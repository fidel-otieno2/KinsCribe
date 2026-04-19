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
        import threading
        threading.Thread(target=_safe_migrate, daemon=True).start()

    @app.errorhandler(Exception)
    def handle_exception(e):
        import traceback
        print(traceback.format_exc())
        return {"error": str(e)}, 500

    return app


def _safe_migrate():
    """Run db.create_all + migrations in background so startup is instant."""
    import time
    time.sleep(2)  # Let the app fully start first
    try:
        with app.app_context():
            db.create_all()
            print("db.create_all completed")
    except Exception as e:
        print(f"db.create_all error: {e}")
    try:
        with app.app_context():
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
        # Stories table
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='music_url') THEN ALTER TABLE stories ADD COLUMN music_url VARCHAR(300); END IF; END $$",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='music_name') THEN ALTER TABLE stories ADD COLUMN music_name VARCHAR(200); END IF; END $$",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='location') THEN ALTER TABLE stories ADD COLUMN location VARCHAR(200); END IF; END $$",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='transcript') THEN ALTER TABLE stories ADD COLUMN transcript TEXT; END IF; END $$",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='enhanced_text') THEN ALTER TABLE stories ADD COLUMN enhanced_text TEXT; END IF; END $$",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='summary') THEN ALTER TABLE stories ADD COLUMN summary TEXT; END IF; END $$",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='tags') THEN ALTER TABLE stories ADD COLUMN tags VARCHAR(300); END IF; END $$",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='ai_processed') THEN ALTER TABLE stories ADD COLUMN ai_processed BOOLEAN DEFAULT FALSE; END IF; END $$",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='story_date') THEN ALTER TABLE stories ADD COLUMN story_date DATE; END IF; END $$",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='updated_at') THEN ALTER TABLE stories ADD COLUMN updated_at TIMESTAMP DEFAULT NOW(); END IF; END $$",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stories' AND column_name='repost_count') THEN ALTER TABLE stories ADD COLUMN repost_count INTEGER DEFAULT 0; END IF; END $$",
        # Users table
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='website') THEN ALTER TABLE users ADD COLUMN website VARCHAR(200); END IF; END $$",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='interests') THEN ALTER TABLE users ADD COLUMN interests VARCHAR(500); END IF; END $$",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_private') THEN ALTER TABLE users ADD COLUMN is_private BOOLEAN DEFAULT FALSE; END IF; END $$",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone') THEN ALTER TABLE users ADD COLUMN phone VARCHAR(20); END IF; END $$",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='apple_id') THEN ALTER TABLE users ADD COLUMN apple_id VARCHAR(200); END IF; END $$",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='two_factor_enabled') THEN ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE; END IF; END $$",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='two_factor_secret') THEN ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(32); END IF; END $$",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='backup_codes') THEN ALTER TABLE users ADD COLUMN backup_codes TEXT; END IF; END $$",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='account_type') THEN ALTER TABLE users ADD COLUMN account_type VARCHAR(20) DEFAULT 'personal'; END IF; END $$",
        # Conversations table
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='name') THEN ALTER TABLE conversations ADD COLUMN name VARCHAR(100); END IF; END $$",
        # Indexes
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id)",
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
