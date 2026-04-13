from extensions import db
from datetime import datetime


class Connection(db.Model):
    __tablename__ = "connections"
    id = db.Column(db.Integer, primary_key=True)
    follower_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    following_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("follower_id", "following_id"),)

    def to_dict(self):
        return {"id": self.id, "follower_id": self.follower_id,
                "following_id": self.following_id, "created_at": self.created_at.isoformat()}


class Post(db.Model):
    __tablename__ = "posts"
    id = db.Column(db.Integer, primary_key=True)
    caption = db.Column(db.Text, nullable=True)
    media_url = db.Column(db.String(300), nullable=True)
    media_urls = db.Column(db.Text, nullable=True)
    media_type = db.Column(db.String(20), nullable=True)
    location = db.Column(db.String(200), nullable=True)
    hashtags = db.Column(db.String(500), nullable=True)
    privacy = db.Column(db.String(20), default="public")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    likes = db.relationship("PostLike", backref="post", lazy=True, cascade="all, delete")
    comments = db.relationship("PostComment", backref="post", lazy=True, cascade="all, delete")
    saves = db.relationship("PostSave", backref="post", lazy=True, cascade="all, delete")

    def to_dict(self, current_user_id=None):
        import json
        liked = saved = False
        if current_user_id:
            liked = any(l.user_id == current_user_id for l in self.likes)
            saved = any(s.user_id == current_user_id for s in self.saves)
        media_list = []
        if self.media_urls:
            try: media_list = json.loads(self.media_urls)
            except: pass
        return {
            "id": self.id, "caption": self.caption,
            "media_url": self.media_url, "media_urls": media_list,
            "media_type": self.media_type, "location": self.location,
            "hashtags": self.hashtags, "privacy": self.privacy,
            "like_count": len(self.likes), "comment_count": len(self.comments),
            "liked_by_me": liked, "saved_by_me": saved,
            "user_id": self.user_id,
            "author_name": self.author.name if self.author else None,
            "author_username": self.author.username if self.author else None,
            "author_avatar": self.author.avatar_url if self.author else None,
            "created_at": self.created_at.isoformat()
        }


class PostLike(db.Model):
    __tablename__ = "post_likes"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False)
    __table_args__ = (db.UniqueConstraint("user_id", "post_id"),)


class PostSave(db.Model):
    __tablename__ = "post_saves"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False)
    collection = db.Column(db.String(100), nullable=True, default="Saved")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("user_id", "post_id"),)


