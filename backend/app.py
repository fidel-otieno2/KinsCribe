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
from routes.subscription_routes import subscription_bp
from routes.call_routes import call_bp


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
    app.register_blueprint(subscription_bp, url_prefix="/api/subscription")
    app.register_blueprint(call_bp, url_prefix="/api/calls")

    @app.route("/")
    def health_check():
        return {"status": "ok"}, 200

    @app.route("/health")
    def health_detailed():
        import time
        health = {"status": "ok", "timestamp": time.time()}
        try:
            start = time.time()
            db.session.execute(db.text("SELECT 1"))
            health["database"] = "connected"
            health["db_ping_ms"] = round((time.time() - start) * 1000, 2)
        except Exception as e:
            health["database"] = f"error: {str(e)}"
            health["status"] = "degraded"
        return health, 200

    with app.app_context():
        _safe_migrate()

    @app.errorhandler(Exception)
    def handle_exception(e):
        import traceback
        print(traceback.format_exc())
        return {"error": str(e)}, 500

    return app


def _safe_migrate():
    """Run db.create_all() + migrations synchronously before app starts."""
    try:
        db.create_all()  # creates any NEW tables (blocks, etc.) without dropping existing ones
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
        "ALTER TABLE stories ADD COLUMN IF NOT EXISTS is_announcement BOOLEAN DEFAULT FALSE",
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
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned_message_id INTEGER",
        # Messages table migrations
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS disappears_at TIMESTAMP",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from_id INTEGER",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS mentions TEXT",
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
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_sponsored BOOLEAN DEFAULT FALSE",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS sponsor_label VARCHAR(100)",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS music_title VARCHAR(200)",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS music_artist VARCHAR(200)",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS music_artwork VARCHAR(300)",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS music_stream_url VARCHAR(500)",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS music_start_time INTEGER DEFAULT 0",
        # Post comments table migrations
        "ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_id INTEGER",
        "ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0",
        # Post saves table migrations
        "ALTER TABLE post_saves ADD COLUMN IF NOT EXISTS collection VARCHAR(100) DEFAULT 'Saved'",
        "ALTER TABLE post_saves ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
        # Connections table migrations
        "ALTER TABLE connections ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'accepted'",
        "UPDATE connections SET status = 'accepted' WHERE status IS NULL",
        # Users privacy fields
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS show_activity BOOLEAN DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_dms BOOLEAN DEFAULT TRUE",
        # Blocks table
        """
        CREATE TABLE IF NOT EXISTS blocks (
            id SERIAL PRIMARY KEY,
            blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(blocker_id, blocked_id)
        )
        """,
        # User sessions table
        """
        CREATE TABLE IF NOT EXISTS user_sessions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash VARCHAR(64),
            device_name VARCHAR(150),
            platform VARCHAR(20),
            ip_address VARCHAR(45),
            location VARCHAR(200),
            last_active TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW(),
            is_revoked BOOLEAN DEFAULT FALSE
        )
        """,
        # Public stories table migrations
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS music_url VARCHAR(300)",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS music_name VARCHAR(200)",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS sticker_data TEXT",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS privacy VARCHAR(20) DEFAULT 'public'",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS bg_color VARCHAR(20)",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS text_content TEXT",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS is_moment BOOLEAN DEFAULT FALSE",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS family_id INTEGER",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS location VARCHAR(200)",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS music_artist VARCHAR(200)",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS music_artwork VARCHAR(300)",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS location VARCHAR(200)",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS music_artist VARCHAR(200)",
        "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS music_artwork VARCHAR(300)",
        # Indexes
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id)",
        "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
        "CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)",
        # Subscription fields
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_plan VARCHAR(20)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMP",
        # Call system
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(30) DEFAULT 'text'",
        """
        CREATE TABLE IF NOT EXISTS active_calls (
            id SERIAL PRIMARY KEY,
            channel VARCHAR(50) UNIQUE NOT NULL,
            caller_id INTEGER NOT NULL,
            callee_id INTEGER,
            call_type VARCHAR(20) DEFAULT 'voice',
            conversation_id INTEGER,
            state VARCHAR(20) DEFAULT 'ringing',
            created_at TIMESTAMP DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS incoming_call_queue (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            payload TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
        """,
        # Multi-family membership
        """
        CREATE TABLE IF NOT EXISTS family_members (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
            role VARCHAR(20) DEFAULT 'member',
            joined_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(user_id, family_id)
        )
        """,
        """
        INSERT INTO family_members (user_id, family_id, role, joined_at)
        SELECT id, family_id, role, created_at
        FROM users
        WHERE family_id IS NOT NULL
        ON CONFLICT (user_id, family_id) DO NOTHING
        """,
        # Families table — extended profile fields
        "ALTER TABLE families ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(300)",
        "ALTER TABLE families ADD COLUMN IF NOT EXISTS motto VARCHAR(200)",
        "ALTER TABLE families ADD COLUMN IF NOT EXISTS username VARCHAR(50)",
        "ALTER TABLE families ADD COLUMN IF NOT EXISTS theme_color VARCHAR(20) DEFAULT '#7c3aed'",
        "ALTER TABLE families ADD COLUMN IF NOT EXISTS privacy VARCHAR(20) DEFAULT 'private'",
        "ALTER TABLE families ADD COLUMN IF NOT EXISTS permissions TEXT",
        # Stories — family_name denorm not needed (join), but ensure family_id index
        "CREATE INDEX IF NOT EXISTS idx_stories_family_id ON stories(family_id)",
        "CREATE INDEX IF NOT EXISTS idx_stories_user_family ON stories(user_id, family_id)",
        # Call logs table
        """
        CREATE TABLE IF NOT EXISTS call_logs (
            id SERIAL PRIMARY KEY,
            channel VARCHAR(50),
            caller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            callee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            call_type VARCHAR(20) DEFAULT 'voice',
            conversation_id INTEGER,
            status VARCHAR(20) DEFAULT 'completed',
            duration_secs INTEGER DEFAULT 0,
            seen BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW()
        )
        """,
        # Push tokens table
        """
        CREATE TABLE IF NOT EXISTS user_push_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            push_token VARCHAR(200) NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(user_id)
        )
        """,
        # Call privacy settings
        """
        CREATE TABLE IF NOT EXISTS user_call_settings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            call_privacy VARCHAR(20) DEFAULT 'connections',
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(user_id)
        )
        """,
        # In-call messages table
        """
        CREATE TABLE IF NOT EXISTS call_messages (
            id SERIAL PRIMARY KEY,
            channel VARCHAR(50) NOT NULL,
            sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            text TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
        """,
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
