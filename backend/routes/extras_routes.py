from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.extras import (FamilyTreeNode, FamilyEvent, FamilyRecipe, FamilyTask,
                            FamilyBudget, BudgetGoal, PostInsight, CloseFriend, ScheduledPost,
                            VerifiedBadge)
from models.social import Post, Connection, MessageRequest
from datetime import datetime, date
import cloudinary, cloudinary.uploader, os, json

extras_bp = Blueprint("extras", __name__)

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)


def me():
    return User.query.get(int(get_jwt_identity()))


# ── Family Tree ───────────────────────────────────────────────

@extras_bp.route("/tree/auto-generate", methods=["POST"])
@jwt_required()
def auto_generate_tree():
    """Auto-generate family tree from family members (admin only)"""
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    
    from models.family import FamilyMember, Family
    from models.notifications import Notification
    import json
    
    # Check if user is admin
    member = FamilyMember.query.filter_by(user_id=user.id, family_id=user.family_id).first()
    if not member or member.role != 'admin':
        return jsonify({"error": "Only admins can generate the family tree"}), 403
    
    # Get all family members
    members = FamilyMember.query.filter_by(family_id=user.family_id).all()
    if not members:
        return jsonify({"error": "No family members found"}), 404
    
    # Clear existing tree nodes for this family
    FamilyTreeNode.query.filter_by(family_id=user.family_id).delete()
    
    # Create nodes for each member
    created_nodes = []
    for idx, member in enumerate(members):
        member_user = User.query.get(member.user_id)
        if not member_user:
            continue
            
        # Determine generation based on role or position
        # Current user is generation 0, admins might be parents (-1)
        generation = 0
        if member.role == 'admin' and member.user_id != user.id:
            generation = -1  # Parents/older generation
        elif member.user_id == user.id:
            generation = 0  # Current user
        
        node = FamilyTreeNode(
            family_id=user.family_id,
            user_id=member.user_id,
            display_name=member_user.name,
            display_avatar=member_user.avatar_url,
            relationship_label='You' if member.user_id == user.id else 'Family Member',
            generation=generation,
            parent_node_id=None,
            is_deceased=False
        )
        db.session.add(node)
        created_nodes.append(node)
    
    db.session.commit()
    
    # Send notification to all family members except the creator
    family = Family.query.get(user.family_id)
    for member in members:
        if member.user_id != user.id:
            notif = Notification(
                user_id=member.user_id,
                from_user_id=user.id,
                type="family_tree",
                title=f"Family Tree Created",
                message=f"{user.name} created the {family.name} family tree with {len(created_nodes)} members.",
                data=json.dumps({"family_id": user.family_id, "action": "tree_created"})
            )
            db.session.add(notif)
    
    db.session.commit()
    
    return jsonify({
        "nodes": [n.to_dict() for n in created_nodes],
        "message": f"Generated tree with {len(created_nodes)} members"
    }), 201


@extras_bp.route("/tree", methods=["GET"])
@jwt_required()
def get_tree():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    nodes = FamilyTreeNode.query.filter_by(family_id=user.family_id).all()
    return jsonify({"nodes": [n.to_dict() for n in nodes]})


@extras_bp.route("/tree", methods=["POST"])
@jwt_required()
def add_tree_node():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    
    # Check if user is admin
    from models.family import FamilyMember, Family
    from models.notifications import Notification
    import json
    
    member = FamilyMember.query.filter_by(user_id=user.id, family_id=user.family_id).first()
    if not member or member.role != 'admin':
        return jsonify({"error": "Only admins can add members to the tree"}), 403
    data = request.get_json() or {}
    birth = None
    death = None
    try:
        if data.get("birth_date"): birth = datetime.strptime(data["birth_date"], "%Y-%m-%d").date()
        if data.get("death_date"): death = datetime.strptime(data["death_date"], "%Y-%m-%d").date()
    except: pass

    node = FamilyTreeNode(
        family_id=user.family_id,
        user_id=data.get("user_id"),
        display_name=data.get("display_name"),
        display_avatar=data.get("display_avatar"),
        birth_date=birth, death_date=death,
        is_deceased=data.get("is_deceased", False),
        relationship_label=data.get("relationship_label"),
        parent_node_id=data.get("parent_node_id"),
        partner_node_id=data.get("partner_node_id"),
        generation=data.get("generation", 0)
    )
    db.session.add(node)
    db.session.commit()
    
    # Send notification to all family members except the creator
    family = Family.query.get(user.family_id)
    members = FamilyMember.query.filter_by(family_id=user.family_id).all()
    for fam_member in members:
        if fam_member.user_id != user.id:
            notif = Notification(
                user_id=fam_member.user_id,
                from_user_id=user.id,
                type="family_tree",
                title=f"Family Tree Updated",
                message=f"{user.name} added {node.display_name} to the {family.name} family tree.",
                data=json.dumps({"family_id": user.family_id, "node_id": node.id, "action": "member_added"})
            )
            db.session.add(notif)
    
    db.session.commit()
    
    return jsonify({"node": node.to_dict()}), 201


@extras_bp.route("/tree/<int:node_id>/set-parent", methods=["POST"])
@jwt_required()
def set_node_parent(node_id):
    """Set parent relationship for a node (admin only)"""
    user = me()
    
    # Check if user is admin
    from models.family import FamilyMember
    member = FamilyMember.query.filter_by(user_id=user.id, family_id=user.family_id).first()
    if not member or member.role != 'admin':
        return jsonify({"error": "Only admins can modify the tree"}), 403
    
    node = FamilyTreeNode.query.get_or_404(node_id)
    data = request.get_json() or {}
    parent_id = data.get("parent_node_id")
    
    if parent_id:
        parent = FamilyTreeNode.query.get(parent_id)
        if parent and parent.family_id == node.family_id:
            node.parent_node_id = parent_id
            # Auto-adjust generation
            node.generation = parent.generation + 1
    else:
        node.parent_node_id = None
    
    db.session.commit()
    return jsonify({"node": node.to_dict()})


