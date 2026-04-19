from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from extensions import db
from models.user import User
from models.social import Post, PostLike, Connection, PublicStory
from models.family import Family
from sqlalchemy import or_, and_, func, desc, text
from datetime import datetime, timedelta
import json

search_bp = Blueprint("search", __name__)


@search_bp.route("/users", methods=["GET"])
@jwt_required()
def search_users():
    """Search for users by name, username, or email"""
    current_user_id = int(get_jwt_identity())
    query = request.args.get("q", "").strip()
    page = int(request.args.get("page", 1))
    limit = min(int(request.args.get("limit", 20)), 50)
    
    if not query or len(query) < 2:
        return jsonify({"users": [], "page": page, "has_more": False})
    
    # Search users
    users = User.query.filter(
        and_(
            User.id != current_user_id,
            or_(
                User.name.ilike(f"%{query}%"),
                User.username.ilike(f"%{query}%"),
                User.email.ilike(f"%{query}%")
            )
        )
    ).offset((page - 1) * limit).limit(limit + 1).all()
    
    has_more = len(users) > limit
    if has_more:
        users = users[:-1]
    
    return jsonify({
        "users": [u.to_dict() for u in users],
        "page": page,
        "has_more": has_more
    })


@search_bp.route("/posts", methods=["GET"])
@jwt_required()
def search_posts():
    """Search posts by caption, hashtags, or location"""
    current_user_id = int(get_jwt_identity())
    query = request.args.get("q", "").strip()
    page = int(request.args.get("page", 1))
    limit = min(int(request.args.get("limit", 20)), 50)
    media_type = request.args.get("media_type")  # photo|video|carousel
    location = request.args.get("location")
    
    if not query or len(query) < 2:
        return jsonify({"posts": [], "page": page, "has_more": False})
    
    # Build search query
    search_conditions = [
        Post.caption.ilike(f"%{query}%"),
        Post.hashtags.ilike(f"%{query}%")
    ]
    
    if location:
        search_conditions.append(Post.location.ilike(f"%{location}%"))
    
    posts_query = Post.query.filter(
        and_(
            or_(*search_conditions),
            Post.privacy == "public"  # Only public posts in search
        )
    )
    
    if media_type:
        posts_query = posts_query.filter(Post.media_type == media_type)
    
    posts = posts_query.order_by(desc(Post.created_at))\\\n                     .offset((page - 1) * limit)\\\n                     .limit(limit + 1)\\\n                     .all()
    
    has_more = len(posts) > limit
    if has_more:
        posts = posts[:-1]
    
    return jsonify({
        "posts": [p.to_dict(current_user_id) for p in posts],
        "page": page,
        "has_more": has_more
    })


