from extensions import db
from datetime import datetime

class FamilyRelationship(db.Model):
    """Maps relationships between family members (for family tree)"""
    __tablename__ = "family_relationships"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    related_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    relationship = db.Column(db.String(50), nullable=False)  # father, mother, sibling, etc.
    family_id = db.Column(db.Integer, db.ForeignKey("families.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "related_user_id": self.related_user_id,
            "relationship": self.relationship,
            "family_id": self.family_id
        }


class Storybook(db.Model):
    """AI-compiled collection of stories"""
    __tablename__ = "storybooks"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    compiled_content = db.Column(db.Text, nullable=True)  # AI-generated narrative
    story_ids = db.Column(db.String(500), nullable=False)  # comma-separated story IDs
    pdf_url = db.Column(db.String(300), nullable=True)
    privacy = db.Column(db.String(20), default="family")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    family_id = db.Column(db.Integer, db.ForeignKey("families.id"), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "compiled_content": self.compiled_content,
            "story_ids": [int(i) for i in self.story_ids.split(",") if i],
            "pdf_url": self.pdf_url,
            "privacy": self.privacy,
            "user_id": self.user_id,
            "family_id": self.family_id,
            "created_at": self.created_at.isoformat()
        }
