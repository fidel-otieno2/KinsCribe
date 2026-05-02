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
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return None
    return user


def require_family(user):
    """Check if user is in a family - returns error only if explicitly required."""
    if not user:
        return jsonify({"error": "User not found"}), 404
    # Don't enforce family requirement - let endpoints decide
    return None


def _upload_media_file(file):
    """Upload media file to Cloudinary and return URL and type."""
    mime = file.content_type or ""
    resource_type = "video" if "video" in mime else "raw" if "audio" in mime else "image"
    media_type = "video" if "video" in mime else "audio" if "audio" in mime else "image"
    result = cloudinary.uploader.upload(file, resource_type=resource_type, folder="kinscribe/stories")
    return result["secure_url"], media_type


def _upload_music_file(music_file):
    """Upload music file to Cloudinary and return URL."""
    result = cloudinary.uploader.upload(music_file, resource_type="raw", folder="kinscribe/music")
    return result["secure_url"]


def _parse_story_date(story_date_str):
    """Parse story date from string, supporting ISO and YYYY-MM-DD formats."""
    if not story_date_str:
        return None
    try:
        return datetime.fromisoformat(story_date_str).date()
    except (ValueError, TypeError):
        try:
            return datetime.strptime(story_date_str, "%Y-%m-%d").date()
        except ValueError:
            print(f"Invalid date format: {story_date_str}")
            return None


def _validate_family_membership(user, target_family_id):
    """Validate user membership in target family."""
    if not target_family_id or target_family_id == user.family_id:
        return target_family_id or user.family_id
    
    from models.family import FamilyMember
    membership = FamilyMember.query.filter_by(user_id=user.id, family_id=target_family_id).first()
    if not membership:
        return None
    return target_family_id


@story_bp.route("/", methods=["POST"])
@jwt_required()
def create_story():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    media_url = None
    media_type = "text"

    # Upload media file if present
    try:
        if "file" in request.files:
            media_url, media_type = _upload_media_file(request.files["file"])
    except Exception as e:
        return jsonify({"error": f"File upload failed: {str(e)}"}), 500

    # Upload music file if present
    music_url = None
    try:
        if "music" in request.files:
            music_url = _upload_music_file(request.files["music"])
    except Exception as e:
        return jsonify({"error": f"Music upload failed: {str(e)}"}), 500

    data = request.form if request.files else request.get_json(force=True, silent=True) or {}

    if not music_url:
        music_url = data.get("music_url")
    music_name = data.get("music_name")

    # Parse story date
    parsed_date = _parse_story_date(data.get("story_date"))

    # Get target family ID from request
    target_family_id = data.get("family_id", type=int) if hasattr(data, 'get') else None
    
    # Validate family membership - only if family_id is provided
    final_family_id = None
    if target_family_id:
        final_family_id = _validate_family_membership(user, target_family_id)
        if final_family_id is None:
            return jsonify({"error": "You are not a member of that family"}), 403
    elif user.family_id:
        # Use user's default family if they have one
        final_family_id = user.family_id

    # Create story
    try:
        story = Story(
            title=data.get("title", ""),
            content=data.get("content", ""),
            media_url=media_url,
            media_type=media_type,
            music_url=music_url,
            music_name=music_name,
            location=data.get("location"),
            privacy=data.get("privacy", "family"),
            story_date=parsed_date,
            user_id=user.id,
            family_id=final_family_id
        )
        db.session.add(story)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500

    # Run AI processing in background thread
    try:
        import threading
        from services.ai_service import process_story
        threading.Thread(target=process_story, args=(story.id,), daemon=True).start()
    except ImportError:
        print("AI service not available")
    except Exception as e:
        print(f"Failed to start AI processing: {str(e)}")

    try:
        return jsonify({"story": story.to_dict()}), 201
    except Exception as e:
        return jsonify({"error": f"Serialization error: {str(e)}"}), 500


@story_bp.route("/family", methods=["GET"])
@jwt_required()
def family_stories():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    # Get family_id from query parameter - REQUIRED
    family_id = request.args.get('family_id', type=int)
    
    if not family_id:
        # If no family_id specified, use user's primary family
        if not user.family_id:
            return jsonify({"stories": []}), 200
        family_id = user.family_id
    
    # Verify user is a member of the requested family
    from models.family import FamilyMember
    is_member = (family_id == user.family_id) or bool(
        FamilyMember.query.filter_by(user_id=user.id, family_id=family_id).first()
    )
    
    if not is_member:
        return jsonify({"error": "Access denied - not a member of this family"}), 403
    
    limit = request.args.get('limit', 50, type=int)
    
    # CRITICAL: Only return stories from THIS specific family
    stories = Story.query.filter_by(family_id=family_id, is_archived=False)\
        .order_by(Story.created_at.desc()).limit(limit).all()
    
    return jsonify({"stories": [s.to_dict() for s in stories]})


