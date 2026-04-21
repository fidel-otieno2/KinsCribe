from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.social import Conversation, ConversationParticipant, Message, MessageReaction, Connection
from models.family import Family
import cloudinary
import cloudinary.uploader
import os
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
    return User.query.get(int(get_jwt_identity()))


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
    """Start or get a DM with a user"""
    user = me()
    if user.id == user_id:
        return jsonify({"error": "Cannot message yourself"}), 400

    target = User.query.get(user_id)
    if not target:
        return jsonify({"error": "User not found"}), 404

    try:
        conv = _get_or_create_dm(user.id, user_id)
        return jsonify({"conversation": conv.to_dict(user.id)})
    except Exception as e:
        db.session.rollback()
        print(f"DM error: {e}")
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

    return jsonify({"messages": [m.to_dict() for m in reversed(messages)]})


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

    msg = Message(
        text=data.get("text"),
        media_url=media_url,
        media_type=media_type,
        reply_to_id=data.get("reply_to_id"),
        conversation_id=conv_id,
        sender_id=user.id
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify({"message": msg.to_dict()}), 201


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
    db.session.delete(msg)
    db.session.commit()
    return jsonify({"message": "Deleted"})


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
    return jsonify({"status": status, "last_seen": last_seen.isoformat(), "seconds_ago": int(diff)})


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