@extras_bp.route("/tree/<int:node_id>", methods=["PUT"])
@jwt_required()
def update_tree_node(node_id):
    user = me()
    
    # Check if user is admin
    from models.family import FamilyMember
    member = FamilyMember.query.filter_by(user_id=user.id, family_id=user.family_id).first()
    if not member or member.role != 'admin':
        return jsonify({"error": "Only admins can modify the tree"}), 403
    
    node = FamilyTreeNode.query.get_or_404(node_id)
    data = request.get_json() or {}
    for field in ("display_name", "display_avatar", "relationship_label",
                  "parent_node_id", "partner_node_id", "generation", "is_deceased"):
        if field in data:
            setattr(node, field, data[field])
    try:
        if data.get("birth_date"): node.birth_date = datetime.strptime(data["birth_date"], "%Y-%m-%d").date()
        if data.get("death_date"): node.death_date = datetime.strptime(data["death_date"], "%Y-%m-%d").date()
    except: pass
    db.session.commit()
    return jsonify({"node": node.to_dict()})


@extras_bp.route("/tree/<int:node_id>/set-partner", methods=["POST"])
@jwt_required()
def set_node_partner(node_id):
    """Set partner relationship for a node (admin only)"""
    user = me()
    
    # Check if user is admin
    from models.family import FamilyMember
    member = FamilyMember.query.filter_by(user_id=user.id, family_id=user.family_id).first()
    if not member or member.role != 'admin':
        return jsonify({"error": "Only admins can modify the tree"}), 403
    
    node = FamilyTreeNode.query.get_or_404(node_id)
    data = request.get_json() or {}
    partner_id = data.get("partner_node_id")
    
    if partner_id:
        partner = FamilyTreeNode.query.get(partner_id)
        if partner and partner.family_id == node.family_id:
            node.partner_node_id = partner_id
            # Set reciprocal relationship
            partner.partner_node_id = node_id
            # Partners should be in same generation
            partner.generation = node.generation
    else:
        # Clear partner relationship
        if node.partner_node_id:
            old_partner = FamilyTreeNode.query.get(node.partner_node_id)
            if old_partner:
                old_partner.partner_node_id = None
        node.partner_node_id = None
    
    db.session.commit()
    return jsonify({"node": node.to_dict()})


@extras_bp.route("/tree/<int:node_id>", methods=["DELETE"])
@jwt_required()
def delete_tree_node(node_id):
    user = me()
    
    # Check if user is admin
    from models.family import FamilyMember, Family
    from models.notifications import Notification
    import json
    
    member = FamilyMember.query.filter_by(user_id=user.id, family_id=user.family_id).first()
    if not member or member.role != 'admin':
        return jsonify({"error": "Only admins can remove members from the tree"}), 403
    
    node = FamilyTreeNode.query.get_or_404(node_id)
    node_name = node.display_name
    
    # Clear partner relationships
    if node.partner_node_id:
        partner = FamilyTreeNode.query.get(node.partner_node_id)
        if partner:
            partner.partner_node_id = None
    # Update children to remove parent reference
    for child in node.children:
        child.parent_node_id = None
    db.session.delete(node)
    db.session.commit()
    
    # Send notification to all family members except the deleter
    family = Family.query.get(user.family_id)
    members = FamilyMember.query.filter_by(family_id=user.family_id).all()
    for fam_member in members:
        if fam_member.user_id != user.id:
            notif = Notification(
                user_id=fam_member.user_id,
                from_user_id=user.id,
                type="family_tree",
                title=f"Family Tree Updated",
                message=f"{user.name} removed {node_name} from the {family.name} family tree.",
                data=json.dumps({"family_id": user.family_id, "action": "member_removed"})
            )
            db.session.add(notif)
    
    db.session.commit()
    
    return jsonify({"message": "Deleted"})


# ── Family Calendar ───────────────────────────────────────────

@extras_bp.route("/calendar", methods=["GET"])
@jwt_required()
def get_events():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)
    q = FamilyEvent.query.filter_by(family_id=user.family_id)
    if month and year:
        q = q.filter(
            db.extract("month", FamilyEvent.event_date) == month,
            db.extract("year", FamilyEvent.event_date) == year
        )
    events = q.order_by(FamilyEvent.event_date).all()
    return jsonify({"events": [e.to_dict() for e in events]})


@extras_bp.route("/calendar", methods=["POST"])
@jwt_required()
def create_event():
    from models.family import FamilyMember
    from models.notifications import Notification
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    data = request.get_json() or {}
    try:
        event_date = datetime.fromisoformat(data["event_date"])
    except:
        return jsonify({"error": "Invalid date format"}), 400
    end_date = None
    try:
        if data.get("end_date"): end_date = datetime.fromisoformat(data["end_date"])
    except: pass

    event = FamilyEvent(
        family_id=user.family_id, created_by=user.id,
        title=data["title"], description=data.get("description"),
        event_date=event_date, end_date=end_date,
        event_type=data.get("event_type", "event"),
        color=data.get("color", "#7c3aed"),
        is_recurring=data.get("is_recurring", False),
        recurrence=data.get("recurrence")
    )
    db.session.add(event)
    db.session.commit()
    
    # Send notification to all family members
    members = FamilyMember.query.filter_by(family_id=user.family_id).all()
    for member in members:
        if member.user_id != user.id:  # Don't notify creator
            notif = Notification(
                user_id=member.user_id,
                from_user_id=user.id,
                type="calendar_event",
                title=f"New {event.event_type}: {event.title}",
                message=f"{user.name} created a new event on {event.event_date.strftime('%b %d, %Y at %I:%M %p')}",
                data=json.dumps({
                    "event_id": event.id,
                    "event_type": event.event_type,
                    "event_date": event.event_date.isoformat(),
                    "title": event.title
                })
            )
            db.session.add(notif)
    db.session.commit()
    
    return jsonify({"event": event.to_dict()}), 201


