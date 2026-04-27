from flask import Blueprint, request, jsonify
from extensions import db, mail
from models.family import Family, FamilyMember, FamilyInvite
from models.user import User
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_mail import Message
import json, secrets

family_bp = Blueprint("family", __name__)

# In-memory pinned messages store: { family_id: [msg_dict, ...] }
_pinned_store = {}


def current_user():
    return User.query.get(int(get_jwt_identity()))


@family_bp.route("/public/<int:family_id>", methods=["GET"])
@jwt_required()
def family_public(family_id):
    """Return public info about a family. Full details only if the requester is a member."""
    user = current_user()
    family = Family.query.get(family_id)
    if not family:
        return jsonify({"error": "Family not found"}), 404

    # Check membership via join table
    membership = FamilyMember.query.filter_by(user_id=user.id, family_id=family_id).first()
    # Also accept legacy family_id on user
    is_member = bool(membership) or (user.family_id == family_id)

    # Public info — anyone can see
    public_data = {
        "id": family.id,
        "name": family.name,
        "description": family.description,
        "member_count": len(FamilyMember.query.filter_by(family_id=family_id).all()) or len(family.members),
        "created_at": family.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    if not is_member:
        # Non-member: only name, description, member count, created_at
        # Plus first-name + avatar of up to 6 members (no emails, no roles, no invite code)
        fm_list = FamilyMember.query.filter_by(family_id=family_id).limit(6).all()
        preview_members = []
        for fm in fm_list:
            u = User.query.get(fm.user_id)
            if u:
                preview_members.append({
                    "id": u.id,
                    "name": u.name.split()[0],  # first name only
                    "avatar_url": u.avatar_url,
                })
        return jsonify({
            "family": public_data,
            "members": preview_members,
            "is_member": False,
        })

    # Member: full info
    fm_list = FamilyMember.query.filter_by(family_id=family_id).all()
    full_members = []
    for fm in fm_list:
        u = User.query.get(fm.user_id)
        if u:
            d = u.to_dict()
            d["role"] = fm.role
            full_members.append(d)

    full_data = {
        **public_data,
        "invite_code": family.invite_code,
    }

    return jsonify({
        "family": full_data,
        "members": full_members,
        "is_member": True,
    })


@family_bp.route("/create", methods=["POST"])
@jwt_required()
def create_family():
    user = current_user()
    data = request.json
    family = Family(
        name=data["name"],
        description=data.get("description", ""),
        invite_code=Family.generate_invite_code()
    )
    db.session.add(family)
    db.session.flush()

    # Add to join table as admin
    membership = FamilyMember(user_id=user.id, family_id=family.id, role="admin")
    db.session.add(membership)

    # Set as primary family if user has none
    if not user.family_id:
        user.family_id = family.id
        user.role = "admin"

    db.session.commit()
    return jsonify({"family": family.to_dict()}), 201


@family_bp.route("/join", methods=["POST"])
@jwt_required()
def join_family():
    user = current_user()
    code = request.json.get("invite_code")
    family = Family.query.filter_by(invite_code=code).first()
    if not family:
        return jsonify({"error": "Invalid invite code"}), 404

    # Check if already a member of THIS family
    existing = FamilyMember.query.filter_by(user_id=user.id, family_id=family.id).first()
    if existing:
        return jsonify({"error": "You are already a member of this family"}), 400

    # Add to join table
    membership = FamilyMember(user_id=user.id, family_id=family.id, role="member")
    db.session.add(membership)

    # Set as primary family if user has none
    if not user.family_id:
        user.family_id = family.id

    db.session.commit()
    return jsonify({"message": f"Joined {family.name}", "family": family.to_dict()})


@family_bp.route("/invite/email", methods=["POST"])
@jwt_required()
def invite_by_email():
    user = current_user()
    if user.role != "admin":
        return jsonify({"error": "Only admins can send invites"}), 403

    family = Family.query.get(user.family_id)
    email = request.json.get("email")

    try:
        msg = Message("You're invited to join KinsCribe", recipients=[email])
        msg.body = (
            f"You've been invited to join the '{family.name}' family on KinsCribe.\n\n"
            f"Use this invite code: {family.invite_code}\n"
        )
        mail.send(msg)
        return jsonify({"message": f"Invite sent to {email}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@family_bp.route("/my-family", methods=["GET"])
@jwt_required()
def my_family():
    user = current_user()
    # Use family_id param if switching families, else default to primary
    family_id = request.args.get("family_id", user.family_id, type=int)
    if not family_id:
        return jsonify({"error": "You are not in a family yet"}), 404

    # Verify user is actually a member
    membership = FamilyMember.query.filter_by(user_id=user.id, family_id=family_id).first()
    if not membership:
        # Fall back to legacy family_id check
        if user.family_id != family_id:
            return jsonify({"error": "You are not a member of this family"}), 403

    family = Family.query.get(family_id)
    if not family:
        return jsonify({"error": "Family not found"}), 404

    # Get members from join table, fall back to legacy
    fm_list = FamilyMember.query.filter_by(family_id=family_id).all()
    if fm_list:
        members = []
        for fm in fm_list:
            u = User.query.get(fm.user_id)
            if u:
                d = u.to_dict()
                d["role"] = fm.role
                members.append(d)
    else:
        members = [m.to_dict() for m in family.members]

    return jsonify({"family": family.to_dict(), "members": members})


@family_bp.route("/my-families", methods=["GET"])
@jwt_required()
def my_families():
    """Return all families the current user belongs to."""
    user = current_user()
    memberships = FamilyMember.query.filter_by(user_id=user.id).all()
    families = []
    for fm in memberships:
        f = Family.query.get(fm.family_id)
        if f:
            d = f.to_dict()
            d["my_role"] = fm.role
            d["is_primary"] = (f.id == user.family_id)
            families.append(d)
    return jsonify({"families": families})


@family_bp.route("/switch", methods=["POST"])
@jwt_required()
def switch_family():
    """Switch the user's active (primary) family."""
    user = current_user()
    family_id = request.json.get("family_id")
    membership = FamilyMember.query.filter_by(user_id=user.id, family_id=family_id).first()
    if not membership:
        return jsonify({"error": "You are not a member of this family"}), 403
    user.family_id = family_id
    user.role = membership.role
    db.session.commit()
    return jsonify({"message": "Switched family", "family_id": family_id})


@family_bp.route("/leave", methods=["POST"])
@jwt_required()
def leave_family():
    """Leave a specific family."""
    user = current_user()
    family_id = request.json.get("family_id", user.family_id)
    membership = FamilyMember.query.filter_by(user_id=user.id, family_id=family_id).first()
    if not membership:
        return jsonify({"error": "You are not a member of this family"}), 404
    db.session.delete(membership)
    # If leaving primary family, switch to another one if available
    if user.family_id == family_id:
        other = FamilyMember.query.filter(
            FamilyMember.user_id == user.id,
            FamilyMember.family_id != family_id
        ).first()
        user.family_id = other.family_id if other else None
        user.role = other.role if other else "member"
    db.session.commit()
    return jsonify({"message": "Left family"})


@family_bp.route("/members/<int:member_id>/role", methods=["PATCH"])
@jwt_required()
def update_member_role(member_id):
    admin = current_user()
    admin_membership = FamilyMember.query.filter_by(user_id=admin.id, family_id=admin.family_id).first()
    if not admin_membership or admin_membership.role != "admin":
        return jsonify({"error": "Admins only"}), 403

    membership = FamilyMember.query.filter_by(user_id=member_id, family_id=admin.family_id).first()
    if not membership:
        return jsonify({"error": "Member not found in your family"}), 404

    new_role = request.json.get("role", "member")
    membership.role = new_role
    # Keep user.role in sync if this is their primary family
    member = User.query.get(member_id)
    if member and member.family_id == admin.family_id:
        member.role = new_role
    db.session.commit()
    return jsonify({"message": "Role updated"})


@family_bp.route("/members/<int:member_id>", methods=["DELETE"])
@jwt_required()
def remove_member(member_id):
    admin = current_user()
    admin_membership = FamilyMember.query.filter_by(user_id=admin.id, family_id=admin.family_id).first()
    if not admin_membership or admin_membership.role != "admin":
        return jsonify({"error": "Admins only"}), 403

    membership = FamilyMember.query.filter_by(user_id=member_id, family_id=admin.family_id).first()
    if not membership:
        return jsonify({"error": "Member not found"}), 404

    db.session.delete(membership)
    # If this was their primary family, clear it
    member = User.query.get(member_id)
    if member and member.family_id == admin.family_id:
        other = FamilyMember.query.filter(
            FamilyMember.user_id == member_id,
            FamilyMember.family_id != admin.family_id
        ).first()
        member.family_id = other.family_id if other else None
        member.role = other.role if other else "member"
    db.session.commit()
    return jsonify({"message": "Member removed"})


@family_bp.route("/announcements", methods=["GET"])
@jwt_required()
def get_announcements():
    """Get admin-only announcement posts for the family."""
    from models.story import Story
    user = current_user()
    if not user.family_id:
        return jsonify({"announcements": []})
    announcements = Story.query.filter_by(
        family_id=user.family_id, is_announcement=True
    ).order_by(Story.created_at.desc()).limit(20).all()
    return jsonify({"announcements": [s.to_dict() for s in announcements]})


@family_bp.route("/announcements", methods=["POST"])
@jwt_required()
def create_announcement():
    """Admin-only: post a pinned announcement to the family."""
    from models.story import Story
    user = current_user()
    if user.role != "admin":
        return jsonify({"error": "Only admins can post announcements"}), 403
    data = request.get_json() or {}
    if not data.get("title") and not data.get("content"):
        return jsonify({"error": "Title or content required"}), 400
    story = Story(
        title=data.get("title", "Announcement"),
        content=data.get("content", ""),
        privacy="family",
        family_id=user.family_id,
        user_id=user.id,
        is_announcement=True
    )
    db.session.add(story)
    db.session.commit()
    return jsonify({"announcement": story.to_dict()}), 201


# ── Pinned Messages ───────────────────────────────────────────

@family_bp.route("/pinned-messages", methods=["GET"])
@jwt_required()
def get_pinned_messages():
    user = current_user()
    if not user.family_id:
        return jsonify({"pinned": []})
    return jsonify({"pinned": _pinned_store.get(user.family_id, [])})


@family_bp.route("/pinned-messages", methods=["POST"])
@jwt_required()
def pin_message():
    """Admin pins a message to the family room."""
    user = current_user()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    if user.role != "admin":
        return jsonify({"error": "Only admins can pin messages"}), 403
    data = request.get_json() or {}
    msg = {
        "id": data.get("message_id"),
        "text": data.get("text"),
        "sender_name": data.get("sender_name"),
        "pinned_by": user.name,
        "pinned_at": __import__("datetime").datetime.utcnow().isoformat(),
    }
    fid = user.family_id
    if fid not in _pinned_store:
        _pinned_store[fid] = []
    # Keep max 5 pinned messages
    _pinned_store[fid] = [m for m in _pinned_store[fid] if m["id"] != msg["id"]]
    _pinned_store[fid].insert(0, msg)
    _pinned_store[fid] = _pinned_store[fid][:5]
    return jsonify({"pinned": _pinned_store[fid]}), 201


@family_bp.route("/pinned-messages/<int:msg_id>", methods=["DELETE"])
@jwt_required()
def unpin_message(msg_id):
    user = current_user()
    if not user.family_id or user.role != "admin":
        return jsonify({"error": "Admins only"}), 403
    fid = user.family_id
    _pinned_store[fid] = [m for m in _pinned_store.get(fid, []) if m["id"] != msg_id]
    return jsonify({"ok": True})


# ── Family Memories (old photos/videos) ───────────────────────

@family_bp.route("/memories", methods=["GET"])
@jwt_required()
def get_memories():
    """Return family stories that have media (photos/videos) as memories."""
    from models.story import Story
    user = current_user()
    if not user.family_id:
        return jsonify({"memories": []})
    memories = Story.query.filter(
        Story.family_id == user.family_id,
        Story.media_url.isnot(None)
    ).order_by(Story.story_date.desc().nullslast(), Story.created_at.desc()).limit(50).all()
    return jsonify({"memories": [s.to_dict() for s in memories]})


@family_bp.route("/memories", methods=["POST"])
@jwt_required()
def share_memory():
    """Share a memory (old photo/video) to the family room."""
    import cloudinary
    import cloudinary.uploader
    import os
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET")
    )
    from models.story import Story
    user = current_user()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403

    media_url = None
    media_type = None
    if "file" in request.files:
        file = request.files["file"]
        mime = file.content_type or ""
        resource_type = "video" if "video" in mime else "image"
        media_type = "video" if "video" in mime else "image"
        result = cloudinary.uploader.upload(file, resource_type=resource_type, folder="kinscribe/memories")
        media_url = result["secure_url"]

    data = request.form if request.files else request.get_json(force=True, silent=True) or {}
    story_date_str = data.get("story_date")
    story_date = None
    if story_date_str:
        try:
            from datetime import date
            story_date = date.fromisoformat(story_date_str)
        except Exception:
            pass

    story = Story(
        title=data.get("title") or "Family Memory",
        content=data.get("caption") or data.get("content") or "",
        media_url=media_url,
        media_type=media_type,
        story_date=story_date,
        privacy="family",
        family_id=user.family_id,
        user_id=user.id,
    )
    db.session.add(story)
    db.session.commit()
    return jsonify({"memory": story.to_dict()}), 201


# ── Family Profile Editing ────────────────────────────────────

@family_bp.route("/<int:family_id>/update", methods=["PATCH"])
@jwt_required()
def update_family(family_id):
    """Admin/owner: update family identity fields."""
    import cloudinary, cloudinary.uploader, os
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET")
    )
    user = current_user()
    membership = FamilyMember.query.filter_by(user_id=user.id, family_id=family_id).first()
    if not membership or membership.role not in ("admin", "owner"):
        return jsonify({"error": "Admins only"}), 403
    family = Family.query.get_or_404(family_id)

    # Handle multipart (cover/avatar upload) or JSON
    if request.files:
        data = request.form
        if "cover" in request.files:
            result = cloudinary.uploader.upload(request.files["cover"], folder="kinscribe/family_covers")
            family.cover_url = result["secure_url"]
        if "avatar" in request.files:
            result = cloudinary.uploader.upload(request.files["avatar"], folder="kinscribe/family_avatars")
            family.avatar_url = result["secure_url"]
    else:
        data = request.get_json(force=True, silent=True) or {}

    for field in ("name", "description", "motto", "username", "theme_color", "privacy"):
        if field in data and data[field] is not None:
            setattr(family, field, data[field])

    # Permissions JSON blob
    if "permissions" in data:
        family.permissions = json.dumps(data["permissions"])

    db.session.commit()
    return jsonify({"family": family.to_dict()})


@family_bp.route("/<int:family_id>/insights", methods=["GET"])
@jwt_required()
def family_insights(family_id):
    """Return activity insights for a family (members only)."""
    from models.story import Story, Like, Comment
    user = current_user()
    membership = FamilyMember.query.filter_by(user_id=user.id, family_id=family_id).first()
    if not membership and user.family_id != family_id:
        return jsonify({"error": "Access denied"}), 403

    members = FamilyMember.query.filter_by(family_id=family_id).all()
    stories = Story.query.filter_by(family_id=family_id).all()
    story_ids = [s.id for s in stories]

    total_likes = Like.query.filter(Like.story_id.in_(story_ids)).count() if story_ids else 0
    total_comments = Comment.query.filter(Comment.story_id.in_(story_ids)).count() if story_ids else 0

    # Per-member post count for leaderboard
    leaderboard = []
    for fm in members:
        u = User.query.get(fm.user_id)
        if not u:
            continue
        count = Story.query.filter_by(user_id=fm.user_id, family_id=family_id).count()
        leaderboard.append({"id": u.id, "name": u.name, "avatar_url": u.avatar_url, "post_count": count, "role": fm.role})
    leaderboard.sort(key=lambda x: x["post_count"], reverse=True)

    return jsonify({
        "total_members": len(members),
        "total_stories": len(stories),
        "total_likes": total_likes,
        "total_comments": total_comments,
        "leaderboard": leaderboard[:10],
    })


@family_bp.route("/<int:family_id>/transfer", methods=["POST"])
@jwt_required()
def transfer_ownership(family_id):
    """Transfer ownership to another member (current owner only)."""
    user = current_user()
    my_membership = FamilyMember.query.filter_by(user_id=user.id, family_id=family_id).first()
    if not my_membership or my_membership.role != "admin":
        return jsonify({"error": "Only the current admin/owner can transfer"}), 403
    new_owner_id = request.json.get("user_id")
    target = FamilyMember.query.filter_by(user_id=new_owner_id, family_id=family_id).first()
    if not target:
        return jsonify({"error": "User is not a member"}), 404
    target.role = "admin"
    my_membership.role = "member"
    # Sync user.role
    new_owner = User.query.get(new_owner_id)
    if new_owner and new_owner.family_id == family_id:
        new_owner.role = "admin"
    if user.family_id == family_id:
        user.role = "member"
    db.session.commit()
    return jsonify({"message": "Ownership transferred"})


@family_bp.route("/<int:family_id>/delete", methods=["DELETE"])
@jwt_required()
def delete_family(family_id):
    """Owner-only: permanently delete the family."""
    user = current_user()
    my_membership = FamilyMember.query.filter_by(user_id=user.id, family_id=family_id).first()
    if not my_membership or my_membership.role != "admin":
        return jsonify({"error": "Only the admin/owner can delete this family"}), 403
    family = Family.query.get_or_404(family_id)
    # Clear family_id on all members
    for fm in FamilyMember.query.filter_by(family_id=family_id).all():
        u = User.query.get(fm.user_id)
        if u and u.family_id == family_id:
            u.family_id = None
            u.role = "member"
    db.session.delete(family)
    db.session.commit()
    return jsonify({"message": "Family deleted"})


@family_bp.route("/<int:family_id>/regenerate-code", methods=["POST"])
@jwt_required()
def regenerate_invite_code(family_id):
    """Admin: generate a new invite code."""
    user = current_user()
    membership = FamilyMember.query.filter_by(user_id=user.id, family_id=family_id).first()
    if not membership or membership.role != "admin":
        return jsonify({"error": "Admins only"}), 403
    family = Family.query.get_or_404(family_id)
    family.invite_code = Family.generate_invite_code()
    db.session.commit()
    return jsonify({"invite_code": family.invite_code})


@family_bp.route("/<int:family_id>/members", methods=["GET"])
@jwt_required()
def get_family_members(family_id):
    """Get full member list for a specific family (members only)."""
    user = current_user()
    membership = FamilyMember.query.filter_by(user_id=user.id, family_id=family_id).first()
    if not membership and user.family_id != family_id:
        return jsonify({"error": "Access denied"}), 403
    fm_list = FamilyMember.query.filter_by(family_id=family_id).all()
    members = []
    for fm in fm_list:
        u = User.query.get(fm.user_id)
        if u:
            d = u.to_dict()
            d["role"] = fm.role
            d["joined_at"] = fm.joined_at.isoformat() if fm.joined_at else None
            members.append(d)
    return jsonify({"members": members})


@family_bp.route("/<int:family_id>/members/<int:member_id>/role", methods=["PATCH"])
@jwt_required()
def update_member_role_v2(member_id, family_id):
    """Admin: update a member's role in a specific family."""
    admin = current_user()
    admin_membership = FamilyMember.query.filter_by(user_id=admin.id, family_id=family_id).first()
    if not admin_membership or admin_membership.role != "admin":
        return jsonify({"error": "Admins only"}), 403
    membership = FamilyMember.query.filter_by(user_id=member_id, family_id=family_id).first()
    if not membership:
        return jsonify({"error": "Member not found"}), 404
    new_role = request.json.get("role", "member")
    membership.role = new_role
    member = User.query.get(member_id)
    if member and member.family_id == family_id:
        member.role = new_role
    db.session.commit()
    return jsonify({"message": "Role updated", "role": new_role})


@family_bp.route("/<int:family_id>/members/<int:member_id>", methods=["DELETE"])
@jwt_required()
def remove_member_v2(member_id, family_id):
    """Admin: remove a member from a specific family."""
    admin = current_user()
    admin_membership = FamilyMember.query.filter_by(user_id=admin.id, family_id=family_id).first()
    if not admin_membership or admin_membership.role != "admin":
        return jsonify({"error": "Admins only"}), 403
    membership = FamilyMember.query.filter_by(user_id=member_id, family_id=family_id).first()
    if not membership:
        return jsonify({"error": "Member not found"}), 404
    db.session.delete(membership)
    member = User.query.get(member_id)
    if member and member.family_id == family_id:
        other = FamilyMember.query.filter(
            FamilyMember.user_id == member_id,
            FamilyMember.family_id != family_id
        ).first()
        member.family_id = other.family_id if other else None
        member.role = other.role if other else "member"
    db.session.commit()
    return jsonify({"message": "Member removed"})


@family_bp.route("/user/<int:user_id>/groups", methods=["GET"])
@jwt_required()
def user_groups(user_id):
    """Return admin_groups and member_groups for any user using the FamilyMember join table."""
    target = User.query.get_or_404(user_id)
    admin_groups = []
    member_groups = []
    memberships = FamilyMember.query.filter_by(user_id=target.id).all()
    for fm in memberships:
        f = Family.query.get(fm.family_id)
        if not f:
            continue
        entry = {
            "id": f.id,
            "name": f.name,
            "cover_url": f.cover_url,
            "member_count": FamilyMember.query.filter_by(family_id=f.id).count(),
        }
        if fm.role == "admin":
            admin_groups.append(entry)
        else:
            member_groups.append(entry)
    return jsonify({"admin_groups": admin_groups, "member_groups": member_groups})


# ── User-to-User Family Invitations ──────────────────────────

@family_bp.route("/invite/send", methods=["POST"])
@jwt_required()
def send_family_invite():
    """Send a family invite to a specific user by user_id."""
    from models.social import Message as DM, Conversation, ConversationParticipant
    from models.notifications import Notification

    sender = current_user()
    data = request.get_json(force=True, silent=True) or {}
    to_user_id = data.get("user_id")
    if not to_user_id:
        return jsonify({"error": "user_id required"}), 400

    if not sender.family_id:
        return jsonify({"error": "You are not in a family"}), 400

    membership = FamilyMember.query.filter_by(user_id=sender.id, family_id=sender.family_id).first()
    if not membership or membership.role not in ("owner", "admin"):
        return jsonify({"error": "Only owners and admins can invite"}), 403

    target = User.query.get(to_user_id)
    if not target:
        return jsonify({"error": "User not found"}), 404

    # Check already a member
    already = FamilyMember.query.filter_by(user_id=to_user_id, family_id=sender.family_id).first()
    if already:
        return jsonify({"error": "User is already a member"}), 400

    # Check pending invite already exists
    existing = FamilyInvite.query.filter_by(
        invited_user_id=to_user_id, family_id=sender.family_id, status="pending"
    ).first()
    if existing:
        return jsonify({"error": "Invite already sent"}), 400

    family = Family.query.get(sender.family_id)
    token = secrets.token_urlsafe(32)

    invite = FamilyInvite(
        family_id=sender.family_id,
        invited_by=sender.id,
        invited_user_id=to_user_id,
        token=token,
    )
    db.session.add(invite)

    # Send DM
    try:
        a_convs = {p.conversation_id for p in ConversationParticipant.query.filter_by(user_id=sender.id).all()}
        b_convs = {p.conversation_id for p in ConversationParticipant.query.filter_by(user_id=to_user_id).all()}
        shared = a_convs & b_convs
        conv = None
        for cid in shared:
            c = Conversation.query.get(cid)
            if c and c.type == "dm":
                conv = c
                break
        if not conv:
            conv = Conversation(type="dm")
            db.session.add(conv)
            db.session.flush()
            db.session.add(ConversationParticipant(conversation_id=conv.id, user_id=sender.id))
            db.session.add(ConversationParticipant(conversation_id=conv.id, user_id=to_user_id))

        msg_text = f"👨‍👩‍👧 {sender.name} invited you to join the **{family.name}** family on KinsCribe! Tap to accept or decline."
        dm = DM(text=msg_text, conversation_id=conv.id, sender_id=sender.id,
                media_type="family_invite", media_url=token)
        db.session.add(dm)
    except Exception:
        pass

    # Send notification
    db.session.add(Notification(
        user_id=to_user_id,
        from_user_id=sender.id,
        type="family_invite",
        title=f"{sender.name} invited you to join {family.name}",
        message=f"Tap to accept or decline the family invitation.",
        data=json.dumps({"token": token, "family_id": sender.family_id,
                         "family_name": family.name, "family_avatar": family.avatar_url}),
    ))

    db.session.commit()
    return jsonify({"message": "Invite sent", "token": token}), 201


@family_bp.route("/invite/<token>/accept", methods=["POST"])
@jwt_required()
def accept_family_invite(token):
    user = current_user()
    invite = FamilyInvite.query.filter_by(token=token, invited_user_id=user.id, status="pending").first()
    if not invite:
        return jsonify({"error": "Invalid or expired invite"}), 404

    family = Family.query.get(invite.family_id)
    if not family:
        return jsonify({"error": "Family not found"}), 404

    # Add as member
    existing = FamilyMember.query.filter_by(user_id=user.id, family_id=family.id).first()
    if not existing:
        db.session.add(FamilyMember(user_id=user.id, family_id=family.id, role="member"))
    if not user.family_id:
        user.family_id = family.id

    invite.status = "accepted"

    # Notify inviter
    from models.notifications import Notification
    db.session.add(Notification(
        user_id=invite.invited_by,
        from_user_id=user.id,
        type="family_invite_accepted",
        title=f"{user.name} accepted your family invitation!",
        message=f"{user.name} has joined {family.name}.",
        data=json.dumps({"family_id": family.id}),
    ))

    db.session.commit()
    return jsonify({"message": "Joined family", "family": family.to_dict()}), 200


@family_bp.route("/invite/<token>/decline", methods=["POST"])
@jwt_required()
def decline_family_invite(token):
    user = current_user()
    invite = FamilyInvite.query.filter_by(token=token, invited_user_id=user.id, status="pending").first()
    if not invite:
        return jsonify({"error": "Invalid or expired invite"}), 404
    invite.status = "declined"
    db.session.commit()
    return jsonify({"message": "Invite declined"}), 200