@story_bp.route("/feed", methods=["GET"])
@jwt_required()
def family_feed():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    # CRITICAL FIX: Get specific family_id from query parameter
    # This ensures we ONLY show stories from the family being viewed
    family_id = request.args.get('family_id', type=int)
    
    if not family_id:
        # If no family_id specified, use user's primary family
        if not user.family_id:
            # Show user's own stories if they're not in a family
            stories = Story.query.filter_by(user_id=user.id, is_archived=False)\
                .order_by(Story.created_at.desc()).limit(100).all()
            user_liked = {l.story_id for l in Like.query.filter_by(user_id=user.id).all()}
            user_saved = {s.story_id for s in SavedStory.query.filter_by(user_id=user.id).all()}
            result = []
            for s in stories:
                d = s.to_dict()
                d["liked_by_me"] = s.id in user_liked
                d["saved_by_me"] = s.id in user_saved
                result.append(d)
            return jsonify({"stories": result})
        family_id = user.family_id
    
    # Verify user is a member of the requested family
    from models.family import FamilyMember
    is_member = (family_id == user.family_id) or bool(
        FamilyMember.query.filter_by(user_id=user.id, family_id=family_id).first()
    )
    
    if not is_member:
        return jsonify({"error": "Access denied - not a member of this family"}), 403
    
    # CRITICAL: Only show stories from THIS specific family
    stories = Story.query.filter_by(family_id=family_id, is_archived=False)\
        .order_by(Story.created_at.desc()).limit(100).all()
    
    user_liked = {l.story_id for l in Like.query.filter_by(user_id=user.id).all()}
    user_saved = {s.story_id for s in SavedStory.query.filter_by(user_id=user.id).all()}
    
    result = []
    for s in stories:
        d = s.to_dict()
        d["liked_by_me"] = s.id in user_liked
        d["saved_by_me"] = s.id in user_saved
        result.append(d)
    
    return jsonify({"stories": result})


@story_bp.route("/timeline", methods=["GET"])
@jwt_required()
def timeline():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404
    if not user.family_id:
        # Show user's own stories if no family
        stories = Story.query.filter_by(user_id=user.id)\
            .order_by(Story.story_date.asc().nullslast(), Story.created_at.desc()).all()
        return jsonify({"stories": [s.to_dict() for s in stories]})
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
    if story.privacy == "family":
        from models.family import FamilyMember
        is_member = (story.family_id == user.family_id) or bool(
            FamilyMember.query.filter_by(user_id=user.id, family_id=story.family_id).first()
        )
        if not is_member:
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


@story_bp.route("/user/<int:user_id>/family/<int:family_id>", methods=["GET"])
@jwt_required()
def user_family_stories(user_id, family_id):
    """Get stories posted by a specific user in a specific family group.
    Only accessible by members of that family."""
    # Validate parameters
    if not user_id or user_id <= 0:
        return jsonify({"error": "Invalid user_id"}), 400
    if not family_id or family_id <= 0:
        return jsonify({"error": "Invalid family_id"}), 400
    
    current = current_user()
    from models.family import FamilyMember
    membership = FamilyMember.query.filter_by(user_id=current.id, family_id=family_id).first()
    if not membership and current.family_id != family_id:
        return jsonify({"error": "Access denied"}), 403
    stories = Story.query.filter_by(user_id=user_id, family_id=family_id)\
        .order_by(Story.created_at.desc()).all()
    return jsonify({"stories": [s.to_dict() for s in stories]})


