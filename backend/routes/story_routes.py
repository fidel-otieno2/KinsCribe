from flask import Blueprint, request, jsonify
from extensions import db
from models.user import User
from models.story import Story, Comment, Like, SavedStory
from flask_jwt_extended import jwt_required, get_jwt_identity
import cloudinary
import cloudinary.uploader
import os
from datetime import datetime

story_bp = Blueprint("stories", __name__)

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)


def current_user():
    return User.query.get(int(get_jwt_identity()))


def require_family(user):
    if not user.family_id:
        return jsonify({"error": "You must join a family first"}), 403
    return None


@story_bp.route("/", methods=["POST"])
@jwt_required()
def create_story():
    user = current_user()
    err = require_family(user)
    if err:
        return err

    media_url = None
    media_type = "text"

    if "file" in request.files:
        file = request.files["file"]
        mime = file.content_type
        resource_type = "video" if "video" in mime else "raw" if "audio" in mime else "image"
        media_type = "video" if "video" in mime else "audio" if "audio" in mime else "image"
        result = cloudinary.uploader.upload(file, resource_type=resource_type, folder="kinscribe/stories")
        media_url = result["secure_url"]

    music_url = None
    if "music" in request.files:
        music_file = request.files["music"]
        music_result = cloudinary.uploader.upload(music_file, resource_type="raw", folder="kinscribe/music")
        music_url = music_result["secure_url"]

    data = request.form if request.files else request.get_json(force=True, silent=True) or {}

    # music_url can come as a form field (iTunes preview URL) when no file is uploaded
    if not music_url:
        music_url = data.get("music_url")
    story_date = data.get("story_date")

    story = Story(
        title=data.get("title"),
        content=data.get("content"),
        media_url=media_url,
        media_type=media_type,
        music_url=music_url,
        location=data.get("location"),
        privacy=data.get("privacy", "family"),
        story_date=datetime.strptime(story_date, "%Y-%m-%d").date() if story_date else None,
        user_id=user.id,
        family_id=user.family_id
    )
    db.session.add(story)
    db.session.commit()

    # Run AI processing — async if Celery available, else sync in background thread
    if source_text_available := (media_url and media_type in ("audio", "video")) or story.content:
        try:
            from services.ai_service import process_story_async
            process_story_async.delay(story.id)
        except Exception:
            try:
                import threading
                from services.ai_service import process_story
                threading.Thread(target=process_story, args=(story.id,), daemon=True).start()
            except Exception:
                pass

    return jsonify({"story": story.to_dict()}), 201


@story_bp.route("/family", methods=["GET"])
@jwt_required()
def family_stories():
    user = current_user()
    err = require_family(user)
    if err:
        return err
    limit = request.args.get('limit', 50, type=int)
    stories = Story.query.filter_by(family_id=user.family_id)\
        .order_by(Story.created_at.desc()).limit(limit).all()
    return jsonify({"stories": [s.to_dict() for s in stories]})


@story_bp.route("/feed", methods=["GET"])
@jwt_required()
def family_feed():
    user = current_user()
    err = require_family(user)
    if err:
        return err
    stories = Story.query.filter_by(family_id=user.family_id)\
        .order_by(Story.created_at.desc()).all()
    return jsonify({"stories": [s.to_dict() for s in stories]})


@story_bp.route("/timeline", methods=["GET"])
@jwt_required()
def timeline():
    user = current_user()
    err = require_family(user)
    if err:
        return err
    stories = Story.query.filter_by(family_id=user.family_id)\
        .order_by(Story.story_date.asc().nullslast(), Story.created_at.desc()).all()
    return jsonify({"stories": [s.to_dict() for s in stories]})


@story_bp.route("/<int:story_id>", methods=["GET"])
@jwt_required()
def get_story(story_id):
    user = current_user()
    story = Story.query.get_or_404(story_id)
    if story.privacy == "private" and story.user_id != user.id:
        return jsonify({"error": "Access denied"}), 403
    if story.privacy == "family" and story.family_id != user.family_id:
        return jsonify({"error": "Access denied"}), 403
    return jsonify({"story": story.to_dict()})


@story_bp.route("/<int:story_id>", methods=["PUT"])
@jwt_required()
def update_story(story_id):
    user = current_user()
    story = Story.query.get_or_404(story_id)
    if story.user_id != user.id and user.role not in ("admin", "historian"):
        return jsonify({"error": "Not authorized"}), 403
    data = request.json
    for field in ("title", "content", "privacy", "tags"):
        if field in data:
            setattr(story, field, data[field] if field != "tags" else ",".join(data[field]))
    db.session.commit()
    return jsonify({"story": story.to_dict()})


@story_bp.route("/<int:story_id>", methods=["DELETE"])
@jwt_required()
def delete_story(story_id):
    user = current_user()
    story = Story.query.get_or_404(story_id)
    if story.user_id != user.id and user.role != "admin":
        return jsonify({"error": "Not authorized"}), 403
    db.session.delete(story)
    db.session.commit()
    return jsonify({"message": "Story deleted"})


@story_bp.route("/<int:story_id>/comments", methods=["POST"])
@jwt_required()
def add_comment(story_id):
    user = current_user()
    comment = Comment(text=request.json["text"], user_id=user.id, story_id=story_id)
    db.session.add(comment)
    db.session.commit()
    return jsonify({"comment": comment.to_dict()}), 201


@story_bp.route("/<int:story_id>/comments", methods=["GET"])
@jwt_required()
def get_comments(story_id):
    comments = Comment.query.filter_by(story_id=story_id).order_by(Comment.created_at).all()
    return jsonify({"comments": [c.to_dict() for c in comments]})


@story_bp.route("/<int:story_id>/like", methods=["POST"])
@jwt_required()
def toggle_like(story_id):
    user_id = int(get_jwt_identity())
    existing = Like.query.filter_by(user_id=user_id, story_id=story_id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({"liked": False})
    db.session.add(Like(user_id=user_id, story_id=story_id))
    db.session.commit()
    return jsonify({"liked": True})


@story_bp.route("/<int:story_id>/save", methods=["POST"])
@jwt_required()
def toggle_save(story_id):
    user_id = int(get_jwt_identity())
    existing = SavedStory.query.filter_by(user_id=user_id, story_id=story_id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({"saved": False})
    db.session.add(SavedStory(user_id=user_id, story_id=story_id))
    db.session.commit()
    return jsonify({"saved": True})
