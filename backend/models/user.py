from extensions import db
from datetime import datetime

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=True)
    email = db.Column(db.String(120), unique=True, nullable=True)  # Made nullable for phone-only users
    phone = db.Column(db.String(20), unique=True, nullable=True)  # Added phone number
    password = db.Column(db.String(200), nullable=True)  # nullable for Google OAuth users
    role = db.Column(db.String(20), default="member")  # admin | member | historian
    is_verified = db.Column(db.Boolean, default=False)
    verification_token = db.Column(db.String(200), nullable=True)
    avatar_url = db.Column(db.String(300), nullable=True)
    bio = db.Column(db.String(300), nullable=True)
    website = db.Column(db.String(200), nullable=True)
    interests = db.Column(db.String(500), nullable=True)
    is_private = db.Column(db.Boolean, default=False)
    google_id = db.Column(db.String(200), nullable=True, unique=True)
    apple_id = db.Column(db.String(200), nullable=True, unique=True)  # Added Apple ID
    
    # 2FA settings
    two_factor_enabled = db.Column(db.Boolean, default=False)
    two_factor_secret = db.Column(db.String(32), nullable=True)
    backup_codes = db.Column(db.Text, nullable=True)  # JSON array of backup codes
    
    # Account type
    account_type = db.Column(db.String(20), default="personal")  # personal|professional|creator
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    family_id = db.Column(db.Integer, db.ForeignKey("families.id"), nullable=True)

    stories = db.relationship("Story", backref="author", lazy=True)
    comments = db.relationship("Comment", backref="commenter", lazy=True)
    likes = db.relationship("Like", backref="liker", lazy=True)
    posts = db.relationship("Post", backref="author", lazy=True)
    post_comments = db.relationship("PostComment", backref="commenter", lazy=True)

    def to_dict(self):
        from models.social import Connection
        connection_count = Connection.query.filter_by(following_id=self.id).count()
        interest_count = Connection.query.filter_by(follower_id=self.id).count()
        return {
            "id": self.id,
            "name": self.name,
            "username": self.username,
            "email": self.email,
            "phone": self.phone,
            "role": self.role,
            "is_verified": self.is_verified,
            "avatar_url": self.avatar_url,
            "bio": self.bio,
            "website": self.website,
            "interests": self.interests.split(',') if self.interests else [],
            "is_private": self.is_private,
            "account_type": self.account_type,
            "two_factor_enabled": self.two_factor_enabled,
            "family_id": self.family_id,
            "connection_count": connection_count,
            "interest_count": interest_count,
            "created_at": self.created_at.isoformat()
        }
