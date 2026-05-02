from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.story import Story
from models.extras import Storybook
import os
import openai
import cloudinary
import cloudinary.uploader

ai_bp = Blueprint("ai", __name__)

openai.api_key = os.getenv("OPENAI_API_KEY")

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)


def me():
    return User.query.get(int(get_jwt_identity()))


# ============ AI STORY ENHANCER ============

@ai_bp.route("/generate-caption", methods=["POST"])
@ai_bp.route("/caption", methods=["POST"])
@jwt_required()
def generate_caption():
    """
    Generate AI caption suggestions for posts/stories.
    Accepts image URL or text context.
    """
    user = me()
    data = request.json or {}
    
    image_url = data.get("image_url")
    context = data.get("context", "")  # Optional text context
    tone = data.get("tone", "casual")  # casual, funny, heartfelt, poetic
    
    if not image_url and not context:
        return jsonify({"error": "Either image_url or context is required"}), 400
    
    try:
        # Build prompt based on tone
        tone_instructions = {
            "casual": "casual and friendly",
            "funny": "humorous and witty",
            "heartfelt": "warm and emotional",
            "poetic": "poetic and artistic",
            "professional": "professional and polished"
        }
        
        tone_style = tone_instructions.get(tone, "casual and friendly")
        
        if image_url:
            # Use GPT-4 Vision to analyze image and generate caption
            response = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": f"You are a creative caption writer. Generate 3 {tone_style} captions for social media posts. Each caption should be engaging and authentic. Return as JSON array: {{\"captions\": [\"caption1\", \"caption2\", \"caption3\"]}}"
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"Generate 3 {tone_style} captions for this image.{' Context: ' + context if context else ''}"
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": image_url}
                            }
                        ]
                    }
                ],
                temperature=0.8,
                max_tokens=300,
                response_format={"type": "json_object"}
            )
        else:
            # Text-only caption generation
            response = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": f"You are a creative caption writer. Generate 3 {tone_style} captions for social media posts based on the context provided. Return as JSON array: {{\"captions\": [\"caption1\", \"caption2\", \"caption3\"]}}"
                    },
                    {
                        "role": "user",
                        "content": f"Generate 3 {tone_style} captions for a post about: {context}"
                    }
                ],
                temperature=0.8,
                max_tokens=300,
                response_format={"type": "json_object"}
            )
        
        result = eval(response.choices[0].message.content)
        captions = result.get("captions", [])
        
        return jsonify({
            "captions": captions,
            "tone": tone,
            "count": len(captions)
        })
        
    except openai.AuthenticationError as e:
        print(f"OpenAI authentication error: {e}")
        return jsonify({
            "error": "AI service unavailable",
            "message": "OpenAI API key is not configured. Please add credits to use AI features.",
            "fallback_captions": [
                "Capturing moments that matter ✨",
                "Making memories with the ones I love ❤️",
                "Another beautiful day 🌟"
            ]
        }), 503
    except openai.RateLimitError as e:
        print(f"OpenAI quota exceeded: {e}")
        return jsonify({
            "error": "AI service quota exceeded",
            "message": "Please add credits to your OpenAI account to use AI features",
            "fallback_captions": [
                "Capturing moments that matter ✨",
                "Making memories with the ones I love ❤️",
                "Another beautiful day 🌟"
            ]
        }), 503
    except Exception as e:
        print(f"Caption generation error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Caption generation unavailable", "details": str(e)}), 500


