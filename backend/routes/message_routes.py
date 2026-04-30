from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.social import (
    Conversation, ConversationParticipant, Message, MessageReaction,
    Connection, ConversationSettings, MessageRequest, MessagePoll, MessagePollVote
)
from models.family import Family
import cloudinary
import cloudinary.uploader
import os
import json
from datetime import datetime, timedelta

message_bp = Blueprint("messages", __name__)

# In-memory stores for typing indicators and presence
# { conversation_id: { user_id: expires_at } }
_typing_store = {}
# { user_id: last_seen_at (datetime) }
_presence_store = {}

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)


def me():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return None
    return user


def _get_or_create_dm(user_a, user_b):
    """Get existing DM conversation or create one"""
    # Find a private conversation both users are in
    a_convs = {p.conversation_id for p in ConversationParticipant.query.filter_by(user_id=user_a).all()}
    b_convs = {p.conversation_id for p in ConversationParticipant.query.filter_by(user_id=user_b).all()}
    shared = a_convs & b_convs

    for conv_id in shared:
        conv = Conversation.query.get(conv_id)
        if conv and conv.type == "private":
            return conv

    # Create new DM
    conv = Conversation(type="private")
    db.session.add(conv)
    db.session.flush()
    db.session.add(ConversationParticipant(conversation_id=conv.id, user_id=user_a))
    db.session.add(ConversationParticipant(conversation_id=conv.id, user_id=user_b))
    db.session.commit()
    return conv


def _get_or_create_family_chat(family_id):
    """Get or create the family group conversation"""
    conv = Conversation.query.filter_by(type="family", family_id=family_id).first()
    if conv:
        return conv

    family = Family.query.get(family_id)
    if not family:
        return None

    conv = Conversation(type="family", family_id=family_id)
    db.session.add(conv)
    db.session.flush()

    for member in family.members:
        db.session.add(ConversationParticipant(conversation_id=conv.id, user_id=member.id))

    db.session.commit()
    return conv


# ── Conversations ─────────────────────────────────────────────

@message_bp.route("/conversations", methods=["GET"])
@jwt_required()
def get_conversations():
    user = me()
    if not user:
        return jsonify({"error": "User not found"}), 404
    parts = ConversationParticipant.query.filter_by(user_id=user.id).all()
    convs = []
    for p in parts:
        conv = Conversation.query.get(p.conversation_id)
        if conv:
            convs.append(conv.to_dict(user.id))
    # Sort by last message time
    convs.sort(key=lambda c: c["last_message"]["created_at"] if c["last_message"] else c["created_at"], reverse=True)
    return jsonify({"conversations": convs})


@message_bp.route("/dm/<int:user_id>", methods=["POST"])
@jwt_required()
def start_dm(user_id):
    """Start or get a DM with a user. Creates a message request if not connected."""
    user = me()
    if user.id == user_id:
        return jsonify({"error": "Cannot message yourself"}), 400

    target = User.query.get(user_id)
    if not target:
        return jsonify({"error": "User not found"}), 404

    try:
        conv = _get_or_create_dm(user.id, user_id)

        # Check if they are connected
        is_connected = Connection.query.filter_by(
            follower_id=user.id, following_id=user_id, status="accepted"
        ).first() or Connection.query.filter_by(
            follower_id=user_id, following_id=user.id, status="accepted"
        ).first()

        # If not connected and target doesn't allow open DMs, create a request
        if not is_connected and not target.allow_dms:
            existing_req = MessageRequest.query.filter_by(
                sender_id=user.id, receiver_id=user_id
            ).first()
            if not existing_req:
                req = MessageRequest(
                    sender_id=user.id, receiver_id=user_id,
                    conversation_id=conv.id, status="pending"
                )
                db.session.add(req)
                db.session.commit()
            return jsonify({"conversation": conv.to_dict(user.id), "is_request": True})

        return jsonify({"conversation": conv.to_dict(user.id), "is_request": False})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@message_bp.route("/family", methods=["GET"])
