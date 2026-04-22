from flask import Blueprint, request, jsonify
from extensions import db, mail
from models.family import Family
from models.user import User
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_mail import Message
import json

family_bp = Blueprint("family", __name__)

# In-memory pinned messages store: { family_id: [msg_dict, ...] }
_pinned_store = {}


def current_user():
    return User.query.get(int(get_jwt_identity()))


@family_bp.route("/create", methods=["POST"])
@jwt_required()
def create_family():
    user = current_user()
    if user.family_id:
        return jsonify({"error": "You already belong to a family"}), 400

    data = request.json
    family = Family(
        name=data["name"],
        description=data.get("description", ""),
        invite_code=Family.generate_invite_code()
    )
    db.session.add(family)
    db.session.flush()

    user.family_id = family.id
    user.role = "admin"
    db.session.commit()

    return jsonify({"family": family.to_dict()}), 201


@family_bp.route("/join", methods=["POST"])
@jwt_required()
def join_family():
    user = current_user()
    if user.family_id:
        return jsonify({"error": "You already belong to a family"}), 400

    code = request.json.get("invite_code")
    family = Family.query.filter_by(invite_code=code).first()
    if not family:
        return jsonify({"error": "Invalid invite code"}), 404

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
    if not user.family_id:
        return jsonify({"error": "You are not in a family yet"}), 404

    family = Family.query.get(user.family_id)
    members = [m.to_dict() for m in family.members]
    return jsonify({"family": family.to_dict(), "members": members})


@family_bp.route("/members/<int:member_id>/role", methods=["PATCH"])
@jwt_required()
def update_member_role(member_id):
    admin = current_user()
    if admin.role != "admin":
        return jsonify({"error": "Admins only"}), 403

    member = User.query.get(member_id)
    if not member or member.family_id != admin.family_id:
        return jsonify({"error": "Member not found in your family"}), 404

    member.role = request.json.get("role", "member")
    db.session.commit()
    return jsonify({"message": "Role updated", "user": member.to_dict()})


@family_bp.route("/members/<int:member_id>", methods=["DELETE"])
@jwt_required()
def remove_member(member_id):
    admin = current_user()
    if admin.role != "admin":
        return jsonify({"error": "Admins only"}), 403

    member = User.query.get(member_id)
    if not member or member.family_id != admin.family_id:
        return jsonify({"error": "Member not found"}), 404

    member.family_id = None
    member.role = "member"
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