class PostComment(db.Model):
    __tablename__ = "post_comments"
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text, nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey("post_comments.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False)
    likes = db.Column(db.Integer, default=0)
    replies = db.relationship("PostComment", backref=db.backref("parent", remote_side=[id]), lazy=True)

    def to_dict(self):
        return {
            "id": self.id, "text": self.text, "user_id": self.user_id,
            "post_id": self.post_id, "parent_id": self.parent_id, "likes": self.likes,
            "author_name": self.commenter.name if self.commenter else None,
            "author_avatar": self.commenter.avatar_url if self.commenter else None,
            "author_username": self.commenter.username if self.commenter else None,
            "reply_count": len(self.replies),
            "created_at": self.created_at.isoformat()
        }


class PublicStory(db.Model):
    __tablename__ = "public_stories"
    id = db.Column(db.Integer, primary_key=True)
    media_url = db.Column(db.String(300), nullable=True)
    media_type = db.Column(db.String(20), nullable=True)
    text_content = db.Column(db.Text, nullable=True)
    bg_color = db.Column(db.String(20), nullable=True)
    music_url = db.Column(db.String(300), nullable=True)
    music_name = db.Column(db.String(200), nullable=True)
    sticker_data = db.Column(db.Text, nullable=True)
    privacy = db.Column(db.String(20), default="public")
    view_count = db.Column(db.Integer, default=0)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    views = db.relationship("PublicStoryView", backref="story", lazy=True, cascade="all, delete")

    def to_dict(self, current_user_id=None):
        viewed = False
        if current_user_id:
            viewed = any(v.user_id == current_user_id for v in self.views)
        return {
            "id": self.id, "media_url": self.media_url, "media_type": self.media_type,
            "text_content": self.text_content, "bg_color": self.bg_color,
            "music_url": self.music_url, "music_name": self.music_name,
            "privacy": self.privacy, "view_count": self.view_count,
            "viewed_by_me": viewed,
            "expires_at": self.expires_at.isoformat(),
            "created_at": self.created_at.isoformat(),
            "user_id": self.user_id,
            "author_name": self.author.name if self.author else None,
            "author_avatar": self.author.avatar_url if self.author else None,
            "author_username": self.author.username if self.author else None,
        }


class PublicStoryView(db.Model):
    __tablename__ = "public_story_views"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    story_id = db.Column(db.Integer, db.ForeignKey("public_stories.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("user_id", "story_id"),)


class StoryHighlight(db.Model):
    __tablename__ = "story_highlights"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(50), nullable=False)
    cover_url = db.Column(db.String(300), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    items = db.relationship("StoryHighlightItem", backref="highlight", lazy=True, cascade="all, delete")

    def to_dict(self):
        return {
            "id": self.id, "title": self.title, "cover_url": self.cover_url,
            "user_id": self.user_id, "item_count": len(self.items),
            "created_at": self.created_at.isoformat()
        }


class StoryHighlightItem(db.Model):
    __tablename__ = "story_highlight_items"
    id = db.Column(db.Integer, primary_key=True)
    highlight_id = db.Column(db.Integer, db.ForeignKey("story_highlights.id"), nullable=False)
    public_story_id = db.Column(db.Integer, db.ForeignKey("public_stories.id"), nullable=True)
    media_url = db.Column(db.String(300), nullable=True)
    media_type = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id, "highlight_id": self.highlight_id,
            "media_url": self.media_url, "media_type": self.media_type,
            "created_at": self.created_at.isoformat()
        }


class Conversation(db.Model):
    __tablename__ = "conversations"
    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(20), default="private")
    name = db.Column(db.String(100), nullable=True)
    family_id = db.Column(db.Integer, db.ForeignKey("families.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    messages = db.relationship("Message", backref="conversation", lazy=True, cascade="all, delete")
    participants = db.relationship("ConversationParticipant", backref="conversation", lazy=True, cascade="all, delete")

    def to_dict(self, current_user_id=None):
        last_msg = Message.query.filter_by(conversation_id=self.id).order_by(Message.created_at.desc()).first()
        other = None
        if self.type == "private" and current_user_id:
            p = ConversationParticipant.query.filter(
                ConversationParticipant.conversation_id == self.id,
                ConversationParticipant.user_id != current_user_id
            ).first()
            if p and p.user:
                other = {"id": p.user.id, "name": p.user.name, "avatar": p.user.avatar_url, "username": p.user.username}
        unread = 0
        if current_user_id:
            unread = Message.query.filter(
                Message.conversation_id == self.id,
                Message.sender_id != current_user_id,
                Message.is_read == False
            ).count()
        return {
            "id": self.id, "type": self.type, "name": self.name,
            "family_id": self.family_id, "other_user": other,
            "last_message": last_msg.to_dict() if last_msg else None,
            "unread_count": unread, "created_at": self.created_at.isoformat()
        }


class ConversationParticipant(db.Model):
    __tablename__ = "conversation_participants"
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey("conversations.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    __table_args__ = (db.UniqueConstraint("conversation_id", "user_id"),)
    user = db.relationship("User", foreign_keys=[user_id])


class Message(db.Model):
    __tablename__ = "messages"
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text, nullable=True)
    media_url = db.Column(db.String(300), nullable=True)
    media_type = db.Column(db.String(20), nullable=True)
    is_read = db.Column(db.Boolean, default=False)
    reply_to_id = db.Column(db.Integer, db.ForeignKey("messages.id"), nullable=True)
    disappears_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    conversation_id = db.Column(db.Integer, db.ForeignKey("conversations.id"), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    sender = db.relationship("User", foreign_keys=[sender_id])
    reactions = db.relationship("MessageReaction", backref="message", lazy=True, cascade="all, delete")
    reply_to = db.relationship("Message", remote_side=[id], foreign_keys=[reply_to_id])

    def to_dict(self):
        return {
            "id": self.id, "text": self.text, "media_url": self.media_url,
            "media_type": self.media_type, "is_read": self.is_read,
            "reply_to_id": self.reply_to_id,
            "reply_to_text": self.reply_to.text if self.reply_to else None,
            "reply_to_sender": self.reply_to.sender.name if self.reply_to and self.reply_to.sender else None,
            "conversation_id": self.conversation_id, "sender_id": self.sender_id,
            "sender_name": self.sender.name if self.sender else None,
            "sender_avatar": self.sender.avatar_url if self.sender else None,
            "sender_username": self.sender.username if self.sender else None,
            "reactions": [r.to_dict() for r in self.reactions],
            "created_at": self.created_at.isoformat()
        }


class MessageReaction(db.Model):
    __tablename__ = "message_reactions"
    id = db.Column(db.Integer, primary_key=True)
    emoji = db.Column(db.String(10), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    message_id = db.Column(db.Integer, db.ForeignKey("messages.id"), nullable=False)
    __table_args__ = (db.UniqueConstraint("user_id", "message_id"),)
    user = db.relationship("User", foreign_keys=[user_id])

    def to_dict(self):
        return {"id": self.id, "emoji": self.emoji, "user_id": self.user_id,
                "user_name": self.user.name if self.user else None, "message_id": self.message_id}
