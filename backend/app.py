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
from routes.notification_routes import notification_bp
from routes.search_routes import search_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

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
    app.register_blueprint(notification_bp, url_prefix="/api/notifications")
    app.register_blueprint(search_bp, url_prefix="/api/search")

    with app.app_context():
        _safe_migrate()

    @app.errorhandler(Exception)
    def handle_exception(e):
        import traceback
        print(traceback.format_exc())
        return {"error": str(e)}, 500

    return app


def _safe_migrate():
    """Run db.create_all + migrations synchronously before app starts."""
    try:
        db.create_all()
        print("db.create_all completed")
    except Exception as e:
        print(f"db.create_all error: {e}")
    try:
        _run_migrations()
        print("Migrations completed")
    except Exception as e:
        print(f"Migration error: {e}")


def _run_migrations():
    """Add any missing columns to existing tables without dropping data."""
    from sqlalchemy import text
    from extensions import db

    # PostgreSQL migrations - check if column exists before adding
    migrations = [
        # Drop unique constraint on phone - same phone can be on multiple accounts
        "DROP INDEX IF EXISTS idx_users_phone",
        "ALTER TABLE users ALTER COLUMN verification_token TYPE VARCHAR(500)",
        # Stories table
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
        # Users table
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS website VARCHAR(200)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS interests VARCHAR(500)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_id VARCHAR(200)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(32)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) DEFAULT 'personal'",
        # Conversations table migrations
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name VARCHAR(100)",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS family_id INTEGER",
        # Messages table migrations
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS disappears_at TIMESTAMP",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type VARCHAR(20)",
        # Posts table migrations
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_urls TEXT",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS location VARCHAR(200)",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS hashtags VARCHAR(500)",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS privacy VARCHAR(20) DEFAULT 'public'",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS alt_text TEXT",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_collab BOOLEAN DEFAULT FALSE",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS collab_users TEXT",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0",
        # Post comments table migrations
        "ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_id INTEGER",
        "ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0",
        # Post saves table migrations
        "ALTER TABLE post_saves ADD COLUMN IF NOT EXISTS collection VARCHAR(100) DEFAULT 'Saved'",
        "ALTER TABLE post_saves ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
        # Public stories table migrations
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS music_url VARCHAR(300)",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS music_name VARCHAR(200)",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS sticker_data TEXT",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS privacy VARCHAR(20) DEFAULT 'public'",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS bg_color VARCHAR(20)",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS text_content TEXT",
        # Indexes
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id)",
    ]

    try:
        with db.engine.connect() as conn:
            for sql in migrations:
                try:
                    conn.execute(text(sql))
                    conn.commit()
                    print(f"Migration executed: {sql[:50]}...")
                except Exception as e:
                    print(f"Migration skipped ({sql[:50]}...): {e}")
    except Exception as e:
        print(f"Migration failed, skipping: {e}")


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
