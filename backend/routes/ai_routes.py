from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.story import Story
from services.ai_service import chat_completion
import openai

ai_bp = Blueprint("ai", __name__)

def current_user():
    return User.query.get(int(get_jwt_identity()))

@ai_bp.route("/chat", methods=["POST"])
@jwt_required()
def family_chat():
    user = current_user()
    
    data = request.json
    message = data.get("message", "")
    
    if not message.strip():
        return jsonify({"response": "Please ask a question about your family! 👨‍👩‍👧‍👦"}), 400
    
    try:
        # Family context from recent stories
        recent_stories = db.session.query(Story).filter_by(
            family_id=user.family_id
        ).order_by(Story.created_at.desc()).limit(5).all()
        
        context = "Family memories:\n"
        for story in recent_stories:
            context += f"- {story.user.name}: {story.content[:100]}... ({story.created_at.strftime('%Y-%m-%d')})\n"
        
        prompt = f"""You are KinsCribe AI, a helpful family memory assistant. 
Context from recent family stories:
{context}

User question: {message}

Respond conversationally, focusing on family memories, genealogy, story suggestions, timeline ideas. Be warm and family-oriented."""
        
        response = chat_completion(prompt)
        
        return jsonify({"response": response})
        
    except Exception as e:
        return jsonify({"response": "Sorry, I'm having trouble thinking right now. Try asking about your family stories! 😊"}), 500


@ai_bp.route("/story-idea", methods=["POST"])
@jwt_required()
def generate_story_idea():
    user = current_user()
    data = request.json
    
    theme = data.get("theme", "family memory")
    
    prompt = f"""Generate a story idea for {user.name}'s family about '{theme}'.
Make it emotional, personal, and family-focused. Include:
1. Title
2. Suggested story date 
3. Who should tell it
4. Key memory points

Format as bullet points."""
    
    response = chat_completion(prompt)
    return jsonify({"idea": response})


@ai_bp.route("/summary", methods=["POST"])
@jwt_required()
def generate_summary():
    data = request.json
    story_content = data.get("content", "")
    
    prompt = f"Summarize this family story in 2-3 emotional sentences:\n\n{story_content}"
    
    response = chat_completion(prompt)
    return jsonify({"summary": response})

