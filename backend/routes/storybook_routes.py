from flask import Blueprint, request, jsonify
from extensions import db
from models.user import User
from models.story import Story
from models.extras import (Storybook, StoryCollection, CollectionStory, TimeLockedStory,
                            StoryContributor, StoryReaction, StoryAudioRecording, FamilyTreeNode)
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
import os
import cloudinary
import cloudinary.uploader

storybook_bp = Blueprint("storybooks", __name__)

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)


def me():
    return User.query.get(int(get_jwt_identity()))


# ============ STORYBOOK GENERATION ============

@storybook_bp.route("/generate", methods=["POST"])
@jwt_required()
def generate_storybook():
    """Generate a compiled storybook from selected stories"""
    user = me()
    data = request.json or {}

    story_ids = data.get("story_ids", [])
    if not story_ids:
        return jsonify({"error": "Select at least one story"}), 400

    stories = Story.query.filter(Story.id.in_(story_ids)).all()

    # Build narrative using AI
    compiled = _compile_narrative(stories, data.get("title", "Family Storybook"))

    book = Storybook(
        title=data.get("title", "Family Storybook"),
        description=data.get("description", ""),
        cover_image=data.get("cover_image"),
        compiled_content=compiled,
        story_ids=",".join(str(i) for i in story_ids),
        privacy=data.get("privacy", "family"),
        theme=data.get("theme", "sepia"),
        font_size=data.get("font_size", "medium"),
        user_id=user.id,
        family_id=user.family_id
    )
    db.session.add(book)
    db.session.commit()

    return jsonify({"storybook": book.to_dict()}), 201


@storybook_bp.route("/auto-generate", methods=["POST"])
@jwt_required()
def auto_generate_memory_book():
    """AI-curated annual memory book"""
    user = me()
    data = request.json or {}
    year = data.get("year", datetime.utcnow().year - 1)
    
    # Get all stories from that year
    from sqlalchemy import extract
    stories = Story.query.filter(
        Story.family_id == user.family_id,
        extract('year', Story.story_date) == year
    ).order_by(Story.story_date.asc()).all()
    
    if not stories:
        return jsonify({"error": f"No stories found for {year}"}), 404
    
    # AI curates and compiles
    title = f"{year} Family Memory Book"
    compiled = _compile_narrative(stories, title)
    
    book = Storybook(
        title=title,
        description=f"Automatically generated memory book for {year}",
        compiled_content=compiled,
        story_ids=",".join(str(s.id) for s in stories),
        privacy="family",
        user_id=user.id,
        family_id=user.family_id
    )
    db.session.add(book)
    db.session.commit()
    
    return jsonify({"storybook": book.to_dict()}), 201


@storybook_bp.route("/", methods=["GET"])
@jwt_required()
def list_storybooks():
    """List all storybooks for the family"""
    user = me()
    books = Storybook.query.filter_by(family_id=user.family_id).order_by(
        Storybook.created_at.desc()
    ).all()
    return jsonify({"storybooks": [b.to_dict() for b in books]})


@storybook_bp.route("/<int:book_id>", methods=["GET"])
@jwt_required()
def get_storybook(book_id):
    """Get a specific storybook with all stories"""
    book = Storybook.query.get_or_404(book_id)
    result = book.to_dict()
    
    # Include full story data
    story_ids = result["story_ids"]
    stories = Story.query.filter(Story.id.in_(story_ids)).all()
    result["stories"] = [s.to_dict() for s in stories]
    
    return jsonify({"storybook": result})


@storybook_bp.route("/<int:book_id>", methods=["PUT"])
@jwt_required()
def update_storybook(book_id):
    """Update storybook settings (theme, font size, etc.)"""
    user = me()
    book = Storybook.query.get_or_404(book_id)
    
    if book.user_id != user.id:
        return jsonify({"error": "Not authorized"}), 403
    
    data = request.json or {}
    if "theme" in data:
        book.theme = data["theme"]
    if "font_size" in data:
        book.font_size = data["font_size"]
    if "title" in data:
        book.title = data["title"]
    if "description" in data:
        book.description = data["description"]
    
    db.session.commit()
    return jsonify({"storybook": book.to_dict()})


