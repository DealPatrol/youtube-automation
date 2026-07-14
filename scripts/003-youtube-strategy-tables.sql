-- VideoForge YouTube Strategy Studio Tables
-- Extend Supabase schema to support channel planning and strategy

-- Channel Strategy table (stores user's YouTube channel strategy/niche)
CREATE TABLE channel_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE TABLE content_roadmaps (
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
CREATE TABLE content_pillars (
  id UUID PRIMARYKey DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES channel_strategies(id) ON DELETE CASCADE,
  pillar_name TEXT NOT NULL,
  pillar_description TEXT,
  percentage INT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Monetization Roadmap table
CREATE TABLE monetization_plans (
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
CREATE TABLE automation_sops (
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
CREATE TABLE strategy_outputs (
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
CREATE TABLE script_strategy_context (
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
ALTER TABLE channel_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE monetization_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_strategy_context ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only see their own strategies
CREATE POLICY "Users can view their own strategies"
  ON channel_strategies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own strategies"
  ON channel_strategies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own strategies"
  ON channel_strategies FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Cascade policies for related tables
CREATE POLICY "View related strategy content"
  ON content_roadmaps FOR SELECT
  USING (strategy_id IN (SELECT id FROM channel_strategies WHERE user_id = auth.uid()));

CREATE POLICY "View strategy outputs"
  ON strategy_outputs FOR SELECT
  USING (strategy_id IN (SELECT id FROM channel_strategies WHERE user_id = auth.uid()));

CREATE POLICY "View script strategy context"
  ON script_strategy_context FOR SELECT
  USING (script_id IN (SELECT id FROM scripts WHERE user_id = auth.uid()));
