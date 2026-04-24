import os
import time
import hmac
import hashlib
import struct
import base64
import random
import string
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.social import ConversationParticipant
from datetime import datetime, timedelta
from sqlalchemy import text

call_bp = Blueprint("calls", __name__)

AGORA_APP_ID = os.getenv("AGORA_APP_ID", "339b4c69704b45298cc7e2a441aa4aa9")
AGORA_APP_CERT = os.getenv("AGORA_APP_CERTIFICATE", "")

PRIVILEGES = {
    "join_channel": 1,
    "publish_audio": 2,
    "publish_video": 3,
    "publish_data": 4,
}


def me():
    return User.query.get(int(get_jwt_identity()))


# ── Agora Token Builder (pure Python, no external lib) ────────

def _pack_uint16(v): return struct.pack("<H", v)
def _pack_uint32(v): return struct.pack("<I", v)
def _pack_string(s):
    if isinstance(s, str): s = s.encode("utf-8")
    return _pack_uint16(len(s)) + s
def _pack_map_uint32(m):
    out = _pack_uint16(len(m))
    for k, v in sorted(m.items()):
        out += _pack_uint16(k) + _pack_uint32(v)
    return out


def build_agora_token(channel: str, uid: int, expire: int = 3600) -> str:
    if not AGORA_APP_CERT:
        return ""  # Testing mode — no token needed
    ts_now = int(time.time())
    ts_exp = ts_now + expire
    salt = random.randint(1, 0xFFFFFFFF)
    privs = {v: ts_exp for v in PRIVILEGES.values()}
    msg = (
        _pack_string(AGORA_APP_ID)
        + _pack_string(str(uid))
        + _pack_string(channel)
        + _pack_uint32(salt)
        + _pack_uint32(ts_now)
        + _pack_map_uint32(privs)
    )
    sig = hmac.new(AGORA_APP_CERT.encode(), msg, hashlib.sha256).digest()
    content = (
        _pack_string(sig)
        + _pack_string(AGORA_APP_ID)
        + _pack_uint32(ts_now)
        + _pack_uint32(salt)
        + _pack_map_uint32(privs)
    )
    return "006" + AGORA_APP_ID + base64.b64encode(content).decode()


def _rand_channel():
    return "kc_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=12))


# ── DB helpers (raw SQL so no new model file needed) ──────────

def _create_call(channel, caller_id, callee_id, call_type, conversation_id):
    db.session.execute(text("""
        INSERT INTO active_calls
            (channel, caller_id, callee_id, call_type, conversation_id, state, created_at)
        VALUES
            (:ch, :caller, :callee, :ctype, :conv, 'ringing', NOW())
        ON CONFLICT (channel) DO NOTHING
    """), dict(ch=channel, caller=caller_id, callee=callee_id,
               ctype=call_type, conv=conversation_id))
    db.session.commit()


def _update_call_state(channel, state):
    db.session.execute(text(
        "UPDATE active_calls SET state = :s WHERE channel = :ch"
    ), dict(s=state, ch=channel))
    db.session.commit()


def _get_call(channel):
    r = db.session.execute(
        text("SELECT * FROM active_calls WHERE channel = :ch"), {"ch": channel}
    ).mappings().first()
    return dict(r) if r else None


def _delete_call(channel):
    db.session.execute(
        text("DELETE FROM active_calls WHERE channel = :ch"), {"ch": channel}
    )
    db.session.commit()


def _push_incoming(user_id, payload: dict):
    import json
    db.session.execute(text("""
        INSERT INTO incoming_call_queue (user_id, payload, created_at)
        VALUES (:uid, :p, NOW())
    """), dict(uid=user_id, p=json.dumps(payload)))
    db.session.commit()


def _pop_incoming(user_id):
    import json
    rows = db.session.execute(text("""
        DELETE FROM incoming_call_queue
        WHERE user_id = :uid
        RETURNING payload
    """), {"uid": user_id}).fetchall()
    db.session.commit()
    return [json.loads(r[0]) for r in rows]


# ── Routes ────────────────────────────────────────────────────

@call_bp.route("/token", methods=["POST"])
@jwt_required()
def get_token():
    user = me()
    data = request.get_json(force=True, silent=True) or {}
    channel = data.get("channel_name", "")
    if not channel:
        return jsonify({"error": "channel_name required"}), 400
    return jsonify({
        "token": build_agora_token(channel, user.id),
        "uid": user.id,
        "channel": channel,
        "app_id": AGORA_APP_ID,
    })


@call_bp.route("/start", methods=["POST"])
@jwt_required()
def start_call():
    """Caller starts a call — stores it in DB, notifies callee(s)."""
    user = me()
    data = request.get_json(force=True, silent=True) or {}
    call_type = data.get("call_type", "voice")
    callee_id = data.get("callee_id")
    conversation_id = data.get("conversation_id")

    channel = _rand_channel()
    caller_token = build_agora_token(channel, user.id)

    _create_call(channel, user.id, callee_id, call_type, conversation_id)

    base_payload = {
        "channel": channel,
        "app_id": AGORA_APP_ID,
        "caller_id": user.id,
        "caller_name": user.name,
        "caller_avatar": user.avatar_url,
        "call_type": call_type,
        "conversation_id": conversation_id,
    }

    # 1-on-1: notify callee
    if callee_id:
        callee_token = build_agora_token(channel, int(callee_id))
        _push_incoming(int(callee_id), {**base_payload, "token": callee_token})

    # Group: notify all conversation participants
    if call_type == "group" and conversation_id:
        parts = ConversationParticipant.query.filter_by(
            conversation_id=conversation_id
        ).all()
        for p in parts:
            if p.user_id != user.id:
                member_token = build_agora_token(channel, p.user_id)
                _push_incoming(p.user_id, {**base_payload, "token": member_token})

    return jsonify({
        **base_payload,
        "token": caller_token,
        "uid": user.id,
        "state": "ringing",
    }), 201


@call_bp.route("/incoming", methods=["GET"])
@jwt_required()
def get_incoming():
    """Poll for incoming calls — returns and clears the queue for this user."""
    user_id = int(get_jwt_identity())
    calls = _pop_incoming(user_id)
    return jsonify({"calls": calls})


@call_bp.route("/answer", methods=["POST"])
@jwt_required()
def answer_call():
    """Callee accepts — returns their Agora token."""
    user = me()
    data = request.get_json(force=True, silent=True) or {}
    channel = data.get("channel")
    call = _get_call(channel)
    if not call:
        return jsonify({"error": "Call not found or already ended"}), 404
    _update_call_state(channel, "active")
    token = build_agora_token(channel, user.id)
    return jsonify({
        "token": token,
        "uid": user.id,
        "channel": channel,
        "app_id": AGORA_APP_ID,
        "caller_name": call.get("caller_name") or "",
        "call_type": call.get("call_type", "voice"),
    })


@call_bp.route("/decline", methods=["POST"])
@jwt_required()
def decline_call():
    data = request.get_json(force=True, silent=True) or {}
    channel = data.get("channel")
    if channel:
        _delete_call(channel)
    return jsonify({"ok": True})


@call_bp.route("/end", methods=["POST"])
@jwt_required()
def end_call():
    data = request.get_json(force=True, silent=True) or {}
    channel = data.get("channel")
    if channel:
        _delete_call(channel)
    return jsonify({"ok": True})


@call_bp.route("/status/<channel>", methods=["GET"])
@jwt_required()
def call_status(channel):
    call = _get_call(channel)
    if not call:
        return jsonify({"state": "ended"})
    return jsonify({"state": call["state"], "channel": channel})