@storybook_bp.route("/<int:book_id>/export", methods=["POST"])
@jwt_required()
def export_storybook(book_id):
    """Export storybook as PDF or ZIP"""
    book = Storybook.query.get_or_404(book_id)
    data = request.json or {}
    format_type = data.get("format", "pdf")  # pdf | zip
    
    if format_type == "pdf":
        pdf_url = _generate_pdf(book)
        book.pdf_url = pdf_url
        db.session.commit()
        return jsonify({"pdf_url": pdf_url})
    else:
        zip_url = _generate_archive(book)
        return jsonify({"zip_url": zip_url})


# ============ STORY COLLECTIONS (CHAPTERS) ============

@storybook_bp.route("/collections", methods=["POST"])
@jwt_required()
def create_collection():
    """Create a themed story collection"""
    user = me()
    data = request.json or {}
    
    collection = StoryCollection(
        family_id=user.family_id,
        created_by=user.id,
        title=data.get("title", "Untitled Collection"),
        description=data.get("description"),
        cover_image=data.get("cover_image"),
        is_collaborative=data.get("is_collaborative", True)
    )
    db.session.add(collection)
    db.session.commit()
    
    return jsonify({"collection": collection.to_dict()}), 201


@storybook_bp.route("/collections", methods=["GET"])
@jwt_required()
def list_collections():
    """List all collections for the family"""
    user = me()
    collections = StoryCollection.query.filter_by(
        family_id=user.family_id
    ).order_by(StoryCollection.created_at.desc()).all()
    return jsonify({"collections": [c.to_dict() for c in collections]})


@storybook_bp.route("/collections/<int:collection_id>", methods=["GET"])
@jwt_required()
def get_collection(collection_id):
    """Get collection with all stories"""
    collection = StoryCollection.query.get_or_404(collection_id)
    result = collection.to_dict()
    
    # Get stories in this collection
    collection_stories = CollectionStory.query.filter_by(
        collection_id=collection_id
    ).order_by(CollectionStory.order_index.asc()).all()
    
    story_ids = [cs.story_id for cs in collection_stories]
    stories = Story.query.filter(Story.id.in_(story_ids)).all()
    result["stories"] = [s.to_dict() for s in stories]
    
    return jsonify({"collection": result})


@storybook_bp.route("/collections/<int:collection_id>/stories", methods=["POST"])
@jwt_required()
def add_story_to_collection(collection_id):
    """Add a story to a collection"""
    user = me()
    collection = StoryCollection.query.get_or_404(collection_id)
    data = request.json or {}
    story_id = data.get("story_id")
    
    if not story_id:
        return jsonify({"error": "story_id required"}), 400
    
    # Check if already exists
    existing = CollectionStory.query.filter_by(
        collection_id=collection_id, story_id=story_id
    ).first()
    if existing:
        return jsonify({"error": "Story already in collection"}), 409
    
    # Get max order index
    max_order = db.session.query(db.func.max(CollectionStory.order_index)).filter_by(
        collection_id=collection_id
    ).scalar() or 0
    
    cs = CollectionStory(
        collection_id=collection_id,
        story_id=story_id,
        added_by=user.id,
        order_index=max_order + 1
    )
    db.session.add(cs)
    db.session.commit()
    
    return jsonify({"message": "Story added to collection"}), 201


@storybook_bp.route("/collections/<int:collection_id>/stories/<int:story_id>", methods=["DELETE"])
@jwt_required()
def remove_story_from_collection(collection_id, story_id):
    """Remove a story from a collection"""
    cs = CollectionStory.query.filter_by(
        collection_id=collection_id, story_id=story_id
    ).first_or_404()
    db.session.delete(cs)
    db.session.commit()
    return jsonify({"message": "Story removed from collection"})


# ============ TIME-LOCKED STORIES ============

@storybook_bp.route("/time-locked", methods=["POST"])
@jwt_required()
def create_time_locked_story():
    """Create a story that unlocks on a future date"""
    user = me()
    data = request.json or {}
    
    # Create the story first
    story = Story(
        title=data.get("title", ""),
        content=data.get("content", ""),
        media_url=data.get("media_url"),
        media_type=data.get("media_type", "text"),
        privacy="private",  # Locked stories are private until unlocked
        user_id=user.id,
        family_id=user.family_id
    )
    db.session.add(story)
    db.session.flush()
    
    # Create time lock
    unlock_date_str = data.get("unlock_date")
    if not unlock_date_str:
        return jsonify({"error": "unlock_date required"}), 400
    
    try:
        unlock_date = datetime.fromisoformat(unlock_date_str)
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400
    
    time_lock = TimeLockedStory(
        story_id=story.id,
        unlock_date=unlock_date,
        unlock_message=data.get("unlock_message")
    )
    db.session.add(time_lock)
    db.session.commit()
    
    return jsonify({
        "story": story.to_dict(),
        "time_lock": time_lock.to_dict()
    }), 201


