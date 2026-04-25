import os
import time
import hmac
import hashlib
import struct
import base64
import random
import string
import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.social import ConversationParticipant, Connection
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


# ── Agora Token Builder ───────────────────────────────────────

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
        return ""
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


# ── Push notification helper ──────────────────────────────────

def _send_push(user_id: int, title: str, body: str, data: dict = None):
    """Send Expo push notification to a user via their stored push token."""
    try:
        row = db.session.execute(
            text("SELECT push_token FROM user_push_tokens WHERE user_id = :uid ORDER BY updated_at DESC LIMIT 1"),
            {"uid": user_id}
        ).fetchone()
        if not row or not row[0]:
            return
        token = row[0]
        if not token.startswith("ExponentPushToken"):
            return
        import urllib.request
        payload = json.dumps({
            "to": token,
            "title": title,
            "body": body,
            "sound": "default",
            "priority": "high",
            "data": data or {},
            "channelId": "calls",
        }).encode()
        req = urllib.request.Request(
            "https://exp.host/--/api/v2/push/send",
            data=payload,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST"
        )
        urllib.request.urlopen(req, timeout=5)
    except Exception as e:
        print(f"Push notification error: {e}")


# ── DB helpers ────────────────────────────────────────────────

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
    db.session.execute(text("""
        INSERT INTO incoming_call_queue (user_id, payload, created_at)
        VALUES (:uid, :p, NOW())
    """), dict(uid=user_id, p=json.dumps(payload)))
    db.session.commit()


def _pop_incoming(user_id):
    rows = db.session.execute(text("""
        DELETE FROM incoming_call_queue
        WHERE user_id = :uid
        RETURNING payload
    """), {"uid": user_id}).fetchall()
    db.session.commit()
    return [json.loads(r[0]) for r in rows]


def _log_call(channel, caller_id, callee_id, call_type, conversation_id,
              status, duration_secs=0):
    """Write a call log entry for both participants."""
    try:
        db.session.execute(text("""
            INSERT INTO call_logs
                (channel, caller_id, callee_id, call_type, conversation_id,
                 status, duration_secs, created_at)
            VALUES
                (:ch, :caller, :callee, :ctype, :conv, :status, :dur, NOW())
        """), dict(ch=channel, caller=caller_id, callee=callee_id,
                   ctype=call_type, conv=conversation_id,
                   status=status, dur=duration_secs))
        db.session.commit()
    except Exception as e:
        print(f"Call log error: {e}")
        db.session.rollback()


def _is_blocked(caller_id, callee_id) -> bool:
    """Return True if callee has blocked caller."""
    try:
        row = db.session.execute(text("""
            SELECT 1 FROM blocks
            WHERE blocker_id = :callee AND blocked_id = :caller
        """), {"callee": callee_id, "caller": caller_id}).fetchone()
        return row is not None
    except Exception:
        return False


def _are_connected(user_a, user_b) -> bool:
    """Return True if both users have an accepted connection."""
    try:
        row = db.session.execute(text("""
            SELECT 1 FROM connections
            WHERE status = 'accepted'
              AND (
                (follower_id = :a AND following_id = :b)
                OR (follower_id = :b AND following_id = :a)
              )
        """), {"a": user_a, "b": user_b}).fetchone()
        return row is not None
    except Exception:
        return True  # fail open


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
    user = me()
    data = request.get_json(force=True, silent=True) or {}
    call_type = data.get("call_type", "voice")
    callee_id = data.get("callee_id")
    conversation_id = data.get("conversation_id")

    # Privacy: block check
    if callee_id and _is_blocked(user.id, int(callee_id)):
        return jsonify({"error": "You cannot call this user"}), 403

    # Privacy: connections-only check
    if callee_id:
        callee = User.query.get(int(callee_id))
        if callee and not _are_connected(user.id, int(callee_id)):
            return jsonify({"error": "You can only call your connections"}), 403

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

    # 1-on-1: notify callee via queue + push notification
    if callee_id:
        callee_token = build_agora_token(channel, int(callee_id))
        _push_incoming(int(callee_id), {**base_payload, "token": callee_token})
        type_label = "Video call" if call_type == "video" else "Voice call"
        _send_push(
            int(callee_id),
            f"📞 {type_label} from {user.name}",
            "Tap to answer",
            {**base_payload, "token": callee_token, "type": "incoming_call"}
        )

    # Group: notify all conversation participants
    if call_type == "group" and conversation_id:
        parts = ConversationParticipant.query.filter_by(
            conversation_id=conversation_id
        ).all()
        for p in parts:
            if p.user_id != user.id:
                member_token = build_agora_token(channel, p.user_id)
                _push_incoming(p.user_id, {**base_payload, "token": member_token})
                _send_push(
                    p.user_id,
                    f"📞 Group call from {user.name}",
                    "Tap to join",
                    {**base_payload, "token": member_token, "type": "incoming_call"}
                )

    return jsonify({
        **base_payload,
        "token": caller_token,
        "uid": user.id,
        "state": "ringing",
    }), 201