@story_bp.route("/notifications", methods=["GET"])
@jwt_required()
def get_notifications():
    user = current_user()
    # Get all stories owned by this user
    my_stories = Story.query.filter_by(user_id=user.id).all()
    notifs = []

    for story in my_stories:
        # Likes on this story (exclude self-likes)
        likes = Like.query.filter(
            Like.story_id == story.id,
            Like.user_id != user.id
        ).order_by(Like.id.desc()).all()

        for like in likes:
            liker = User.query.get(like.user_id)
            if liker:
                notifs.append({
                    "id": f"like-{like.id}",
                    "type": "like",
                    "actor_name": liker.name,
                    "actor_avatar": liker.avatar_url,
                    "story_id": story.id,
                    "story_title": story.title,
                    "story_media": story.media_url,
                    "story_media_type": story.media_type,
                    "created_at": story.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                })

        # Comments on this story (exclude own comments)
        comments = Comment.query.filter(
            Comment.story_id == story.id,
            Comment.user_id != user.id
        ).order_by(Comment.created_at.desc()).all()

        for comment in comments:
            commenter = User.query.get(comment.user_id)
            if commenter:
                notifs.append({
                    "id": f"comment-{comment.id}",
                    "type": "comment",
                    "actor_name": commenter.name,
                    "actor_avatar": commenter.avatar_url,
                    "story_id": story.id,
                    "story_title": story.title,
                    "story_media": story.media_url,
                    "story_media_type": story.media_type,
                    "comment_text": comment.text,
                    "created_at": comment.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                })

    # Also notify about new family stories posted by others
    if user.family_id:
        new_stories = Story.query.filter(
            Story.family_id == user.family_id,
            Story.user_id != user.id
        ).order_by(Story.created_at.desc()).limit(10).all()

        for story in new_stories:
            author = User.query.get(story.user_id)
            if author:
                notifs.append({
                    "id": f"story-{story.id}",
                    "type": "new_story",
                    "actor_name": author.name,
                    "actor_avatar": author.avatar_url,
                    "story_id": story.id,
                    "story_title": story.title,
                    "story_media": story.media_url,
                    "story_media_type": story.media_type,
                    "created_at": story.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                })

    # Sort by most recent
    notifs.sort(key=lambda x: x["created_at"], reverse=True)
    return jsonify({"notifications": notifs[:50]})


@story_bp.route("/notifications/count", methods=["GET"])
@jwt_required()
def notification_count():
    user = current_user()
    my_stories = Story.query.filter_by(user_id=user.id).all()
    story_ids = [s.id for s in my_stories]
    likes = Like.query.filter(
        Like.story_id.in_(story_ids),
        Like.user_id != user.id
    ).count() if story_ids else 0
    comments = Comment.query.filter(
        Comment.story_id.in_(story_ids),
        Comment.user_id != user.id
    ).count() if story_ids else 0
    return jsonify({"count": likes + comments})


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


@story_bp.route("/<int:story_id>/repost", methods=["POST"])
@jwt_required()
def repost_story(story_id):
    story = Story.query.get_or_404(story_id)
    story.repost_count = (story.repost_count or 0) + 1
    db.session.commit()
    return jsonify({"repost_count": story.repost_count})


@story_bp.route("/<int:story_id>/report", methods=["POST"])
@jwt_required()
def report_story(story_id):
    # placeholder — just acknowledge for now
    return jsonify({"message": "Story reported. Our team will review it."})


@story_bp.route("/<int:story_id>/archive", methods=["POST"])
@jwt_required()
def toggle_archive(story_id):
    user = current_user()
    story = Story.query.get_or_404(story_id)
    if story.user_id != user.id:
        return jsonify({"error": "Not authorized"}), 403
    story.is_archived = not story.is_archived
    story.archived_at = datetime.utcnow() if story.is_archived else None
    db.session.commit()
    return jsonify({"archived": story.is_archived})


@story_bp.route("/<int:story_id>/highlight", methods=["POST"])
@jwt_required()
def toggle_highlight(story_id):
    user = current_user()
    story = Story.query.get_or_404(story_id)
    # Allow family admins/owner to highlight
    from models.family import FamilyMember
    membership = FamilyMember.query.filter_by(user_id=user.id, family_id=story.family_id).first()
    is_admin = membership and membership.role in ('owner', 'admin')
    if story.user_id != user.id and not is_admin:
        return jsonify({"error": "Not authorized"}), 403
    story.is_highlighted = not story.is_highlighted
    story.highlighted_at = datetime.utcnow() if story.is_highlighted else None
    db.session.commit()
    return jsonify({"highlighted": story.is_highlighted})


@story_bp.route("/family/<int:family_id>/highlights", methods=["GET"])
@jwt_required()
def family_highlights(family_id):
    user = current_user()
    from models.family import FamilyMember
    membership = FamilyMember.query.filter_by(user_id=user.id, family_id=family_id).first()
    if not membership and user.family_id != family_id:
        return jsonify({"error": "Access denied"}), 403
    stories = Story.query.filter_by(family_id=family_id, is_highlighted=True)\
        .order_by(Story.highlighted_at.desc()).all()
    return jsonify({"stories": [s.to_dict() for s in stories]})


@story_bp.route("/archived", methods=["GET"])
@jwt_required()
def my_archived():
    user = current_user()
    stories = Story.query.filter_by(user_id=user.id, is_archived=True)\
        .order_by(Story.archived_at.desc()).all()
    return jsonify({"stories": [s.to_dict() for s in stories]})
