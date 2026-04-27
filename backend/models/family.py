from extensions import db, utc_iso
from datetime import datetime
import random
import string


class FamilyMember(db.Model):
    """Many-to-many: a user can belong to multiple families."""
    __tablename__ = "family_members"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    family_id = db.Column(db.Integer, db.ForeignKey("families.id"), nullable=False)
    role = db.Column(db.String(20), default="member")  # admin | member | view-only
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("user_id", "family_id"),)
    user = db.relationship("User", foreign_keys=[user_id])
    family = db.relationship("Family", foreign_keys=[family_id], back_populates="family_members")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "family_id": self.family_id,
            "role": self.role,
            "joined_at": utc_iso(self.joined_at),
        }


class Family(db.Model):
    __tablename__ = "families"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(300), nullable=True)
    invite_code = db.Column(db.String(10), unique=True, nullable=False)
    cover_url = db.Column(db.String(300), nullable=True)
    avatar_url = db.Column(db.String(300), nullable=True)
    motto = db.Column(db.String(200), nullable=True)
    username = db.Column(db.String(50), nullable=True, unique=True)
    theme_color = db.Column(db.String(20), nullable=True, default='#7c3aed')
    privacy = db.Column(db.String(20), nullable=True, default='private')  # private | public | connections
    permissions = db.Column(db.Text, nullable=True)  # JSON blob
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Legacy: users whose primary family is this one
    members = db.relationship("User", backref="family", lazy=True, foreign_keys="User.family_id")
    # New: all members via join table
    family_members = db.relationship("FamilyMember", back_populates="family", lazy=True, cascade="all, delete")
    stories = db.relationship("Story", backref="family", lazy=True)

    @staticmethod
    def generate_invite_code():
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

    def get_all_members(self):
        """Return all User objects from the join table."""
        return [fm.user for fm in self.family_members if fm.user]

    def to_dict(self):
        import json as _json
        perms = {}
        try:
            if self.permissions:
                perms = _json.loads(self.permissions)
        except Exception:
            pass
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "motto": self.motto,
            "username": self.username,
            "invite_code": self.invite_code,
            "cover_url": self.cover_url,
            "avatar_url": self.avatar_url,
            "theme_color": self.theme_color or "#7c3aed",
            "privacy": self.privacy or "private",
            "permissions": perms,
            "member_count": len(self.family_members),
            "created_at": utc_iso(self.created_at),
        }


class FamilyInvite(db.Model):
    __tablename__ = "family_invites"
    id = db.Column(db.Integer, primary_key=True)
    family_id = db.Column(db.Integer, db.ForeignKey("families.id"), nullable=False)
    invited_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    invited_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    token = db.Column(db.String(64), unique=True, nullable=False)
    status = db.Column(db.String(20), default="pending")  # pending | accepted | declined
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    family = db.relationship("Family", foreign_keys=[family_id])
    inviter = db.relationship("User", foreign_keys=[invited_by])
    invitee = db.relationship("User", foreign_keys=[invited_user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "token": self.token,
            "status": self.status,
            "family_id": self.family_id,
            "family_name": self.family.name if self.family else None,
            "family_avatar": self.family.avatar_url if self.family else None,
            "invited_by_name": self.inviter.name if self.inviter else None,
            "invited_by_avatar": self.inviter.avatar_url if self.inviter else None,
            "created_at": utc_iso(self.created_at),
        }
