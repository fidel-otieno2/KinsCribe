import os
from flask import Flask
from config import Config
from extensions import db, jwt, bcrypt, mail, cors

from routes.auth_routes import auth_bp
from routes.family_routes import family_bp
from routes.story_routes import story_bp
from routes.storybook_routes import storybook_bp
from routes.ai_routes import ai_bp
from routes.connection_routes import connection_bp
from routes.post_routes import post_bp
from routes.message_routes import message_bp
from routes.public_story_routes import public_story_bp
from routes.extras_routes import extras_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Init extensions
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    mail.init_app(app)
    allowed_origins = os.getenv("CORS_ORIGINS", "*")
    cors.init_app(app, resources={r"/api/*": {
        "origins": allowed_origins,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": False,
    }})

    # Import models so db.create_all picks them up
    from models.user import User
    from models.story import Story, Comment, Like, SavedStory
    from models.family import Family
    from models.extras import FamilyRelationship, FamilyTreeNode, FamilyEvent, FamilyRecipe, FamilyTask, FamilyBudget, PostInsight, CloseFriend, ScheduledPost, VerifiedBadge, MessageRequest, Storybook
    from models.social import Connection, Post, PostLike, PostComment, PostSave, Conversation, ConversationParticipant, Message, MessageReaction, PublicStory, PublicStoryView, StoryHighlight, StoryHighlightItem

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(family_bp, url_prefix="/api/family")
    app.register_blueprint(story_bp, url_prefix="/api/stories")
    app.register_blueprint(storybook_bp, url_prefix="/api/storybooks")
    app.register_blueprint(ai_bp, url_prefix="/api/ai")
    app.register_blueprint(connection_bp, url_prefix="/api/connections")
    app.register_blueprint(post_bp, url_prefix="/api/posts")
    app.register_blueprint(message_bp, url_prefix="/api/messages")
    app.register_blueprint(public_story_bp, url_prefix="/api/pstories")
    app.register_blueprint(extras_bp, url_prefix="/api/extras")

    with app.app_context():
        try:
            db.create_all()
            _run_migrations()
        except Exception as e:
            print(f"Startup DB error (non-fatal): {e}")

    @app.errorhandler(Exception)
    def handle_exception(e):
        import traceback
        print(traceback.format_exc())
        return {"error": str(e)}, 500

    return app


def _run_migrations():
    """Add any missing columns to existing tables without dropping data."""
    from sqlalchemy import text
    from extensions import db

    migrations = [
        "ALTER TABLE stories ADD COLUMN IF NOT EXISTS music_url VARCHAR(300)",
        "ALTER TABLE stories ADD COLUMN IF NOT EXISTS music_name VARCHAR(200)",
        "ALTER TABLE stories ADD COLUMN IF NOT EXISTS location VARCHAR(200)",
        "ALTER TABLE stories ADD COLUMN IF NOT EXISTS transcript TEXT",
        "ALTER TABLE stories ADD COLUMN IF NOT EXISTS enhanced_text TEXT",
        "ALTER TABLE stories ADD COLUMN IF NOT EXISTS summary TEXT",
        "ALTER TABLE stories ADD COLUMN IF NOT EXISTS tags VARCHAR(300)",
        "ALTER TABLE stories ADD COLUMN IF NOT EXISTS ai_processed BOOLEAN DEFAULT FALSE",
        "ALTER TABLE stories ADD COLUMN IF NOT EXISTS story_date DATE",
        "ALTER TABLE stories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
        "ALTER TABLE stories ADD COLUMN IF NOT EXISTS repost_count INTEGER DEFAULT 0",
    ]

    try:
        with db.engine.connect() as conn:
            for sql in migrations:
                try:
                    conn.execute(text(sql))
                except Exception as e:
                    print(f"Migration skipped ({sql[:50]}...): {e}")
            conn.commit()
    except Exception as e:
        print(f"Migration failed, skipping: {e}")


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
