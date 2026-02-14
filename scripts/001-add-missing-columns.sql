-- Add missing columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS youtube_clip_duration integer DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tiktok_clip_duration integer DEFAULT 15;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS scheduled_for timestamp with time zone;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS views integer DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS youtube_video_id text;

-- Add missing columns to results table
ALTER TABLE results ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE results ADD COLUMN IF NOT EXISTS youtube_refresh_token text;
ALTER TABLE results ADD COLUMN IF NOT EXISTS youtube_access_token text;
ALTER TABLE results ADD COLUMN IF NOT EXISTS youtube_video_id text;
ALTER TABLE results ADD COLUMN IF NOT EXISTS youtube_url text;
ALTER TABLE results ADD COLUMN IF NOT EXISTS youtube_status text;

-- Create youtube_tokens table for storing OAuth tokens per user (not per result)
CREATE TABLE IF NOT EXISTS youtube_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  refresh_token text NOT NULL,
  access_token text,
  channel_name text,
  channel_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create schedules table for video auto-posting
CREATE TABLE IF NOT EXISTS schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  project_id uuid REFERENCES projects(id),
  result_id uuid REFERENCES results(id),
  scheduled_for timestamp with time zone NOT NULL,
  status text DEFAULT 'pending',
  youtube_token_id uuid REFERENCES youtube_tokens(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
