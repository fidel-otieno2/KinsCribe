from extensions import db
from datetime import datetime

class Story(db.Model):
    __tablename__ = "stories"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=True)           # original text
    media_url = db.Column(db.String(300), nullable=True)  # Cloudinary URL
    media_type = db.Column(db.String(20), nullable=True)  # text | audio | video
    music_url = db.Column(db.String(300), nullable=True)   # background music
    music_name = db.Column(db.String(200), nullable=True)  # song name for display
    location = db.Column(db.String(200), nullable=True)    # location tag

    # AI-generated fields
    transcript = db.Column(db.Text, nullable=True)
    enhanced_text = db.Column(db.Text, nullable=True)
    summary = db.Column(db.Text, nullable=True)
    tags = db.Column(db.String(300), nullable=True)       # comma-separated
    ai_processed = db.Column(db.Boolean, default=False)

    # Timeline
    story_date = db.Column(db.Date, nullable=True)        # when the story happened

    # Privacy: private | family | public
    privacy = db.Column(db.String(20), default="family")
    repost_count = db.Column(db.Integer, default=0)
    is_announcement = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    family_id = db.Column(db.Integer, db.ForeignKey("families.id"), nullable=True)

    comments = db.relationship("Comment", backref="story", lazy=True, cascade="all, delete")
    likes = db.relationship("Like", backref="story", lazy=True, cascade="all, delete")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "media_url": self.media_url,
            "media_type": self.media_type,
            "music_url": self.music_url,
            "music_name": self.music_name,
            "location": self.location,
            "transcript": self.transcript,
            "enhanced_text": self.enhanced_text,
            "summary": self.summary,
            "tags": self.tags.split(",") if self.tags else [],
            "ai_processed": self.ai_processed,
            "story_date": self.story_date.isoformat() if self.story_date else None,
            "privacy": self.privacy,
            "user_id": self.user_id,
            "family_id": self.family_id,
            "like_count": len(self.likes),
            "comment_count": len(self.comments),
            "repost_count": self.repost_count or 0,
            "is_announcement": self.is_announcement or False,
            "author_name": self.author.name if self.author else None,
            "author_avatar": self.author.avatar_url if self.author else None,
            "created_at": self.created_at.isoformat()
        }


class Comment(db.Model):
    __tablename__ = "comments"

    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    story_id = db.Column(db.Integer, db.ForeignKey("stories.id"), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "text": self.text,
            "user_id": self.user_id,
            "story_id": self.story_id,
            "author_name": self.commenter.name if self.commenter else None,
            "created_at": self.created_at.isoformat()
        }


class Like(db.Model):
    __tablename__ = "likes"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    story_id = db.Column(db.Integer, db.ForeignKey("stories.id"), nullable=False)

    __table_args__ = (db.UniqueConstraint("user_id", "story_id"),)


class SavedStory(db.Model):
    __tablename__ = "saved_stories"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    story_id = db.Column(db.Integer, db.ForeignKey("stories.id"), nullable=False)

    __table_args__ = (db.UniqueConstraint("user_id", "story_id"),)
