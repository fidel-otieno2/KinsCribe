from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.story import Story
from services.ai_service import chat_completion

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/test", methods=["GET"])
def test_ai():
    try:
        result = chat_completion("Say hello in one word")
        return jsonify({"status": "ok", "response": result})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


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


@ai_bp.route("/smart-replies", methods=["POST"])
@jwt_required()
def smart_replies():
    """Generate 3 smart reply suggestions for a message."""
    message = (request.json or {}).get("message", "").strip()
    if not message:
        return jsonify({"replies": []})
    prompt = f"""Generate exactly 3 short, natural reply suggestions for this message: "{message}"
Return only the 3 replies as a JSON array of strings, nothing else. Example: ["Sure!", "Sounds good", "Let me check"]"""
    try:
        import json as _json
        raw = chat_completion(prompt)
        replies = _json.loads(raw)
        if isinstance(replies, list):
            return jsonify({"replies": replies[:3]})
    except Exception:
        pass
    return jsonify({"replies": ["Sure!", "Sounds good!", "Let me think about it"]})


@ai_bp.route("/tone-check", methods=["POST"])
@jwt_required()
def tone_check():
    """Check the tone and sentiment of a post caption before publishing."""
    text = (request.json or {}).get("text", "").strip()
    if not text:
        return jsonify({"tone": "neutral", "score": 5, "suggestion": ""})
    prompt = f"""Analyse the tone and sentiment of this social media post caption:
"{text}"

Respond with a JSON object with these exact keys:
- tone: one of positive/negative/neutral/aggressive/sad/inspiring/funny
- score: integer 1-10 (10 = very positive)
- suggestion: one short sentence improvement tip if needed, or empty string if it's fine

Return only the JSON object."""
    try:
        import json as _json
        raw = chat_completion(prompt)
        result = _json.loads(raw)
        return jsonify(result)
    except Exception:
        return jsonify({"tone": "neutral", "score": 5, "suggestion": ""})


@ai_bp.route("/caption", methods=["POST"])
@jwt_required()
def generate_caption():
    """Generate a caption for a post based on context."""
    data = request.json or {}
    context = data.get("context", "").strip()
    tone = data.get("tone", "warm")  # warm | funny | inspiring | professional
    if not context:
        return jsonify({"caption": ""}), 400
    prompt = f"""You are a creative social media caption writer.
The user is posting: {context}
Write a compelling, engaging caption. Tone: {tone}.
Rules:
- Under 150 characters
- No hashtags (those come separately)
- Make it feel personal and real, not generic
- Return ONLY the caption text, no quotes, no explanation"""
    try:
        return jsonify({"caption": chat_completion(prompt).strip('"').strip()})
    except Exception:
        return jsonify({"caption": ""}), 500


@ai_bp.route("/hashtags", methods=["POST"])
@jwt_required()
def generate_hashtags():
    """Generate relevant hashtags for a post."""
    caption = (request.json or {}).get("caption", "").strip()
    if not caption:
        return jsonify({"hashtags": []}), 400
    prompt = f"""Generate 8-10 relevant hashtags for this social media post: "{caption}"
Mix popular and niche tags. Return only a JSON array of strings like ["#family", "#memories"].
No explanation, just the JSON array."""
    try:
        import json as _json
        raw = chat_completion(prompt)
        tags = _json.loads(raw)
        if isinstance(tags, list):
            return jsonify({"hashtags": tags[:10]})
    except Exception:
        pass
    return jsonify({"hashtags": ["#family", "#memories", "#kinscribe"]})


@ai_bp.route("/improve", methods=["POST"])
@jwt_required()
def improve_post():
    """Rewrite/improve a caption to be more engaging."""
    caption = (request.json or {}).get("caption", "").strip()
    if not caption:
        return jsonify({"improved": ""}), 400
    prompt = f"""Improve this social media caption to be more engaging, emotional, and shareable:
"{caption}"
Keep the same meaning and tone. Return only the improved caption, no explanation."""
    try:
        return jsonify({"improved": chat_completion(prompt).strip('"').strip()})
    except Exception:
        return jsonify({"improved": caption}), 500


@ai_bp.route("/family-summary", methods=["POST"])
@jwt_required()
def family_chat_summary():
    """Generate an AI summary of recent family chat messages."""
    import json as _json
    user = current_user()
    messages = (request.json or {}).get("messages", [])
    if not messages:
        return jsonify({"summary": "No messages to summarise yet."})

    # Build a readable transcript (last 30 messages)
    transcript_lines = []
    for m in messages[-30:]:
        sender = m.get("sender_name") or "Someone"
        text = m.get("text") or ("[media]" if m.get("media_url") else "")
        if text:
            transcript_lines.append(f"{sender}: {text}")

    transcript = "\n".join(transcript_lines)
    if not transcript.strip():
        return jsonify({"summary": "No text messages to summarise."})

    prompt = f"""You are KinsCribe AI, a warm family assistant.
Here is a recent family group chat transcript:

{transcript}

Write a warm, friendly summary of what the family has been talking about.
Highlight key topics, decisions, plans, or memorable moments.
Keep it to 3-5 sentences. Be warm and personal."""

    try:
        summary = chat_completion(prompt)
        return jsonify({"summary": summary})
    except Exception as e:
        return jsonify({"summary": "Could not generate summary right now."}), 500