@extras_bp.route("/calendar/<int:event_id>", methods=["PUT"])
@jwt_required()
def update_event(event_id):
    event = FamilyEvent.query.get_or_404(event_id)
    data = request.get_json() or {}
    
    # Update fields
    if "title" in data:
        event.title = data["title"]
    if "description" in data:
        event.description = data["description"]
    if "event_type" in data:
        event.event_type = data["event_type"]
    if "color" in data:
        event.color = data["color"]
    if "is_recurring" in data:
        event.is_recurring = data["is_recurring"]
    if "recurrence" in data:
        event.recurrence = data["recurrence"]
    
    # Update dates
    try:
        if "event_date" in data:
            event.event_date = datetime.fromisoformat(data["event_date"])
        if "end_date" in data:
            event.end_date = datetime.fromisoformat(data["end_date"]) if data["end_date"] else None
    except:
        return jsonify({"error": "Invalid date format"}), 400
    
    db.session.commit()
    return jsonify({"event": event.to_dict()})


@extras_bp.route("/calendar/<int:event_id>", methods=["DELETE"])
@jwt_required()
def delete_event(event_id):
    event = FamilyEvent.query.get_or_404(event_id)
    db.session.delete(event)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@extras_bp.route("/calendar/<int:event_id>/reactions", methods=["GET"])
@jwt_required()
def get_event_reactions(event_id):
    """Get all reactions for an event"""
    from models.extras import EventReaction
    reactions = EventReaction.query.filter_by(event_id=event_id).all()
    return jsonify({"reactions": [r.to_dict() for r in reactions]})


@extras_bp.route("/calendar/<int:event_id>/reactions", methods=["POST"])
@jwt_required()
def add_event_reaction(event_id):
    """Add or update reaction to an event"""
    from models.extras import EventReaction
    user = me()
    data = request.get_json() or {}
    reaction_type = data.get("reaction", "❤️")
    
    # Check if user already reacted
    existing = EventReaction.query.filter_by(event_id=event_id, user_id=user.id).first()
    if existing:
        existing.reaction = reaction_type
        existing.created_at = datetime.utcnow()
    else:
        reaction = EventReaction(
            event_id=event_id,
            user_id=user.id,
            reaction=reaction_type
        )
        db.session.add(reaction)
    
    db.session.commit()
    reactions = EventReaction.query.filter_by(event_id=event_id).all()
    return jsonify({"reactions": [r.to_dict() for r in reactions]})


@extras_bp.route("/calendar/<int:event_id>/reactions/<int:reaction_id>", methods=["DELETE"])
@jwt_required()
def delete_event_reaction(event_id, reaction_id):
    """Remove reaction from event"""
    from models.extras import EventReaction
    reaction = EventReaction.query.get_or_404(reaction_id)
    if reaction.user_id != int(get_jwt_identity()):
        return jsonify({"error": "Not authorized"}), 403
    db.session.delete(reaction)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@extras_bp.route("/calendar/<int:event_id>/comments", methods=["GET"])
@jwt_required()
def get_event_comments(event_id):
    """Get all comments for an event"""
    from models.extras import EventComment
    comments = EventComment.query.filter_by(event_id=event_id).order_by(EventComment.created_at.desc()).all()
    return jsonify({"comments": [c.to_dict() for c in comments]})


@extras_bp.route("/calendar/<int:event_id>/comments", methods=["POST"])
@jwt_required()
def add_event_comment(event_id):
    """Add comment to an event"""
    from models.extras import EventComment
    user = me()
    data = request.get_json() or {}
    text = data.get("text", "").strip()
    
    if not text:
        return jsonify({"error": "Comment text required"}), 400
    
    comment = EventComment(
        event_id=event_id,
        user_id=user.id,
        text=text
    )
    db.session.add(comment)
    db.session.commit()
    
    return jsonify({"comment": comment.to_dict()}), 201


@extras_bp.route("/calendar/<int:event_id>/comments/<int:comment_id>", methods=["DELETE"])
@jwt_required()
def delete_event_comment(event_id, comment_id):
    """Delete comment from event"""
    from models.extras import EventComment
    comment = EventComment.query.get_or_404(comment_id)
    if comment.user_id != int(get_jwt_identity()):
        return jsonify({"error": "Not authorized"}), 403
    db.session.delete(comment)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@extras_bp.route("/calendar/upcoming", methods=["GET"])
@jwt_required()
def upcoming_events():
    user = me()
    if not user.family_id:
        return jsonify({"events": []})
    now = datetime.utcnow()
    events = FamilyEvent.query.filter(
        FamilyEvent.family_id == user.family_id,
        FamilyEvent.event_date >= now
    ).order_by(FamilyEvent.event_date).limit(5).all()
    return jsonify({"events": [e.to_dict() for e in events]})


# ── Family Recipes ────────────────────────────────────────────

@extras_bp.route("/recipes", methods=["GET"])
@jwt_required()
def get_recipes():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    category = request.args.get("category")
    q = FamilyRecipe.query.filter_by(family_id=user.family_id)
    if category:
        q = q.filter_by(category=category)
    recipes = q.order_by(FamilyRecipe.created_at.desc()).all()
    return jsonify({"recipes": [r.to_dict() for r in recipes]})


@extras_bp.route("/recipes", methods=["POST"])
@jwt_required()
def create_recipe():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403

    image_url = None
    if "image" in request.files:
        result = cloudinary.uploader.upload(request.files["image"], folder="kinscribe/recipes")
        image_url = result["secure_url"]

    # Accept both JSON and form data
    if request.is_json:
        data = request.get_json() or {}
    else:
        data = request.form.to_dict()

    ingredients = data.get("ingredients", "[]")
    if isinstance(ingredients, list):
        ingredients = json.dumps(ingredients)
    elif isinstance(ingredients, str):
        # already a JSON string or plain string
        try:
            json.loads(ingredients)  # validate it's valid JSON
        except:
            ingredients = json.dumps([ingredients]) if ingredients else "[]"

    recipe = FamilyRecipe(
        family_id=user.family_id, user_id=user.id,
        title=data.get("title", ""), description=data.get("description"),
        ingredients=ingredients, instructions=data.get("instructions"),
        image_url=image_url or data.get("image_url"),
        prep_time=int(data["prep_time"]) if data.get("prep_time") else None,
        servings=int(data["servings"]) if data.get("servings") else None,
        category=data.get("category"), tags=data.get("tags")
    )
    db.session.add(recipe)
    db.session.flush()

    # Send notifications to all family members
    from models.family import FamilyMember
    from models.notifications import Notification
    family_members = FamilyMember.query.filter_by(family_id=user.family_id).all()
    for member in family_members:
        if member.user_id != user.id:  # Don't notify the creator
            notif = Notification(
                user_id=member.user_id,
                type="recipe",
                title=f"New Recipe: {recipe.title}",
                message=f"{user.name} shared a new recipe",
                data=json.dumps({"recipe_id": recipe.id, "family_id": user.family_id}),
                action_url=f"/family/recipes/{recipe.id}"
            )
            db.session.add(notif)
    
    db.session.commit()
    return jsonify({"recipe": recipe.to_dict()}), 201


