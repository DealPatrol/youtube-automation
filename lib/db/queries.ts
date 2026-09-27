'use server';

import { sql } from 'drizzle-orm';
import { docs, rows } from './client';
import { updateColumns } from './mutate';
import { ensureAppUser } from './users';
import type {
  Script,
  Video,
  Voiceover,
  TrendingTopic,
  UserUsage,
  VideoPricing,
  CreateScriptRequest,
} from '../types';

const SCRIPT_COLUMNS = new Set([
  'topic',
  'format',
  'script_text',
  'script_json',
  'duration_seconds',
  'ai_model',
  'trending_angle',
]);

const VIDEO_COLUMNS = new Set([
  'status',
  'video_url',
  'format',
  'duration_seconds',
  'resolution',
  'file_size_mb',
  'error_message',
  'uploaded_to_youtube',
  'youtube_url',
  'youtube_video_id',
  'youtube_upload_status',
]);

const USAGE_COLUMNS = new Set([
  'scripts_generated',
  'videos_generated',
  'voiceover_minutes_used',
  'total_spent_usd',
  'stripe_customer_id',
  'stripe_subscription_id',
]);

const PRICING_COLUMNS = new Set([
  'script_cost_usd',
  'voiceover_cost_usd',
  'assembly_cost_usd',
  'total_base_cost_usd',
  'markup_percentage',
  'final_price_usd',
  'payment_status',
  'stripe_payment_intent_id',
  'paid_at',
]);

async function one<T>(query: ReturnType<typeof sql>): Promise<T | null> {
  const [doc] = await docs<T>(query);
  return doc ?? null;
}

export async function createScript(userId: string, request: CreateScriptRequest): Promise<Script> {
  await ensureAppUser({ id: userId });
  const [script] = await docs<Script>(sql`
    INSERT INTO scripts (user_id, topic, format, duration_seconds, ai_model, trending_angle)
    VALUES (
      ${userId},
      ${request.topic},
      ${request.format},
      ${request.duration_target ?? null},
      'claude-3-5-sonnet',
      ${request.trending_angle ?? null}
    )
    RETURNING to_jsonb(scripts.*) AS doc
  `);
  if (!script) throw new Error('Failed to create script');
  return script;
}

export async function getScript(scriptId: string, userId: string): Promise<Script | null> {
  return one<Script>(sql`
    SELECT to_jsonb(scripts.*) AS doc
    FROM scripts
    WHERE id = ${scriptId} AND user_id = ${userId}
  `);
}

export async function updateScript(
  scriptId: string,
  userId: string,
  updates: Partial<Script>
): Promise<Script> {
  const count = await updateColumns(
    'scripts',
    updates,
    SCRIPT_COLUMNS,
    new Set(['script_json']),
    [
      { column: 'id', value: scriptId },
      { column: 'user_id', value: userId },
    ]
  );
  if (count === 0) throw new Error('Failed to update script');
  const script = await getScript(scriptId, userId);
  if (!script) throw new Error('Failed to update script');
  return script;
}

