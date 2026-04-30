-- Add missing columns to stories table
-- Run this in Render PostgreSQL console if migration fails

ALTER TABLE stories ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT FALSE;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS highlighted_at TIMESTAMP;

-- Verify columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'stories'
AND column_name IN ('is_archived', 'is_highlighted', 'archived_at', 'highlighted_at')
ORDER BY column_name;