@jwt_required()
def get_family_chat():
    user = me()
    if not user.family_id:
        return jsonify({"error": "You are not in a family"}), 403
    conv = _get_or_create_family_chat(user.family_id)
    return jsonify({"conversation": conv.to_dict(user.id)})


# ── Messages ──────────────────────────────────────────────────

@message_bp.route("/conversations/<int:conv_id>/messages", methods=["GET"])
@jwt_required()
def get_messages(conv_id):
    user = me()
    # Verify user is participant
    part = ConversationParticipant.query.filter_by(
        conversation_id=conv_id, user_id=user.id
    ).first()
    if not part:
        return jsonify({"error": "Access denied"}), 403

    page = request.args.get("page", 1, type=int)
    per_page = 30
    messages = Message.query.filter_by(conversation_id=conv_id)\
        .order_by(Message.created_at.desc())\
        .offset((page - 1) * per_page).limit(per_page).all()

    # Mark messages as read
    Message.query.filter(
        Message.conversation_id == conv_id,
        Message.sender_id != user.id,
        Message.is_read == False
    ).update({"is_read": True})
    db.session.commit()

    return jsonify({"messages": [m.to_dict(user.id) for m in reversed(messages)]})


@message_bp.route("/conversations/<int:conv_id>/messages", methods=["POST"])
@jwt_required()
def send_message(conv_id):
    user = me()
    part = ConversationParticipant.query.filter_by(
        conversation_id=conv_id, user_id=user.id
    ).first()
    if not part:
        return jsonify({"error": "Access denied"}), 403

    media_url = None
    media_type = None

    if "file" in request.files:
        file = request.files["file"]
        mime = file.content_type or ""
        resource_type = "video" if "video" in mime else "raw" if "audio" in mime else "image"
        media_type = "video" if "video" in mime else "audio" if "audio" in mime else "image"
        result = cloudinary.uploader.upload(file, resource_type=resource_type, folder="kinscribe/messages")
        media_url = result["secure_url"]

    data = request.form if request.files else request.get_json(force=True, silent=True) or {}

    # Handle GIF (no upload needed, just store URL)
    if data.get("gif_url") or (data.get("media_type") == "gif" and data.get("media_url")):
        media_url = data.get("gif_url") or data.get("media_url")
        media_type = "gif"

    # Parse mentions
    mentions_raw = data.get("mentions", "[]")
    if isinstance(mentions_raw, str):
        try: mentions_list = json.loads(mentions_raw)
        except: mentions_list = []
    else:
        mentions_list = mentions_raw or []

    msg = Message(
        text=data.get("text"),
        media_url=media_url,
        media_type=media_type,
        reply_to_id=data.get("reply_to_id"),
        forwarded_from_id=data.get("forwarded_from_id"),
        mentions=json.dumps(mentions_list) if mentions_list else None,
        conversation_id=conv_id,
        sender_id=user.id
    )
    db.session.add(msg)
    db.session.flush()

    # Save message_type if provided (call_started / call_ended)
    msg_type = data.get("message_type", "text")
    if msg_type and msg_type != "text":
        try:
            from sqlalchemy import text as sqlt
            db.session.execute(
                sqlt("UPDATE messages SET message_type = :t WHERE id = :id"),
                {"t": msg_type, "id": msg.id}
            )
        except Exception:
            pass

    # Handle poll
    poll_data = data.get("poll")
    if poll_data:
        if isinstance(poll_data, str):
            try: poll_data = json.loads(poll_data)
            except: poll_data = None
        if poll_data and poll_data.get("question") and poll_data.get("options"):
            poll = MessagePoll(
                message_id=msg.id,
                question=poll_data["question"],
                options=json.dumps(poll_data["options"])
            )
            db.session.add(poll)

    db.session.commit()

    # ── Fire mention notifications ────────────────────────────
    text_body = data.get("text") or ""
    if mentions_list or "@" in text_body:
        # Also parse @username from text if mentions_list not provided
        if not mentions_list:
            import re
            usernames = re.findall(r'@(\w+)', text_body)
            for uname in set(usernames):
                mentioned = User.query.filter(
                    (User.username == uname) | (User.name == uname)
                ).first()
                if mentioned and mentioned.id != user.id:
                    mentions_list.append(mentioned.id)
        for uid in set(mentions_list):
            if uid != user.id:
                # Store mention notification in a simple in-memory store
                # (notification_routes reads from _mention_store)
                from routes.notification_routes import _mention_store
                _mention_store.setdefault(uid, []).append({
                    "id": f"mention-{msg.id}-{uid}",
                    "type": "mention",
                    "source": "message",
                    "actor_name": user.name,
                    "actor_avatar": user.avatar_url,
                    "actor_id": user.id,
                    "title": f"{user.name} mentioned you in a message",
                    "body": text_body[:80],
                    "conversation_id": conv_id,
                    "created_at": msg.created_at.strftime('%Y-%m-%dT%H:%M:%SZ'),
                })

    return jsonify({"message": msg.to_dict(user.id)}), 201


