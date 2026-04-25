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

    data = request.json or {}
    message = data.get("message", "").strip()
    history = data.get("history", [])
    if not message:
        return jsonify({"response": "Please type a message!"}), 400

    try:
        response = chat_completion(message, history=history, user_name=user.name)
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
    data = request.json or {}
    context = data.get("context", "").strip()
    tone = data.get("tone", "warm")
    length = data.get("length", "medium")  # short | medium | long
    emoji = data.get("emoji", "minimal")   # none | minimal | heavy
    count = int(data.get("count", 1))
    if not context:
        return jsonify({"captions": [], "caption": ""}), 400

    length_guide = {"short": "1 line, under 80 chars", "medium": "2-3 lines, under 150 chars", "long": "3-5 lines, storytelling style"}.get(length, "under 150 chars")
    emoji_guide = {"none": "no emojis at all", "minimal": "1-2 emojis max", "heavy": "lots of emojis, expressive"}.get(emoji, "1-2 emojis")
    tone_guide = {
        "warm": "warm, loving, heartfelt",
        "funny": "funny, witty, makes people laugh",
        "deep": "deep, thoughtful, philosophical",
        "romantic": "romantic, soft, loving",
        "savage": "savage, bold, no filter",
        "professional": "professional, clean, polished",
        "inspiring": "inspiring, uplifting, motivating",
        "nostalgic": "nostalgic, throwback, sentimental",
        "aesthetic": "aesthetic, dreamy, artsy vibes",
        "humble": "humble, grateful, down to earth",
        "bold": "bold, confident, powerful",
        "mysterious": "mysterious, cryptic, intriguing",
        "grateful": "grateful, appreciative, blessed",
        "sarcastic": "sarcastic, dry humor, ironic",
        "motivational": "motivational, hustle, push harder",
        "chill": "chill, relaxed, laid back",
        "dramatic": "dramatic, over the top, theatrical",
        "poetic": "poetic, lyrical, beautiful language",
        "family": "family-focused, warm, inclusive",
        "travel": "travel, adventure, wanderlust",
        "foodie": "foodie, delicious, mouth-watering",
    }.get(tone, tone)

    prompt = f"""You are a creative social media caption writer.
Content: {context}
Tone: {tone_guide}
Length: {length_guide}
Emoji style: {emoji_guide}

Write exactly {count} different caption options. Each must feel unique — vary the angle, energy, and style.
Return ONLY a JSON array of {count} strings. No explanation, no numbering, just the array.
Example format: ["caption 1", "caption 2"]"""
    try:
        import json as _json
        raw = chat_completion(prompt)
        # Try to parse as JSON array
        captions = _json.loads(raw)
        if isinstance(captions, list):
            captions = [c.strip().strip('"') for c in captions if c][:count]
        else:
            captions = [str(captions).strip()]
        return jsonify({"captions": captions, "caption": captions[0] if captions else ""})
    except Exception:
        # Fallback: split by newlines
        lines = [l.strip().lstrip('0123456789.-) ') for l in raw.split('\n') if l.strip()]
        captions = [l for l in lines if len(l) > 10][:count]
        return jsonify({"captions": captions, "caption": captions[0] if captions else ""})


@ai_bp.route("/hashtags", methods=["POST"])
@jwt_required()
def generate_hashtags():
    data = request.json or {}
    caption = data.get("caption", "").strip()
    location = data.get("location", "").strip()
    tone = data.get("tone", "warm")
    count = min(int(data.get("count", 10)), 30)
    if not caption:
        return jsonify({"hashtags": []}), 400

    location_hint = f" Location: {location}." if location else ""
    prompt = f"""You are a social media hashtag expert.
Caption: "{caption}"
Tone: {tone}{location_hint}

Generate {count} hashtags. Categorize each as: trending, location, niche, community, or personal.
Rate each as: high, medium, or low (reach potential).

Return ONLY a JSON array. Each item must have: tag, category, level.
Example:
[
  {{"tag": "#NairobiVibes", "category": "location", "level": "high"}},
  {{"tag": "#ChillMoments", "category": "niche", "level": "medium"}}
]
No explanation. Just the JSON array."""
    try:
        import json as _json
        raw = chat_completion(prompt)
        # Strip markdown code blocks if present
        raw = raw.strip().strip('`')
        if raw.startswith('json'):
            raw = raw[4:].strip()
        hashtags = _json.loads(raw)
        if isinstance(hashtags, list):
            # Validate structure
            result = []
            for h in hashtags:
                if isinstance(h, dict) and 'tag' in h:
                    tag = h['tag'] if h['tag'].startswith('#') else f"#{h['tag']}"
                    result.append({
                        'tag': tag,
                        'category': h.get('category', 'niche'),
                        'level': h.get('level', 'medium'),
                    })
                elif isinstance(h, str):
                    result.append({'tag': h if h.startswith('#') else f'#{h}', 'category': 'niche', 'level': 'medium'})
            return jsonify({"hashtags": result[:count]})
    except Exception:
        pass
    # Fallback
    return jsonify({"hashtags": [
        {"tag": "#explore", "category": "trending", "level": "high"},
        {"tag": "#viral", "category": "trending", "level": "high"},
        {"tag": "#photooftheday", "category": "niche", "level": "medium"},
        {"tag": "#lifestyle", "category": "community", "level": "medium"},
    ]})


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
