"""
AI Service — uses Groq (free, fast) for chat, enhancement, summarization and tagging.
"""
import os
from groq import Groq
from extensions import db
from models.story import Story

MODEL = "llama-3.3-70b-versatile"

def _get_client():
    return Groq(api_key=os.getenv("GROQ_API_KEY"))


def _complete(prompt: str, max_tokens: int = 500) -> str:
    response = _get_client().chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
        temperature=0.7
    )
    return response.choices[0].message.content.strip()


def enhance_text(text: str) -> str:
    return _complete(
        "Enhance this family story for clarity and readability. "
        "Fix grammar but preserve the original voice and emotional tone. "
        "Do not add fictional details.\n\n" + text,
        max_tokens=1000
    )


def summarize_text(text: str) -> str:
    return _complete("Summarize this family story in 2-3 sentences:\n\n" + text)


def generate_tags(text: str) -> list:
    result = _complete(
        "Generate 5 relevant hashtag-style tags for this family story. "
        "Return only comma-separated tags without # symbol.\n\n" + text
    )
    return [t.strip() for t in result.split(",")]


def transcribe_audio(media_url: str) -> str:
    """Download media and transcribe using Groq Whisper."""
    import urllib.request
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        urllib.request.urlretrieve(media_url, tmp.name)
        with open(tmp.name, "rb") as f:
            result = _get_client().audio.transcriptions.create(
                model="whisper-large-v3",
                file=f
            )
    return result.text


def process_story(story_id: int):
    """Full AI pipeline for a story."""
    story = Story.query.get(story_id)
    if not story:
        return
    try:
        if story.media_type in ("audio", "video") and story.media_url:
            story.transcript = transcribe_audio(story.media_url)

        source_text = story.transcript or story.content or ""
        if not source_text:
            return

        story.enhanced_text = enhance_text(source_text)
        story.summary = summarize_text(source_text)
        story.tags = ",".join(generate_tags(source_text))
        story.ai_processed = True
        db.session.commit()
    except Exception as e:
        print(f"AI processing failed for story {story_id}: {e}")


def chat_completion(prompt: str, history: list = None, user_name: str = None) -> str:
    system = "You are KinsCribe AI, a smart, helpful and friendly AI assistant built into the KinsCribe app by Martins Fidel. You can help with anything — general knowledge, coding, creative writing, social media, advice, family memories, and more. Always format your responses using Markdown: use **bold** for important terms, `code` for technical terms, # headings for sections, - bullet points for lists, numbered lists for steps, > blockquotes for tips or highlights, and tables where comparisons are needed. Be natural and conversational like Meta AI. Only mention Martins Fidel or KinsCribe if the user specifically asks about who made you."

    if user_name:
        is_creator = 'martins' in user_name.lower() or 'fidel' in user_name.lower()
        if is_creator:
            system += " You are speaking with Martins Fidel, your creator. Be friendly and respectful."
        else:
            system += f" You are speaking with {user_name}."

    messages = [{"role": "system", "content": system}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": prompt})
    response = _get_client().chat.completions.create(
        model=MODEL,
        messages=messages,
        max_tokens=1000,
        temperature=0.7
    )
    return response.choices[0].message.content.strip()


# Celery task wrapper
try:
    from celery import Celery
    celery_app = Celery("kinscribe", broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"))

    @celery_app.task
    def process_story_async(story_id: int):
        process_story(story_id)

except ImportError:
    pass
