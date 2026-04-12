from extensions import db
from datetime import datetime


class Connection(db.Model):
    """Connections (followers/following) between users"""
    __tablename__ = "connections"

    id = db.Column(db.Integer, primary_key=True)
    follower_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    following_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint("follower_id", "following_id"),)

    def to_dict(self):
        return {
            "id": self.id,
            "follower_id": self.follower_id,
            "following_id": self.following_id,
            "created_at": self.created_at.isoformat()
        }


class Post(db.Model):
    """Public posts (outside family — like Instagram posts)"""
    __tablename__ = "posts"

    id = db.Column(db.Integer, primary_key=True)
    caption = db.Column(db.Text, nullable=True)
    media_url = db.Column(db.String(300), nullable=True)
    media_type = db.Column(db.String(20), nullable=True)  # image | video | text
    location = db.Column(db.String(200), nullable=True)
    # public | connections | family
    privacy = db.Column(db.String(20), default="public")
    like_count = db.Column(db.Integer, default=0)
    comment_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    likes = db.relationship("PostLike", backref="post", lazy=True, cascade="all, delete")
    comments = db.relationship("PostComment", backref="post", lazy=True, cascade="all, delete")

    def to_dict(self, current_user_id=None):
        liked = False
        saved = False
        if current_user_id:
            liked = any(l.user_id == current_user_id for l in self.likes)
        return {
            "id": self.id,
            "caption": self.caption,
            "media_url": self.media_url,
            "media_type": self.media_type,
            "location": self.location,
            "privacy": self.privacy,
            "like_count": len(self.likes),
            "comment_count": len(self.comments),
            "liked_by_me": liked,
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


class PostComment(db.Model):
    __tablename__ = "post_comments"
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "text": self.text,
            "user_id": self.user_id,
            "post_id": self.post_id,
            "author_name": self.commenter.name if self.commenter else None,
            "author_avatar": self.commenter.avatar_url if self.commenter else None,
            "created_at": self.created_at.isoformat()
        }


class Conversation(db.Model):
    """Private DM or family group chat"""
    __tablename__ = "conversations"

    id = db.Column(db.Integer, primary_key=True)
    # private | family
    type = db.Column(db.String(20), default="private")
    # for family chats
    family_id = db.Column(db.Integer, db.ForeignKey("families.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    messages = db.relationship("Message", backref="conversation", lazy=True, cascade="all, delete")
    participants = db.relationship("ConversationParticipant", backref="conversation", lazy=True, cascade="all, delete")

    def to_dict(self, current_user_id=None):
        last_msg = Message.query.filter_by(conversation_id=self.id)\
            .order_by(Message.created_at.desc()).first()
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
            "id": self.id,
            "type": self.type,
            "family_id": self.family_id,
            "other_user": other,
            "last_message": last_msg.to_dict() if last_msg else None,
            "unread_count": unread,
            "created_at": self.created_at.isoformat()
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
    media_type = db.Column(db.String(20), nullable=True)  # image | audio | video
    is_read = db.Column(db.Boolean, default=False)
    # for replies
    reply_to_id = db.Column(db.Integer, db.ForeignKey("messages.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    conversation_id = db.Column(db.Integer, db.ForeignKey("conversations.id"), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    sender = db.relationship("User", foreign_keys=[sender_id])
    reactions = db.relationship("MessageReaction", backref="message", lazy=True, cascade="all, delete")
    reply_to = db.relationship("Message", remote_side=[id], foreign_keys=[reply_to_id])

    def to_dict(self):
        return {
            "id": self.id,
            "text": self.text,
            "media_url": self.media_url,
            "media_type": self.media_type,
            "is_read": self.is_read,
            "reply_to_id": self.reply_to_id,
            "reply_to_text": self.reply_to.text if self.reply_to else None,
            "reply_to_sender": self.reply_to.sender.name if self.reply_to and self.reply_to.sender else None,
            "conversation_id": self.conversation_id,
            "sender_id": self.sender_id,
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
        return {
            "id": self.id,
            "emoji": self.emoji,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else None,
            "message_id": self.message_id
        }
