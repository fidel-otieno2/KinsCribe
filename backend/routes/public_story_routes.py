from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.social import (PublicStory, PublicStoryView, StoryHighlight,
                            StoryHighlightItem, Connection, PostSave)
from datetime import datetime, timedelta
import cloudinary, cloudinary.uploader, os

public_story_bp = Blueprint("public_stories", __name__)

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)


def me():
    return User.query.get(int(get_jwt_identity()))


@public_story_bp.route("/", methods=["POST"])
@jwt_required()
def create_story():
    user = me()
    media_url = None
    media_type = "text"
    if "file" in request.files:
        file = request.files["file"]
        mime = file.content_type or ""
        resource_type = "video" if "video" in mime else "image"
        media_type = "video" if "video" in mime else "image"
        result = cloudinary.uploader.upload(file, resource_type=resource_type, folder="kinscribe/pstories")
        media_url = result["secure_url"]
    data = request.form if request.files else request.get_json(force=True, silent=True) or {}
    story = PublicStory(
        media_url=media_url,
        media_type=media_type if media_url else "text",
        text_content=data.get("text_content"),
        bg_color=data.get("bg_color", "#7c3aed"),
        music_url=data.get("music_url"),
        music_name=data.get("music_name"),
        privacy=data.get("privacy", "public"),
        expires_at=datetime.utcnow() + timedelta(hours=24),
        user_id=user.id
    )
    db.session.add(story)
    db.session.commit()
    return jsonify({"story": story.to_dict(user.id)}), 201


@public_story_bp.route("/feed", methods=["GET"])
@jwt_required()
def story_feed():
    user = me()
    current_id = user.id
    interests = {c.following_id for c in Connection.query.filter_by(follower_id=current_id).all()}
    candidate_ids = list(interests | {current_id})
    now = datetime.utcnow()
    stories = PublicStory.query.filter(
        PublicStory.user_id.in_(candidate_ids),
        PublicStory.expires_at > now
    ).order_by(PublicStory.created_at.desc()).all()

    by_user = {}
    for s in stories:
        uid = s.user_id
        if uid not in by_user:
            by_user[uid] = []
        by_user[uid].append(s.to_dict(current_id))

    result = []
    for uid, user_stories in by_user.items():
        u = User.query.get(uid)
        has_unseen = any(not s["viewed_by_me"] for s in user_stories)
        result.append({
            "user_id": uid,
            "author_name": u.name if u else None,
            "author_avatar": u.avatar_url if u else None,
            "author_username": u.username if u else None,
            "has_unseen": has_unseen,
            "stories": user_stories
        })
    result.sort(key=lambda x: (not x["has_unseen"]))
    return jsonify({"story_groups": result})


@public_story_bp.route("/<int:story_id>/view", methods=["POST"])
@jwt_required()
def view_story(story_id):
    current_id = int(get_jwt_identity())
    story = PublicStory.query.get_or_404(story_id)
    existing = PublicStoryView.query.filter_by(user_id=current_id, story_id=story_id).first()
    if not existing:
        db.session.add(PublicStoryView(user_id=current_id, story_id=story_id))
        story.view_count = (story.view_count or 0) + 1
        db.session.commit()
    return jsonify({"viewed": True})


@public_story_bp.route("/<int:story_id>", methods=["DELETE"])
@jwt_required()
def delete_story(story_id):
    story = PublicStory.query.get_or_404(story_id)
    if story.user_id != int(get_jwt_identity()):
        return jsonify({"error": "Not authorized"}), 403
    db.session.delete(story)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@public_story_bp.route("/my", methods=["GET"])
@jwt_required()
def my_stories():
    current_id = int(get_jwt_identity())
    now = datetime.utcnow()
    stories = PublicStory.query.filter(
        PublicStory.user_id == current_id,
        PublicStory.expires_at > now
    ).order_by(PublicStory.created_at.desc()).all()
    return jsonify({"stories": [s.to_dict(current_id) for s in stories]})


@public_story_bp.route("/highlights", methods=["GET"])
@jwt_required()
def get_highlights():
    user_id = request.args.get("user_id", int(get_jwt_identity()), type=int)
    highlights = StoryHighlight.query.filter_by(user_id=user_id).order_by(StoryHighlight.created_at.desc()).all()
    result = []
    for h in highlights:
        d = h.to_dict()
        d["items"] = [i.to_dict() for i in h.items]
        result.append(d)
    return jsonify({"highlights": result})


@public_story_bp.route("/highlights", methods=["POST"])
@jwt_required()
def create_highlight():
    user = me()
    data = request.get_json() or {}
    h = StoryHighlight(title=data.get("title", "Highlight"), cover_url=data.get("cover_url"), user_id=user.id)
    db.session.add(h)
    db.session.flush()
    for item in data.get("items", []):
        db.session.add(StoryHighlightItem(
            highlight_id=h.id, public_story_id=item.get("story_id"),
            media_url=item.get("media_url"), media_type=item.get("media_type", "image")
        ))
    db.session.commit()
    result = h.to_dict()
    result["items"] = [i.to_dict() for i in h.items]
    return jsonify({"highlight": result}), 201


@public_story_bp.route("/highlights/<int:hid>", methods=["DELETE"])
@jwt_required()
def delete_highlight(hid):
    h = StoryHighlight.query.get_or_404(hid)
    if h.user_id != int(get_jwt_identity()):
        return jsonify({"error": "Not authorized"}), 403
    db.session.delete(h)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@public_story_bp.route("/saved", methods=["GET"])
@jwt_required()
def saved_posts():
    from models.social import Post
    current_id = int(get_jwt_identity())
    saves = PostSave.query.filter_by(user_id=current_id).order_by(PostSave.created_at.desc()).all()
    posts = []
    for s in saves:
        p = Post.query.get(s.post_id)
        if p:
            d = p.to_dict(current_id)
            d["collection"] = s.collection
            posts.append(d)
    return jsonify({"posts": posts})
