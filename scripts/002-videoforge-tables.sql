-- VideoForge Extended Schema Migration
-- Adds new tables for unified video creation SaaS

-- Scripts table (AI-generated scripts)
CREATE TABLE IF NOT EXISTS public.scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('long-form', 'short', 'true-crime', 'tutorial')),
  script_text TEXT,
  script_json JSONB, -- Structured scenes with timing and notes
  duration_seconds INTEGER,
  ai_model TEXT DEFAULT 'claude-3-5-sonnet',
  trending_angle TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT scripts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Videos table (Generated videos)
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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
  youtube_upload_status TEXT,
  
  CONSTRAINT videos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT videos_script_id_fkey FOREIGN KEY (script_id) REFERENCES public.scripts(id) ON DELETE CASCADE
);

-- Voiceovers table (TTS audio)
CREATE TABLE IF NOT EXISTS public.voiceovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  audio_url TEXT NOT NULL,
  voice_provider TEXT NOT NULL CHECK (voice_provider IN ('elevenlabs', 'google-cloud', 'openai')),
  voice_id TEXT,
  duration_seconds DECIMAL(10,2),
  cost_usd DECIMAL(10,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT voiceovers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT voiceovers_script_id_fkey FOREIGN KEY (script_id) REFERENCES public.scripts(id) ON DELETE CASCADE
);

-- B-roll clips table (Stock footage used in videos)
CREATE TABLE IF NOT EXISTS public.clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('pexels', 'unsplash', 'custom')),
  source_id TEXT,
  source_url TEXT,
  title TEXT,
  duration_seconds DECIMAL(10,2),
  position_in_video INTEGER, -- Order in video
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT clips_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT clips_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE
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
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  scripts_generated INT DEFAULT 0,
  videos_generated INT DEFAULT 0,
  voiceover_minutes_used DECIMAL(10,2) DEFAULT 0,
  total_spent_usd DECIMAL(10,2) DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT user_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Pricing records table (Track per-video costs for transparency)
CREATE TABLE IF NOT EXISTS public.video_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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
  paid_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT video_pricing_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT video_pricing_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE
);

-- API audit log for monitoring and debugging
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
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
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voiceovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_pricing ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scripts
CREATE POLICY "Users can view their own scripts" ON public.scripts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create scripts" ON public.scripts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scripts" ON public.scripts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scripts" ON public.scripts
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for videos
CREATE POLICY "Users can view their own videos" ON public.videos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create videos" ON public.videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own videos" ON public.videos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own videos" ON public.videos
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for voiceovers
CREATE POLICY "Users can view their own voiceovers" ON public.voiceovers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create voiceovers" ON public.voiceovers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voiceovers" ON public.voiceovers
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for clips
CREATE POLICY "Users can view their own clips" ON public.clips
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create clips" ON public.clips
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_usage
CREATE POLICY "Users can view their own usage" ON public.user_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage" ON public.user_usage
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for video_pricing
CREATE POLICY "Users can view their own pricing records" ON public.video_pricing
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create pricing records" ON public.video_pricing
  FOR INSERT WITH CHECK (auth.uid() = user_id);
