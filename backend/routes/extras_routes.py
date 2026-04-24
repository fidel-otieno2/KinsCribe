from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.extras import (FamilyTreeNode, FamilyEvent, FamilyRecipe, FamilyTask,
                            FamilyBudget, PostInsight, CloseFriend, ScheduledPost,
                            VerifiedBadge)
from models.social import Post, Connection, MessageRequest
from datetime import datetime, date
import cloudinary, cloudinary.uploader, os, json

extras_bp = Blueprint("extras", __name__)

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)


def me():
    return User.query.get(int(get_jwt_identity()))


# ── Family Tree ───────────────────────────────────────────────

@extras_bp.route("/tree", methods=["GET"])
@jwt_required()
def get_tree():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    nodes = FamilyTreeNode.query.filter_by(family_id=user.family_id).all()
    return jsonify({"nodes": [n.to_dict() for n in nodes]})


@extras_bp.route("/tree", methods=["POST"])
@jwt_required()
def add_tree_node():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    data = request.get_json() or {}
    birth = None
    death = None
    try:
        if data.get("birth_date"): birth = datetime.strptime(data["birth_date"], "%Y-%m-%d").date()
        if data.get("death_date"): death = datetime.strptime(data["death_date"], "%Y-%m-%d").date()
    except: pass

    node = FamilyTreeNode(
        family_id=user.family_id,
        user_id=data.get("user_id"),
        display_name=data.get("display_name"),
        display_avatar=data.get("display_avatar"),
        birth_date=birth, death_date=death,
        is_deceased=data.get("is_deceased", False),
        relationship_label=data.get("relationship_label"),
        parent_node_id=data.get("parent_node_id"),
        partner_node_id=data.get("partner_node_id"),
        generation=data.get("generation", 0)
    )
    db.session.add(node)
    db.session.commit()
    return jsonify({"node": node.to_dict()}), 201


@extras_bp.route("/tree/<int:node_id>", methods=["PUT"])
@jwt_required()
def update_tree_node(node_id):
    node = FamilyTreeNode.query.get_or_404(node_id)
    data = request.get_json() or {}
    for field in ("display_name", "display_avatar", "relationship_label",
                  "parent_node_id", "partner_node_id", "generation", "is_deceased"):
        if field in data:
            setattr(node, field, data[field])
    try:
        if data.get("birth_date"): node.birth_date = datetime.strptime(data["birth_date"], "%Y-%m-%d").date()
        if data.get("death_date"): node.death_date = datetime.strptime(data["death_date"], "%Y-%m-%d").date()
    except: pass
    db.session.commit()
    return jsonify({"node": node.to_dict()})


@extras_bp.route("/tree/<int:node_id>", methods=["DELETE"])
@jwt_required()
def delete_tree_node(node_id):
    node = FamilyTreeNode.query.get_or_404(node_id)
    db.session.delete(node)
    db.session.commit()
    return jsonify({"message": "Deleted"})


# ── Family Calendar ───────────────────────────────────────────

@extras_bp.route("/calendar", methods=["GET"])
@jwt_required()
def get_events():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)
    q = FamilyEvent.query.filter_by(family_id=user.family_id)
    if month and year:
        q = q.filter(
            db.extract("month", FamilyEvent.event_date) == month,
            db.extract("year", FamilyEvent.event_date) == year
        )
    events = q.order_by(FamilyEvent.event_date).all()
    return jsonify({"events": [e.to_dict() for e in events]})


@extras_bp.route("/calendar", methods=["POST"])
@jwt_required()
def create_event():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    data = request.get_json() or {}
    try:
        event_date = datetime.fromisoformat(data["event_date"])
    except:
        return jsonify({"error": "Invalid date format"}), 400
    end_date = None
    try:
        if data.get("end_date"): end_date = datetime.fromisoformat(data["end_date"])
    except: pass

    event = FamilyEvent(
        family_id=user.family_id, created_by=user.id,
        title=data["title"], description=data.get("description"),
        event_date=event_date, end_date=end_date,
        event_type=data.get("event_type", "event"),
        color=data.get("color", "#7c3aed"),
        is_recurring=data.get("is_recurring", False),
        recurrence=data.get("recurrence")
    )
    db.session.add(event)
    db.session.commit()
    return jsonify({"event": event.to_dict()}), 201