@ai_bp.route("/enhance-story", methods=["POST"])
@jwt_required()
def enhance_story():
    """
    AI rewrites rough text into rich narrative.
    User approves before publishing.
    """
    user = me()
    data = request.json or {}
    
    original_text = data.get("text", "").strip()
    context = data.get("context", {})  # Optional: date, location, people involved
    
    if not original_text:
        return jsonify({"error": "Text is required"}), 400
    
    try:
        # Build context prompt
        context_parts = []
        if context.get("date"):
            context_parts.append(f"Date: {context['date']}")
        if context.get("location"):
            context_parts.append(f"Location: {context['location']}")
        if context.get("people"):
            context_parts.append(f"People involved: {', '.join(context['people'])}")
        
        context_str = "\n".join(context_parts) if context_parts else ""
        
        # Call OpenAI
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a family storytelling assistant. Your job is to take rough, "
                        "informal text (like voice notes or short captions) and transform them "
                        "into beautiful, readable narratives. Keep all the facts and emotions, "
                        "but improve grammar, structure, and flow. Make it warm and personal. "
                        "Preserve the original voice and tone. Don't add facts that weren't mentioned."
                    )
                },
                {
                    "role": "user",
                    "content": f"Original text:\n{original_text}\n\n{context_str}\n\nPlease enhance this into a beautiful family story."
                }
            ],
            temperature=0.7,
            max_tokens=1000
        )
        
        enhanced_text = response.choices[0].message.content.strip()
        
        # Generate a title suggestion
        title_response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Generate a short, meaningful title (3-6 words) for this family story."
                },
                {
                    "role": "user",
                    "content": enhanced_text
                }
            ],
            temperature=0.7,
            max_tokens=50
        )
        
        suggested_title = title_response.choices[0].message.content.strip().strip('"')
        
        return jsonify({
            "original": original_text,
            "enhanced": enhanced_text,
            "suggested_title": suggested_title,
            "improvements": {
                "word_count_before": len(original_text.split()),
                "word_count_after": len(enhanced_text.split()),
            }
        })
        
    except Exception as e:
        print(f"AI enhancement error: {e}")
        return jsonify({"error": f"Enhancement failed: {str(e)}"}), 500


@ai_bp.route("/enhance-story-batch", methods=["POST"])
@jwt_required()
def enhance_story_batch():
    """Enhance multiple stories at once"""
    user = me()
    data = request.json or {}
    story_ids = data.get("story_ids", [])
    
    if not story_ids:
        return jsonify({"error": "story_ids required"}), 400
    
    results = []
    for story_id in story_ids:
        story = Story.query.get(story_id)
        if not story or story.user_id != user.id:
            continue
        
        if story.ai_processed:
            results.append({"story_id": story_id, "status": "already_enhanced"})
            continue
        
        try:
            response = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "Enhance this family story. Keep facts, improve readability."
                    },
                    {
                        "role": "user",
                        "content": story.content or story.transcript or ""
                    }
                ],
                temperature=0.7,
                max_tokens=1000
            )
            
            enhanced = response.choices[0].message.content.strip()
            story.enhanced_text = enhanced
            story.ai_processed = True
            db.session.commit()
            
            results.append({"story_id": story_id, "status": "enhanced"})
        except Exception as e:
            results.append({"story_id": story_id, "status": "failed", "error": str(e)})
    
    return jsonify({"results": results})


# ============ VOICE-TO-STORY ============

