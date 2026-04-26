from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.social import Post, PostLike, PostComment, PostSave, Connection, PostCollaborator
import cloudinary, cloudinary.uploader, os, json

post_bp = Blueprint("posts", __name__)

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)


def me():
    return User.query.get(int(get_jwt_identity()))


def _is_connected(user_id, target_id):
    """Returns True only if there is an accepted connection from user_id → target_id"""
    return Connection.query.filter_by(
        follower_id=user_id, following_id=target_id, status="accepted"
    ).first() is not None


def _can_view_profile(current_id, target_user):
    """Can current_id view target_user's posts?
    - Always yes for own profile
    - Always yes if target is public
    - Yes if private AND current_id has an accepted connection
    """
    if current_id == target_user.id:
        return True
    if not target_user.is_private:
        return True
    return _is_connected(current_id, target_user.id)


@post_bp.route("/", methods=["POST"])
@jwt_required()
def create_post():
    user = me()
    media_url = None
    media_urls = []
    media_type = "text"

    # Multiple files (carousel)
    files = request.files.getlist("files")
    if files and files[0].filename:
        for file in files[:10]:
            mime = file.content_type or ""
            resource_type = "video" if "video" in mime else "image"
            mt = "video" if "video" in mime else "image"
            result = cloudinary.uploader.upload(file, resource_type=resource_type, folder="kinscribe/posts")
            media_urls.append({"url": result["secure_url"], "type": mt})
        if len(media_urls) == 1:
            media_url = media_urls[0]["url"]
            media_type = media_urls[0]["type"]
            media_urls = []
        else:
            media_url = media_urls[0]["url"]
            media_type = "carousel"
    elif "file" in request.files:
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
        media_urls=json.dumps(media_urls) if media_urls else None,
        media_type=media_type,
        location=data.get("location"),
        hashtags=data.get("hashtags"),
        privacy=data.get("privacy", "public"),
        user_id=user.id
    )
    # Save music — upload Deezer preview to Cloudinary for permanent storage
    music_id = data.get("music_id")
    music_title = data.get("music_title", "").strip()
    music_preview_url = data.get("music_stream_url", "").strip()
    if music_id and music_title:
        post.music_title = music_title
        post.music_artist = data.get("music_artist", "")
        post.music_artwork = data.get("music_artwork", "")
        try:
            post.music_start_time = int(data.get("music_start_time", 0))
        except Exception:
            post.music_start_time = 0
        # Upload the 30s preview to Cloudinary so it never expires
        if music_preview_url:
            try:
                import urllib.request as _req
                import tempfile, os as _os
                with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp:
                    tmp_path = tmp.name
                _req.urlretrieve(music_preview_url, tmp_path)
                upload_result = cloudinary.uploader.upload(
                    tmp_path,
                    resource_type='video',
                    folder='kinscribe/music',
                    public_id=f'music_{music_id}',
                    overwrite=False,
                )
                post.music_stream_url = upload_result['secure_url']
                _os.unlink(tmp_path)
            except Exception as e:
                # Cloudinary upload failed — don't store the Deezer URL as it expires
                post.music_stream_url = ''
        else:
            post.music_stream_url = ''
    db.session.add(post)
    db.session.flush()  # get post.id before commit

    # Handle collaborators
    collab_raw = data.get("collaborators", "[]")
    try:
        collab_ids = json.loads(collab_raw) if isinstance(collab_raw, str) else collab_raw
    except Exception:
        collab_ids = []
    for c in collab_ids:
        uid = c.get("id") if isinstance(c, dict) else int(c)
        role = c.get("role", "creator") if isinstance(c, dict) else "creator"
        if uid and uid != user.id:
            db.session.add(PostCollaborator(
                post_id=post.id, user_id=uid, role=role, status="pending"
            ))

    db.session.commit()
    return jsonify({"post": post.to_dict(user.id)}), 201


@post_bp.route("/feed", methods=["GET"])
@jwt_required()
def post_feed():
    user = me()
    current_id = user.id
    interests = {c.following_id for c in Connection.query.filter_by(
        follower_id=current_id, status="accepted"
    ).all()}
    candidate_ids = interests | {current_id}
    all_posts = Post.query.filter(Post.user_id.in_(candidate_ids)).order_by(Post.created_at.desc()).limit(50).all()

    # Also include posts where current user is an accepted collaborator
    collab_post_ids = [
        c.post_id for c in PostCollaborator.query.filter_by(user_id=current_id, status="accepted").all()
    ]
    if collab_post_ids:
        collab_posts = Post.query.filter(
            Post.id.in_(collab_post_ids),
            ~Post.id.in_([p.id for p in all_posts])
        ).order_by(Post.created_at.desc()).limit(20).all()
        all_posts = sorted(all_posts + collab_posts, key=lambda x: x.created_at, reverse=True)[:50]

    result = []
    for p in all_posts:
        author = User.query.get(p.user_id)
        if not author:
            continue
        if p.user_id != current_id and author.is_private and not _is_connected(current_id, p.user_id):
            # Allow if current user is an accepted collaborator on this post
            is_collab = p.id in collab_post_ids if collab_post_ids else False
            if not is_collab:
                continue
        if p.privacy == "public":
            result.append(p.to_dict(current_id))
        elif p.privacy == "connections" and (p.user_id == current_id or _is_connected(current_id, p.user_id)):
            result.append(p.to_dict(current_id))
        elif p.user_id == current_id:
            result.append(p.to_dict(current_id))
        elif p.id in (collab_post_ids if collab_post_ids else []):
            result.append(p.to_dict(current_id))
    return jsonify({"posts": result})


