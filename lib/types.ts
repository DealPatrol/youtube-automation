// VideoForge Database Types
// Automatically generated from Supabase schema
import type { Json } from './db/database.types';

export type VideoFormat = 'long-form' | 'short' | 'true-crime' | 'tutorial';
export type ScriptStatus = 'draft' | 'generating' | 'completed' | 'failed';
export type VoiceProvider = 'elevenlabs' | 'google-cloud' | 'openai';
export type ClipSource = 'pexels' | 'unsplash' | 'custom';
export type Platform = 'youtube' | 'tiktok' | 'twitter';
export type CompetitionLevel = 'low' | 'medium' | 'high';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ScriptJsonScene {
  [key: string]: Json | undefined;
  number?: number;
  title: string;
  duration_seconds: number;
  voiceover?: string;
  voiceover_text?: string;
  broll_suggestions?: string[];
  broll_notes?: string;
  on_screen_text?: string[];
  music_style?: string;
  mood?: string;
  tips?: string[];
  common_mistakes?: string[];
  sound_design?: string;
}

export interface ScriptJson {
  [key: string]: Json | undefined;
  title?: string;
  hook?: string;
  intro_hook?: string;
  intro?: string;
  scenes?: ScriptJsonScene[];
  total_duration?: number;
  total_duration_seconds?: number;
  estimated_word_count?: number;
  trending_angle?: string;
  seo_keywords?: string[];
  cta?: string;
  conclusion?: string;
  requirements?: string[];
  steps?: ScriptJsonScene[];
  dramatization_level?: string;
  difficulty_level?: string;
  resources_mentioned?: string[];
  trending_elements?: string[];
}

// Script table
export interface Script {
  id: string;
  user_id: string;
  topic: string;
  format: VideoFormat;
  script_text: string | null;
  script_json: ScriptJson | null;
  duration_seconds: number | null;
  ai_model: string;
  trending_angle: string | null;
  created_at: string;
  updated_at: string;
}

// Video table
export interface Video {
  id: string;
  user_id: string;
  script_id: string;
  status: ScriptStatus;
  video_url: string | null;
  format: VideoFormat | null;
  duration_seconds: number | null;
  resolution: string;
  file_size_mb: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  uploaded_to_youtube: boolean;
  youtube_url: string | null;
  youtube_video_id: string | null;
  youtube_upload_status: string | null;
}

// Voiceover table
export interface Voiceover {
  id: string;
  user_id: string;
  script_id: string;
  video_id: string | null;
  audio_url: string;
  voice_provider: VoiceProvider;
  voice_id: string | null;
  duration_seconds: number | null;
  cost_usd: number | null;
  created_at: string;
}

// Clip table
export interface Clip {
  id: string;
  user_id: string;
  video_id: string;
  source: ClipSource;
  source_id: string | null;
  source_url: string | null;
  title: string | null;
  duration_seconds: number | null;
  position_in_video: number | null;
  created_at: string;
}

// Trending topic table
export interface TrendingTopic {
  id: string;
  platform: Platform;
  topic: string;
  category: string | null;
  search_volume: number | null;
  growth_percentage: number | null;
  competition_level: CompetitionLevel | null;
  suggested_format: VideoFormat | null;
  fetched_at: string;
  expires_at: string | null;
}

// User usage table
export interface UserUsage {
  id: string;
  user_id: string;
  scripts_generated: number;
  videos_generated: number;
  voiceover_minutes_used: number;
  total_spent_usd: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

// Video pricing table
export interface VideoPricing {
  id: string;
  user_id: string;
  video_id: string;
  script_cost_usd: number | null;
  voiceover_cost_usd: number | null;
  assembly_cost_usd: number | null;
  total_base_cost_usd: number | null;
  markup_percentage: number | null;
  final_price_usd: number | null;
  payment_status: PaymentStatus;
  stripe_payment_intent_id: string | null;
  created_at: string;
  paid_at: string | null;
}

// Audit log table
export interface AuditLog {
  id: string;
  user_id: string | null;
  endpoint: string;
  method: HttpMethod;
  status_code: number | null;
  response_time_ms: number | null;
  error_message: string | null;
  created_at: string;
}

// API Request/Response types
export interface CreateScriptRequest {
  topic: string;
  format: VideoFormat;
  duration_target?: number;
  tone?: string;
  trending_angle?: string;
}

export interface ScriptGenerationResponse {
  success: boolean;
  script?: Script;
  error?: string;
}

export interface VideoAssemblyRequest {
  script_id: string;
  clip_ids: string[];
  music_url?: string;
  voiceover_id: string;
}

export interface VideoAssemblyResponse {
  success: boolean;
  video?: Video;
  job_id?: string; // For async jobs
  error?: string;
}

export interface YouTubeUploadRequest {
  video_id: string;
  title: string;
  description: string;
  tags: string[];
  playlist_id?: string;
}

export interface YouTubeUploadResponse {
  success: boolean;
  youtube_url?: string;
  youtube_video_id?: string;
  error?: string;
}

export interface TrendingTopicsResponse {
  success: boolean;
  topics: TrendingTopic[];
  fetched_at: string;
  error?: string;
}

// Utility types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