@ai_bp.route("/voice-to-story", methods=["POST"])
@jwt_required()
def voice_to_story():
    """
    Transcribe voice memo, structure into story with title and paragraphs.
    Suggest matching photo from gallery.
    """
    user = me()
    
    if "audio" not in request.files:
        return jsonify({"error": "Audio file required"}), 400
    
    audio_file = request.files["audio"]
    
    try:
        # Upload audio to Cloudinary
        audio_result = cloudinary.uploader.upload(
            audio_file,
            resource_type="raw",
            folder="kinscribe/audio"
        )
        audio_url = audio_result["secure_url"]
        
        # Transcribe with OpenAI Whisper
        audio_file.seek(0)  # Reset file pointer
        transcript = openai.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="en"
        )
        
        transcribed_text = transcript.text
        
        # Structure into story
        story_response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a family storytelling assistant. Take this transcribed voice memo "
                        "and structure it into a beautiful story with:\n"
                        "1. A meaningful title (3-6 words)\n"
                        "2. Well-structured paragraphs\n"
                        "3. Proper grammar and punctuation\n"
                        "4. Preserved emotions and personal voice\n\n"
                        "Format your response as JSON:\n"
                        "{\n"
                        '  "title": "Story Title",\n'
                        '  "content": "Structured story with paragraphs...",\n'
                        '  "summary": "One sentence summary",\n'
                        '  "suggested_tags": ["tag1", "tag2"],\n'
                        '  "key_people": ["person1", "person2"],\n'
                        '  "key_locations": ["location1"],\n'
                        '  "estimated_date": "YYYY-MM-DD or null"\n'
                        "}"
                    )
                },
                {
                    "role": "user",
                    "content": f"Transcribed voice memo:\n\n{transcribed_text}"
                }
            ],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        
        story_data = eval(story_response.choices[0].message.content)
        
        return jsonify({
            "audio_url": audio_url,
            "transcript": transcribed_text,
            "title": story_data.get("title"),
            "content": story_data.get("content"),
            "summary": story_data.get("summary"),
            "suggested_tags": story_data.get("suggested_tags", []),
            "key_people": story_data.get("key_people", []),
            "key_locations": story_data.get("key_locations", []),
            "estimated_date": story_data.get("estimated_date"),
        })
        
    except Exception as e:
        print(f"Voice-to-story error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500


# ============ AI "ASK THE FAMILY" ============

@ai_bp.route("/chat", methods=["POST"])
@jwt_required()
def ai_chat():
    """
    General AI chat assistant for the app.
    Helps with app features, suggestions, and general queries.
    """
    user = me()
    data = request.json or {}
    message = data.get("message", "").strip()
    history = data.get("history", [])  # Previous messages for context
    
    if not message:
        return jsonify({"error": "Message is required"}), 400
    
    try:
        # Build conversation messages
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a helpful AI assistant for KinsCribe, a family storytelling app. "
                    "Help users with app features, give suggestions for stories to post, "
                    "provide writing tips, and answer general questions. "
                    "Be warm, friendly, and encouraging. Keep responses concise (2-3 paragraphs max)."
                )
            }
        ]
        
        # Add conversation history (last 5 messages)
        for msg in history[-5:]:
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })
        
        # Add current message
        messages.append({"role": "user", "content": message})
        
        # Get AI response
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=500
        )
        
        ai_response = response.choices[0].message.content.strip()
        
        return jsonify({
            "response": ai_response,
            "message": message
        })
        
    except openai.RateLimitError:
        return jsonify({
            "error": "AI service quota exceeded",
            "response": "I'm currently unavailable due to API limits. Please try again later or contact support."
        }), 503
    except Exception as e:
        print(f"AI chat error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Chat unavailable",
            "response": "I'm having trouble responding right now. Please try again."
        }), 500


@ai_bp.route("/family-chat", methods=["POST"])
@jwt_required()
def family_chat():
    """
    Conversational AI chat about family stories and history.
    Maintains conversation context.
    """
    user = me()
    data = request.json or {}
    message = data.get("message", "").strip()
    history = data.get("history", [])  # Previous messages for context
    
    if not message:
        return jsonify({"error": "Message is required"}), 400
    
    try:
        # Get family stories as context
        stories = Story.query.filter_by(family_id=user.family_id).order_by(
            Story.story_date.desc().nullslast()
        ).limit(50).all()
        
        if not stories:
            return jsonify({
                "response": "I don't have any family stories to reference yet. Start adding stories to build your family history, and I'll be able to help you explore them!",
                "relevant_stories": []
            })
        
        # Build context from stories
        context_stories = []
        for story in stories:
            story_text = story.enhanced_text or story.content or story.transcript or ""
            if story_text:
                context_stories.append({
                    "id": story.id,
                    "title": story.title,
                    "date": str(story.story_date) if story.story_date else "Unknown",
                    "content": story_text[:400]
                })
        
        context_str = "\n\n".join([
            f"Story: {s['title']} ({s['date']})\n{s['content']}"
            for s in context_stories[:15]
        ])
        
        # Build conversation messages
        messages = [
            {
                "role": "system",
                "content": (
                    f"You are a helpful family historian assistant for the {user.family.name if user.family else 'family'}. "
                    "Answer questions about the family using the provided stories. "
                    "Be warm, conversational, and personal. If you find relevant information, "
                    "mention which story it's from. If you can't find the answer, say so honestly. "
                    "Keep responses concise (2-3 paragraphs max).\n\n"
                    f"Family Stories:\n{context_str}"
                )
            }
        ]
        
        # Add conversation history (last 5 messages)
        for msg in history[-5:]:
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })
        
        # Add current message
        messages.append({"role": "user", "content": message})
        
        # Get AI response
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=500
        )
        
        ai_response = response.choices[0].message.content.strip()
        
        return jsonify({
            "response": ai_response,
            "message": message
        })
        
    except openai.RateLimitError:
        return jsonify({
            "error": "AI service quota exceeded",
            "response": "I'm currently unavailable due to API limits. Please try again later or contact support."
        }), 503
    except Exception as e:
        print(f"Family chat error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Chat unavailable",
            "response": "I'm having trouble responding right now. Please try again."
        }), 500