@message_bp.route("/messages/<int:msg_id>/react", methods=["POST"])
@jwt_required()
def react_to_message(msg_id):
    user = me()
    emoji = request.json.get("emoji", "")
    if not emoji:
        return jsonify({"error": "Emoji required"}), 400

    existing = MessageReaction.query.filter_by(user_id=user.id, message_id=msg_id).first()
    if existing:
        if existing.emoji == emoji:
            db.session.delete(existing)
            db.session.commit()
            return jsonify({"removed": True})
        existing.emoji = emoji
        db.session.commit()
        return jsonify({"reaction": existing.to_dict()})

    reaction = MessageReaction(emoji=emoji, user_id=user.id, message_id=msg_id)
    db.session.add(reaction)
    db.session.commit()
    return jsonify({"reaction": reaction.to_dict()})


@message_bp.route("/messages/<int:msg_id>", methods=["DELETE"])
@jwt_required()
def delete_message(msg_id):
    user = me()
    msg = Message.query.get_or_404(msg_id)
    if msg.sender_id != user.id:
        return jsonify({"error": "Not authorized"}), 403
    scope = request.args.get("scope", "me")  # me | everyone
    if scope == "everyone":
        # Verify user is still a participant in the conversation
        part = ConversationParticipant.query.filter_by(
            conversation_id=msg.conversation_id, user_id=user.id
        ).first()
        if not part:
            return jsonify({"error": "Not authorized"}), 403
        db.session.delete(msg)
    else:
        db.session.delete(msg)
    db.session.commit()
    return jsonify({"deleted": True, "scope": scope, "msg_id": msg_id})


@message_bp.route("/presence/ping", methods=["POST"])
@jwt_required()
def presence_ping():
    """Update user's last seen timestamp"""
    user_id = int(get_jwt_identity())
    _presence_store[user_id] = datetime.utcnow()
    return jsonify({"ok": True})


@message_bp.route("/presence/<int:user_id>", methods=["GET"])
@jwt_required()
def get_presence(user_id):
    """Get a user's online status"""
    last_seen = _presence_store.get(user_id)
    if not last_seen:
        return jsonify({"status": "offline", "last_seen": None})
    diff = (datetime.utcnow() - last_seen).total_seconds()
    if diff < 60:
        status = "online"
    elif diff < 300:
        status = "recently"
    else:
        status = "offline"
    return jsonify({"status": status, "last_seen": last_seen.strftime('%Y-%m-%dT%H:%M:%SZ'), "seconds_ago": int(diff)})


@message_bp.route("/conversations/<int:conv_id>/typing", methods=["POST"])
@jwt_required()
def set_typing(conv_id):
    """Signal that current user is typing in a conversation"""
    user_id = int(get_jwt_identity())
    is_typing = request.json.get("typing", True)
    if conv_id not in _typing_store:
        _typing_store[conv_id] = {}
    if is_typing:
        _typing_store[conv_id][user_id] = datetime.utcnow() + timedelta(seconds=5)
    else:
        _typing_store[conv_id].pop(user_id, None)
    return jsonify({"ok": True})