@extras_bp.route("/calendar/<int:event_id>", methods=["DELETE"])
@jwt_required()
def delete_event(event_id):
    event = FamilyEvent.query.get_or_404(event_id)
    db.session.delete(event)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@extras_bp.route("/calendar/upcoming", methods=["GET"])
@jwt_required()
def upcoming_events():
    user = me()
    if not user.family_id:
        return jsonify({"events": []})
    now = datetime.utcnow()
    events = FamilyEvent.query.filter(
        FamilyEvent.family_id == user.family_id,
        FamilyEvent.event_date >= now
    ).order_by(FamilyEvent.event_date).limit(5).all()
    return jsonify({"events": [e.to_dict() for e in events]})


# ── Family Recipes ────────────────────────────────────────────

@extras_bp.route("/recipes", methods=["GET"])
@jwt_required()
def get_recipes():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    category = request.args.get("category")
    q = FamilyRecipe.query.filter_by(family_id=user.family_id)
    if category:
        q = q.filter_by(category=category)
    recipes = q.order_by(FamilyRecipe.created_at.desc()).all()
    return jsonify({"recipes": [r.to_dict() for r in recipes]})


@extras_bp.route("/recipes", methods=["POST"])
@jwt_required()
def create_recipe():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403

    image_url = None
    if "image" in request.files:
        result = cloudinary.uploader.upload(request.files["image"], folder="kinscribe/recipes")
        image_url = result["secure_url"]

    # Accept both JSON and form data
    if request.is_json:
        data = request.get_json() or {}
    else:
        data = request.form.to_dict()

    ingredients = data.get("ingredients", "[]")
    if isinstance(ingredients, list):
        ingredients = json.dumps(ingredients)
    elif isinstance(ingredients, str):
        # already a JSON string or plain string
        try:
            json.loads(ingredients)  # validate it's valid JSON
        except:
            ingredients = json.dumps([ingredients]) if ingredients else "[]"

    recipe = FamilyRecipe(
        family_id=user.family_id, user_id=user.id,
        title=data.get("title", ""), description=data.get("description"),
        ingredients=ingredients, instructions=data.get("instructions"),
        image_url=image_url or data.get("image_url"),
        prep_time=int(data["prep_time"]) if data.get("prep_time") else None,
        servings=int(data["servings"]) if data.get("servings") else None,
        category=data.get("category"), tags=data.get("tags")
    )
    db.session.add(recipe)
    db.session.commit()
    return jsonify({"recipe": recipe.to_dict()}), 201


@extras_bp.route("/recipes/<int:recipe_id>", methods=["DELETE"])
@jwt_required()
def delete_recipe(recipe_id):
    recipe = FamilyRecipe.query.get_or_404(recipe_id)
    if recipe.user_id != int(get_jwt_identity()):
        return jsonify({"error": "Not authorized"}), 403
    db.session.delete(recipe)
    db.session.commit()
    return jsonify({"message": "Deleted"})


# ── Family Tasks ──────────────────────────────────────────────

@extras_bp.route("/tasks", methods=["GET"])
@jwt_required()
def get_tasks():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    tasks = FamilyTask.query.filter_by(family_id=user.family_id).order_by(
        FamilyTask.is_done, FamilyTask.due_date
    ).all()
    return jsonify({"tasks": [t.to_dict() for t in tasks]})


