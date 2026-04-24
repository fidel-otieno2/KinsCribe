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
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "invite_code": self.invite_code,
            "cover_url": self.cover_url,
            "member_count": len(self.family_members),
            "created_at": utc_iso(self.created_at)
        }