export async function listScripts(userId: string, limit = 50): Promise<Script[]> {
  return docs<Script>(sql`
    SELECT to_jsonb(scripts.*) AS doc
    FROM scripts
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
}

export async function deleteScript(scriptId: string, userId: string): Promise<void> {
  const result = await rows(sql`
    DELETE FROM scripts
    WHERE id = ${scriptId} AND user_id = ${userId}
  `);
  if ((result.length ?? 0) < 0) {
    throw new Error('Failed to delete script');
  }
}

export async function createVideo(userId: string, scriptId: string, format: string): Promise<Video> {
  await ensureAppUser({ id: userId });
  const [video] = await docs<Video>(sql`
    INSERT INTO videos (user_id, script_id, format, status)
    VALUES (${userId}, ${scriptId}, ${format}, 'draft')
    RETURNING to_jsonb(videos.*) AS doc
  `);
  if (!video) throw new Error('Failed to create video');
  return video;
}

export async function getVideo(videoId: string, userId: string): Promise<Video | null> {
  return one<Video>(sql`
    SELECT to_jsonb(videos.*) AS doc
    FROM videos
    WHERE id = ${videoId} AND user_id = ${userId}
  `);
}

export async function updateVideo(
  videoId: string,
  userId: string,
  updates: Partial<Video>
): Promise<Video> {
  const count = await updateColumns(
    'videos',
    updates,
    VIDEO_COLUMNS,
    new Set(),
    [
      { column: 'id', value: videoId },
      { column: 'user_id', value: userId },
    ]
  );
  if (count === 0) throw new Error('Failed to update video');
  const video = await getVideo(videoId, userId);
  if (!video) throw new Error('Failed to update video');
  return video;
}

export async function listVideos(userId: string, limit = 50): Promise<Video[]> {
  return docs<Video>(sql`
    SELECT to_jsonb(videos.*) AS doc
    FROM videos
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
}

export async function createVoiceover(
  userId: string,
  scriptId: string,
  audioUrl: string,
  provider: string,
  durationSeconds?: number,
  costUsd?: number
): Promise<Voiceover> {
  await ensureAppUser({ id: userId });
  const [voiceover] = await docs<Voiceover>(sql`
    INSERT INTO voiceovers (
      user_id, script_id, audio_url, voice_provider, duration_seconds, cost_usd
    ) VALUES (
      ${userId},
      ${scriptId},
      ${audioUrl},
      ${provider},
      ${durationSeconds ?? null},
      ${costUsd ?? null}
    )
    RETURNING to_jsonb(voiceovers.*) AS doc
  `);
  if (!voiceover) throw new Error('Failed to create voiceover');
  return voiceover;
}

export async function getVoiceoverByScriptId(
  scriptId: string,
  userId?: string
): Promise<Voiceover | null> {
  return one<Voiceover>(sql`
    SELECT to_jsonb(voiceovers.*) AS doc
    FROM voiceovers
    WHERE script_id = ${scriptId}
      AND (${userId ?? null}::text IS NULL OR user_id = ${userId ?? null})
    ORDER BY created_at DESC
    LIMIT 1
  `);
}

export async function getTrendingTopics(platform: string, limit = 20): Promise<TrendingTopic[]> {
  return docs<TrendingTopic>(sql`
    SELECT to_jsonb(trending_topics.*) AS doc
    FROM trending_topics
    WHERE platform = ${platform}
    ORDER BY fetched_at DESC
    LIMIT ${limit}
  `);
}

export async function createTrendingTopic(topic: TrendingTopic): Promise<TrendingTopic> {
  const [created] = await docs<TrendingTopic>(sql`
    INSERT INTO trending_topics (
      platform, topic, category, search_volume, growth_percentage,
      competition_level, suggested_format, expires_at
    ) VALUES (
      ${topic.platform},
      ${topic.topic},
      ${topic.category},
      ${topic.search_volume},
      ${topic.growth_percentage},
      ${topic.competition_level},
      ${topic.suggested_format},
      ${topic.expires_at}
    )
    RETURNING to_jsonb(trending_topics.*) AS doc
  `);
  if (!created) throw new Error('Failed to create trending topic');
  return created;
}

export async function getUserUsage(userId: string): Promise<UserUsage | null> {
  return one<UserUsage>(sql`
    SELECT to_jsonb(user_usage.*) AS doc
    FROM user_usage
    WHERE user_id = ${userId}
  `);
}

export async function initializeUserUsage(userId: string): Promise<UserUsage> {
  await ensureAppUser({ id: userId });
  const [usage] = await docs<UserUsage>(sql`
    INSERT INTO user_usage (user_id, scripts_generated, videos_generated, voiceover_minutes_used, total_spent_usd)
    VALUES (${userId}, 0, 0, 0, 0)
    RETURNING to_jsonb(user_usage.*) AS doc
  `);
  if (!usage) throw new Error('Failed to initialize user usage');
  return usage;
}

export async function updateUserUsage(userId: string, updates: Partial<UserUsage>): Promise<UserUsage> {
  const count = await updateColumns(
    'user_usage',
    updates,
    USAGE_COLUMNS,
    new Set(),
    [{ column: 'user_id', value: userId }]
  );
  if (count === 0) throw new Error('Failed to update user usage');
  const usage = await getUserUsage(userId);
  if (!usage) throw new Error('Failed to update user usage');
  return usage;
}

export async function createVideoPricing(
  userId: string,
  videoId: string,
  pricing: Partial<VideoPricing>
): Promise<VideoPricing> {
  await ensureAppUser({ id: userId });
  const [created] = await docs<VideoPricing>(sql`
    INSERT INTO video_pricing (
      user_id, video_id, script_cost_usd, voiceover_cost_usd, assembly_cost_usd,
      total_base_cost_usd, markup_percentage, final_price_usd, payment_status,
      stripe_payment_intent_id
    ) VALUES (
      ${userId},
      ${videoId},
      ${pricing.script_cost_usd ?? null},
      ${pricing.voiceover_cost_usd ?? null},
      ${pricing.assembly_cost_usd ?? null},
      ${pricing.total_base_cost_usd ?? null},
      ${pricing.markup_percentage ?? null},
      ${pricing.final_price_usd ?? null},
      ${pricing.payment_status ?? 'pending'},
      ${pricing.stripe_payment_intent_id ?? null}
    )
    RETURNING to_jsonb(video_pricing.*) AS doc
  `);
  if (!created) throw new Error('Failed to create video pricing');
  return created;
}

export async function getVideoPricing(videoId: string): Promise<VideoPricing | null> {
  return one<VideoPricing>(sql`
    SELECT to_jsonb(video_pricing.*) AS doc
    FROM video_pricing
    WHERE video_id = ${videoId}
  `);
}

export async function updateVideoPricing(
  pricingId: string,
  updates: Partial<VideoPricing>
): Promise<VideoPricing> {
  const count = await updateColumns(
    'video_pricing',
    updates,
    PRICING_COLUMNS,
    new Set(),
    [{ column: 'id', value: pricingId }],
    false
  );
  if (count === 0) throw new Error('Failed to update video pricing');
  const [pricing] = await docs<VideoPricing>(sql`
    SELECT to_jsonb(video_pricing.*) AS doc
    FROM video_pricing
    WHERE id = ${pricingId}
  `);
  if (!pricing) throw new Error('Failed to update video pricing');
  return pricing;
}