@extras_bp.route("/tasks", methods=["POST"])
@jwt_required()
def create_task():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    data = request.get_json() or {}
    due = None
    try:
        if data.get("due_date"): due = datetime.fromisoformat(data["due_date"])
    except: pass
    task = FamilyTask(
        family_id=user.family_id, created_by=user.id,
        assigned_to=data.get("assigned_to"),
        title=data["title"], description=data.get("description"),
        due_date=due, priority=data.get("priority", "medium")
    )
    db.session.add(task)
    db.session.commit()
    return jsonify({"task": task.to_dict()}), 201


@extras_bp.route("/tasks/<int:task_id>/toggle", methods=["POST"])
@jwt_required()
def toggle_task(task_id):
    task = FamilyTask.query.get_or_404(task_id)
    task.is_done = not task.is_done
    db.session.commit()
    return jsonify({"task": task.to_dict()})


@extras_bp.route("/tasks/<int:task_id>", methods=["DELETE"])
@jwt_required()
def delete_task(task_id):
    task = FamilyTask.query.get_or_404(task_id)
    db.session.delete(task)
    db.session.commit()
    return jsonify({"message": "Deleted"})


# ── Family Budget ─────────────────────────────────────────────

@extras_bp.route("/budget", methods=["GET"])
@jwt_required()
def get_budget():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    month = request.args.get("month", type=int, default=datetime.utcnow().month)
    year = request.args.get("year", type=int, default=datetime.utcnow().year)
    entries = FamilyBudget.query.filter(
        FamilyBudget.family_id == user.family_id,
        db.extract("month", FamilyBudget.date) == month,
        db.extract("year", FamilyBudget.date) == year
    ).order_by(FamilyBudget.date.desc()).all()
    total_income = sum(e.amount for e in entries if e.entry_type == "income")
    total_expense = sum(e.amount for e in entries if e.entry_type == "expense")
    return jsonify({
        "entries": [e.to_dict() for e in entries],
        "total_income": total_income,
        "total_expense": total_expense,
        "balance": total_income - total_expense
    })


@extras_bp.route("/budget", methods=["POST"])
@jwt_required()
def add_budget_entry():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    data = request.get_json() or {}
    entry_date = date.today()
    try:
        if data.get("date"): entry_date = datetime.strptime(data["date"], "%Y-%m-%d").date()
    except: pass
    entry = FamilyBudget(
        family_id=user.family_id, user_id=user.id,
        title=data["title"], amount=float(data["amount"]),
        category=data.get("category", "other"),
        entry_type=data.get("entry_type", "expense"),
        date=entry_date, notes=data.get("notes")
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify({"entry": entry.to_dict()}), 201


@extras_bp.route("/budget/<int:entry_id>", methods=["DELETE"])
@jwt_required()
def delete_budget_entry(entry_id):
    entry = FamilyBudget.query.get_or_404(entry_id)
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"message": "Deleted"})


# ── Post Insights ─────────────────────────────────────────────

@extras_bp.route("/insights/<int:post_id>", methods=["GET"])
@jwt_required()
def get_post_insights(post_id):
    current_id = int(get_jwt_identity())
    post = Post.query.get_or_404(post_id)
    if post.user_id != current_id:
        return jsonify({"error": "Not authorized"}), 403
    insights = PostInsight.query.filter_by(post_id=post_id).order_by(PostInsight.date).all()
    total = {
        "impressions": sum(i.impressions for i in insights),
        "reach": sum(i.reach for i in insights),
        "profile_visits": sum(i.profile_visits for i in insights),
        "shares": sum(i.shares for i in insights),
        "likes": post.to_dict(current_id)["like_count"],
        "comments": post.to_dict(current_id)["comment_count"],
        "saves": len(post.saves)
    }
    return jsonify({"insights": [i.to_dict() for i in insights], "total": total})