@ai_bp.route("/family-summary", methods=["POST"])
@jwt_required()
def family_summary():
    """
    Generate a summary of recent family chat messages.
    """
    user = me()
    data = request.json or {}
    messages = data.get("messages", [])
    
    if not messages:
        return jsonify({"error": "No messages provided"}), 400
    
    try:
        # Build message context
        message_text = "\n".join([
            f"{msg.get('sender_name', 'Unknown')}: {msg.get('text', '[Media]')}"
            for msg in messages
            if msg.get('text')
        ])
        
        if not message_text.strip():
            return jsonify({"summary": "No text messages to summarize. The chat contains only media."})
        
        # Generate summary with AI
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are summarizing a family chat conversation. "
                        "Create a brief, warm summary highlighting the main topics discussed, "
                        "important updates, and the overall mood. Keep it to 2-3 sentences. "
                        "Be conversational and family-friendly."
                    )
                },
                {
                    "role": "user",
                    "content": f"Summarize this family chat:\n\n{message_text}"
                }
            ],
            temperature=0.7,
            max_tokens=200
        )
        
        summary = response.choices[0].message.content.strip()
        
        return jsonify({"summary": summary})
        
    except openai.RateLimitError:
        return jsonify({
            "error": "AI service quota exceeded",
            "summary": "Unable to generate summary due to API limits. The family has been chatting about various topics!"
        }), 503
    except openai.AuthenticationError:
        return jsonify({
            "error": "AI service unavailable",
            "summary": "AI summary is currently unavailable. Please check your OpenAI API configuration."
        }), 503
    except Exception as e:
        print(f"Family summary error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Summary generation failed",
            "summary": "Unable to generate summary at this time. The family has been actively chatting!"
        }), 500


@ai_bp.route("/ask-family", methods=["POST"])
@jwt_required()
def ask_family():
    """
    Chat interface that answers questions about family using stories as context.
    Returns relevant story with quote and link.
    """
    user = me()
    data = request.json or {}
    question = data.get("question", "").strip()
    
    if not question:
        return jsonify({"error": "Question is required"}), 400
    
    try:
        # Get all family stories as context
        stories = Story.query.filter_by(family_id=user.family_id).order_by(
            Story.story_date.desc().nullslast()
        ).limit(100).all()
        
        if not stories:
            return jsonify({
                "answer": "I don't have any family stories to search through yet. Start adding stories to build your family history!",
                "relevant_stories": []
            })
        
        # Build context from stories
        context_stories = []
        for story in stories:
            story_text = story.enhanced_text or story.content or story.transcript or ""
            if story_text:
                context_stories.append({
                    "id": story.id,
                    "title": story.title,
                    "date": str(story.story_date) if story.story_date else "Unknown date",
                    "location": story.location or "Unknown location",
                    "author": story.author.name if story.author else "Unknown",
                    "content": story_text[:500]  # Limit context size
                })
        
        # Create context string
        context_str = "\n\n".join([
            f"Story {i+1}: {s['title']}\n"
            f"Date: {s['date']}\n"
            f"Location: {s['location']}\n"
            f"By: {s['author']}\n"
            f"Content: {s['content']}"
            for i, s in enumerate(context_stories[:20])  # Limit to 20 stories
        ])
        
        # Ask AI
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a family historian assistant. Answer questions about the family "
                        "using ONLY the information from the provided stories. If you find relevant "
                        "information, quote it directly and mention which story it's from. "
                        "If you can't find the answer in the stories, say so honestly. "
                        "Be warm, personal, and conversational.\n\n"
                        "Format your response as JSON:\n"
                        "{\n"
                        '  "answer": "Your conversational answer",\n'
                        '  "relevant_story_ids": [1, 2],\n'
                        '  "quotes": ["Quote from story 1", "Quote from story 2"],\n'
                        '  "confidence": "high|medium|low"\n'
                        "}"
                    )
                },
                {
                    "role": "user",
                    "content": f"Family Stories:\n\n{context_str}\n\nQuestion: {question}"
                }
            ],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        
        ai_response = eval(response.choices[0].message.content)
        
        # Get full story details for relevant stories
        relevant_story_ids = ai_response.get("relevant_story_ids", [])
        relevant_stories = []
        for story_id in relevant_story_ids:
            story = Story.query.get(story_id)
            if story:
                relevant_stories.append({
                    "id": story.id,
                    "title": story.title,
                    "date": str(story.story_date) if story.story_date else None,
                    "location": story.location,
                    "author_name": story.author.name if story.author else None,
                    "media_url": story.media_url,
                })
        
        return jsonify({
            "question": question,
            "answer": ai_response.get("answer"),
            "quotes": ai_response.get("quotes", []),
            "confidence": ai_response.get("confidence", "medium"),
            "relevant_stories": relevant_stories,
        })
        
    except Exception as e:
        print(f"Ask family error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to answer question: {str(e)}"}), 500


