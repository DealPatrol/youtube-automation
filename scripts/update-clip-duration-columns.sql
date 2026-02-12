-- Update projects table to have separate YouTube and TikTok clip durations
-- Rename existing column and add new column

-- Rename old column to youtube_clip_duration
ALTER TABLE projects 
  RENAME COLUMN clip_duration_seconds TO youtube_clip_duration;

-- Add TikTok clip duration column
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS tiktok_clip_duration INTEGER DEFAULT 15;

-- Update youtube_clip_duration to allow 0 (auto mode)
ALTER TABLE projects 
  ALTER COLUMN youtube_clip_duration SET DEFAULT 0;

-- Add comments for clarity
COMMENT ON COLUMN projects.youtube_clip_duration IS 'Clip duration for YouTube videos in seconds. 0 = auto length based on content';
COMMENT ON COLUMN projects.tiktok_clip_duration IS 'Clip duration for TikTok videos in seconds. 0 = auto length based on content. Optimal: 15-90 seconds';