@call_bp.route("/incoming", methods=["GET"])
@jwt_required()
def get_incoming():
    user_id = int(get_jwt_identity())
    calls = _pop_incoming(user_id)
    return jsonify({"calls": calls})


@call_bp.route("/answer", methods=["POST"])
@jwt_required()
def answer_call():
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
    user = me()
    data = request.get_json(force=True, silent=True) or {}
    channel = data.get("channel")
    if channel:
        call = _get_call(channel)
        if call:
            _log_call(
                channel, call["caller_id"], call.get("callee_id"),
                call.get("call_type", "voice"), call.get("conversation_id"),
                "declined"
            )
            # Notify caller their call was declined
            _send_push(
                call["caller_id"],
                "Call declined",
                f"{user.name} declined your call",
                {"type": "call_declined", "channel": channel}
            )
        _delete_call(channel)
    return jsonify({"ok": True})


@call_bp.route("/end", methods=["POST"])
@jwt_required()
def end_call():
    data = request.get_json(force=True, silent=True) or {}
    channel = data.get("channel")
    duration_secs = data.get("duration_secs", 0)
    if channel:
        call = _get_call(channel)
        if call:
            status = "completed" if call.get("state") == "active" else "missed"
            _log_call(
                channel, call["caller_id"], call.get("callee_id"),
                call.get("call_type", "voice"), call.get("conversation_id"),
                status, duration_secs
            )
        _delete_call(channel)
    return jsonify({"ok": True})


@call_bp.route("/missed", methods=["POST"])
@jwt_required()
def mark_missed():
    """Called when outgoing call times out with no answer."""
    data = request.get_json(force=True, silent=True) or {}
    channel = data.get("channel")
    if channel:
        call = _get_call(channel)
        if call:
            _log_call(
                channel, call["caller_id"], call.get("callee_id"),
                call.get("call_type", "voice"), call.get("conversation_id"),
                "missed"
            )
            # Push missed call notification to callee
            if call.get("callee_id"):
                caller = User.query.get(call["caller_id"])
                name = caller.name if caller else "Someone"
                _send_push(
                    call["callee_id"],
                    "Missed call",
                    f"You missed a call from {name}",
                    {"type": "missed_call", "caller_id": call["caller_id"]}
                )
        _delete_call(channel)
    return jsonify({"ok": True})


@call_bp.route("/status/<channel>", methods=["GET"])
@jwt_required()
def call_status(channel):
    call = _get_call(channel)
    if not call:
        return jsonify({"state": "ended"})
    return jsonify({"state": call["state"], "channel": channel})


@call_bp.route("/logs", methods=["GET"])
@jwt_required()
def get_call_logs():
    """Return call history for the current user."""
    user_id = int(get_jwt_identity())
    limit = min(int(request.args.get("limit", 50)), 100)
    filter_type = request.args.get("type")  # missed | received | dialed

    base_query = """
        SELECT cl.*,
               c.name AS caller_name, c.avatar_url AS caller_avatar,
               c.username AS caller_username,
               e.name AS callee_name, e.avatar_url AS callee_avatar,
               e.username AS callee_username
        FROM call_logs cl
        LEFT JOIN users c ON c.id = cl.caller_id
        LEFT JOIN users e ON e.id = cl.callee_id
        WHERE (cl.caller_id = :uid OR cl.callee_id = :uid)
    """
    params = {"uid": user_id}

    if filter_type == "missed":
        base_query += " AND cl.status = 'missed' AND cl.callee_id = :uid"
    elif filter_type == "received":
        base_query += " AND cl.callee_id = :uid AND cl.status = 'completed'"
    elif filter_type == "dialed":
        base_query += " AND cl.caller_id = :uid"

    base_query += " ORDER BY cl.created_at DESC LIMIT :lim"
    params["lim"] = limit

    try:
        rows = db.session.execute(text(base_query), params).mappings().fetchall()
        logs = []
        for r in rows:
            r = dict(r)
            is_outgoing = r["caller_id"] == user_id
            other_name = r["callee_name"] if is_outgoing else r["caller_name"]
            other_avatar = r["callee_avatar"] if is_outgoing else r["caller_avatar"]
            other_username = r["callee_username"] if is_outgoing else r["caller_username"]
            other_id = r["callee_id"] if is_outgoing else r["caller_id"]
            logs.append({
                "id": r["id"],
                "channel": r["channel"],
                "call_type": r["call_type"],
                "status": r["status"],
                "duration_secs": r["duration_secs"] or 0,
                "is_outgoing": is_outgoing,
                "other_user_id": other_id,
                "other_user_name": other_name,
                "other_user_avatar": other_avatar,
                "other_user_username": other_username,
                "conversation_id": r["conversation_id"],
                "created_at": r["created_at"].strftime("%Y-%m-%dT%H:%M:%SZ") if r["created_at"] else None,
            })
        return jsonify({"logs": logs, "count": len(logs)})
    except Exception as e:
        print(f"Call logs error: {e}")
        return jsonify({"logs": [], "count": 0})