@extras_bp.route("/insights/profile", methods=["GET"])
@jwt_required()
def profile_insights():
    from models.social import Message, Conversation, ConversationParticipant, PublicStory, PublicStoryView
    from models.family import FamilyMember
    from models.story import Story
    from models.notifications import Notification
    from sqlalchemy import text, func
    from datetime import timedelta
    current_id = int(get_jwt_identity())
    user = me()
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    posts = Post.query.filter_by(user_id=current_id).all()
    total_likes = sum(len(p.likes) for p in posts)
    total_comments = sum(len(p.comments) for p in posts)
    total_saves = sum(len(p.saves) for p in posts)
    total_shares = sum(p.share_count or 0 for p in posts)
    total_views = sum(p.view_count or 0 for p in posts)
    connections_count = Connection.query.filter_by(following_id=current_id, status="accepted").count()
    interests_count = Connection.query.filter_by(follower_id=current_id, status="accepted").count()

    # Engagement rate
    eng_rate = 0
    if total_views > 0:
        eng_rate = round(((total_likes + total_comments + total_shares) / total_views) * 100, 1)

    # Top 5 posts by engagement (likes + comments + saves)
    top_posts = sorted(posts, key=lambda p: len(p.likes) + len(p.comments) + len(p.saves), reverse=True)[:5]

    # Posts by type
    type_counts = {}
    for p in posts:
        t = p.media_type or "text"
        type_counts[t] = type_counts.get(t, 0) + 1

    # Voice posts stats
    voice_posts = [p for p in posts if p.media_type == "audio"]
    voice_plays = sum(p.view_count or 0 for p in voice_posts)

    # Weekly growth: connections gained in last 7 days
    new_connections = Connection.query.filter(
        Connection.following_id == current_id,
        Connection.status == "accepted",
        Connection.created_at >= week_ago
    ).count()

    # 7-day daily growth trend (new connections per day)
    weekly_trend = []
    for i in range(6, -1, -1):
        day_start = now - timedelta(days=i+1)
        day_end = now - timedelta(days=i)
        count = Connection.query.filter(
            Connection.following_id == current_id,
            Connection.status == "accepted",
            Connection.created_at >= day_start,
            Connection.created_at < day_end
        ).count()
        weekly_trend.append({"day": day_start.strftime("%a"), "count": count})

    # Top interactive connections (users who liked/commented most on my posts)
    top_connections = []
    try:
        from models.social import PostLike, PostComment
        post_ids = [p.id for p in posts]
        if post_ids:
            liker_counts = db.session.query(
                PostLike.user_id, func.count(PostLike.id).label("cnt")
            ).filter(
                PostLike.post_id.in_(post_ids),
                PostLike.user_id != current_id
            ).group_by(PostLike.user_id).order_by(func.count(PostLike.id).desc()).limit(5).all()
            for row in liker_counts:
                u = User.query.get(row[0])
                if u:
                    top_connections.append({"id": u.id, "name": u.name, "avatar": u.avatar_url, "interactions": row[1]})
    except Exception:
        pass

    # Messages stats
    msgs_sent = 0
    msgs_received = 0
    active_convs = 0
    top_chatters = []
    try:
        my_parts = ConversationParticipant.query.filter_by(user_id=current_id).all()
        conv_ids = [p.conversation_id for p in my_parts]
        active_convs = len(conv_ids)
        msgs_sent = Message.query.filter_by(sender_id=current_id).count()
        msgs_received = Message.query.filter(
            Message.conversation_id.in_(conv_ids),
            Message.sender_id != current_id
        ).count()
        if conv_ids:
            top_raw = db.session.execute(text("""
                SELECT m.sender_id, COUNT(*) as cnt
                FROM messages m
                WHERE m.conversation_id = ANY(:cids)
                AND m.sender_id != :uid
                GROUP BY m.sender_id
                ORDER BY cnt DESC
                LIMIT 5
            """), {"cids": conv_ids, "uid": current_id}).fetchall()
            for row in top_raw:
                u = User.query.get(row[0])
                if u:
                    top_chatters.append({"id": u.id, "name": u.name, "avatar": u.avatar_url, "count": row[1]})
    except Exception:
        pass

    # Notification insights
    notif_data = {}
    try:
        total_notifs = Notification.query.filter_by(user_id=current_id).count()
        unread_notifs = Notification.query.filter_by(user_id=current_id, is_read=False).count()
        new_conn_notifs = Notification.query.filter(
            Notification.user_id == current_id,
            Notification.type == "connection",
            Notification.created_at >= week_ago
        ).count()
        mention_notifs = Notification.query.filter(
            Notification.user_id == current_id,
            Notification.type == "mention",
        ).count()
        notif_data = {
            "total": total_notifs,
            "unread": unread_notifs,
            "new_connections_notifs": new_conn_notifs,
            "mentions": mention_notifs,
        }
    except Exception:
        pass

    # Public stories stats
    stories_count = 0
    story_views = 0
    story_replies = 0
    top_story = None
    music_counts = {}
    try:
        my_stories = PublicStory.query.filter_by(user_id=current_id).all()
        stories_count = len(my_stories)
        story_views = sum(s.view_count or 0 for s in my_stories)
        # replies = messages that reference a story (media_type='story_reply')
        story_replies = Message.query.filter_by(sender_id=current_id, media_type="story_reply").count()
        # Top story by views
        if my_stories:
            best = max(my_stories, key=lambda s: s.view_count or 0)
            top_story = {
                "id": best.id,
                "media_url": best.media_url,
                "media_type": best.media_type,
                "views": best.view_count or 0,
                "music_name": best.music_name,
            }
        # Music usage from stories
        for s in my_stories:
            if s.music_name:
                music_counts[s.music_name] = music_counts.get(s.music_name, 0) + 1
    except Exception:
        pass

    # Music from family stories
    try:
        fam_stories_all = Story.query.filter_by(user_id=current_id).all()
        for s in fam_stories_all:
            if s.music_name:
                music_counts[s.music_name] = music_counts.get(s.music_name, 0) + 1
    except Exception:
        pass

    top_music = sorted(music_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    top_music = [{"name": k, "count": v} for k, v in top_music]

    # Family insights
    family_data = {}
    if user.family_id:
        try:
            fm_list = FamilyMember.query.filter_by(family_id=user.family_id).all()
            fam_conv = Conversation.query.filter_by(type="family", family_id=user.family_id).first()
            most_active_member = None
            fam_msg_count = 0
            fam_group_eng_rate = 0
            if fam_conv:
                fam_msg_count = Message.query.filter_by(conversation_id=fam_conv.id).count()
                top_fam = db.session.execute(text("""
                    SELECT sender_id, COUNT(*) as cnt
                    FROM messages WHERE conversation_id = :cid
                    GROUP BY sender_id ORDER BY cnt DESC LIMIT 1
                """), {"cid": fam_conv.id}).fetchone()
                if top_fam:
                    u = User.query.get(top_fam[0])
                    if u:
                        most_active_member = {"id": u.id, "name": u.name, "avatar": u.avatar_url, "count": top_fam[1]}
                # Group engagement rate: msgs / members
                if len(fm_list) > 0:
                    fam_group_eng_rate = round(fam_msg_count / len(fm_list), 1)
            fam_stories_count = Story.query.filter_by(family_id=user.family_id).count()
            # Most viewed family story
            best_fam_story = Story.query.filter_by(family_id=user.family_id).order_by(
                Story.repost_count.desc()
            ).first()
            # Mention count in family group
            mention_count = 0
            if fam_conv:
                try:
                    mention_count = db.session.execute(text("""
                        SELECT COUNT(*) FROM messages
                        WHERE conversation_id = :cid
                        AND mentions IS NOT NULL AND mentions != '[]'
                    """), {"cid": fam_conv.id}).scalar() or 0
                except Exception:
                    pass
            family_data = {
                "member_count": len(fm_list),
                "total_messages": fam_msg_count,
                "most_active_member": most_active_member,
                "total_stories": fam_stories_count,
                "group_engagement_rate": fam_group_eng_rate,
                "mention_count": mention_count,
                "most_viewed_story": best_fam_story.title if best_fam_story else None,
            }
        except Exception:
            pass

    # AI insights — dynamic based on real data
    ai_insights = []
    if type_counts.get("video", 0) > type_counts.get("image", 0):
        ai_insights.append("Your videos get more engagement than photos — keep posting videos.")
    elif type_counts.get("image", 0) > 0:
        ai_insights.append("Posts with images perform well — try adding short videos to boost reach.")
    if eng_rate >= 5:
        ai_insights.append(f"Your {eng_rate}% engagement rate is excellent — you're in the top tier.")
    elif eng_rate > 0:
        ai_insights.append(f"Your engagement rate is {eng_rate}%. Replying to comments can push it above 5%.")
    if new_connections > 5:
        ai_insights.append(f"You gained {new_connections} new connections this week — your content is reaching new people.")
    if top_music:
        ai_insights.append(f"Stories with music get more views. Your most used song: '{top_music[0]['name']}'.")
    if voice_posts:
        ai_insights.append(f"You have {len(voice_posts)} voice posts with {voice_plays} total plays — voice content builds intimacy.")
    if not ai_insights:
        ai_insights.append("Post consistently and engage with comments to unlock deeper insights.")

    return jsonify({
        # Overview
        "total_posts": len(posts),
        "total_likes": total_likes,
        "total_comments": total_comments,
        "total_saves": total_saves,
        "total_shares": total_shares,
        "total_views": total_views,
        "connections": connections_count,
        "interests": interests_count,
        "new_connections_this_week": new_connections,
        "engagement_rate": eng_rate,
        # Content
        "top_posts": [{
            "id": p.id,
            "caption": (p.caption or "")[:60],
            "media_url": p.media_url,
            "media_type": p.media_type,
            "likes": len(p.likes),
            "comments": len(p.comments),
            "saves": len(p.saves),
            "shares": p.share_count or 0,
            "views": p.view_count or 0,
        } for p in top_posts],
        "content_types": type_counts,
        "stories_count": stories_count,
        "story_views": story_views,
        "story_replies": story_replies,
        "top_story": top_story,
        # Voice
        "voice_posts_count": len(voice_posts),
        "voice_plays": voice_plays,
        # Music
        "top_music": top_music,
        # Activity
        "weekly_trend": weekly_trend,
        # Audience
        "top_connections": top_connections,
        # Messaging
        "messages_sent": msgs_sent,
        "messages_received": msgs_received,
        "active_conversations": active_convs,
        "top_chatters": top_chatters,
        # Notifications
        "notifications": notif_data,
        # Family
        "family": family_data,
        # AI
        "ai_insights": ai_insights,
    })


# ── Close Friends ─────────────────────────────────────────────

@extras_bp.route("/close-friends", methods=["GET"])
@jwt_required()
def get_close_friends():
    current_id = int(get_jwt_identity())
    friends = CloseFriend.query.filter_by(user_id=current_id).all()
    result = []
    for f in friends:
        u = User.query.get(f.friend_id)
        if u:
            result.append({**u.to_dict(), "close_friend_id": f.id})
    return jsonify({"close_friends": result})


@extras_bp.route("/close-friends/<int:friend_id>/toggle", methods=["POST"])
@jwt_required()
def toggle_close_friend(friend_id):
    current_id = int(get_jwt_identity())
    existing = CloseFriend.query.filter_by(user_id=current_id, friend_id=friend_id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({"is_close_friend": False})
    db.session.add(CloseFriend(user_id=current_id, friend_id=friend_id))
    db.session.commit()
    return jsonify({"is_close_friend": True})


# ── Scheduled Posts ───────────────────────────────────────────

@extras_bp.route("/scheduled", methods=["GET"])
@jwt_required()
def get_scheduled():
    current_id = int(get_jwt_identity())
    posts = ScheduledPost.query.filter_by(user_id=current_id, is_published=False).order_by(
        ScheduledPost.scheduled_at
    ).all()
    return jsonify({"scheduled_posts": [p.to_dict() for p in posts]})


@extras_bp.route("/scheduled", methods=["POST"])
@jwt_required()
def schedule_post():
    current_id = int(get_jwt_identity())
    data = request.get_json() or {}
    try:
        scheduled_at = datetime.fromisoformat(data["scheduled_at"])
    except:
        return jsonify({"error": "Invalid scheduled_at date"}), 400
    post = ScheduledPost(
        user_id=current_id, caption=data.get("caption"),
        media_url=data.get("media_url"), media_type=data.get("media_type"),
        privacy=data.get("privacy", "public"),
        hashtags=data.get("hashtags"), location=data.get("location"),
        scheduled_at=scheduled_at
    )
    db.session.add(post)
    db.session.commit()
    return jsonify({"scheduled_post": post.to_dict()}), 201


@extras_bp.route("/scheduled/<int:post_id>", methods=["DELETE"])
@jwt_required()
def delete_scheduled(post_id):
    post = ScheduledPost.query.get_or_404(post_id)
    if post.user_id != int(get_jwt_identity()):
        return jsonify({"error": "Not authorized"}), 403
    db.session.delete(post)
    db.session.commit()
    return jsonify({"message": "Deleted"})


# ── Message Requests ──────────────────────────────────────────

@extras_bp.route("/message-requests", methods=["GET"])
@jwt_required()
def get_message_requests():
    current_id = int(get_jwt_identity())
    requests_list = MessageRequest.query.filter_by(
        receiver_id=current_id, status="pending"
    ).order_by(MessageRequest.created_at.desc()).all()
    return jsonify({"requests": [r.to_dict() for r in requests_list]})


@extras_bp.route("/message-requests/<int:req_id>/accept", methods=["POST"])
@jwt_required()
def accept_message_request(req_id):
    req = MessageRequest.query.get_or_404(req_id)
    if req.receiver_id != int(get_jwt_identity()):
        return jsonify({"error": "Not authorized"}), 403
    req.status = "accepted"
    db.session.commit()
    return jsonify({"message": "Accepted"})


@extras_bp.route("/message-requests/<int:req_id>/decline", methods=["POST"])
@jwt_required()
def decline_message_request(req_id):
    req = MessageRequest.query.get_or_404(req_id)
    if req.receiver_id != int(get_jwt_identity()):
        return jsonify({"error": "Not authorized"}), 403
    req.status = "declined"
    db.session.commit()
    return jsonify({"message": "Declined"})


# ── Verified Badge ────────────────────────────────────────────

@extras_bp.route("/verified/<int:user_id>", methods=["GET"])
@jwt_required()
def check_verified(user_id):
    badge = VerifiedBadge.query.filter_by(user_id=user_id).first()
    return jsonify({"is_verified": badge is not None, "badge_type": badge.badge_type if badge else None})


# ── On This Day ───────────────────────────────────────────────

@extras_bp.route("/on-this-day", methods=["GET"])
@jwt_required()
def on_this_day():
    from models.story import Story
    user = me()
    if not user.family_id:
        return jsonify({"stories": []})
    today = datetime.utcnow()
    stories = Story.query.filter(
        Story.family_id == user.family_id,
        db.extract("month", Story.story_date) == today.month,
        db.extract("day", Story.story_date) == today.day,
        Story.story_date != None
    ).order_by(Story.story_date.desc()).all()
    return jsonify({"stories": [s.to_dict() for s in stories], "date": today.strftime("%B %d")})
