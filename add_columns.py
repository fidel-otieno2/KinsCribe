#!/usr/bin/env python3
"""Add missing columns to PostgreSQL database on Render"""

# PASTE YOUR RENDER POSTGRESQL URL HERE:
# Get it from: Render Dashboard → Your PostgreSQL Database → External Database URL
DATABASE_URL = "postgresql://kinscribe_db_user:yIFjOasz9wrqe8t8ZGbBB6jjM0EpeIiS@dpg-d7c1c058nd3s73fj3m4g-a.oregon-postgres.render.com/kinscribe_db"

# If you already have it in environment, uncomment this:
# import os
# DATABASE_URL = os.getenv("DATABASE_URL")

import psycopg2

# Fix URL format
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

print("🔗 Connecting to PostgreSQL...")

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("✅ Connected!")
    print("🔧 Adding missing columns to stories table...")
    
    # Add columns
    cur.execute("ALTER TABLE stories ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE")
    print("✅ Added is_archived")
    
    cur.execute("ALTER TABLE stories ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT FALSE")
    print("✅ Added is_highlighted")
    
    cur.execute("ALTER TABLE stories ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP")
    print("✅ Added archived_at")
    
    cur.execute("ALTER TABLE stories ADD COLUMN IF NOT EXISTS highlighted_at TIMESTAMP")
    print("✅ Added highlighted_at")
    
    conn.commit()
    
    # Verify
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'stories' 
        AND column_name IN ('is_archived', 'is_highlighted', 'archived_at', 'highlighted_at')
    """)
    
    columns = [row[0] for row in cur.fetchall()]
    print(f"\n✅ Verified columns exist: {columns}")
    
    cur.close()
    conn.close()
    
    print("\n🎉 SUCCESS! All columns added. Notifications will now work!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    print("\nGet your DATABASE_URL from:")
    print("Render Dashboard → PostgreSQL Database → External Database URL")
