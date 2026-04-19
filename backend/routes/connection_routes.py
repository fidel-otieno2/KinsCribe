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

    existing = Connection.query.filter_by(
        follower_id=current.id, following_id=user_id
    ).first()

    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({"connected": False})

    db.session.add(Connection(follower_id=current.id, following_id=user_id))
    db.session.commit()
    return jsonify({"connected": True})


@connection_bp.route("/<int:user_id>/status", methods=["GET"])
@jwt_required()
def connection_status(user_id):
    current = me()
    connected = Connection.query.filter_by(
        follower_id=current.id, following_id=user_id
    ).first() is not None
    follows_you = Connection.query.filter_by(
        follower_id=user_id, following_id=current.id
    ).first() is not None
    return jsonify({"connected": connected, "follows_you": follows_you})


@connection_bp.route("/<int:user_id>/connections", methods=["GET"])
@jwt_required()
def get_connections(user_id):
    """People who connected to this user (their connections)"""
    rows = Connection.query.filter_by(following_id=user_id).all()
    users = []
    current_id = int(get_jwt_identity())
    for r in rows:
        u = User.query.get(r.follower_id)
        if u:
            is_connected = Connection.query.filter_by(
                follower_id=current_id, following_id=u.id
            ).first() is not None
            users.append({**u.to_dict(), "is_connected": is_connected})
    return jsonify({"connections": users})


@connection_bp.route("/<int:user_id>/interests", methods=["GET"])
@jwt_required()
def get_interests(user_id):
    """People this user is interested in (following)"""
    rows = Connection.query.filter_by(follower_id=user_id).all()
    users = []
    current_id = int(get_jwt_identity())
    for r in rows:
        u = User.query.get(r.following_id)
        if u:
            is_connected = Connection.query.filter_by(
                follower_id=current_id, following_id=u.id
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
            follower_id=u.id, following_id=current_id
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
        is_connected = Connection.query.filter_by(
            follower_id=current_id, following_id=u.id
        ).first() is not None
        result.append({**u.to_dict(), "is_connected": is_connected})
    return jsonify({"users": result})


@connection_bp.route("/<int:user_id>/block", methods=["POST"])
@jwt_required()
def block_user(user_id):
    current_id = int(get_jwt_identity())
    # Remove any existing connection both ways
    Connection.query.filter(
        ((Connection.follower_id == current_id) & (Connection.following_id == user_id)) |
        ((Connection.follower_id == user_id) & (Connection.following_id == current_id))
    ).delete(synchronize_session=False)
    db.session.commit()
    return jsonify({"blocked": True})


@connection_bp.route("/<int:user_id>/mute", methods=["POST"])
@jwt_required()
def mute_user(user_id):
    # Mute is client-side preference; just acknowledge
    return jsonify({"muted": True})
