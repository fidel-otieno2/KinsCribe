from extensions import db
from datetime import datetime


class FamilyRelationship(db.Model):
    __tablename__ = "family_relationships"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    related_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    relationship = db.Column(db.String(50), nullable=False)
    family_id = db.Column(db.Integer, db.ForeignKey("families.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        from models.user import User
        related = User.query.get(self.related_user_id)
        return {
            "id": self.id, "user_id": self.user_id,
            "related_user_id": self.related_user_id,
            "related_name": related.name if related else None,
            "related_avatar": related.avatar_url if related else None,
            "relationship": self.relationship,
            "family_id": self.family_id
        }


class FamilyTreeNode(db.Model):
    """Visual family tree node — each member's position and parent link"""
    __tablename__ = "family_tree_nodes"
    id = db.Column(db.Integer, primary_key=True)
    family_id = db.Column(db.Integer, db.ForeignKey("families.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    # For deceased/non-app members
    display_name = db.Column(db.String(100), nullable=True)
    display_avatar = db.Column(db.String(300), nullable=True)
    birth_date = db.Column(db.Date, nullable=True)
    death_date = db.Column(db.Date, nullable=True)
    is_deceased = db.Column(db.Boolean, default=False)
    relationship_label = db.Column(db.String(50), nullable=True)  # Dad, Mum, Sister etc.
    parent_node_id = db.Column(db.Integer, db.ForeignKey("family_tree_nodes.id"), nullable=True)
    partner_node_id = db.Column(db.Integer, db.ForeignKey("family_tree_nodes.id"), nullable=True)
    generation = db.Column(db.Integer, default=0)  # 0=current, -1=parents, -2=grandparents
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    children = db.relationship("FamilyTreeNode", foreign_keys=[parent_node_id],
                                backref=db.backref("parent", remote_side=[id]), lazy=True)

    def to_dict(self):
        from models.user import User
        u = User.query.get(self.user_id) if self.user_id else None
        return {
            "id": self.id, "family_id": self.family_id,
            "user_id": self.user_id,
            "display_name": u.name if u else self.display_name,
            "display_avatar": u.avatar_url if u else self.display_avatar,
            "birth_date": self.birth_date.isoformat() if self.birth_date else None,
            "death_date": self.death_date.isoformat() if self.death_date else None,
            "is_deceased": self.is_deceased,
            "relationship_label": self.relationship_label,
            "parent_node_id": self.parent_node_id,
            "partner_node_id": self.partner_node_id,
            "generation": self.generation,
            "child_ids": [c.id for c in self.children],
            "created_at": self.created_at.isoformat()
        }


class FamilyEvent(db.Model):
    """Family calendar events"""
    __tablename__ = "family_events"
    id = db.Column(db.Integer, primary_key=True)
    family_id = db.Column(db.Integer, db.ForeignKey("families.id"), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    event_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=True)
    event_type = db.Column(db.String(30), default="event")  # birthday|anniversary|event|milestone
    color = db.Column(db.String(20), default="#7c3aed")
    is_recurring = db.Column(db.Boolean, default=False)
    recurrence = db.Column(db.String(20), nullable=True)  # yearly|monthly|weekly
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        from models.user import User
        creator = User.query.get(self.created_by)
        return {
            "id": self.id, "family_id": self.family_id,
            "title": self.title, "description": self.description,
            "event_date": self.event_date.isoformat(),
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "event_type": self.event_type, "color": self.color,
            "is_recurring": self.is_recurring, "recurrence": self.recurrence,
            "created_by": self.created_by,
            "creator_name": creator.name if creator else None,
            "created_at": self.created_at.isoformat()
        }


class FamilyRecipe(db.Model):
    """Family recipe organiser"""
    __tablename__ = "family_recipes"
    id = db.Column(db.Integer, primary_key=True)
    family_id = db.Column(db.Integer, db.ForeignKey("families.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    ingredients = db.Column(db.Text, nullable=True)  # JSON array
    instructions = db.Column(db.Text, nullable=True)
    image_url = db.Column(db.String(300), nullable=True)
    prep_time = db.Column(db.Integer, nullable=True)  # minutes
    servings = db.Column(db.Integer, nullable=True)
    category = db.Column(db.String(50), nullable=True)  # breakfast|lunch|dinner|snack|dessert
    tags = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        import json
        from models.user import User
        u = User.query.get(self.user_id)
        ingredients = []
        try:
            if self.ingredients: ingredients = json.loads(self.ingredients)
        except: pass
        return {
            "id": self.id, "family_id": self.family_id, "user_id": self.user_id,
            "title": self.title, "description": self.description,
            "ingredients": ingredients, "instructions": self.instructions,
            "image_url": self.image_url, "prep_time": self.prep_time,
            "servings": self.servings, "category": self.category, "tags": self.tags,
            "author_name": u.name if u else None,
            "author_avatar": u.avatar_url if u else None,
            "created_at": self.created_at.isoformat()
        }


class FamilyTask(db.Model):
    """Shared family to-do / task list"""
    __tablename__ = "family_tasks"
    id = db.Column(db.Integer, primary_key=True)
    family_id = db.Column(db.Integer, db.ForeignKey("families.id"), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    assigned_to = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    due_date = db.Column(db.DateTime, nullable=True)
    is_done = db.Column(db.Boolean, default=False)
    priority = db.Column(db.String(10), default="medium")  # low|medium|high
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        from models.user import User
        assignee = User.query.get(self.assigned_to) if self.assigned_to else None
        creator = User.query.get(self.created_by)
        return {
            "id": self.id, "family_id": self.family_id,
            "title": self.title, "description": self.description,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "is_done": self.is_done, "priority": self.priority,
            "created_by": self.created_by,
            "creator_name": creator.name if creator else None,
            "assigned_to": self.assigned_to,
            "assignee_name": assignee.name if assignee else None,
            "assignee_avatar": assignee.avatar_url if assignee else None,
            "created_at": self.created_at.isoformat()
        }


class FamilyBudget(db.Model):
    """Family budget / expense tracker"""
    __tablename__ = "family_budget"
    id = db.Column(db.Integer, primary_key=True)
    family_id = db.Column(db.Integer, db.ForeignKey("families.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=True)  # food|transport|bills|entertainment|other
    entry_type = db.Column(db.String(10), default="expense")  # income|expense
    date = db.Column(db.Date, default=datetime.utcnow)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        from models.user import User
        u = User.query.get(self.user_id)
        return {
            "id": self.id, "family_id": self.family_id, "user_id": self.user_id,
            "title": self.title, "amount": self.amount, "category": self.category,
            "entry_type": self.entry_type,
            "date": self.date.isoformat() if self.date else None,
            "notes": self.notes,
            "author_name": u.name if u else None,
            "created_at": self.created_at.isoformat()
        }


class PostInsight(db.Model):
    """Track post analytics"""
    __tablename__ = "post_insights"
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    impressions = db.Column(db.Integer, default=0)
    reach = db.Column(db.Integer, default=0)
    profile_visits = db.Column(db.Integer, default=0)
    shares = db.Column(db.Integer, default=0)
    date = db.Column(db.Date, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("post_id", "date"),)

    def to_dict(self):
        return {
            "post_id": self.post_id, "impressions": self.impressions,
            "reach": self.reach, "profile_visits": self.profile_visits,
            "shares": self.shares, "date": self.date.isoformat()
        }


class CloseFriend(db.Model):
    """Close friends list for stories"""
    __tablename__ = "close_friends"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    friend_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("user_id", "friend_id"),)


class ScheduledPost(db.Model):
    """Posts scheduled for later"""
    __tablename__ = "scheduled_posts"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    caption = db.Column(db.Text, nullable=True)
    media_url = db.Column(db.String(300), nullable=True)
    media_type = db.Column(db.String(20), nullable=True)
    privacy = db.Column(db.String(20), default="public")
    hashtags = db.Column(db.String(500), nullable=True)
    location = db.Column(db.String(200), nullable=True)
    scheduled_at = db.Column(db.DateTime, nullable=False)
    is_published = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id, "user_id": self.user_id, "caption": self.caption,
            "media_url": self.media_url, "media_type": self.media_type,
            "privacy": self.privacy, "hashtags": self.hashtags, "location": self.location,
            "scheduled_at": self.scheduled_at.isoformat(),
            "is_published": self.is_published,
            "created_at": self.created_at.isoformat()
        }


class VerifiedBadge(db.Model):
    """Verified badge for users"""
    __tablename__ = "verified_badges"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)
    badge_type = db.Column(db.String(20), default="verified")  # verified|creator|official
    granted_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class MessageRequest(db.Model):
    """DM requests from people you don't follow"""
    __tablename__ = "message_requests"
    id = db.Column(db.Integer, primary_key=True)
    from_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    to_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    message = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default="pending")  # pending|accepted|declined
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("from_user_id", "to_user_id"),)

    def to_dict(self):
        from models.user import User
        sender = User.query.get(self.from_user_id)
        return {
            "id": self.id, "from_user_id": self.from_user_id,
            "to_user_id": self.to_user_id, "message": self.message,
            "status": self.status,
            "sender_name": sender.name if sender else None,
            "sender_avatar": sender.avatar_url if sender else None,
            "sender_username": sender.username if sender else None,
            "created_at": self.created_at.isoformat()
        }


class Storybook(db.Model):
    __tablename__ = "storybooks"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    compiled_content = db.Column(db.Text, nullable=True)
    story_ids = db.Column(db.String(500), nullable=False)
    pdf_url = db.Column(db.String(300), nullable=True)
    privacy = db.Column(db.String(20), default="family")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    family_id = db.Column(db.Integer, db.ForeignKey("families.id"), nullable=False)

    def to_dict(self):
        return {
            "id": self.id, "title": self.title, "description": self.description,
            "compiled_content": self.compiled_content,
            "story_ids": [int(i) for i in self.story_ids.split(",") if i],
            "pdf_url": self.pdf_url, "privacy": self.privacy,
            "user_id": self.user_id, "family_id": self.family_id,
            "created_at": self.created_at.isoformat()
        }
