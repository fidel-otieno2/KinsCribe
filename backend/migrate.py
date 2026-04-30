#!/usr/bin/env python3
"""
Database Migration Script for KinsCribe
Adds missing columns to existing PostgreSQL database on Render
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.exc import ProgrammingError

def run_migrations():
    """Run all pending migrations"""
    
    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not found in environment variables")
        return False
    
    # Fix postgres:// to postgresql:// for SQLAlchemy 1.4+
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    
    print(f"🔗 Connecting to database...")
    
    try:
        engine = create_engine(database_url)
        
        # List of migrations to run
        migrations = [
            # Users table migrations
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_id VARCHAR(200)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(32)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) DEFAULT 'personal'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS website VARCHAR(200)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS interests VARCHAR(500)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE",
            
            # Create unique indexes
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id) WHERE apple_id IS NOT NULL",
            
            # Stories table migrations
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
            "ALTER TABLE stories ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE",
            "ALTER TABLE stories ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT FALSE",
            "ALTER TABLE stories ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP",
            "ALTER TABLE stories ADD COLUMN IF NOT EXISTS highlighted_at TIMESTAMP",
            
            # Conversations table migrations
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name VARCHAR(100)",
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned_message_id INTEGER",

            # Posts table music columns
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS music_title VARCHAR(200)",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS music_artist VARCHAR(200)",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS music_artwork VARCHAR(300)",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS music_stream_url VARCHAR(500)",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS music_start_time INTEGER DEFAULT 0",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS alt_text TEXT",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_collab BOOLEAN DEFAULT FALSE",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS collab_users TEXT",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT FALSE",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_sponsored BOOLEAN DEFAULT FALSE",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS sponsor_label VARCHAR(100)",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_urls TEXT",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS hashtags VARCHAR(500)",

            # Post collaborators table
            """
            CREATE TABLE IF NOT EXISTS post_collaborators (
                id SERIAL PRIMARY KEY,
                post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role VARCHAR(20) DEFAULT 'creator',
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(post_id, user_id)
            )
            """,

            # Public stories — location + music metadata
            "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS location VARCHAR(200)",
            "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS music_artist VARCHAR(200)",
            "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS music_artwork VARCHAR(300)",

            # Notification read receipts — persists which notifications a user has read
            """
            CREATE TABLE IF NOT EXISTS notification_read_receipts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                notification_key VARCHAR(100) NOT NULL,
                read_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, notification_key)
            )
            """,
            "CREATE INDEX IF NOT EXISTS idx_notif_read_user ON notification_read_receipts(user_id)",

            # Family invites — user-to-user family invitations
            """
            CREATE TABLE IF NOT EXISTS family_invites (
                id SERIAL PRIMARY KEY,
                family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
                invited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                invited_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token VARCHAR(64) UNIQUE NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW()
            )
            """,
            "CREATE INDEX IF NOT EXISTS idx_family_invites_user ON family_invites(invited_user_id)",
            "CREATE INDEX IF NOT EXISTS idx_family_invites_family ON family_invites(family_id)",

            # Public stories — sticker data for mentions
            "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS sticker_data TEXT",
            "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS music_url VARCHAR(300)",
            "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS is_moment BOOLEAN DEFAULT FALSE",
            "ALTER TABLE public_stories ADD COLUMN IF NOT EXISTS family_id INTEGER REFERENCES families(id) ON DELETE SET NULL",
            "CREATE INDEX IF NOT EXISTS idx_public_stories_family ON public_stories(family_id)",
        ]
        
        print(f"🚀 Running {len(migrations)} migrations...")
        
        with engine.connect() as conn:
            success_count = 0
            for i, migration in enumerate(migrations, 1):
                try:
                    conn.execute(text(migration))
                    conn.commit()
                    success_count += 1
                    print(f"✅ Migration {i}/{len(migrations)}: {migration[:50]}...")
                except ProgrammingError as e:
                    if "already exists" in str(e) or "duplicate" in str(e).lower():
                        print(f"⏭️  Migration {i}/{len(migrations)}: Already exists - {migration[:50]}...")
                        success_count += 1
                    else:
                        print(f"❌ Migration {i}/{len(migrations)} failed: {e}")
                except Exception as e:
                    print(f"❌ Migration {i}/{len(migrations)} failed: {e}")
        
        print(f"\n🎉 Migration complete! {success_count}/{len(migrations)} migrations successful")
        return success_count == len(migrations)
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

if __name__ == "__main__":
    print("🔧 KinsCribe Database Migration")
    print("=" * 40)
    
    success = run_migrations()
    
    if success:
        print("\n✅ All migrations completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Some migrations failed. Check the logs above.")
        sys.exit(1)