@post_bp.route("/reels", methods=["GET"])
@jwt_required()
def public_reels():
    """Public video posts only — never includes family-privacy posts."""
    current_id = int(get_jwt_identity())
    posts = Post.query.filter(
        Post.media_type == 'video',
        Post.media_url.isnot(None),
        Post.privacy == 'public',
    ).order_by(Post.created_at.desc()).limit(50).all()
    return jsonify({"reels": [p.to_dict(current_id) for p in posts]})


@post_bp.route("/explore", methods=["GET"])
@jwt_required()
def explore():
    current_id = int(get_jwt_identity())
    posts = Post.query.filter_by(privacy="public").order_by(Post.created_at.desc()).limit(30).all()
    return jsonify({"posts": [p.to_dict(current_id) for p in posts]})


@post_bp.route("/user/<int:user_id>", methods=["GET"])
@jwt_required()
def user_posts(user_id):
    current_id = int(get_jwt_identity())
    target = User.query.get(user_id)
    if not target:
        return jsonify({"posts": [], "is_private": False})

    can_view = _can_view_profile(current_id, target)
    if not can_view:
        return jsonify({"posts": [], "is_private": True, "locked": True})

    is_connected = _is_connected(current_id, user_id)
    is_same = current_id == user_id

    # Own posts + accepted collab posts
    own_posts = Post.query.filter_by(user_id=user_id).all()
    collab_post_ids = [
        c.post_id for c in PostCollaborator.query.filter_by(user_id=user_id, status="accepted").all()
    ]
    collab_posts = Post.query.filter(Post.id.in_(collab_post_ids)).all() if collab_post_ids else []

    seen = set()
    result = []
    for p in sorted(own_posts + collab_posts, key=lambda x: x.created_at, reverse=True):
        if p.id in seen:
            continue
        seen.add(p.id)
        if p.privacy == "public":
            result.append(p.to_dict(current_id))
        elif p.privacy == "connections" and (is_same or is_connected):
            result.append(p.to_dict(current_id))
        elif is_same or p.user_id == current_id:
            result.append(p.to_dict(current_id))
    return jsonify({"posts": result, "is_private": target.is_private})


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