@ai_bp.route("/ask-family/suggestions", methods=["GET"])
@jwt_required()
def ask_family_suggestions():
    """Generate suggested questions based on family stories"""
    user = me()
    
    try:
        stories = Story.query.filter_by(family_id=user.family_id).limit(50).all()
        
        if not stories:
            return jsonify({"suggestions": [
                "Tell me about our family history",
                "What are some memorable family events?",
                "Who are the oldest family members?",
            ]})
        
        # Extract themes from stories
        titles = [s.title for s in stories[:20]]
        locations = list(set([s.location for s in stories if s.location]))[:10]
        
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Generate 5 interesting questions someone might ask about their family "
                        "based on these story titles and locations. Make them specific and engaging."
                    )
                },
                {
                    "role": "user",
                    "content": f"Story titles: {', '.join(titles)}\nLocations: {', '.join(locations)}"
                }
            ],
            temperature=0.8,
        )
        
        suggestions_text = response.choices[0].message.content
        suggestions = [line.strip().strip('123456789.-) ') for line in suggestions_text.split('\n') if line.strip()]
        
        return jsonify({"suggestions": suggestions[:5]})
        
    except Exception as e:
        return jsonify({"suggestions": [
            "Where did grandma grow up?",
            "What was our family like in the 1980s?",
            "Tell me about family vacations",
            "What are some funny family stories?",
            "Who are the important people in our family?",
        ]})


# ============ AUTO MEMORY BOOK GENERATOR ============

