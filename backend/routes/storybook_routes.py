from flask import Blueprint, request, jsonify
from extensions import db
from models.user import User
from models.story import Story
from models.extras import Storybook
from flask_jwt_extended import jwt_required, get_jwt_identity
import os

storybook_bp = Blueprint("storybooks", __name__)


@storybook_bp.route("/generate", methods=["POST"])
@jwt_required()
def generate_storybook():
    user = User.query.get(get_jwt_identity())
    data = request.json

    story_ids = data.get("story_ids", [])
    if not story_ids:
        return jsonify({"error": "Select at least one story"}), 400

    stories = Story.query.filter(Story.id.in_(story_ids)).all()

    # Build narrative using AI
    compiled = _compile_narrative(stories, data.get("title", "Family Storybook"))

    book = Storybook(
        title=data.get("title", "Family Storybook"),
        description=data.get("description", ""),
        compiled_content=compiled,
        story_ids=",".join(str(i) for i in story_ids),
        privacy=data.get("privacy", "family"),
        user_id=user.id,
        family_id=user.family_id
    )
    db.session.add(book)
    db.session.commit()

    return jsonify({"storybook": book.to_dict()}), 201


@storybook_bp.route("/", methods=["GET"])
@jwt_required()
def list_storybooks():
    user = User.query.get(get_jwt_identity())
    books = Storybook.query.filter_by(family_id=user.family_id).all()
    return jsonify({"storybooks": [b.to_dict() for b in books]})


@storybook_bp.route("/<int:book_id>", methods=["GET"])
@jwt_required()
def get_storybook(book_id):
    book = Storybook.query.get_or_404(book_id)
    return jsonify({"storybook": book.to_dict()})


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
    except Exception:
        # Fallback: simple concatenation
        return "\n\n---\n\n".join([
            f"## {s.title}\n{s.enhanced_text or s.content or s.transcript or ''}"
            for s in stories
        ])
