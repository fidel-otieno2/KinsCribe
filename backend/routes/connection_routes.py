from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.social import Connection

connection_bp = Blueprint("connections", __name__)


def me():
    return User.query.get(int(get_jwt_identity()))


@connection_bp.route("/<int:user_id>/toggle", methods=["POST"])
@jwt_required()
def toggle_connection(user_id):
    current = me()
    if current.id == user_id:
        return jsonify({"error": "Cannot connect to yourself"}), 400

    target = User.query.get(user_id)
    if not target:
        return jsonify({"error": "User not found"}), 404

    existing = Connection.query.filter_by(
        follower_id=current.id, following_id=user_id
    ).first()

    if existing:
        # Cancel follow / unfollow / withdraw request
        db.session.delete(existing)
        db.session.commit()
        return jsonify({"connected": False, "status": None})

    # If target account is private → send a pending follow request
    if target.is_private:
        conn = Connection(follower_id=current.id, following_id=user_id, status="pending")
        db.session.add(conn)
        db.session.commit()
        return jsonify({"connected": False, "status": "pending", "requested": True})

    # Public account → accept immediately
    conn = Connection(follower_id=current.id, following_id=user_id, status="accepted")
    db.session.add(conn)
    db.session.commit()
    return jsonify({"connected": True, "status": "accepted"})


@connection_bp.route("/<int:user_id>/status", methods=["GET"])
@jwt_required()
def connection_status(user_id):
    current = me()
    conn = Connection.query.filter_by(
        follower_id=current.id, following_id=user_id
    ).first()
    follows_you = Connection.query.filter_by(
        follower_id=user_id, following_id=current.id,
        status="accepted"
    ).first() is not None

    if conn is None:
        return jsonify({"connected": False, "status": None, "follows_you": follows_you})
    return jsonify({
        "connected": conn.status == "accepted",
        "status": conn.status,
        "follows_you": follows_you,
        "requested": conn.status == "pending",
    })


@connection_bp.route("/requests", methods=["GET"])
@jwt_required()
def get_follow_requests():
    """Get pending follow requests sent TO the current user (they need to approve)"""
    current = me()
    pending = Connection.query.filter_by(following_id=current.id, status="pending").all()
    result = []
    for conn in pending:
        requester = User.query.get(conn.follower_id)
        if requester:
            result.append({
                "connection_id": conn.id,
                "user": {
                    "id": requester.id,
                    "name": requester.name,
                    "username": requester.username,
                    "avatar_url": requester.avatar_url,
                    "bio": requester.bio,
                },
                "created_at": conn.created_at.isoformat(),
            })
    return jsonify({"requests": result, "count": len(result)})


@connection_bp.route("/requests/<int:conn_id>/accept", methods=["POST"])
@jwt_required()
def accept_request(conn_id):
    current = me()
    conn = Connection.query.get_or_404(conn_id)
    if conn.following_id != current.id:
        return jsonify({"error": "Not authorized"}), 403
    conn.status = "accepted"
    db.session.commit()
    return jsonify({"message": "Request accepted", "connection": conn.to_dict()})


@connection_bp.route("/requests/<int:conn_id>/decline", methods=["POST"])
@jwt_required()
def decline_request(conn_id):
    current = me()
    conn = Connection.query.get_or_404(conn_id)
    if conn.following_id != current.id:
        return jsonify({"error": "Not authorized"}), 403
    db.session.delete(conn)
    db.session.commit()
    return jsonify({"message": "Request declined"})


@connection_bp.route("/<int:user_id>/connections", methods=["GET"])
@jwt_required()
def get_connections(user_id):
    """People who are accepted followers of this user"""
    rows = Connection.query.filter_by(following_id=user_id, status="accepted").all()
    users = []
    current_id = int(get_jwt_identity())
    for r in rows:
        u = User.query.get(r.follower_id)
        if u:
            is_connected = Connection.query.filter_by(
                follower_id=current_id, following_id=u.id, status="accepted"
            ).first() is not None
            users.append({**u.to_dict(), "is_connected": is_connected})
    return jsonify({"connections": users})


@connection_bp.route("/<int:user_id>/interests", methods=["GET"])
@jwt_required()
def get_interests(user_id):
    """People this user is following (accepted)"""
    rows = Connection.query.filter_by(follower_id=user_id, status="accepted").all()
    users = []
    current_id = int(get_jwt_identity())
    for r in rows:
        u = User.query.get(r.following_id)
        if u:
            is_connected = Connection.query.filter_by(
                follower_id=current_id, following_id=u.id, status="accepted"
            ).first() is not None
            users.append({**u.to_dict(), "is_connected": is_connected})
    return jsonify({"interests": users})


@connection_bp.route("/suggestions", methods=["GET"])
@jwt_required()
def suggestions():
    """Suggest users not yet connected to"""
    current = me()
    already = {c.following_id for c in Connection.query.filter_by(follower_id=current.id).all()}
    already.add(current.id)
    users = User.query.filter(User.id.notin_(already)).order_by(db.func.random()).limit(20).all()
    current_id = current.id
    result = []
    for u in users:
        follows_back = Connection.query.filter_by(
            follower_id=u.id, following_id=current_id, status="accepted"
        ).first() is not None
        result.append({**u.to_dict(), "follows_you": follows_back})
    return jsonify({"suggestions": result})


@connection_bp.route("/search", methods=["GET"])
@jwt_required()
def search_users():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"users": []})
    current_id = int(get_jwt_identity())
    users = User.query.filter(
        (User.name.ilike(f"%{q}%")) | (User.username.ilike(f"%{q}%")),
        User.id != current_id
    ).limit(20).all()
    result = []
    for u in users:
        conn = Connection.query.filter_by(
            follower_id=current_id, following_id=u.id
        ).first()
        result.append({
            **u.to_dict(),
            "is_connected": conn.status == "accepted" if conn else False,
            "connection_status": conn.status if conn else None,
        })
    return jsonify({"users": result})


@connection_bp.route("/<int:user_id>/block", methods=["POST"])
@jwt_required()
def block_user(user_id):
    current_id = int(get_jwt_identity())
    Connection.query.filter(
        ((Connection.follower_id == current_id) & (Connection.following_id == user_id)) |
        ((Connection.follower_id == user_id) & (Connection.following_id == current_id))
    ).delete(synchronize_session=False)
    db.session.commit()
    return jsonify({"blocked": True})


@connection_bp.route("/<int:user_id>/mute", methods=["POST"])
@jwt_required()
def mute_user(user_id):
    return jsonify({"muted": True})