@storybook_bp.route("/time-locked", methods=["GET"])
@jwt_required()
def list_time_locked_stories():
    """List all time-locked stories for the family"""
    user = me()
    
    # Get all time-locked stories in the family
    time_locks = db.session.query(TimeLockedStory).join(Story).filter(
        Story.family_id == user.family_id
    ).order_by(TimeLockedStory.unlock_date.asc()).all()
    
    result = []
    for tl in time_locks:
        story = Story.query.get(tl.story_id)
        if story:
            data = tl.to_dict()
            data["story"] = story.to_dict()
            result.append(data)
    
    return jsonify({"time_locked_stories": result})


@storybook_bp.route("/time-locked/check-unlocks", methods=["POST"])
@jwt_required()
def check_and_unlock_stories():
    """Check for stories that should be unlocked now"""
    user = me()
    now = datetime.utcnow()
    
    # Find stories that should be unlocked
    to_unlock = db.session.query(TimeLockedStory).join(Story).filter(
        Story.family_id == user.family_id,
        TimeLockedStory.unlock_date <= now,
        TimeLockedStory.is_unlocked == False
    ).all()
    
    unlocked = []
    for tl in to_unlock:
        tl.is_unlocked = True
        tl.unlocked_at = now
        
        # Change story privacy to family
        story = Story.query.get(tl.story_id)
        if story:
            story.privacy = "family"
            unlocked.append({
                "story": story.to_dict(),
                "unlock_message": tl.unlock_message
            })
    
    db.session.commit()
    
    return jsonify({"unlocked_stories": unlocked, "count": len(unlocked)})


# ============ MULTI-AUTHOR STORIES ============

@storybook_bp.route("/collaborative", methods=["POST"])
@jwt_required()
def create_collaborative_story():
    """Create a multi-author story"""
    user = me()
    data = request.json or {}
    
    story = Story(
        title=data.get("title", "Collaborative Story"),
        content=data.get("content", ""),
        is_collaborative=True,
        user_id=user.id,
        family_id=user.family_id
    )
    db.session.add(story)
    db.session.flush()
    
    # Add creator as first contributor
    contributor = StoryContributor(
        story_id=story.id,
        user_id=user.id,
        contribution=data.get("content", ""),
        order_index=0
    )
    db.session.add(contributor)
    db.session.commit()
    
    return jsonify({"story": story.to_dict()}), 201


@storybook_bp.route("/collaborative/<int:story_id>/contribute", methods=["POST"])
@jwt_required()
def add_contribution(story_id):
    """Add your contribution to a collaborative story"""
    user = me()
    story = Story.query.get_or_404(story_id)
    
    if not story.is_collaborative:
        return jsonify({"error": "Story is not collaborative"}), 400
    
    data = request.json or {}
    contribution_text = data.get("contribution", "")
    
    if not contribution_text:
        return jsonify({"error": "contribution required"}), 400
    
    # Check if user already contributed
    existing = StoryContributor.query.filter_by(
        story_id=story_id, user_id=user.id
    ).first()
    
    if existing:
        existing.contribution = contribution_text
    else:
        max_order = db.session.query(db.func.max(StoryContributor.order_index)).filter_by(
            story_id=story_id
        ).scalar() or 0
        
        contributor = StoryContributor(
            story_id=story_id,
            user_id=user.id,
            contribution=contribution_text,
            order_index=max_order + 1
        )
        db.session.add(contributor)
    
    db.session.commit()
    return jsonify({"message": "Contribution added"})


@storybook_bp.route("/collaborative/<int:story_id>/contributors", methods=["GET"])
@jwt_required()
def get_contributors(story_id):
    """Get all contributors to a story"""
    contributors = StoryContributor.query.filter_by(
        story_id=story_id
    ).order_by(StoryContributor.order_index.asc()).all()
    
    return jsonify({"contributors": [c.to_dict() for c in contributors]})


# ============ STORY REACTIONS ============

