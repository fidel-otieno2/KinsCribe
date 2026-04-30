#!/usr/bin/env python3
"""Quick fix: Add missing columns to stories table"""
import os
import sys

# Get DATABASE_URL from environment
database_url = os.getenv('DATABASE_URL')
if not database_url:
    print("❌ DATABASE_URL not set")
    sys.exit(1)

# Fix postgres:// to postgresql://
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

print(f"🔗 Connecting to database...")

try:
    from sqlalchemy import create_engine, text
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        print("✅ Connected!")
        print("🔧 Adding missing columns...")
        
        conn.execute(text("ALTER TABLE stories ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE"))
        conn.commit()
        print("✅ Added is_archived")
        
        conn.execute(text("ALTER TABLE stories ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT FALSE"))
        conn.commit()
        print("✅ Added is_highlighted")
        
        conn.execute(text("ALTER TABLE stories ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP"))
        conn.commit()
        print("✅ Added archived_at")
        
        conn.execute(text("ALTER TABLE stories ADD COLUMN IF NOT EXISTS highlighted_at TIMESTAMP"))
        conn.commit()
        print("✅ Added highlighted_at")
        
        print("\n🎉 All columns added successfully!")
        
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