@extras_bp.route("/recipes/<int:recipe_id>", methods=["DELETE"])
@jwt_required()
def delete_recipe(recipe_id):
    recipe = FamilyRecipe.query.get_or_404(recipe_id)
    if recipe.user_id != int(get_jwt_identity()):
        return jsonify({"error": "Not authorized"}), 403
    db.session.delete(recipe)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@extras_bp.route("/recipes/<int:recipe_id>", methods=["GET"])
@jwt_required()
def get_recipe(recipe_id):
    recipe = FamilyRecipe.query.get_or_404(recipe_id)
    return jsonify({"recipe": recipe.to_dict()})


@extras_bp.route("/recipes/<int:recipe_id>/react", methods=["POST"])
@jwt_required()
def react_to_recipe(recipe_id):
    from models.extras import RecipeReaction
    user = me()
    recipe = FamilyRecipe.query.get_or_404(recipe_id)
    data = request.get_json() or {}
    reaction_type = data.get("reaction_type", "like")  # like, love, yum
    
    # Check if already reacted
    existing = RecipeReaction.query.filter_by(
        recipe_id=recipe_id, user_id=user.id
    ).first()
    
    if existing:
        if existing.reaction_type == reaction_type:
            # Remove reaction
            db.session.delete(existing)
            db.session.commit()
            return jsonify({"reacted": False})
        else:
            # Update reaction
            existing.reaction_type = reaction_type
            db.session.commit()
            return jsonify({"reacted": True, "reaction_type": reaction_type})
    
    # Add new reaction
    reaction = RecipeReaction(
        recipe_id=recipe_id,
        user_id=user.id,
        reaction_type=reaction_type
    )
    db.session.add(reaction)
    db.session.commit()
    
    # Notify recipe author
    if recipe.user_id != user.id:
        from models.notifications import Notification
        notif = Notification(
            user_id=recipe.user_id,
            type="recipe_reaction",
            title=f"{user.name} reacted to your recipe",
            message=f"{reaction_type.capitalize()} on {recipe.title}",
            data=json.dumps({"recipe_id": recipe_id, "user_id": user.id}),
            action_url=f"/family/recipes/{recipe_id}"
        )
        db.session.add(notif)
        db.session.commit()
    
    return jsonify({"reacted": True, "reaction_type": reaction_type})


@extras_bp.route("/recipes/<int:recipe_id>/reactions", methods=["GET"])
@jwt_required()
def get_recipe_reactions(recipe_id):
    from models.extras import RecipeReaction
    reactions = RecipeReaction.query.filter_by(recipe_id=recipe_id).all()
    return jsonify({"reactions": [r.to_dict() for r in reactions]})


@extras_bp.route("/recipes/<int:recipe_id>/comments", methods=["POST"])
@jwt_required()
def comment_on_recipe(recipe_id):
    from models.extras import RecipeComment
    user = me()
    recipe = FamilyRecipe.query.get_or_404(recipe_id)
    data = request.get_json() or {}
    text = data.get("text", "").strip()
    
    if not text:
        return jsonify({"error": "Comment text required"}), 400
    
    comment = RecipeComment(
        recipe_id=recipe_id,
        user_id=user.id,
        text=text
    )
    db.session.add(comment)
    db.session.commit()
    
    # Notify recipe author
    if recipe.user_id != user.id:
        from models.notifications import Notification
        notif = Notification(
            user_id=recipe.user_id,
            type="recipe_comment",
            title=f"{user.name} commented on your recipe",
            message=text[:100],
            data=json.dumps({"recipe_id": recipe_id, "comment_id": comment.id}),
            action_url=f"/family/recipes/{recipe_id}"
        )
        db.session.add(notif)
        db.session.commit()
    
    return jsonify({"comment": comment.to_dict()}), 201


@extras_bp.route("/recipes/<int:recipe_id>/comments", methods=["GET"])
@jwt_required()
def get_recipe_comments(recipe_id):
    from models.extras import RecipeComment
    comments = RecipeComment.query.filter_by(recipe_id=recipe_id).order_by(
        RecipeComment.created_at.desc()
    ).all()
    return jsonify({"comments": [c.to_dict() for c in comments]})


# ── Family Tasks ──────────────────────────────────────────────

@extras_bp.route("/tasks", methods=["GET"])
@jwt_required()
def get_tasks():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    tasks = FamilyTask.query.filter_by(family_id=user.family_id).order_by(
        FamilyTask.is_done, FamilyTask.due_date
    ).all()
    return jsonify({"tasks": [t.to_dict() for t in tasks]})


@extras_bp.route("/tasks", methods=["POST"])
@jwt_required()
def create_task():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    data = request.get_json() or {}
    due = None
    try:
        if data.get("due_date"): due = datetime.fromisoformat(data["due_date"])
    except: pass
    task = FamilyTask(
        family_id=user.family_id, created_by=user.id,
        assigned_to=data.get("assigned_to"),
        title=data["title"], description=data.get("description"),
        due_date=due, priority=data.get("priority", "medium")
    )
    db.session.add(task)
    db.session.commit()
    return jsonify({"task": task.to_dict()}), 201


@extras_bp.route("/tasks/<int:task_id>/toggle", methods=["POST"])
@jwt_required()
def toggle_task(task_id):
    task = FamilyTask.query.get_or_404(task_id)
    task.is_done = not task.is_done
    db.session.commit()
    return jsonify({"task": task.to_dict()})


