from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.story import Story
from services.ai_service import chat_completion

ai_bp = Blueprint("ai", __name__)


def current_user():
    return User.query.get(int(get_jwt_identity()))


@ai_bp.route("/chat", methods=["POST"])
@jwt_required()
def family_chat():
    user = current_user()
    if not user:
        return jsonify({"response": "User not found."}), 404

    message = (request.json or {}).get("message", "").strip()
    if not message:
        return jsonify({"response": "Please ask a question about your family!"}), 400

    try:
        context = ""
        if user.family_id:
            recent_stories = Story.query.filter_by(
                family_id=user.family_id
            ).order_by(Story.created_at.desc()).limit(5).all()

            if recent_stories:
                context = "Recent family stories:\n"
                for s in recent_stories:
                    text = (s.content or s.transcript or "")[:100]
                    context += f"- {s.title}: {text}\n"

        prompt = f"""You are KinsCribe AI, a warm and helpful family memory assistant.
{context}
User: {message}

Respond helpfully, focusing on family memories, genealogy, story ideas, and timelines."""

        response = chat_completion(prompt)
        return jsonify({"response": response})

    except Exception as e:
        print(f"AI chat error: {e}")
        return jsonify({"response": "Sorry, I had trouble processing that. Please try again!"}), 500


@ai_bp.route("/story-idea", methods=["POST"])
@jwt_required()
def generate_story_idea():
    user = current_user()
    theme = (request.json or {}).get("theme", "family memory")
    prompt = f"""Generate a story idea for {user.name}'s family about '{theme}'.
Make it emotional, personal, and family-focused. Include:
1. Title
2. Suggested story date
3. Who should tell it
4. Key memory points

Format as bullet points."""
    return jsonify({"idea": chat_completion(prompt)})


@ai_bp.route("/summary", methods=["POST"])
@jwt_required()
def generate_summary():
    content = (request.json or {}).get("content", "")
    prompt = f"Summarize this family story in 2-3 emotional sentences:\n\n{content}"
    return jsonify({"summary": chat_completion(prompt)})
