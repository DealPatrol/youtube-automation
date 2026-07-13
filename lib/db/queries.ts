'use server';

import { getSupabaseServerClient } from './supabase-client';
import type {
  Script,
  Video,
  Voiceover,
  TrendingTopic,
  UserUsage,
  VideoPricing,
  CreateScriptRequest,
} from '../types';

// ===== SCRIPTS =====

export async function createScript(
  userId: string,
  request: CreateScriptRequest
): Promise<Script> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('scripts')
    .insert({
      user_id: userId,
      topic: request.topic,
      format: request.format,
      duration_seconds: request.duration_target,
      ai_model: 'claude-3-5-sonnet',
      trending_angle: request.trending_angle,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create script: ${error.message}`);
  return data as Script;
}

export async function getScript(scriptId: string, userId: string): Promise<Script | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('scripts')
    .select('*')
    .eq('id', scriptId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch script: ${error.message}`);
  }

  return (data as Script) || null;
}

export async function updateScript(
  scriptId: string,
  userId: string,
  updates: Partial<Script>
): Promise<Script> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('scripts')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scriptId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update script: ${error.message}`);
  return data as Script;
}

export async function listScripts(userId: string, limit = 50): Promise<Script[]> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('scripts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list scripts: ${error.message}`);
  return (data as Script[]) || [];
}

export async function deleteScript(scriptId: string, userId: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from('scripts')
    .delete()
    .eq('id', scriptId)
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to delete script: ${error.message}`);
}

// ===== VIDEOS =====

export async function createVideo(
  userId: string,
  scriptId: string,
  format: string
): Promise<Video> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('videos')
    .insert({
      user_id: userId,
      script_id: scriptId,
      format,
      status: 'draft',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create video: ${error.message}`);
  return data as Video;
}

export async function getVideo(videoId: string, userId: string): Promise<Video | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch video: ${error.message}`);
  }

  return (data as Video) || null;
}

export async function updateVideo(
  videoId: string,
  userId: string,
  updates: Partial<Video>
): Promise<Video> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('videos')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update video: ${error.message}`);
  return data as Video;
}

export async function listVideos(userId: string, limit = 50): Promise<Video[]> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list videos: ${error.message}`);
  return (data as Video[]) || [];
}

// ===== VOICEOVERS =====

export async function createVoiceover(
  userId: string,
  scriptId: string,
  audioUrl: string,
  provider: string,
  durationSeconds?: number,
  costUsd?: number
): Promise<Voiceover> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('voiceovers')
    .insert({
      user_id: userId,
      script_id: scriptId,
      audio_url: audioUrl,
      voice_provider: provider,
      duration_seconds: durationSeconds,
      cost_usd: costUsd,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create voiceover: ${error.message}`);
  return data as Voiceover;
}

export async function getVoiceoverByScriptId(scriptId: string): Promise<Voiceover | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('voiceovers')
    .select('*')
    .eq('script_id', scriptId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch voiceover: ${error.message}`);
  }

  return (data as Voiceover) || null;
}

// ===== TRENDING TOPICS =====

export async function getTrendingTopics(
  platform: string,
  limit = 20
): Promise<TrendingTopic[]> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('trending_topics')
    .select('*')
    .eq('platform', platform)
    .order('fetched_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch trending topics: ${error.message}`);
  return (data as TrendingTopic[]) || [];
}

export async function createTrendingTopic(topic: TrendingTopic): Promise<TrendingTopic> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('trending_topics')
    .insert(topic)
    .select()
    .single();

  if (error) throw new Error(`Failed to create trending topic: ${error.message}`);
  return data as TrendingTopic;
}

// ===== USER USAGE =====

export async function getUserUsage(userId: string): Promise<UserUsage | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('user_usage')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch user usage: ${error.message}`);
  }

  return (data as UserUsage) || null;
}

export async function initializeUserUsage(userId: string): Promise<UserUsage> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('user_usage')
    .insert({
      user_id: userId,
      scripts_generated: 0,
      videos_generated: 0,
      voiceover_minutes_used: 0,
      total_spent_usd: 0,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to initialize user usage: ${error.message}`);
  return data as UserUsage;
}

export async function updateUserUsage(
  userId: string,
  updates: Partial<UserUsage>
): Promise<UserUsage> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('user_usage')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update user usage: ${error.message}`);
  return data as UserUsage;
}

// ===== VIDEO PRICING =====

export async function createVideoPricing(
  userId: string,
  videoId: string,
  pricing: Partial<VideoPricing>
): Promise<VideoPricing> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('video_pricing')
    .insert({
      user_id: userId,
      video_id: videoId,
      ...pricing,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create video pricing: ${error.message}`);
  return data as VideoPricing;
}

export async function getVideoPricing(videoId: string): Promise<VideoPricing | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('video_pricing')
    .select('*')
    .eq('video_id', videoId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch video pricing: ${error.message}`);
  }

  return (data as VideoPricing) || null;
}

export async function updateVideoPricing(
  pricingId: string,
  updates: Partial<VideoPricing>
): Promise<VideoPricing> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('video_pricing')
    .update(updates)
    .eq('id', pricingId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update video pricing: ${error.message}`);
  return data as VideoPricing;
}