@ai_bp.route("/generate-memory-book", methods=["POST"])
@jwt_required()
def generate_memory_book():
    """
    AI collects all stories, photos, and milestones into a formatted PDF memory book.
    Can be triggered annually or on demand.
    """
    user = me()
    data = request.json or {}
    
    year = data.get("year")
    title = data.get("title", f"{year or 'Family'} Memory Book")
    include_photos = data.get("include_photos", True)
    
    try:
        # Get stories for the year (or all stories)
        query = Story.query.filter_by(family_id=user.family_id)
        
        if year:
            from sqlalchemy import extract
            query = query.filter(extract('year', Story.story_date) == year)
        
        stories = query.order_by(Story.story_date.asc().nullslast()).all()
        
        if not stories:
            return jsonify({"error": "No stories found for this period"}), 404
        
        # AI curates and organizes stories
        story_summaries = []
        for story in stories:
            story_summaries.append({
                "title": story.title,
                "date": str(story.story_date) if story.story_date else "Unknown",
                "content": (story.enhanced_text or story.content or story.transcript or "")[:300],
                "location": story.location,
                "author": story.author.name if story.author else "Unknown",
            })
        
        # Ask AI to organize into chapters
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are creating a family memory book. Organize these stories into "
                        "meaningful chapters (e.g., 'Family Gatherings', 'Vacations', 'Milestones'). "
                        "Write a beautiful introduction and chapter descriptions. "
                        "Format as JSON:\n"
                        "{\n"
                        '  "introduction": "Warm introduction text",\n'
                        '  "chapters": [\n'
                        '    {\n'
                        '      "title": "Chapter Title",\n'
                        '      "description": "Chapter description",\n'
                        '      "story_indices": [0, 1, 2]\n'
                        '    }\n'
                        '  ],\n'
                        '  "conclusion": "Closing thoughts"\n'
                        "}"
                    )
                },
                {
                    "role": "user",
                    "content": f"Book title: {title}\n\nStories:\n" + 
                               "\n\n".join([f"{i}. {s['title']} ({s['date']})" for i, s in enumerate(story_summaries)])
                }
            ],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        
        book_structure = eval(response.choices[0].message.content)
        
        # Create storybook entry
        story_ids = [str(s.id) for s in stories]
        
        # Compile content
        compiled_content = f"# {title}\n\n"
        compiled_content += f"{book_structure.get('introduction', '')}\n\n"
        
        for chapter in book_structure.get('chapters', []):
            compiled_content += f"## {chapter['title']}\n\n"
            compiled_content += f"{chapter['description']}\n\n"
            
            for idx in chapter.get('story_indices', []):
                if idx < len(stories):
                    story = stories[idx]
                    compiled_content += f"### {story.title}\n"
                    if story.story_date:
                        compiled_content += f"*{story.story_date}*\n\n"
                    compiled_content += f"{story.enhanced_text or story.content or story.transcript}\n\n"
                    compiled_content += "---\n\n"
        
        compiled_content += f"\n\n{book_structure.get('conclusion', '')}"
        
        # Create storybook
        book = Storybook(
            title=title,
            description=f"AI-curated memory book for {year or 'the family'}",
            compiled_content=compiled_content,
            story_ids=",".join(story_ids),
            privacy="family",
            user_id=user.id,
            family_id=user.family_id
        )
        db.session.add(book)
        db.session.commit()
        
        return jsonify({
            "storybook": book.to_dict(),
            "chapters": book_structure.get('chapters', []),
            "story_count": len(stories),
            "message": f"Memory book created with {len(stories)} stories organized into {len(book_structure.get('chapters', []))} chapters"
        }), 201
        
    except Exception as e:
        print(f"Memory book generation error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to generate memory book: {str(e)}"}), 500


# ============ DUPLICATE MEMORY DETECTOR ============

@ai_bp.route("/detect-duplicates", methods=["POST"])
@jwt_required()
def detect_duplicates():
    """
    AI detects when multiple family members posted about the same event.
    Suggests merging into one shared story.
    """
    user = me()
    
    try:
        # Get recent stories from family
        stories = Story.query.filter_by(family_id=user.family_id).filter(
            Story.story_date.isnot(None)
        ).order_by(Story.created_at.desc()).limit(100).all()
        
        if len(stories) < 2:
            return jsonify({"duplicates": []})
        
        # Group stories by similar dates (within 7 days)
        from datetime import timedelta
        potential_groups = []
        
        for i, story1 in enumerate(stories):
            for story2 in stories[i+1:]:
                if not story1.story_date or not story2.story_date:
                    continue
                
                date_diff = abs((story1.story_date - story2.story_date).days)
                
                if date_diff <= 7 and story1.user_id != story2.user_id:
                    potential_groups.append((story1, story2))
        
        # Use AI to check if they're about the same event
        duplicates = []
        
        for story1, story2 in potential_groups[:10]:  # Limit to 10 checks
            content1 = story1.enhanced_text or story1.content or story1.transcript or ""
            content2 = story2.enhanced_text or story2.content or story2.transcript or ""
            
            response = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Determine if these two stories are about the same event. "
                            "Respond with JSON: {\"is_duplicate\": true/false, \"confidence\": \"high|medium|low\", \"reason\": \"explanation\"}"
                        )
                    },
                    {
                        "role": "user",
                        "content": f"Story 1 ({story1.title}):\n{content1[:300]}\n\nStory 2 ({story2.title}):\n{content2[:300]}"
                    }
                ],
                temperature=0.3,
                response_format={"type": "json_object"}
            )
            
            result = eval(response.choices[0].message.content)
            
            if result.get("is_duplicate") and result.get("confidence") in ["high", "medium"]:
                duplicates.append({
                    "story1": {
                        "id": story1.id,
                        "title": story1.title,
                        "author": story1.author.name if story1.author else None,
                        "date": str(story1.story_date),
                    },
                    "story2": {
                        "id": story2.id,
                        "title": story2.title,
                        "author": story2.author.name if story2.author else None,
                        "date": str(story2.story_date),
                    },
                    "confidence": result.get("confidence"),
                    "reason": result.get("reason"),
                })
        
        return jsonify({"duplicates": duplicates, "count": len(duplicates)})
        
    except Exception as e:
        print(f"Duplicate detection error: {e}")
        return jsonify({"duplicates": [], "error": str(e)})