@message_bp.route("/conversations/<int:conv_id>/typing", methods=["GET"])
@jwt_required()
def get_typing(conv_id):
    """Get who is currently typing in a conversation"""
    current_user_id = int(get_jwt_identity())
    now = datetime.utcnow()
    typers = _typing_store.get(conv_id, {})
    # Clean expired + exclude self
    active = [uid for uid, exp in typers.items() if exp > now and uid != current_user_id]
    names = []
    for uid in active:
        u = User.query.get(uid)
        if u:
            names.append(u.name.split()[0])
    return jsonify({"typing": active, "names": names})


@message_bp.route("/conversations/<int:conv_id>/members", methods=["POST"])
@jwt_required()
def add_family_member(conv_id):
    """Add a new family member to the family chat when they join"""
    user_id = request.json.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    existing = ConversationParticipant.query.filter_by(
        conversation_id=conv_id, user_id=user_id
    ).first()
    if not existing:
        db.session.add(ConversationParticipant(conversation_id=conv_id, user_id=user_id))
        db.session.commit()
    return jsonify({"message": "Added"})


@message_bp.route("/conversations/<int:conv_id>/pin", methods=["POST"])
@jwt_required()
def pin_message(conv_id):
    """Pin or unpin a message in a family conversation."""
    from sqlalchemy import text
    msg_id = (request.json or {}).get("message_id")
    try:
        # Get current pinned
        result = db.session.execute(text("SELECT pinned_message_id FROM conversations WHERE id = :id"), {"id": conv_id})
        current = result.scalar()
        new_id = None if current == msg_id else msg_id
        db.session.execute(text("UPDATE conversations SET pinned_message_id = :pid WHERE id = :id"), {"pid": new_id, "id": conv_id})
        db.session.commit()
        return jsonify({"pinned_message_id": new_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@message_bp.route("/conversations/<int:conv_id>/participants", methods=["GET"])
@jwt_required()
def get_participants(conv_id):
    """Return all participants in a conversation for @mention autocomplete"""
    user = me()
    part = ConversationParticipant.query.filter_by(
        conversation_id=conv_id, user_id=user.id
    ).first()
    if not part:
        return jsonify({"error": "Access denied"}), 403
    participants = ConversationParticipant.query.filter_by(conversation_id=conv_id).all()
    result = []
    for p in participants:
        u = User.query.get(p.user_id)
        if u:
            result.append({"id": u.id, "name": u.name, "username": u.username, "avatar": u.avatar_url})
    return jsonify({"participants": result})


# ── Conversation Settings (pin / mute / archive) ──────────────

@message_bp.route("/conversations/<int:conv_id>/settings", methods=["GET"])
@jwt_required()
def get_conv_settings(conv_id):
    user = me()
    s = ConversationSettings.query.filter_by(user_id=user.id, conversation_id=conv_id).first()
    if not s:
        return jsonify({"is_pinned": False, "is_muted": False, "is_archived": False})
    return jsonify(s.to_dict())


@message_bp.route("/conversations/<int:conv_id>/settings", methods=["PATCH"])
@jwt_required()
def update_conv_settings(conv_id):
    user = me()
    data = request.get_json(force=True, silent=True) or {}
    s = ConversationSettings.query.filter_by(user_id=user.id, conversation_id=conv_id).first()
    if not s:
        s = ConversationSettings(user_id=user.id, conversation_id=conv_id)
        db.session.add(s)
    if "is_pinned" in data:
        s.is_pinned = data["is_pinned"]
    if "is_muted" in data:
        s.is_muted = data["is_muted"]
    if "is_archived" in data:
        s.is_archived = data["is_archived"]
    db.session.commit()
    return jsonify(s.to_dict())


@message_bp.route("/conversations/settings/all", methods=["GET"])
@jwt_required()
def get_all_conv_settings():
    """Return all conversation settings for the current user as a dict keyed by conv_id."""
    user = me()
    settings = ConversationSettings.query.filter_by(user_id=user.id).all()
    return jsonify({str(s.conversation_id): s.to_dict() for s in settings})


# ── Message Search ────────────────────────────────────────────

@message_bp.route("/conversations/<int:conv_id>/search", methods=["GET"])
@jwt_required()
def search_messages(conv_id):
    user = me()
    part = ConversationParticipant.query.filter_by(
        conversation_id=conv_id, user_id=user.id
    ).first()
    if not part:
        return jsonify({"error": "Access denied"}), 403
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"messages": []})
    results = Message.query.filter(
        Message.conversation_id == conv_id,
        Message.text.ilike(f"%{q}%")
    ).order_by(Message.created_at.desc()).limit(30).all()
    return jsonify({"messages": [m.to_dict(user.id) for m in results]})