@storybook_bp.route("/<int:story_id>/reactions", methods=["POST"])
@jwt_required()
def add_reaction(story_id):
    """Add a threaded reaction to a story"""
    user = me()
    data = request.json or {}
    
    # Upload media if present
    media_url = None
    if "file" in request.files:
        file = request.files["file"]
        result = cloudinary.uploader.upload(file, folder="kinscribe/reactions")
        media_url = result["secure_url"]
    
    reaction = StoryReaction(
        story_id=story_id,
        user_id=user.id,
        reaction_type=data.get("reaction_type", "comment"),
        text=data.get("text"),
        media_url=media_url or data.get("media_url")
    )
    db.session.add(reaction)
    db.session.commit()
    
    return jsonify({"reaction": reaction.to_dict()}), 201


@storybook_bp.route("/<int:story_id>/reactions", methods=["GET"])
@jwt_required()
def get_reactions(story_id):
    """Get all reactions to a story"""
    reactions = StoryReaction.query.filter_by(
        story_id=story_id
    ).order_by(StoryReaction.created_at.desc()).all()
    
    return jsonify({"reactions": [r.to_dict() for r in reactions]})


# ============ AUDIO PRESERVATION ============

@storybook_bp.route("/<int:story_id>/audio", methods=["POST"])
@jwt_required()
def add_audio_recording(story_id):
    """Attach audio recording to a story"""
    user = me()
    
    if "audio" not in request.files:
        return jsonify({"error": "audio file required"}), 400
    
    audio_file = request.files["audio"]
    result = cloudinary.uploader.upload(
        audio_file, 
        resource_type="raw",
        folder="kinscribe/audio"
    )
    
    data = request.form
    recording = StoryAudioRecording(
        story_id=story_id,
        user_id=user.id,
        audio_url=result["secure_url"],
        duration_seconds=data.get("duration_seconds"),
        transcript=data.get("transcript")
    )
    db.session.add(recording)
    db.session.commit()
    
    return jsonify({"recording": recording.to_dict()}), 201


@storybook_bp.route("/<int:story_id>/audio", methods=["GET"])
@jwt_required()
def get_audio_recordings(story_id):
    """Get all audio recordings for a story"""
    recordings = StoryAudioRecording.query.filter_by(
        story_id=story_id
    ).order_by(StoryAudioRecording.created_at.asc()).all()
    
    return jsonify({"recordings": [r.to_dict() for r in recordings]})


# ============ FAMILY TREE INTEGRATION ============

@storybook_bp.route("/tree-node/<int:node_id>/stories", methods=["GET"])
@jwt_required()
def get_stories_by_tree_node(node_id):
    """Get all stories tagged to a family tree member"""
    stories = Story.query.filter_by(tagged_tree_node_id=node_id).order_by(
        Story.created_at.desc()
    ).all()
    
    return jsonify({"stories": [s.to_dict() for s in stories]})


@storybook_bp.route("/<int:story_id>/tag-person", methods=["POST"])
@jwt_required()
def tag_person_in_story(story_id):
    """Tag a family tree member in a story"""
    story = Story.query.get_or_404(story_id)
    data = request.json or {}
    node_id = data.get("tree_node_id")
    
    if not node_id:
        return jsonify({"error": "tree_node_id required"}), 400
    
    story.tagged_tree_node_id = node_id
    db.session.commit()
    
    return jsonify({"message": "Person tagged in story"})


# ============ FAMILY TIMELINE ============

