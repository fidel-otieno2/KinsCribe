from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.social import Post, PostLike, PostComment, Connection
import cloudinary
import cloudinary.uploader
import os

post_bp = Blueprint("posts", __name__)

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)


def me():
    return User.query.get(int(get_jwt_identity()))


def _is_connected(user_id, target_id):
    return Connection.query.filter_by(
        follower_id=user_id, following_id=target_id
    ).first() is not None


@post_bp.route("/", methods=["POST"])
@jwt_required()
def create_post():
    user = me()
    media_url = None
    media_type = "text"

    if "file" in request.files:
        file = request.files["file"]
        mime = file.content_type or ""
        resource_type = "video" if "video" in mime else "image"
        media_type = "video" if "video" in mime else "image"
        result = cloudinary.uploader.upload(file, resource_type=resource_type, folder="kinscribe/posts")
        media_url = result["secure_url"]

    data = request.form if request.files else request.get_json(force=True, silent=True) or {}

    post = Post(
        caption=data.get("caption", ""),
        media_url=media_url,
        media_type=media_type,
        location=data.get("location"),
        privacy=data.get("privacy", "public"),
        user_id=user.id
    )
    db.session.add(post)
    db.session.commit()
    return jsonify({"post": post.to_dict(user.id)}), 201


@post_bp.route("/feed", methods=["GET"])
@jwt_required()
def post_feed():
    user = me()
    current_id = user.id

    # IDs of people I'm interested in (following)
    interests = {c.following_id for c in Connection.query.filter_by(follower_id=current_id).all()}

    # Get posts from people I follow + my own
    candidate_ids = interests | {current_id}
    all_posts = Post.query.filter(Post.user_id.in_(candidate_ids))\
        .order_by(Post.created_at.desc()).limit(50).all()

    result = []
    for p in all_posts:
        if p.privacy == "public":
            result.append(p.to_dict(current_id))
        elif p.privacy == "connections" and (p.user_id == current_id or _is_connected(current_id, p.user_id)):
            result.append(p.to_dict(current_id))
        elif p.privacy == "family" and p.user_id == current_id:
            result.append(p.to_dict(current_id))

    return jsonify({"posts": result})


@post_bp.route("/explore", methods=["GET"])
@jwt_required()
def explore():
    """Public posts from everyone for discovery"""
    current_id = int(get_jwt_identity())
    posts = Post.query.filter_by(privacy="public")\
        .order_by(Post.created_at.desc()).limit(30).all()
    return jsonify({"posts": [p.to_dict(current_id) for p in posts]})


@post_bp.route("/user/<int:user_id>", methods=["GET"])
@jwt_required()
def user_posts(user_id):
    current_id = int(get_jwt_identity())
    is_connected = _is_connected(current_id, user_id)
    is_same = current_id == user_id

    posts = Post.query.filter_by(user_id=user_id)\
        .order_by(Post.created_at.desc()).all()

    result = []
    for p in posts:
        if p.privacy == "public":
            result.append(p.to_dict(current_id))
        elif p.privacy == "connections" and (is_same or is_connected):
            result.append(p.to_dict(current_id))
        elif is_same:
            result.append(p.to_dict(current_id))

    return jsonify({"posts": result})


@post_bp.route("/<int:post_id>/like", methods=["POST"])
@jwt_required()
def toggle_like(post_id):
    current_id = int(get_jwt_identity())
    existing = PostLike.query.filter_by(user_id=current_id, post_id=post_id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({"liked": False})
    db.session.add(PostLike(user_id=current_id, post_id=post_id))
    db.session.commit()
    return jsonify({"liked": True})


@post_bp.route("/<int:post_id>/comments", methods=["GET"])
@jwt_required()
def get_comments(post_id):
    comments = PostComment.query.filter_by(post_id=post_id)\
        .order_by(PostComment.created_at).all()
    return jsonify({"comments": [c.to_dict() for c in comments]})


@post_bp.route("/<int:post_id>/comments", methods=["POST"])
@jwt_required()
def add_comment(post_id):
    user = me()
    c = PostComment(
        text=request.json["text"],
        user_id=user.id,
        post_id=post_id
    )
    db.session.add(c)
    db.session.commit()
    return jsonify({"comment": c.to_dict()}), 201


@post_bp.route("/<int:post_id>", methods=["DELETE"])
@jwt_required()
def delete_post(post_id):
    user = me()
    post = Post.query.get_or_404(post_id)
    if post.user_id != user.id and user.role != "admin":
        return jsonify({"error": "Not authorized"}), 403
    db.session.delete(post)
    db.session.commit()
    return jsonify({"message": "Post deleted"})
