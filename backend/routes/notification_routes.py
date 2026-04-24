from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.story import Story, Comment as StoryComment, Like as StoryLike
from models.social import Post, PostLike, PostComment, Connection
from models.family import Family
import json
from datetime import datetime

notification_bp = Blueprint("notifications", __name__)

# In-memory store for read notification IDs per user
# In production this should be a DB table, but works for now
_read_store = {}

# In-memory store for mention notifications { user_id: [notif_dict, ...] }
_mention_store = {}


def _get_all_notifications(user):
    notifs = []

    # ── 1. Story likes & comments ─────────────────────────────
    my_stories = Story.query.filter_by(user_id=user.id).all()
    for story in my_stories:
        for like in StoryLike.query.filter(StoryLike.story_id == story.id, StoryLike.user_id != user.id).all():
            actor = User.query.get(like.user_id)
            if actor:
                notifs.append({
                    "id": f"story_like-{like.id}",
                    "type": "story_like",
                    "source": "family_story",
                    "actor_name": actor.name,
                    "actor_avatar": actor.avatar_url,
                    "actor_id": actor.id,
                    "title": f"{actor.name} liked your family story",
                    "body": f'"{story.title}"' if story.title else "",
                    "story_id": story.id,
                    "story_title": story.title,
                    "story_media": story.media_url,
                    "story_media_type": story.media_type,
                    "created_at": story.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                })
        for comment in StoryComment.query.filter(StoryComment.story_id == story.id, StoryComment.user_id != user.id).all():
            actor = User.query.get(comment.user_id)
            if actor:
                notifs.append({
                    "id": f"story_comment-{comment.id}",
                    "type": "story_comment",
                    "source": "family_story",
                    "actor_name": actor.name,
                    "actor_avatar": actor.avatar_url,
                    "actor_id": actor.id,
                    "title": f"{actor.name} commented on your family story",
                    "body": comment.text,
                    "story_id": story.id,
                    "story_title": story.title,
                    "story_media": story.media_url,
                    "story_media_type": story.media_type,
                    "comment_text": comment.text,
                    "created_at": comment.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                })

    # ── 2. New family stories from others ────────────────────
    if user.family_id:
        for story in Story.query.filter(Story.family_id == user.family_id, Story.user_id != user.id).order_by(Story.created_at.desc()).limit(20).all():
            actor = User.query.get(story.user_id)
            if actor:
                notifs.append({
                    "id": f"new_family_story-{story.id}",
                    "type": "new_family_story",
                    "source": "family_story",
                    "actor_name": actor.name,
                    "actor_avatar": actor.avatar_url,
                    "actor_id": actor.id,
                    "title": f"{actor.name} shared a family story",
                    "body": story.title or "",
                    "story_id": story.id,
                    "story_title": story.title,
                    "story_media": story.media_url,
                    "story_media_type": story.media_type,
                    "created_at": story.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                })

    # ── 3. Post likes & comments ──────────────────────────────
    my_posts = Post.query.filter_by(user_id=user.id).all()
    for post in my_posts:
        for like in PostLike.query.filter(PostLike.post_id == post.id, PostLike.user_id != user.id).all():
            actor = User.query.get(like.user_id)
            if actor:
                notifs.append({
                    "id": f"post_like-{like.id}",
                    "type": "post_like",
                    "source": "post",
                    "actor_name": actor.name,
                    "actor_avatar": actor.avatar_url,
                    "actor_id": actor.id,
                    "title": f"{actor.name} liked your post",
                    "body": post.caption[:60] if post.caption else "",
                    "post_id": post.id,
                    "post_media": post.media_url,
                    "created_at": post.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                })
        for comment in PostComment.query.filter(PostComment.post_id == post.id, PostComment.user_id != user.id).all():
            actor = User.query.get(comment.user_id)
            if actor:
                notifs.append({
                    "id": f"post_comment-{comment.id}",
                    "type": "post_comment",
                    "source": "post",
                    "actor_name": actor.name,
                    "actor_avatar": actor.avatar_url,
                    "actor_id": actor.id,
                    "title": f"{actor.name} commented on your post",
                    "body": comment.text,
                    "post_id": post.id,
                    "post_media": post.media_url,
                    "comment_text": comment.text,
                    "created_at": comment.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                })

    # ── 4. New connections / follow requests ─────────────────
    for conn in Connection.query.filter_by(following_id=user.id).order_by(Connection.id.desc()).limit(20).all():
        actor = User.query.get(conn.follower_id)
        if actor:
            if conn.status == "pending":
                notifs.append({
                    "id": f"follow_request-{conn.id}",
                    "type": "follow_request",
                    "source": "connection",
                    "actor_name": actor.name,
                    "actor_avatar": actor.avatar_url,
                    "actor_id": actor.id,
                    "connection_id": conn.id,
                    "title": f"{actor.name} wants to follow you",
                    "body": f"@{actor.username}" if actor.username else "",
                    "created_at": conn.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                })
            else:
                notifs.append({
                    "id": f"connection-{conn.id}",
                    "type": "connection",
                    "source": "connection",
                    "actor_name": actor.name,
                    "actor_avatar": actor.avatar_url,
                    "actor_id": actor.id,
                    "title": f"{actor.name} connected with you",
                    "body": f"@{actor.username}" if actor.username else "",
                    "created_at": conn.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                })

    # ── 5. Birthday reminders ─────────────────────────────────
    if user.family_id:
        from models.extras import FamilyEvent
        from sqlalchemy import extract as sa_extract
        today = datetime.utcnow()
        upcoming = FamilyEvent.query.filter(
            FamilyEvent.family_id == user.family_id,
            FamilyEvent.event_type == "birthday",
            sa_extract("month", FamilyEvent.event_date) == today.month,
        ).all()
        for ev in upcoming:
            try:
                ev_this_year = ev.event_date.replace(year=today.year)
                days_away = (ev_this_year.date() - today.date()).days
                if days_away < 0:
                    days_away += 365
                if days_away <= 7:
                    notifs.append({
                        "id": f"birthday-{ev.id}",
                        "type": "birthday",
                        "source": "family",
                        "actor_name": "KinsCribe",
                        "actor_avatar": None,
                        "actor_id": None,
                        "title": f"🎂 {ev.title}",
                        "body": "Today!" if days_away == 0 else f"In {days_away} day{'s' if days_away != 1 else ''}",
                        "created_at": today.isoformat(),
                    })
            except Exception:
                pass

    # ── 6. Post shared notifications ──────────────────────────
    for post in my_posts:
        if post.share_count and post.share_count > 0:
            notifs.append({
                "id": f"post_share-{post.id}",
                "type": "post_share",
                "source": "post",
                "actor_name": "Someone",
                "actor_avatar": None,
                "actor_id": None,
                "title": f"Your post was shared {post.share_count} time{'s' if post.share_count != 1 else ''}",
                "body": post.caption[:60] if post.caption else "",
                "post_id": post.id,
                "post_media": post.media_url,
                "created_at": post.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
            })

    # ── 7. Mention notifications ──────────────────────────────
    for mention_notif in _mention_store.get(user.id, []):
        notifs.append(mention_notif)

    notifs.sort(key=lambda x: x["created_at"], reverse=True)
    return notifs[:60]


