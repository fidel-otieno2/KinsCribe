from extensions import db
from datetime import datetime
import random
import string

class Family(db.Model):
    __tablename__ = "families"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(300), nullable=True)
    invite_code = db.Column(db.String(10), unique=True, nullable=False)
    cover_url = db.Column(db.String(300), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    members = db.relationship("User", backref="family", lazy=True)
    stories = db.relationship("Story", backref="family", lazy=True)

    @staticmethod
    def generate_invite_code():
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "invite_code": self.invite_code,
            "cover_url": self.cover_url,
            "member_count": len(self.members),
            "created_at": self.created_at.isoformat()
        }