@extras_bp.route("/tasks/<int:task_id>", methods=["DELETE"])
@jwt_required()
def delete_task(task_id):
    task = FamilyTask.query.get_or_404(task_id)
    db.session.delete(task)
    db.session.commit()
    return jsonify({"message": "Deleted"})


# ── Family Budget ─────────────────────────────────────────────

@extras_bp.route("/budget", methods=["GET"])
@jwt_required()
def get_budget():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    month = request.args.get("month", type=int, default=datetime.utcnow().month)
    year = request.args.get("year", type=int, default=datetime.utcnow().year)
    search = request.args.get("search", "")
    category = request.args.get("category")
    entry_type = request.args.get("entry_type")
    
    q = FamilyBudget.query.filter(
        FamilyBudget.family_id == user.family_id,
        db.extract("month", FamilyBudget.date) == month,
        db.extract("year", FamilyBudget.date) == year
    )
    
    if search:
        q = q.filter(FamilyBudget.title.ilike(f"%{search}%"))
    if category:
        q = q.filter_by(category=category)
    if entry_type:
        q = q.filter_by(entry_type=entry_type)
    
    entries = q.order_by(FamilyBudget.date.desc()).all()
    total_income = sum(e.amount for e in entries if e.entry_type == "income")
    total_expense = sum(e.amount for e in entries if e.entry_type == "expense")
    
    # Category breakdown
    category_breakdown = {}
    for e in entries:
        if e.entry_type == "expense" and e.category:
            category_breakdown[e.category] = category_breakdown.get(e.category, 0) + e.amount
    
    # Get budget goals
    goals = BudgetGoal.query.filter_by(family_id=user.family_id).all()
    goals_dict = {g.category: g.to_dict() for g in goals}
    
    # Calculate goal progress
    for cat, spent in category_breakdown.items():
        if cat in goals_dict:
            limit = goals_dict[cat]["monthly_limit"]
            goals_dict[cat]["spent"] = spent
            goals_dict[cat]["percentage"] = round((spent / limit) * 100, 1) if limit > 0 else 0
            goals_dict[cat]["remaining"] = limit - spent
    
    return jsonify({
        "entries": [e.to_dict() for e in entries],
        "total_income": total_income,
        "total_expense": total_expense,
        "balance": total_income - total_expense,
        "category_breakdown": category_breakdown,
        "goals": list(goals_dict.values())
    })