@notification_bp.route("/", methods=["GET"])
@jwt_required()
def get_notifications():
    user = User.query.get(int(get_jwt_identity()))
    notifs = _get_all_notifications(user)
    read_ids = set(_read_store.get(user.id, []))
    for n in notifs:
        n["is_read"] = n["id"] in read_ids
    unread_count = sum(1 for n in notifs if not n["is_read"])
    return jsonify({"notifications": notifs, "unread_count": unread_count})


@notification_bp.route("/count", methods=["GET"])
@jwt_required()
def get_notification_count():
    user = User.query.get(int(get_jwt_identity()))
    notifs = _get_all_notifications(user)
    read_ids = set(_read_store.get(user.id, []))
    unread_count = sum(1 for n in notifs if n["id"] not in read_ids)
    return jsonify({"unread_count": unread_count})


@notification_bp.route("/mark-read", methods=["POST"])
@jwt_required()
def mark_read():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    mark_all = data.get("mark_all", False)
    ids = data.get("notification_ids", [])

    if mark_all:
        user = User.query.get(user_id)
        notifs = _get_all_notifications(user)
        _read_store[user_id] = [n["id"] for n in notifs]
    elif ids:
        existing = set(_read_store.get(user_id, []))
        existing.update(ids)
        _read_store[user_id] = list(existing)

    user = User.query.get(user_id)
    notifs = _get_all_notifications(user)
    read_ids = set(_read_store.get(user_id, []))
    unread_count = sum(1 for n in notifs if n["id"] not in read_ids)
    return jsonify({"message": "Marked as read", "unread_count": unread_count})
