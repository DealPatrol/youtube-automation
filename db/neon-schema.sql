-- ContentForge / youtube-automation schema adapted for plain Postgres (Neon).
-- Source: scripts/init-supabase.sql, 001, 002, 003, clip-duration scripts (DealPatrol/youtube-automation@main).
-- Changes: typo "PRIMARYKey" in 003 fixed; trailing commas in 002 fixed; duplicate named FK constraints in 002 removed (they collided with the inline REFERENCES and made 002 fail);
-- Supabase RLS policies + auth.uid() removed (authorization must be enforced in app code by filtering on user_id);
-- auth.users FKs replaced by public.users(id TEXT) which the app upserts from the Neon Auth session;
-- all user_id columns are TEXT (Neon Auth/Better Auth ids); clip-duration rename made idempotent.

CREATE TABLE IF NOT EXISTS public.users (
  id text PRIMARY KEY,
  email text UNIQUE,
  full_name text,
  avatar_url text,
  credits integer DEFAULT 100,
  subscription_tier text DEFAULT 'free',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ===== init-supabase.sql =====
-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'anonymous',
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  description TEXT,
  video_length_minutes INTEGER NOT NULL,
  tone TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create results table
CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL DEFAULT 'anonymous',
  script JSONB,
  scenes JSONB,
  capcut_steps JSONB,
  seo JSONB,
  thumbnail JSONB,
  processing_status TEXT DEFAULT 'processing',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);
CREATE INDEX IF NOT EXISTS results_project_id_idx ON results(project_id);
CREATE INDEX IF NOT EXISTS results_user_id_idx ON results(user_id);

-- ===== 001-add-missing-columns.sql =====
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
ALTER TABLE results ADD COLUMN IF NOT EXISTS thumbnail_url text;

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

-- ===== 002-videoforge-tables.sql =====
-- VideoForge Extended Schema Migration
-- Adds new tables for unified video creation SaaS

-- Scripts table (AI-generated scripts)
CREATE TABLE IF NOT EXISTS public.scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('long-form', 'short', 'true-crime', 'tutorial')),
  script_text TEXT,
  script_json JSONB, -- Structured scenes with timing and notes
  duration_seconds INTEGER,
  ai_model TEXT DEFAULT 'claude-3-5-sonnet',
  trending_angle TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Videos table (Generated videos)
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'completed', 'failed')),
  video_url TEXT,
  format TEXT CHECK (format IN ('long-form', 'short', 'true-crime', 'tutorial')),
  duration_seconds INTEGER,
  resolution TEXT DEFAULT '1080p', -- 1080p for YouTube, 1080x1920 for shorts
  file_size_mb INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- YouTube integration
  uploaded_to_youtube BOOLEAN DEFAULT FALSE,
  youtube_url TEXT,
  youtube_video_id TEXT,
  youtube_upload_status TEXT
);

-- Voiceovers table (TTS audio)
CREATE TABLE IF NOT EXISTS public.voiceovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  audio_url TEXT NOT NULL,
  voice_provider TEXT NOT NULL CHECK (voice_provider IN ('elevenlabs', 'google-cloud', 'openai')),
  voice_id TEXT,
  duration_seconds DECIMAL(10,2),
  cost_usd DECIMAL(10,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- B-roll clips table (Stock footage used in videos)
CREATE TABLE IF NOT EXISTS public.clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('pexels', 'unsplash', 'custom')),
  source_id TEXT,
  source_url TEXT,
  title TEXT,
  duration_seconds DECIMAL(10,2),
  position_in_video INTEGER, -- Order in video
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trending topics table
CREATE TABLE IF NOT EXISTS public.trending_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'twitter')),
  topic TEXT NOT NULL,
  category TEXT,
  search_volume INTEGER,
  growth_percentage DECIMAL(5,2),
  competition_level TEXT CHECK (competition_level IN ('low', 'medium', 'high')),
  suggested_format TEXT CHECK (suggested_format IN ('long-form', 'short', 'true-crime', 'tutorial')),
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE, -- Trends expire, so we know when to re-fetch
  
  CONSTRAINT trending_topics_unique UNIQUE(platform, topic, fetched_at)
);

-- User usage & billing table
CREATE TABLE IF NOT EXISTS public.user_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  scripts_generated INT DEFAULT 0,
  videos_generated INT DEFAULT 0,
  voiceover_minutes_used DECIMAL(10,2) DEFAULT 0,
  total_spent_usd DECIMAL(10,2) DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Pricing records table (Track per-video costs for transparency)
CREATE TABLE IF NOT EXISTS public.video_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  script_cost_usd DECIMAL(10,4),
  voiceover_cost_usd DECIMAL(10,4),
  assembly_cost_usd DECIMAL(10,4),
  total_base_cost_usd DECIMAL(10,4),
  markup_percentage DECIMAL(5,2),
  final_price_usd DECIMAL(10,4),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- API audit log for monitoring and debugging
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  status_code INT,
  response_time_ms INT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scripts_user_id ON public.scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_format ON public.scripts(format);