@storybook_bp.route("/timeline", methods=["GET"])
@jwt_required()
def get_family_timeline():
    """Get stories organized by timeline (story_date, not created_at)"""
    user = me()
    
    # Get view mode: decade | year | month
    view = request.args.get("view", "year")
    year = request.args.get("year", type=int)
    
    stories = Story.query.filter_by(family_id=user.family_id).filter(
        Story.story_date.isnot(None)
    ).order_by(Story.story_date.asc()).all()
    
    if view == "decade":
        # Group by decade
        timeline = {}
        for story in stories:
            decade = (story.story_date.year // 10) * 10
            if decade not in timeline:
                timeline[decade] = []
            timeline[decade].append(story.to_dict())
        return jsonify({"timeline": timeline, "view": "decade"})
    
    elif view == "year":
        # Group by year
        timeline = {}
        for story in stories:
            year_key = story.story_date.year
            if year_key not in timeline:
                timeline[year_key] = []
            timeline[year_key].append(story.to_dict())
        return jsonify({"timeline": timeline, "view": "year"})
    
    else:  # month
        # Group by month for a specific year
        if not year:
            year = datetime.utcnow().year
        
        timeline = {}
        for story in stories:
            if story.story_date.year == year:
                month_key = story.story_date.strftime("%Y-%m")
                if month_key not in timeline:
                    timeline[month_key] = []
                timeline[month_key].append(story.to_dict())
        return jsonify({"timeline": timeline, "view": "month", "year": year})


# ============ AI FEATURES ============

@storybook_bp.route("/ai/ask", methods=["POST"])
@jwt_required()
def ask_family_ai():
    """AI chat interface to query family stories"""
    user = me()
    data = request.json or {}
    question = data.get("question", "")
    
    if not question:
        return jsonify({"error": "question required"}), 400
    
    # Get all family stories as context
    stories = Story.query.filter_by(family_id=user.family_id).all()
    
    answer = _ai_answer_question(question, stories)
    
    return jsonify({"answer": answer})


@storybook_bp.route("/ai/detect-duplicates", methods=["POST"])
@jwt_required()
def detect_duplicate_memories():
    """AI detects when multiple people posted about the same event"""
    user = me()
    
    stories = Story.query.filter_by(family_id=user.family_id).filter(
        Story.story_date.isnot(None)
    ).order_by(Story.story_date.asc()).all()
    
    duplicates = _ai_find_duplicates(stories)
    
    return jsonify({"duplicates": duplicates})


@storybook_bp.route("/ai/story-prompts", methods=["GET"])
@jwt_required()
def get_story_prompts():
    """AI generates prompts based on gaps in timeline"""
    user = me()
    
    # Analyze timeline gaps
    stories = Story.query.filter_by(family_id=user.family_id).all()
    prompts = _ai_generate_prompts(stories, user)
    
    return jsonify({"prompts": prompts})


# ============ HELPER FUNCTIONS ============

def _compile_narrative(stories, title):
    """Use OpenAI to compile stories into a structured narrative."""
    try:
        import openai
        openai.api_key = os.getenv("OPENAI_API_KEY")

        story_texts = "\n\n".join([
            f"[{s.story_date or 'Unknown date'}] {s.title}:\n{s.enhanced_text or s.content or s.transcript or ''}"
            for s in stories
        ])

        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": (
                    f"Compile these family stories into a structured storybook titled '{title}'. "
                    f"Organize into chapters by time period. Keep the emotional tone. "
                    f"Preserve the original voices.\n\n{story_texts}"
                )
            }]
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"AI compilation error: {e}")
        # Fallback: simple concatenation
        return "\n\n---\n\n".join([
            f"## {s.title}\n{s.enhanced_text or s.content or s.transcript or ''}"
            for s in stories
        ])


def _generate_pdf(book):
    """Generate PDF from storybook (placeholder)"""
    # TODO: Implement PDF generation using reportlab or weasyprint
    return "https://placeholder-pdf-url.com"


def _generate_archive(book):
    """Generate ZIP archive with all stories and media"""
    # TODO: Implement ZIP generation
    return "https://placeholder-zip-url.com"


def _ai_answer_question(question, stories):
    """AI answers questions about family using stories as context"""
    try:
        import openai
        openai.api_key = os.getenv("OPENAI_API_KEY")
        
        context = "\n\n".join([
            f"{s.title} ({s.story_date}): {s.content or s.transcript or ''}"
            for s in stories[:50]  # Limit context
        ])
        
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a family historian. Answer questions based on the family stories provided."},
                {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Unable to answer: {str(e)}"


def _ai_find_duplicates(stories):
    """AI finds duplicate memories from different perspectives"""
    # TODO: Implement duplicate detection using embeddings
    return []


def _ai_generate_prompts(stories, user):
    """AI generates story prompts based on gaps"""
    prompts = []
    
    # Find year gaps
    years_covered = {s.story_date.year for s in stories if s.story_date}
    current_year = datetime.utcnow().year
    
    for year in range(current_year - 50, current_year):
        if year not in years_covered:
            prompts.append({
                "prompt": f"What do you remember from {year}?",
                "year": year,
                "type": "gap"
            })
    
    return prompts[:10]  # Return top 10 prompts
