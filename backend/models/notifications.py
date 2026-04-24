from extensions import db, utc_iso
from datetime import datetime


class UserSession(db.Model):
    """Tracks active login sessions per user device."""
    __tablename__ = "user_sessions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    token_hash = db.Column(db.String(64), nullable=True)   # SHA256 of JWT for revocation
    device_name = db.Column(db.String(150), nullable=True)  # e.g. "iPhone 14", "Chrome on Windows"
    platform = db.Column(db.String(20), nullable=True)      # ios | android | web
    ip_address = db.Column(db.String(45), nullable=True)
    location = db.Column(db.String(200), nullable=True)     # city/country from IP (optional)
    last_active = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_revoked = db.Column(db.Boolean, default=False)

    user = db.relationship("User", foreign_keys=[user_id])

    def to_dict(self, current_token_hash=None):
        return {
            "id": self.id,
            "device_name": self.device_name or "Unknown device",
            "platform": self.platform or "unknown",
            "ip_address": self.ip_address,
            "location": self.location,
            "last_active": utc_iso(self.last_active),
            "created_at": utc_iso(self.created_at),
            "is_current": (current_token_hash is not None and self.token_hash == current_token_hash),
        }


class Notification(db.Model):
    __tablename__ = "notifications"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    from_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    type = db.Column(db.String(30), nullable=False)  # like|comment|follow|mention|story_view|birthday
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=True)
    data = db.Column(db.Text, nullable=True)  # JSON data for the notification
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relations
    user = db.relationship("User", foreign_keys=[user_id], backref="notifications")
    from_user = db.relationship("User", foreign_keys=[from_user_id])
    
    def to_dict(self):
        import json
        data = {}
        try:
            if self.data:
                data = json.loads(self.data)
        except:
            pass
            
        return {
            "id": self.id,
            "user_id": self.user_id,
            "from_user_id": self.from_user_id,
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "data": data,
            "is_read": self.is_read,
            "from_user_name": self.from_user.name if self.from_user else None,
            "from_user_avatar": self.from_user.avatar_url if self.from_user else None,
            "from_user_username": self.from_user.username if self.from_user else None,
            "created_at": utc_iso(self.created_at)
        }


class NotificationSettings(db.Model):
    __tablename__ = "notification_settings"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)
    
    # Push notification toggles
    likes = db.Column(db.Boolean, default=True)
    comments = db.Column(db.Boolean, default=True)
    mentions = db.Column(db.Boolean, default=True)
    follows = db.Column(db.Boolean, default=True)
    messages = db.Column(db.Boolean, default=True)
    stories = db.Column(db.Boolean, default=True)
    birthdays = db.Column(db.Boolean, default=True)
    
    # Quiet hours
    quiet_hours_enabled = db.Column(db.Boolean, default=False)
    quiet_start = db.Column(db.String(5), default="22:00")  # HH:MM format
    quiet_end = db.Column(db.String(5), default="08:00")
    
    # Email digest
    email_digest = db.Column(db.String(10), default="weekly")  # none|daily|weekly
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            "user_id": self.user_id,
            "likes": self.likes,
            "comments": self.comments,
            "mentions": self.mentions,
            "follows": self.follows,
            "messages": self.messages,
            "stories": self.stories,
            "birthdays": self.birthdays,
            "quiet_hours_enabled": self.quiet_hours_enabled,
            "quiet_start": self.quiet_start,
            "quiet_end": self.quiet_end,
            "email_digest": self.email_digest
        }


class DeviceToken(db.Model):
    """Store push notification tokens for devices"""
    __tablename__ = "device_tokens"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    token = db.Column(db.String(500), nullable=False)
    platform = db.Column(db.String(10), nullable=False)  # ios|android|web
    device_name = db.Column(db.String(100), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_used = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint("user_id", "token"),)
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "platform": self.platform,
            "device_name": self.device_name,
            "is_active": self.is_active,
            "created_at": utc_iso(self.created_at),
            "last_used": utc_iso(self.last_used)
        }