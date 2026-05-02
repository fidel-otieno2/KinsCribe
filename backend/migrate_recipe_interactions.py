import os
import psycopg2
from urllib.parse import urlparse

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("No DATABASE_URL found")
    exit(0)

# Parse the database URL
result = urlparse(DATABASE_URL)
username = result.username
password = result.password
database = result.path[1:]
hostname = result.hostname
port = result.port

conn = psycopg2.connect(
    database=database,
    user=username,
    password=password,
    host=hostname,
    port=port
)

cur = conn.cursor()

# Create recipe_reactions table
cur.execute("""
CREATE TABLE IF NOT EXISTS recipe_reactions (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER NOT NULL REFERENCES family_recipes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) DEFAULT 'like',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(recipe_id, user_id)
);
""")

# Create recipe_comments table
cur.execute("""
CREATE TABLE IF NOT EXISTS recipe_comments (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER NOT NULL REFERENCES family_recipes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")

# Create indexes
cur.execute("CREATE INDEX IF NOT EXISTS idx_recipe_reactions_recipe ON recipe_reactions(recipe_id);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_recipe_reactions_user ON recipe_reactions(user_id);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_recipe_comments_recipe ON recipe_comments(recipe_id);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_recipe_comments_user ON recipe_comments(user_id);")

conn.commit()
cur.close()
conn.close()

print("✅ Recipe reactions and comments tables created successfully")