# ============ STORY PROMPT ENGINE ============

@ai_bp.route("/story-prompts", methods=["GET"])
@jwt_required()
def story_prompts():
    """
    AI generates prompts based on gaps in timeline, birthdays, anniversaries.
    "You haven't posted about 1998 yet. What do you remember?"
    """
    user = me()
    
    try:
        stories = Story.query.filter_by(family_id=user.family_id).all()
        
        # Analyze timeline gaps
        years_covered = set()
        for story in stories:
            if story.story_date:
                years_covered.add(story.story_date.year)
        
        current_year = datetime.utcnow().year
        prompts = []
        
        # Gap-based prompts
        for year in range(current_year - 50, current_year):
            if year not in years_covered:
                prompts.append({
                    "type": "gap",
                    "prompt": f"You haven't posted about {year} yet. What do you remember from that year?",
                    "year": year,
                    "priority": "medium"
                })
        
        # Recent events prompt
        from datetime import datetime, timedelta
        last_story_date = max([s.created_at for s in stories]) if stories else None
        if not last_story_date or (datetime.utcnow() - last_story_date).days > 30:
            prompts.append({
                "type": "recent",
                "prompt": "It's been a while! What's new with the family?",
                "priority": "high"
            })
        
        # Seasonal prompts
        month = datetime.utcnow().month
        seasonal_prompts = {
            12: "Share a favorite holiday memory from this season",
            6: "What's your favorite summer memory with the family?",
            3: "Spring is here! Any special springtime traditions?",
            9: "Back to school season - any memorable school stories?",
        }
        if month in seasonal_prompts:
            prompts.append({
                "type": "seasonal",
                "prompt": seasonal_prompts[month],
                "priority": "medium"
            })
        
        # Use AI to generate personalized prompts
        if stories:
            recent_titles = [s.title for s in stories[-10:]]
            
            response = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "Generate 3 thoughtful prompts to encourage family storytelling based on recent stories."
                    },
                    {
                        "role": "user",
                        "content": f"Recent stories: {', '.join(recent_titles)}"
                    }
                ],
                temperature=0.8,
            )
            
            ai_prompts = response.choices[0].message.content.split('\n')
            for prompt_text in ai_prompts:
                if prompt_text.strip():
                    prompts.append({
                        "type": "ai_generated",
                        "prompt": prompt_text.strip().strip('123456789.-) '),
                        "priority": "low"
                    })
        
        # Sort by priority
        priority_order = {"high": 0, "medium": 1, "low": 2}
        prompts.sort(key=lambda x: priority_order.get(x.get("priority", "low"), 2))
        
        return jsonify({"prompts": prompts[:10]})
        
    except Exception as e:
        print(f"Story prompts error: {e}")
        return jsonify({"prompts": [
            {"type": "default", "prompt": "Share a favorite family memory", "priority": "medium"},
            {"type": "default", "prompt": "Tell us about a special family tradition", "priority": "medium"},
            {"type": "default", "prompt": "What's something funny that happened recently?", "priority": "medium"},
        ]})


# ============ HELPER FUNCTIONS ============

from datetime import datetime

def _extract_metadata_from_text(text):
    """Extract dates, locations, people from text using AI"""
    try:
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract metadata from this text. Return JSON:\n"
                        '{"dates": ["YYYY-MM-DD"], "locations": ["place"], "people": ["name"]}'
                    )
                },
                {"role": "user", "content": text}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        return eval(response.choices[0].message.content)
    except Exception:
        return {"dates": [], "locations": [], "people": []}