@search_bp.route("/hashtags", methods=["GET"])
@jwt_required()
def search_hashtags():
    """Search and get trending hashtags"""
    query = request.args.get("q", "").strip()
    limit = min(int(request.args.get("limit", 20)), 50)
    
    # Get hashtags from recent posts
    recent_posts = Post.query.filter(
        and_(
            Post.hashtags.isnot(None),
            Post.created_at >= datetime.utcnow() - timedelta(days=7),
            Post.privacy == "public"
        )
    ).all()
    
    # Extract and count hashtags
    hashtag_counts = {}\n    for post in recent_posts:
        if post.hashtags:
            tags = [tag.strip() for tag in post.hashtags.split(',') if tag.strip()]
            for tag in tags:
                if tag.startswith('#'):
                    tag = tag[1:]  # Remove #
                if query and query.lower() not in tag.lower():
                    continue
                hashtag_counts[tag] = hashtag_counts.get(tag, 0) + 1
    
    # Sort by count and limit
    trending = sorted(hashtag_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    
    return jsonify({
        "hashtags": [{"tag": tag, "count": count} for tag, count in trending]
    })


@search_bp.route("/places", methods=["GET"])
@jwt_required()
def search_places():
    """Search places/locations"""
    query = request.args.get("q", "").strip()
    limit = min(int(request.args.get("limit", 20)), 50)
    
    if not query or len(query) < 2:
        return jsonify({"places": []})
    
    # Get unique locations from posts
    locations = db.session.query(Post.location, func.count(Post.id).label('post_count'))\\\n                        .filter(and_(\n                            Post.location.isnot(None),\n                            Post.location.ilike(f"%{query}%"),\n                            Post.privacy == "public"\n                        ))\\\n                        .group_by(Post.location)\\\n                        .order_by(desc('post_count'))\\\n                        .limit(limit)\\\n                        .all()
    
    return jsonify({
        "places": [{"name": loc[0], "post_count": loc[1]} for loc in locations]
    })


@search_bp.route("/explore", methods=["GET"])
@jwt_required()
def explore_feed():
    """Get personalized explore feed"""
    current_user_id = int(get_jwt_identity())
    page = int(request.args.get("page", 1))
    limit = min(int(request.args.get("limit", 20)), 50)
    category = request.args.get("category")  # trending|recent|popular
    
    # Get user's interests for personalization
    user = User.query.get(current_user_id)
    user_interests = user.interests.split(',') if user.interests else []
    
    # Get users the current user follows
    following_ids = [c.following_id for c in Connection.query.filter_by(follower_id=current_user_id).all()]
    
    # Base query - exclude own posts and posts from followed users (they're in main feed)
    base_query = Post.query.filter(
        and_(
            Post.privacy == "public",
            Post.user_id != current_user_id,
            ~Post.user_id.in_(following_ids) if following_ids else True
        )
    )
    
    if category == "trending":
        # Posts with high engagement in last 24 hours
        posts = base_query.join(PostLike)\\\n                          .filter(PostLike.created_at >= datetime.utcnow() - timedelta(hours=24))\\\n                          .group_by(Post.id)\\\n                          .order_by(desc(func.count(PostLike.id)))\\\n                          .offset((page - 1) * limit)\\\n                          .limit(limit + 1)\\\n                          .all()
    elif category == "popular":
        # Posts with most likes overall
        posts = base_query.join(PostLike)\\\n                          .group_by(Post.id)\\\n                          .order_by(desc(func.count(PostLike.id)))\\\n                          .offset((page - 1) * limit)\\\n                          .limit(limit + 1)\\\n                          .all()
    else:
        # Recent posts, optionally filtered by interests
        query = base_query
        if user_interests:
            # Boost posts with matching hashtags
            interest_conditions = [Post.hashtags.ilike(f"%{interest}%") for interest in user_interests]
            query = query.filter(or_(*interest_conditions))
        
        posts = query.order_by(desc(Post.created_at))\\\n                     .offset((page - 1) * limit)\\\n                     .limit(limit + 1)\\\n                     .all()
    
    has_more = len(posts) > limit
    if has_more:
        posts = posts[:-1]
    
    return jsonify({
        "posts": [p.to_dict(current_user_id) for p in posts],
        "page": page,
        "has_more": has_more,
        "category": category or "recent"
    })


@search_bp.route("/suggestions/users", methods=["GET"])
@jwt_required()
def user_suggestions():
    """Get user follow suggestions"""
    current_user_id = int(get_jwt_identity())
    limit = min(int(request.args.get("limit", 10)), 20)
    
    # Get users the current user already follows
    following_ids = [c.following_id for c in Connection.query.filter_by(follower_id=current_user_id).all()]
    following_ids.append(current_user_id)  # Exclude self
    
    # Get user's interests
    user = User.query.get(current_user_id)
    user_interests = user.interests.split(',') if user.interests else []
    
    suggestions = []
    
    # 1. Users with similar interests
    if user_interests:
        interest_conditions = [User.interests.ilike(f"%{interest}%") for interest in user_interests]
        similar_users = User.query.filter(
            and_(
                ~User.id.in_(following_ids),
                or_(*interest_conditions)
            )
        ).limit(limit // 2).all()
        suggestions.extend(similar_users)
    
    # 2. Popular users (most followers)
    if len(suggestions) < limit:
        popular_users = db.session.query(User, func.count(Connection.follower_id).label('follower_count'))\\\n                                  .outerjoin(Connection, Connection.following_id == User.id)\\\n                                  .filter(~User.id.in_(following_ids + [u.id for u in suggestions]))\\\n                                  .group_by(User.id)\\\n                                  .order_by(desc('follower_count'))\\\n                                  .limit(limit - len(suggestions))\\\n                                  .all()
        suggestions.extend([u[0] for u in popular_users])
    
    return jsonify({
        "suggestions": [u.to_dict() for u in suggestions[:limit]]
    })


@search_bp.route("/audio", methods=["GET"])
@jwt_required()
def search_audio():
    """Search posts by audio/music (placeholder for future audio recognition)"""
    current_user_id = int(get_jwt_identity())
    query = request.args.get("q", "").strip()
    page = int(request.args.get("page", 1))
    limit = min(int(request.args.get("limit", 20)), 50)
    
    if not query:
        return jsonify({"posts": [], "page": page, "has_more": False})
    
    # Search in public stories with music
    stories = PublicStory.query.filter(
        and_(
            PublicStory.music_name.ilike(f"%{query}%"),
            PublicStory.privacy == "public",
            PublicStory.expires_at > datetime.utcnow()
        )
    ).order_by(desc(PublicStory.created_at))\\\n     .offset((page - 1) * limit)\\\n     .limit(limit + 1)\\\n     .all()
    
    has_more = len(stories) > limit
    if has_more:
        stories = stories[:-1]
    
    return jsonify({
        "stories": [s.to_dict(current_user_id) for s in stories],
        "page": page,
        "has_more": has_more
    })


@search_bp.route("/trending", methods=["GET"])
@jwt_required()
def trending_content():
    """Get trending hashtags, locations, and sounds"""
    
    # Trending hashtags (last 7 days)
    recent_posts = Post.query.filter(
        and_(
            Post.hashtags.isnot(None),
            Post.created_at >= datetime.utcnow() - timedelta(days=7),
            Post.privacy == "public"
        )
    ).all()
    
    hashtag_counts = {}
    for post in recent_posts:
        if post.hashtags:
            tags = [tag.strip() for tag in post.hashtags.split(',') if tag.strip()]
            for tag in tags:
                if tag.startswith('#'):
                    tag = tag[1:]
                hashtag_counts[tag] = hashtag_counts.get(tag, 0) + 1
    
    trending_hashtags = sorted(hashtag_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    
    # Trending locations
    trending_locations = db.session.query(Post.location, func.count(Post.id).label('count'))\\\n                                  .filter(and_(\n                                      Post.location.isnot(None),\n                                      Post.created_at >= datetime.utcnow() - timedelta(days=7),\n                                      Post.privacy == "public"\n                                  ))\\\n                                  .group_by(Post.location)\\\n                                  .order_by(desc('count'))\\\n                                  .limit(10)\\\n                                  .all()
    
    # Trending sounds/music
    trending_sounds = db.session.query(PublicStory.music_name, func.count(PublicStory.id).label('count'))\\\n                                .filter(and_(\n                                    PublicStory.music_name.isnot(None),\n                                    PublicStory.created_at >= datetime.utcnow() - timedelta(days=7),\n                                    PublicStory.privacy == "public"\n                                ))\\\n                                .group_by(PublicStory.music_name)\\\n                                .order_by(desc('count'))\\\n                                .limit(10)\\\n                                .all()
    
    return jsonify({
        "hashtags": [{"tag": tag, "count": count} for tag, count in trending_hashtags],
        "locations": [{"name": loc[0], "count": loc[1]} for loc in trending_locations],
        "sounds": [{"name": sound[0], "count": sound[1]} for sound in trending_sounds]
    })