@extras_bp.route("/budget", methods=["POST"])
@jwt_required()
def add_budget_entry():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    
    # Handle file upload
    attachment_url = None
    if "attachment" in request.files:
        result = cloudinary.uploader.upload(request.files["attachment"], folder="kinscribe/budget")
        attachment_url = result["secure_url"]
    
    # Get data from JSON or form
    if request.is_json:
        data = request.get_json() or {}
    else:
        data = request.form.to_dict()
    
    entry_date = date.today()
    try:
        if data.get("date"): entry_date = datetime.strptime(data["date"], "%Y-%m-%d").date()
    except: pass
    
    entry = FamilyBudget(
        family_id=user.family_id, user_id=user.id,
        title=data["title"], amount=float(data["amount"]),
        category=data.get("category", "other"),
        entry_type=data.get("entry_type", "expense"),
        date=entry_date, notes=data.get("notes"),
        attachment_url=attachment_url or data.get("attachment_url"),
        is_recurring=data.get("is_recurring", False),
        recurrence=data.get("recurrence"),
        currency=data.get("currency", "USD")
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify({"entry": entry.to_dict()}), 201


@extras_bp.route("/budget/<int:entry_id>", methods=["PUT"])
@jwt_required()
def update_budget_entry(entry_id):
    entry = FamilyBudget.query.get_or_404(entry_id)
    data = request.get_json() or {}
    
    if "title" in data:
        entry.title = data["title"]
    if "amount" in data:
        entry.amount = float(data["amount"])
    if "category" in data:
        entry.category = data["category"]
    if "entry_type" in data:
        entry.entry_type = data["entry_type"]
    if "notes" in data:
        entry.notes = data["notes"]
    if "is_recurring" in data:
        entry.is_recurring = data["is_recurring"]
    if "recurrence" in data:
        entry.recurrence = data["recurrence"]
    if "currency" in data:
        entry.currency = data["currency"]
    
    try:
        if "date" in data:
            entry.date = datetime.strptime(data["date"], "%Y-%m-%d").date()
    except: pass
    
    db.session.commit()
    return jsonify({"entry": entry.to_dict()})


@extras_bp.route("/budget/<int:entry_id>", methods=["DELETE"])
@jwt_required()
def delete_budget_entry(entry_id):
    entry = FamilyBudget.query.get_or_404(entry_id)
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@extras_bp.route("/budget/goals", methods=["GET"])
@jwt_required()
def get_budget_goals():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    goals = BudgetGoal.query.filter_by(family_id=user.family_id).all()
    return jsonify({"goals": [g.to_dict() for g in goals]})


@extras_bp.route("/budget/goals", methods=["POST"])
@jwt_required()
def set_budget_goal():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    data = request.get_json() or {}
    
    # Check if goal exists
    existing = BudgetGoal.query.filter_by(
        family_id=user.family_id,
        category=data["category"]
    ).first()
    
    if existing:
        existing.monthly_limit = float(data["monthly_limit"])
        existing.alert_threshold = float(data.get("alert_threshold", 80.0))
        db.session.commit()
        return jsonify({"goal": existing.to_dict()})
    
    goal = BudgetGoal(
        family_id=user.family_id,
        category=data["category"],
        monthly_limit=float(data["monthly_limit"]),
        alert_threshold=float(data.get("alert_threshold", 80.0)),
        created_by=user.id
    )
    db.session.add(goal)
    db.session.commit()
    return jsonify({"goal": goal.to_dict()}), 201


@extras_bp.route("/budget/goals/<int:goal_id>", methods=["DELETE"])
@jwt_required()
def delete_budget_goal(goal_id):
    goal = BudgetGoal.query.get_or_404(goal_id)
    db.session.delete(goal)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@extras_bp.route("/budget/analytics", methods=["GET"])
@jwt_required()
def budget_analytics():
    user = me()
    if not user.family_id:
        return jsonify({"error": "Not in a family"}), 403
    
    year = request.args.get("year", type=int, default=datetime.utcnow().year)
    
    # Get all entries for the year
    entries = FamilyBudget.query.filter(
        FamilyBudget.family_id == user.family_id,
        db.extract("year", FamilyBudget.date) == year
    ).all()
    
    # Monthly trend
    monthly_data = {}
    for i in range(1, 13):
        monthly_data[i] = {"income": 0, "expense": 0, "balance": 0}
    
    for e in entries:
        m = e.date.month
        if e.entry_type == "income":
            monthly_data[m]["income"] += e.amount
        else:
            monthly_data[m]["expense"] += e.amount
        monthly_data[m]["balance"] = monthly_data[m]["income"] - monthly_data[m]["expense"]
    
    # Category totals
    category_totals = {}
    for e in entries:
        if e.entry_type == "expense" and e.category:
            category_totals[e.category] = category_totals.get(e.category, 0) + e.amount
    
    # Top expenses
    top_expenses = sorted(
        [e for e in entries if e.entry_type == "expense"],
        key=lambda x: x.amount,
        reverse=True
    )[:10]
    
    return jsonify({
        "monthly_trend": [{
            "month": m,
            "income": monthly_data[m]["income"],
            "expense": monthly_data[m]["expense"],
            "balance": monthly_data[m]["balance"]
        } for m in range(1, 13)],
        "category_totals": category_totals,
        "top_expenses": [e.to_dict() for e in top_expenses],
        "total_income": sum(e.amount for e in entries if e.entry_type == "income"),
        "total_expense": sum(e.amount for e in entries if e.entry_type == "expense")
    })


# ── Post Insights ─────────────────────────────────────────────

@extras_bp.route("/insights/<int:post_id>", methods=["GET"])
@jwt_required()
def get_post_insights(post_id):
    current_id = int(get_jwt_identity())
    post = Post.query.get_or_404(post_id)
    if post.user_id != current_id:
        return jsonify({"error": "Not authorized"}), 403
    insights = PostInsight.query.filter_by(post_id=post_id).order_by(PostInsight.date).all()
    total = {
        "impressions": sum(i.impressions for i in insights),
        "reach": sum(i.reach for i in insights),
        "profile_visits": sum(i.profile_visits for i in insights),
        "shares": sum(i.shares for i in insights),
        "likes": post.to_dict(current_id)["like_count"],
        "comments": post.to_dict(current_id)["comment_count"],
        "saves": len(post.saves)
    }
    return jsonify({"insights": [i.to_dict() for i in insights], "total": total})


@extras_bp.route("/insights/profile", methods=["GET"])
@jwt_required()
def profile_insights():
    from models.social import Message, Conversation, ConversationParticipant, PublicStory, PublicStoryView
    from models.family import FamilyMember
    from models.story import Story
    from models.notifications import Notification
    from sqlalchemy import text, func
    from datetime import timedelta
    current_id = int(get_jwt_identity())
    user = me()
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    posts = Post.query.filter_by(user_id=current_id).all()
    total_likes = sum(len(p.likes) for p in posts)
    total_comments = sum(len(p.comments) for p in posts)
    total_saves = sum(len(p.saves) for p in posts)
    total_shares = sum(p.share_count or 0 for p in posts)
    total_views = sum(p.view_count or 0 for p in posts)
    connections_count = Connection.query.filter_by(following_id=current_id, status="accepted").count()
    interests_count = Connection.query.filter_by(follower_id=current_id, status="accepted").count()

    # Engagement rate
    eng_rate = 0
    if total_views > 0:
        eng_rate = round(((total_likes + total_comments + total_shares) / total_views) * 100, 1)

    # Top 5 posts by engagement (likes + comments + saves)
    top_posts = sorted(posts, key=lambda p: len(p.likes) + len(p.comments) + len(p.saves), reverse=True)[:5]

    # Posts by type
    type_counts = {}
    for p in posts:
        t = p.media_type or "text"
        type_counts[t] = type_counts.get(t, 0) + 1

    # Voice posts stats
    voice_posts = [p for p in posts if p.media_type == "audio"]
    voice_plays = sum(p.view_count or 0 for p in voice_posts)

    # Weekly growth: connections gained in last 7 days
    new_connections = Connection.query.filter(
        Connection.following_id == current_id,
        Connection.status == "accepted",
        Connection.created_at >= week_ago
    ).count()

    # 7-day daily growth trend (new connections per day)
    weekly_trend = []
    for i in range(6, -1, -1):
        day_start = now - timedelta(days=i+1)
        day_end = now - timedelta(days=i)
        count = Connection.query.filter(
            Connection.following_id == current_id,
            Connection.status == "accepted",
            Connection.created_at >= day_start,
            Connection.created_at < day_end
        ).count()
        weekly_trend.append({"day": day_start.strftime("%a"), "count": count})

    # Top interactive connections (users who liked/commented most on my posts)
    top_connections = []
    try:
        from models.social import PostLike, PostComment
        post_ids = [p.id for p in posts]
        if post_ids:
            liker_counts = db.session.query(
                PostLike.user_id, func.count(PostLike.id).label("cnt")
            ).filter(
                PostLike.post_id.in_(post_ids),
                PostLike.user_id != current_id
            ).group_by(PostLike.user_id).order_by(func.count(PostLike.id).desc()).limit(5).all()
            for row in liker_counts:
                u = User.query.get(row[0])
                if u:
                    top_connections.append({"id": u.id, "name": u.name, "avatar": u.avatar_url, "interactions": row[1]})
    except Exception:
        pass

    # Messages stats
    msgs_sent = 0
    msgs_received = 0
    active_convs = 0
    top_chatters = []
    try:
        my_parts = ConversationParticipant.query.filter_by(user_id=current_id).all()
        conv_ids = [p.conversation_id for p in my_parts]
        active_convs = len(conv_ids)
        msgs_sent = Message.query.filter_by(sender_id=current_id).count()
        msgs_received = Message.query.filter(
            Message.conversation_id.in_(conv_ids),
            Message.sender_id != current_id
        ).count()
        if conv_ids:
            top_raw = db.session.execute(text("""
                SELECT m.sender_id, COUNT(*) as cnt
                FROM messages m
                WHERE m.conversation_id = ANY(:cids)
                AND m.sender_id != :uid
                GROUP BY m.sender_id
                ORDER BY cnt DESC
                LIMIT 5
            """), {"cids": conv_ids, "uid": current_id}).fetchall()
            for row in top_raw:
                u = User.query.get(row[0])
                if u:
                    top_chatters.append({"id": u.id, "name": u.name, "avatar": u.avatar_url, "count": row[1]})
    except Exception:
        pass

    # Notification insights
    notif_data = {}
    try:
        total_notifs = Notification.query.filter_by(user_id=current_id).count()
        unread_notifs = Notification.query.filter_by(user_id=current_id, is_read=False).count()
        new_conn_notifs = Notification.query.filter(
            Notification.user_id == current_id,
            Notification.type == "connection",
            Notification.created_at >= week_ago
        ).count()
        mention_notifs = Notification.query.filter(
            Notification.user_id == current_id,
            Notification.type == "mention",
        ).count()
        notif_data = {
            "total": total_notifs,
            "unread": unread_notifs,
            "new_connections_notifs": new_conn_notifs,
            "mentions": mention_notifs,
        }
    except Exception:
        pass

    # Public stories stats
    stories_count = 0
    story_views = 0
    story_replies = 0
    top_story = None
    music_counts = {}
    try:
        my_stories = PublicStory.query.filter_by(user_id=current_id).all()
        stories_count = len(my_stories)
        story_views = sum(s.view_count or 0 for s in my_stories)
        # replies = messages that reference a story (media_type='story_reply')
        story_replies = Message.query.filter_by(sender_id=current_id, media_type="story_reply").count()
        # Top story by views
        if my_stories:
            best = max(my_stories, key=lambda s: s.view_count or 0)
            top_story = {
                "id": best.id,
                "media_url": best.media_url,
                "media_type": best.media_type,
                "views": best.view_count or 0,
                "music_name": best.music_name,
            }
        # Music usage from stories
        for s in my_stories:
            if s.music_name:
                music_counts[s.music_name] = music_counts.get(s.music_name, 0) + 1
    except Exception:
        pass

    # Music from family stories
    try:
        fam_stories_all = Story.query.filter_by(user_id=current_id).all()
        for s in fam_stories_all:
            if s.music_name:
                music_counts[s.music_name] = music_counts.get(s.music_name, 0) + 1
    except Exception:
        pass

    top_music = sorted(music_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    top_music = [{"name": k, "count": v} for k, v in top_music]

    # Family insights
    family_data = {}
    if user.family_id:
        try:
            fm_list = FamilyMember.query.filter_by(family_id=user.family_id).all()
            fam_conv = Conversation.query.filter_by(type="family", family_id=user.family_id).first()
            most_active_member = None
            fam_msg_count = 0
            fam_group_eng_rate = 0
            if fam_conv:
                fam_msg_count = Message.query.filter_by(conversation_id=fam_conv.id).count()
                top_fam = db.session.execute(text("""
                    SELECT sender_id, COUNT(*) as cnt
                    FROM messages WHERE conversation_id = :cid
                    GROUP BY sender_id ORDER BY cnt DESC LIMIT 1
                """), {"cid": fam_conv.id}).fetchone()
                if top_fam:
                    u = User.query.get(top_fam[0])
                    if u:
                        most_active_member = {"id": u.id, "name": u.name, "avatar": u.avatar_url, "count": top_fam[1]}
                # Group engagement rate: msgs / members
                if len(fm_list) > 0:
                    fam_group_eng_rate = round(fam_msg_count / len(fm_list), 1)
            fam_stories_count = Story.query.filter_by(family_id=user.family_id).count()
            # Most viewed family story
            best_fam_story = Story.query.filter_by(family_id=user.family_id).order_by(
                Story.repost_count.desc()
            ).first()
            # Mention count in family group
            mention_count = 0
            if fam_conv:
                try:
                    mention_count = db.session.execute(text("""
                        SELECT COUNT(*) FROM messages
                        WHERE conversation_id = :cid
                        AND mentions IS NOT NULL AND mentions != '[]'
                    """), {"cid": fam_conv.id}).scalar() or 0
                except Exception:
                    pass
            family_data = {
                "member_count": len(fm_list),
                "total_messages": fam_msg_count,
                "most_active_member": most_active_member,
                "total_stories": fam_stories_count,
                "group_engagement_rate": fam_group_eng_rate,
                "mention_count": mention_count,
                "most_viewed_story": best_fam_story.title if best_fam_story else None,
            }
        except Exception:
            pass

    # AI insights — dynamic based on real data
    ai_insights = []
    if type_counts.get("video", 0) > type_counts.get("image", 0):
        ai_insights.append("Your videos get more engagement than photos — keep posting videos.")
    elif type_counts.get("image", 0) > 0:
        ai_insights.append("Posts with images perform well — try adding short videos to boost reach.")
    if eng_rate >= 5:
        ai_insights.append(f"Your {eng_rate}% engagement rate is excellent — you're in the top tier.")
    elif eng_rate > 0:
        ai_insights.append(f"Your engagement rate is {eng_rate}%. Replying to comments can push it above 5%.")
    if new_connections > 5:
        ai_insights.append(f"You gained {new_connections} new connections this week — your content is reaching new people.")
    if top_music:
        ai_insights.append(f"Stories with music get more views. Your most used song: '{top_music[0]['name']}'.")
    if voice_posts:
        ai_insights.append(f"You have {len(voice_posts)} voice posts with {voice_plays} total plays — voice content builds intimacy.")
    if not ai_insights:
        ai_insights.append("Post consistently and engage with comments to unlock deeper insights.")

    return jsonify({
        # Overview
        "total_posts": len(posts),
        "total_likes": total_likes,
        "total_comments": total_comments,
        "total_saves": total_saves,
        "total_shares": total_shares,
        "total_views": total_views,
        "connections": connections_count,
        "interests": interests_count,
        "new_connections_this_week": new_connections,
        "engagement_rate": eng_rate,
        # Content
        "top_posts": [{
            "id": p.id,
            "caption": (p.caption or "")[:60],
            "media_url": p.media_url,
            "media_type": p.media_type,
            "likes": len(p.likes),
            "comments": len(p.comments),
            "saves": len(p.saves),
            "shares": p.share_count or 0,
            "views": p.view_count or 0,
        } for p in top_posts],
        "content_types": type_counts,
        "stories_count": stories_count,
        "story_views": story_views,
        "story_replies": story_replies,
        "top_story": top_story,
        # Voice
        "voice_posts_count": len(voice_posts),
        "voice_plays": voice_plays,
        # Music
        "top_music": top_music,
        # Activity
        "weekly_trend": weekly_trend,
        # Audience
        "top_connections": top_connections,
        # Messaging
        "messages_sent": msgs_sent,
        "messages_received": msgs_received,
        "active_conversations": active_convs,
        "top_chatters": top_chatters,
        # Notifications
        "notifications": notif_data,
        # Family
        "family": family_data,
        # AI
        "ai_insights": ai_insights,
    })


# ── Close Friends ─────────────────────────────────────────────

@extras_bp.route("/close-friends", methods=["GET"])
@jwt_required()
def get_close_friends():
    current_id = int(get_jwt_identity())
    friends = CloseFriend.query.filter_by(user_id=current_id).all()
    result = []
    for f in friends:
        u = User.query.get(f.friend_id)
        if u:
            result.append({**u.to_dict(), "close_friend_id": f.id})
    return jsonify({"close_friends": result})


@extras_bp.route("/close-friends/<int:friend_id>/toggle", methods=["POST"])
@jwt_required()
def toggle_close_friend(friend_id):
    current_id = int(get_jwt_identity())
    existing = CloseFriend.query.filter_by(user_id=current_id, friend_id=friend_id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({"is_close_friend": False})
    db.session.add(CloseFriend(user_id=current_id, friend_id=friend_id))
    db.session.commit()
    return jsonify({"is_close_friend": True})


# ── Scheduled Posts ───────────────────────────────────────────

@extras_bp.route("/scheduled", methods=["GET"])
@jwt_required()
def get_scheduled():
    current_id = int(get_jwt_identity())
    posts = ScheduledPost.query.filter_by(user_id=current_id, is_published=False).order_by(
        ScheduledPost.scheduled_at
    ).all()
    return jsonify({"scheduled_posts": [p.to_dict() for p in posts]})


@extras_bp.route("/scheduled", methods=["POST"])
@jwt_required()
def schedule_post():
    current_id = int(get_jwt_identity())
    data = request.get_json() or {}
    try:
        scheduled_at = datetime.fromisoformat(data["scheduled_at"])
    except:
        return jsonify({"error": "Invalid scheduled_at date"}), 400
    post = ScheduledPost(
        user_id=current_id, caption=data.get("caption"),
        media_url=data.get("media_url"), media_type=data.get("media_type"),
        privacy=data.get("privacy", "public"),
        hashtags=data.get("hashtags"), location=data.get("location"),
        scheduled_at=scheduled_at
    )
    db.session.add(post)
    db.session.commit()
    return jsonify({"scheduled_post": post.to_dict()}), 201


@extras_bp.route("/scheduled/<int:post_id>", methods=["DELETE"])
@jwt_required()
def delete_scheduled(post_id):
    post = ScheduledPost.query.get_or_404(post_id)
    if post.user_id != int(get_jwt_identity()):
        return jsonify({"error": "Not authorized"}), 403
    db.session.delete(post)
    db.session.commit()
    return jsonify({"message": "Deleted"})


# ── Message Requests ──────────────────────────────────────────

@extras_bp.route("/message-requests", methods=["GET"])
@jwt_required()
def get_message_requests():
    current_id = int(get_jwt_identity())
    requests_list = MessageRequest.query.filter_by(
        receiver_id=current_id, status="pending"
    ).order_by(MessageRequest.created_at.desc()).all()
    return jsonify({"requests": [r.to_dict() for r in requests_list]})


@extras_bp.route("/message-requests/<int:req_id>/accept", methods=["POST"])
@jwt_required()
def accept_message_request(req_id):
    req = MessageRequest.query.get_or_404(req_id)
    if req.receiver_id != int(get_jwt_identity()):
        return jsonify({"error": "Not authorized"}), 403
    req.status = "accepted"
    db.session.commit()
    return jsonify({"message": "Accepted"})


@extras_bp.route("/message-requests/<int:req_id>/decline", methods=["POST"])
@jwt_required()
def decline_message_request(req_id):
    req = MessageRequest.query.get_or_404(req_id)
    if req.receiver_id != int(get_jwt_identity()):
        return jsonify({"error": "Not authorized"}), 403
    req.status = "declined"
    db.session.commit()
    return jsonify({"message": "Declined"})


# ── Verified Badge ────────────────────────────────────────────

@extras_bp.route("/verified/<int:user_id>", methods=["GET"])
@jwt_required()
def check_verified(user_id):
    badge = VerifiedBadge.query.filter_by(user_id=user_id).first()
    return jsonify({"is_verified": badge is not None, "badge_type": badge.badge_type if badge else None})


# ── On This Day ───────────────────────────────────────────────

@extras_bp.route("/on-this-day", methods=["GET"])
@jwt_required()
def on_this_day():
    from models.story import Story
    user = me()
    if not user.family_id:
        return jsonify({"stories": []})
    today = datetime.utcnow()
    stories = Story.query.filter(
        Story.family_id == user.family_id,
        db.extract("month", Story.story_date) == today.month,
        db.extract("day", Story.story_date) == today.day,
        Story.story_date != None
    ).order_by(Story.story_date.desc()).all()
    return jsonify({"stories": [s.to_dict() for s in stories], "date": today.strftime("%B %d")})
