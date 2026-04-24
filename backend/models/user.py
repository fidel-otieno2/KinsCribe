from extensions import db, utc_iso
from datetime import datetime

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=True)
    email = db.Column(db.String(120), unique=True, nullable=True)  # Made nullable for phone-only users
    phone = db.Column(db.String(20), nullable=True)  # One phone can be linked to many emails
    password = db.Column(db.String(200), nullable=True)  # nullable for Google OAuth users
    role = db.Column(db.String(20), default="member")  # admin | member | historian
    is_verified = db.Column(db.Boolean, default=False)
    verification_token = db.Column(db.String(500), nullable=True)
    avatar_url = db.Column(db.String(300), nullable=True)
    bio = db.Column(db.String(300), nullable=True)
    website = db.Column(db.String(200), nullable=True)
    interests = db.Column(db.String(500), nullable=True)
    is_private = db.Column(db.Boolean, default=False)
    show_activity = db.Column(db.Boolean, default=True)   # show online/active status to others
    allow_dms = db.Column(db.Boolean, default=True)        # allow direct messages from non-followers
    google_id = db.Column(db.String(200), nullable=True, unique=True)
    apple_id = db.Column(db.String(200), nullable=True, unique=True)  # Added Apple ID
    
    # 2FA settings
    two_factor_enabled = db.Column(db.Boolean, default=False)
    two_factor_secret = db.Column(db.String(32), nullable=True)
    backup_codes = db.Column(db.Text, nullable=True)  # JSON array of backup codes
    
    # Account type
    account_type = db.Column(db.String(20), default="personal")  # personal|professional|creator

    # Subscription
    is_premium = db.Column(db.Boolean, default=False)
    premium_plan = db.Column(db.String(20), nullable=True)   # monthly | yearly
    premium_expires_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    family_id = db.Column(db.Integer, db.ForeignKey("families.id"), nullable=True)

    stories = db.relationship("Story", backref="author", lazy=True)
    comments = db.relationship("Comment", backref="commenter", lazy=True)
    likes = db.relationship("Like", backref="liker", lazy=True)
    posts = db.relationship("Post", backref="author", lazy=True)
    post_comments = db.relationship("PostComment", backref="commenter", lazy=True)

    def to_dict(self):
        try:
            from models.social import Connection
            connection_count = Connection.query.filter_by(following_id=self.id).count()
            interest_count = Connection.query.filter_by(follower_id=self.id).count()
        except Exception:
            connection_count = 0
            interest_count = 0
        try:
            from models.extras import VerifiedBadge
            badge = VerifiedBadge.query.filter_by(user_id=self.id).first()
            verified_badge = badge.badge_type if badge else None
        except Exception:
            verified_badge = None
        return {
            "id": self.id,
            "name": self.name,
            "username": self.username,
            "email": self.email,
            "phone": self.phone,
            "role": self.role,
            "is_verified": self.is_verified,
            "verified_badge": verified_badge,
            "avatar_url": self.avatar_url,
            "bio": self.bio,
            "website": self.website,
            "interests": self.interests.split(',') if self.interests else [],
            "is_private": self.is_private,
            "show_activity": self.show_activity if self.show_activity is not None else True,
            "allow_dms": self.allow_dms if self.allow_dms is not None else True,
            "account_type": self.account_type,
            "two_factor_enabled": self.two_factor_enabled,
            "has_password": bool(self.password),
            "family_id": self.family_id,
            "connection_count": connection_count,
            "interest_count": interest_count,
            "is_premium": self.is_premium or False,
            "premium_plan": self.premium_plan,
            "premium_expires_at": utc_iso(self.premium_expires_at) if self.premium_expires_at else None,
            "created_at": utc_iso(self.created_at)
        }