CREATE INDEX IF NOT EXISTS idx_scripts_created_at ON public.scripts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_script_id ON public.videos(script_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);
CREATE INDEX IF NOT EXISTS idx_voiceovers_user_id ON public.voiceovers(user_id);
CREATE INDEX IF NOT EXISTS idx_voiceovers_script_id ON public.voiceovers(script_id);
CREATE INDEX IF NOT EXISTS idx_voiceovers_video_id ON public.voiceovers(video_id);
CREATE INDEX IF NOT EXISTS idx_clips_video_id ON public.clips(video_id);
CREATE INDEX IF NOT EXISTS idx_trending_topics_platform ON public.trending_topics(platform);
CREATE INDEX IF NOT EXISTS idx_trending_topics_fetched_at ON public.trending_topics(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON public.user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_video_pricing_user_id ON public.video_pricing(user_id);
CREATE INDEX IF NOT EXISTS idx_video_pricing_video_id ON public.video_pricing(video_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable Row Level Security on new tables






-- RLS Policies for scripts








-- RLS Policies for videos








-- RLS Policies for voiceovers






-- RLS Policies for clips




-- RLS Policies for user_usage




-- RLS Policies for video_pricing

-- ===== 003-youtube-strategy-tables.sql =====
-- VideoForge YouTube Strategy Studio Tables
-- Extend Supabase schema to support channel planning and strategy

-- Channel Strategy table (stores user's YouTube channel strategy/niche)
CREATE TABLE IF NOT EXISTS channel_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel_name TEXT,
  channel_tagline TEXT,
  niche TEXT NOT NULL,
  target_audience TEXT,
  posting_frequency TEXT,
  
  -- Niche Finder results
  interests TEXT,
  goals TEXT,
  time_available TEXT,
  monetization_potential INT,
  competition_level TEXT,
  
  -- Strategy completeness tracking
  niche_completed BOOLEAN DEFAULT FALSE,
  roadmap_completed BOOLEAN DEFAULT FALSE,
  monetization_completed BOOLEAN DEFAULT FALSE,
  automation_completed BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Content Roadmap table (stores 90-day content calendar)
CREATE TABLE IF NOT EXISTS content_roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES channel_strategies(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  video_title TEXT NOT NULL,
  video_type TEXT CHECK (video_type IN ('EDU', 'ENT', 'VIR')), -- Educational, Entertaining, Viral
  seo_notes TEXT,
  shorts_description TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Content Pillar table (main content categories)
CREATE TABLE IF NOT EXISTS content_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES channel_strategies(id) ON DELETE CASCADE,
  pillar_name TEXT NOT NULL,
  pillar_description TEXT,
  percentage INT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Monetization Roadmap table
CREATE TABLE IF NOT EXISTS monetization_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES channel_strategies(id) ON DELETE CASCADE,
  revenue_stream TEXT CHECK (revenue_stream IN ('adsense', 'sponsorship', 'digital_product', 'affiliate', 'membership')),
  estimated_revenue DECIMAL(10,2),
  monthly_budget DECIMAL(10,2),
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Automation SOP table (stores automation workflow)
CREATE TABLE IF NOT EXISTS automation_sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES channel_strategies(id) ON DELETE CASCADE,
  workflow_name TEXT NOT NULL,
  daily_hours_required INT,
  tools_used TEXT[], -- Array of tool names
  batch_size INT, -- How many videos batched per session
  monthly_cost DECIMAL(10,2),
  workflow_steps TEXT, -- JSON stored as text
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Strategy Prompts Output table (stores AI-generated responses)
CREATE TABLE IF NOT EXISTS strategy_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES channel_strategies(id) ON DELETE CASCADE,
  prompt_number INT NOT NULL CHECK (prompt_number BETWEEN 1 AND 7),
  prompt_name TEXT NOT NULL,
  user_input JSONB,
  ai_output TEXT NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Link strategies to video scripts for context-aware generation
CREATE TABLE IF NOT EXISTS script_strategy_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  strategy_id UUID NOT NULL REFERENCES channel_strategies(id) ON DELETE CASCADE,
  niche_context TEXT,
  audience_context TEXT,
  content_pillar TEXT,
  monetization_angle TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS (Row Level Security) on all new tables







-- RLS Policies - Users can only see their own strategies






-- Cascade policies for related tables

-- ===== add-clip-duration-column.sql + update-clip-duration-columns.sql (idempotent) =====
-- 001 already creates youtube_clip_duration/tiktok_clip_duration; only rename if the old column exists.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='clip_duration_seconds')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='youtube_clip_duration') THEN
    ALTER TABLE projects RENAME COLUMN clip_duration_seconds TO youtube_clip_duration;
  END IF;
END $$;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS youtube_clip_duration INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tiktok_clip_duration INTEGER DEFAULT 15;
ALTER TABLE projects ALTER COLUMN youtube_clip_duration SET DEFAULT 0;
COMMENT ON COLUMN projects.youtube_clip_duration IS 'Clip duration for YouTube videos in seconds. 0 = auto length based on content';
COMMENT ON COLUMN projects.tiktok_clip_duration IS 'Clip duration for TikTok videos in seconds. 0 = auto. Optimal: 15-90 seconds';