# ── Forward Message ───────────────────────────────────────────

@message_bp.route("/messages/<int:msg_id>/forward", methods=["POST"])
@jwt_required()
def forward_message(msg_id):
    user = me()
    data = request.get_json(force=True, silent=True) or {}
    target_conv_ids = data.get("conversation_ids", [])
    if not target_conv_ids:
        return jsonify({"error": "conversation_ids required"}), 400

    original = Message.query.get_or_404(msg_id)
    forwarded = []
    for cid in target_conv_ids:
        part = ConversationParticipant.query.filter_by(
            conversation_id=cid, user_id=user.id
        ).first()
        if not part:
            continue
        msg = Message(
            text=original.text,
            media_url=original.media_url,
            media_type=original.media_type,
            forwarded_from_id=original.id,
            conversation_id=cid,
            sender_id=user.id
        )
        db.session.add(msg)
        forwarded.append(cid)
    db.session.commit()
    return jsonify({"forwarded_to": forwarded})


# ── Quick Send (story reply / one-shot DM) ───────────────────

@message_bp.route("/send", methods=["POST"])
@jwt_required()
def quick_send():
    """Send a message to a user by user_id — creates DM if needed.
    Used by story replies and reactions."""
    user = me()
    data = request.get_json(force=True, silent=True) or {}
    to_user_id = data.get("to_user_id")
    text = data.get("text", "").strip()
    if not to_user_id:
        return jsonify({"error": "to_user_id required"}), 400
    if not text:
        return jsonify({"error": "text required"}), 400
    if user.id == to_user_id:
        return jsonify({"error": "Cannot message yourself"}), 400
    target = User.query.get(to_user_id)
    if not target:
        return jsonify({"error": "User not found"}), 404
    try:
        conv = _get_or_create_dm(user.id, to_user_id)
        msg = Message(
            text=text,
            conversation_id=conv.id,
            sender_id=user.id
        )
        db.session.add(msg)
        db.session.commit()
        return jsonify({"message": msg.to_dict(user.id), "conversation_id": conv.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── Message Requests ──────────────────────────────────────────

@message_bp.route("/requests", methods=["GET"])
@jwt_required()
def get_message_requests():
    user = me()
    reqs = MessageRequest.query.filter_by(receiver_id=user.id, status="pending").all()
    return jsonify({"requests": [r.to_dict() for r in reqs]})


@message_bp.route("/requests/<int:req_id>", methods=["PATCH"])
@jwt_required()
def respond_to_request(req_id):
    user = me()
    req = MessageRequest.query.get_or_404(req_id)
    if req.receiver_id != user.id:
        return jsonify({"error": "Not authorized"}), 403
    action = request.json.get("action")  # accept | decline
    if action == "accept":
        req.status = "accepted"
    elif action == "decline":
        req.status = "declined"
    else:
        return jsonify({"error": "action must be accept or decline"}), 400
    db.session.commit()
    return jsonify({"request": req.to_dict()})


# ── Polls ─────────────────────────────────────────────────────

@message_bp.route("/polls/<int:poll_id>/vote", methods=["POST"])
@jwt_required()
def vote_poll(poll_id):
    user = me()
    poll = MessagePoll.query.get_or_404(poll_id)
    option_index = request.json.get("option_index")
    if option_index is None:
        return jsonify({"error": "option_index required"}), 400
    existing = MessagePollVote.query.filter_by(poll_id=poll_id, user_id=user.id).first()
    if existing:
        existing.option_index = option_index
    else:
        db.session.add(MessagePollVote(poll_id=poll_id, user_id=user.id, option_index=option_index))
    db.session.commit()
    return jsonify({"poll": poll.to_dict(user.id)})
