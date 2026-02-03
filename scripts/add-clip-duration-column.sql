-- Add clip_duration_seconds column to projects table if it doesn't exist
ALTER TABLE projects ADD COLUMN IF NOT EXISTS clip_duration_seconds INTEGER DEFAULT 5;

-- Update existing records to have a default value
UPDATE projects SET clip_duration_seconds = 5 WHERE clip_duration_seconds IS NULL;