@call_bp.route("/logs/unread-missed", methods=["GET"])
@jwt_required()
def unread_missed_count():
    """Count of missed calls since last check."""
    user_id = int(get_jwt_identity())
    try:
        row = db.session.execute(text("""
            SELECT COUNT(*) FROM call_logs
            WHERE callee_id = :uid AND status = 'missed' AND seen = FALSE
        """), {"uid": user_id}).fetchone()
        return jsonify({"count": row[0] if row else 0})
    except Exception:
        return jsonify({"count": 0})


@call_bp.route("/logs/mark-seen", methods=["POST"])
@jwt_required()
def mark_logs_seen():
    user_id = int(get_jwt_identity())
    try:
        db.session.execute(text("""
            UPDATE call_logs SET seen = TRUE
            WHERE callee_id = :uid AND status = 'missed'
        """), {"uid": user_id})
        db.session.commit()
    except Exception:
        pass
    return jsonify({"ok": True})


@call_bp.route("/block-calls", methods=["POST"])
@jwt_required()
def block_calls():
    """Block a user from calling you (uses existing blocks table)."""
    user = me()
    data = request.get_json(force=True, silent=True) or {}
    target_id = data.get("user_id")
    if not target_id:
        return jsonify({"error": "user_id required"}), 400
    try:
        db.session.execute(text("""
            INSERT INTO blocks (blocker_id, blocked_id, created_at)
            VALUES (:blocker, :blocked, NOW())
            ON CONFLICT (blocker_id, blocked_id) DO NOTHING
        """), {"blocker": user.id, "blocked": int(target_id)})
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    return jsonify({"ok": True})


@call_bp.route("/messages/<channel>", methods=["GET"])
@jwt_required()
def get_call_messages(channel):
    """Get in-call chat messages for a channel."""
    try:
        rows = db.session.execute(text("""
            SELECT cm.id, cm.text, cm.created_at,
                   u.name AS sender_name, u.avatar_url AS sender_avatar
            FROM call_messages cm
            LEFT JOIN users u ON u.id = cm.sender_id
            WHERE cm.channel = :ch
            ORDER BY cm.created_at ASC
            LIMIT 100
        """), {"ch": channel}).mappings().fetchall()
        msgs = [{
            "id": r["id"],
            "text": r["text"],
            "sender_name": r["sender_name"],
            "sender_avatar": r["sender_avatar"],
            "created_at": r["created_at"].strftime("%Y-%m-%dT%H:%M:%SZ") if r["created_at"] else None,
        } for r in rows]
        return jsonify({"messages": msgs})
    except Exception as e:
        return jsonify({"messages": [], "error": str(e)})


@call_bp.route("/messages/<channel>", methods=["POST"])
@jwt_required()
def send_call_message(channel):
    """Send an in-call chat message."""
    user = me()
    data = request.get_json(force=True, silent=True) or {}
    text_body = data.get("text", "").strip()
    if not text_body:
        return jsonify({"error": "text required"}), 400
    try:
        db.session.execute(text("""
            INSERT INTO call_messages (channel, sender_id, text, created_at)
            VALUES (:ch, :uid, :txt, NOW())
        """), {"ch": channel, "uid": user.id, "txt": text_body})
        db.session.commit()
        return jsonify({"ok": True}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@call_bp.route("/privacy", methods=["GET", "POST"])
@jwt_required()
def call_privacy():
    """Get or set who can call this user: 'everyone' | 'connections' | 'nobody'."""
    user_id = int(get_jwt_identity())
    if request.method == "GET":
        try:
            row = db.session.execute(text(
                "SELECT call_privacy FROM user_call_settings WHERE user_id = :uid"
            ), {"uid": user_id}).fetchone()
            return jsonify({"call_privacy": row[0] if row else "connections"})
        except Exception:
            return jsonify({"call_privacy": "connections"})
    data = request.get_json(force=True, silent=True) or {}
    setting = data.get("call_privacy", "connections")
    if setting not in ("everyone", "connections", "nobody"):
        return jsonify({"error": "Invalid setting"}), 400
    try:
        db.session.execute(text("""
            INSERT INTO user_call_settings (user_id, call_privacy, updated_at)
            VALUES (:uid, :s, NOW())
            ON CONFLICT (user_id) DO UPDATE SET call_privacy = :s, updated_at = NOW()
        """), {"uid": user_id, "s": setting})
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    return jsonify({"ok": True, "call_privacy": setting})
