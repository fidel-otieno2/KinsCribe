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
            
            # Conversations table migrations
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name VARCHAR(100)",
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