@post_bp.route("/<int:post_id>/save", methods=["POST"])
@jwt_required()
def toggle_save(post_id):
    current_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    existing = PostSave.query.filter_by(user_id=current_id, post_id=post_id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({"saved": False})
    db.session.add(PostSave(user_id=current_id, post_id=post_id, collection=data.get("collection", "Saved")))
    db.session.commit()
    return jsonify({"saved": True})


@post_bp.route("/<int:post_id>/comments", methods=["GET"])
@jwt_required()
def get_comments(post_id):
    comments = PostComment.query.filter_by(post_id=post_id, parent_id=None).order_by(PostComment.created_at).all()
    return jsonify({"comments": [c.to_dict() for c in comments]})


@post_bp.route("/<int:post_id>/comments", methods=["POST"])
@jwt_required()
def add_comment(post_id):
    user = me()
    data = request.get_json() or {}
    c = PostComment(
        text=data["text"], user_id=user.id, post_id=post_id,
        parent_id=data.get("parent_id")
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


@post_bp.route("/<int:post_id>", methods=["GET"])
@jwt_required()
def get_post(post_id):
    current_id = int(get_jwt_identity())
    post = Post.query.get_or_404(post_id)
    return jsonify({"post": post.to_dict(current_id)})


@post_bp.route("/tagged/<int:user_id>", methods=["GET"])
@jwt_required()
def tagged_posts(user_id):
    """Posts where the user is tagged (caption mentions @username)."""
    current_id = int(get_jwt_identity())
    target = User.query.get_or_404(user_id)
    username = target.username or target.name
    posts = Post.query.filter(
        Post.caption.ilike(f"%@{username}%"),
        Post.privacy == "public"
    ).order_by(Post.created_at.desc()).limit(50).all()
    return jsonify({"posts": [p.to_dict(current_id) for p in posts]})


@post_bp.route("/liked/<int:user_id>", methods=["GET"])
@jwt_required()
def liked_posts(user_id):
    """Posts liked by the given user."""
    current_id = int(get_jwt_identity())
    likes = PostLike.query.filter_by(user_id=user_id).order_by(PostLike.id.desc()).limit(50).all()
    post_ids = [l.post_id for l in likes]
    posts = Post.query.filter(Post.id.in_(post_ids), Post.privacy == "public").all()
    posts_map = {p.id: p for p in posts}
    result = [posts_map[pid].to_dict(current_id) for pid in post_ids if pid in posts_map]
    return jsonify({"posts": result})


@post_bp.route("/<int:post_id>/view", methods=["POST"])
@jwt_required()
def record_view(post_id):
    current_id = int(get_jwt_identity())
    post = Post.query.get_or_404(post_id)
    # Don't count the author viewing their own post
    if post.user_id != current_id:
        post.view_count = (post.view_count or 0) + 1
        db.session.commit()
    return jsonify({"view_count": post.view_count or 0})


@post_bp.route("/<int:post_id>/share", methods=["POST"])
@jwt_required()
def share_post(post_id):
    """Share a post into a DM conversation."""
    from models.social import Conversation, ConversationParticipant, Message
    user = me()
    data = request.get_json() or {}
    to_user_id = data.get("to_user_id")
    if not to_user_id:
        return jsonify({"error": "to_user_id required"}), 400
    post = Post.query.get_or_404(post_id)
    # Find or create DM
    a_convs = {p.conversation_id for p in ConversationParticipant.query.filter_by(user_id=user.id).all()}
    b_convs = {p.conversation_id for p in ConversationParticipant.query.filter_by(user_id=to_user_id).all()}
    shared = a_convs & b_convs
    conv = None
    for cid in shared:
        c = Conversation.query.get(cid)
        if c and c.type == "private":
            conv = c
            break
    if not conv:
        conv = Conversation(type="private")
        db.session.add(conv)
        db.session.flush()
        db.session.add(ConversationParticipant(conversation_id=conv.id, user_id=user.id))
        db.session.add(ConversationParticipant(conversation_id=conv.id, user_id=to_user_id))
    post_url = post.media_url or ""
    caption_preview = (post.caption or "")[:100]
    msg = Message(
        text=f"Shared a post: {caption_preview}" if caption_preview else "Shared a post",
        media_url=post_url,
        media_type="shared_post",
        conversation_id=conv.id,
        sender_id=user.id
    )
    db.session.add(msg)
    post.share_count = (post.share_count or 0) + 1
    db.session.commit()
    return jsonify({"message": "Post shared", "conversation_id": conv.id}), 201


@post_bp.route("/<int:post_id>/sponsor", methods=["POST"])
@jwt_required()
def toggle_sponsor(post_id):
    """Opt-in to mark your own post as sponsored/promoted."""
    user = me()
    post = Post.query.get_or_404(post_id)
    if post.user_id != user.id:
        return jsonify({"error": "Not authorized"}), 403
    data = request.get_json() or {}
    post.is_sponsored = data.get("is_sponsored", not post.is_sponsored)
    post.sponsor_label = data.get("sponsor_label", post.sponsor_label)
    db.session.commit()
    return jsonify({"is_sponsored": post.is_sponsored})


# ── COLLAB ROUTES ────────────────────────────────────────────────────

@post_bp.route("/collab/pending", methods=["GET"])
@jwt_required()
def my_collab_requests():
    """Get all pending collab invites for the current user."""
    user = me()
    pending = PostCollaborator.query.filter_by(user_id=user.id, status="pending").all()
    result = []
    for c in pending:
        post = Post.query.get(c.post_id)
        if not post:
            continue
        owner = User.query.get(post.user_id)
        result.append({
            "collab_id": c.id,
            "post_id": post.id,
            "post_caption": (post.caption or "")[:80],
            "post_media": post.media_url,
            "role": c.role,
            "owner_name": owner.name if owner else None,
            "owner_avatar": owner.avatar_url if owner else None,
            "owner_username": owner.username if owner else None,
        })
    return jsonify({"requests": result})


@post_bp.route("/collab/<int:collab_id>/respond", methods=["POST"])
@jwt_required()
def respond_collab(collab_id):
    """Accept or reject a collab invite."""
    user = me()
    collab = PostCollaborator.query.get_or_404(collab_id)
    if collab.user_id != user.id:
        return jsonify({"error": "Not authorized"}), 403
    data = request.get_json() or {}
    action = data.get("action")  # accept | reject
    if action == "accept":
        collab.status = "accepted"
    elif action == "reject":
        collab.status = "rejected"
    else:
        return jsonify({"error": "action must be accept or reject"}), 400
    db.session.commit()
    return jsonify({"status": collab.status})


@post_bp.route("/collab/search", methods=["GET"])
@jwt_required()
def search_collab_users():
    """Search users to invite as collaborators."""
    user = me()
    q = request.args.get("q", "").strip()
    if not q or len(q) < 2:
        return jsonify({"users": []})
    users = User.query.filter(
        User.id != user.id,
        db.or_(
            User.name.ilike(f"%{q}%"),
            User.username.ilike(f"%{q}%")
        )
    ).limit(10).all()
    return jsonify({"users": [
        {"id": u.id, "name": u.name, "username": u.username, "avatar": u.avatar_url}
        for u in users
    ]})
