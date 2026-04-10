"""
AI Service — handles transcription, enhancement, summarization, and tagging.
Runs as a Celery background task after story upload.
"""
import os
from openai import OpenAI
from extensions import db
from models.story import Story

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def transcribe_audio(media_url: str) -> str:
    import urllib.request
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        urllib.request.urlretrieve(media_url, tmp.name)
        with open(tmp.name, "rb") as f:
            result = client.audio.transcriptions.create(model="whisper-1", file=f)
    return result.text


def enhance_text(text: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": (
            "Enhance this family story for clarity and readability. "
            "Fix grammar but preserve the original voice and emotional tone. "
            "Do not add fictional details.\n\n" + text
        )}]
    )
    return response.choices[0].message.content


def summarize_text(text: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Summarize this family story in 2-3 sentences:\n\n" + text}]
    )
    return response.choices[0].message.content


def generate_tags(text: str) -> list:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": (
            "Generate 5 relevant hashtag-style tags for this family story. "
            "Return only comma-separated tags without # symbol.\n\n" + text
        )}]
    )
    return [t.strip() for t in response.choices[0].message.content.split(",")]


def process_story(story_id: int):
    """Full AI pipeline for a story."""
    story = Story.query.get(story_id)
    if not story:
        return

    try:
        # Step 1: Transcribe if audio/video
        if story.media_type in ("audio", "video") and story.media_url:
            story.transcript = transcribe_audio(story.media_url)

        source_text = story.transcript or story.content or ""
        if not source_text:
            return

        # Step 2: Enhance
        story.enhanced_text = enhance_text(source_text)

        # Step 3: Summarize
        story.summary = summarize_text(source_text)

        # Step 4: Tag
        tags = generate_tags(source_text)
        story.tags = ",".join(tags)

        story.ai_processed = True
        db.session.commit()

    except Exception as e:
        print(f"AI processing failed for story {story_id}: {e}")


def chat_completion(prompt: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500,
        temperature=0.7
    )
    return response.choices[0].message.content.strip()


# Celery task wrapper (only active when Celery is running)
try:
    from celery import Celery
    celery_app = Celery("kinscribe", broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"))

    @celery_app.task
    def process_story_async(story_id: int):
        process_story(story_id)

except ImportError:
    pass

