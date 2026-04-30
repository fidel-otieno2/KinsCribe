#!/usr/bin/env python3
"""Initialize PostgreSQL database with all tables"""
import os
import sys

# Set the DATABASE_URL
os.environ['DATABASE_URL'] = "postgresql://kinscribe_db_user:yIFjOasz9wrqe8t8ZGbBB6jjM0EpeIiS@dpg-d7c1c058nd3s73fj3m4g-a.oregon-postgres.render.com/kinscribe_db"

sys.path.insert(0, '/home/martins/KinsCribe/backend')

from app import app, db

print("🔗 Connecting to PostgreSQL...")
print(f"📍 Database: {app.config['SQLALCHEMY_DATABASE_URI'][:50]}...")

with app.app_context():
    print("🔧 Creating all tables...")
    db.create_all()
    print("✅ All tables created successfully!")
    
    # Verify stories table
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()
    print(f"\n📊 Tables in database: {len(tables)}")
    for table in sorted(tables):
        print(f"  ✓ {table}")
    
    if 'stories' in tables:
        columns = [col['name'] for col in inspector.get_columns('stories')]
        print(f"\n📋 Stories table columns ({len(columns)}):")
        for col in columns:
            print(f"  ✓ {col}")
    
    print("\n🎉 Database initialized! Your app should work now.")
