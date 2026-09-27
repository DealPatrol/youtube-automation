import { sql } from 'drizzle-orm'
import { docs, rows } from './client'
import { updateColumns } from './mutate'

const RESULT_COLUMNS = new Set([
  'script',
  'scenes',
  'capcut_steps',
  'seo',
  'thumbnail',
  'processing_status',
  'error_message',
  'video_url',
  'youtube_refresh_token',
  'youtube_access_token',
  'youtube_video_id',
  'youtube_url',
  'youtube_status',
  'thumbnail_url',
])

const RESULT_JSON = new Set(['script', 'scenes', 'capcut_steps', 'seo', 'thumbnail'])

const PROJECT_COLUMNS = new Set([
  'title',
  'topic',
  'description',
  'video_length_minutes',
  'youtube_clip_duration',
  'tiktok_clip_duration',
  'tone',
  'platform',
  'status',
  'scheduled_for',
  'video_url',
  'views',
  'youtube_video_id',
])

export interface ProjectInput {
  userId: string
  title: string
  topic: string
  description?: string | null
  videoLengthMinutes: number
  youtubeClipDuration?: number
  tiktokClipDuration?: number
  tone: string
  platform: string
}

export async function insertProject(input: ProjectInput): Promise<string> {
  const [row] = await rows<{ id: string }>(sql`
    INSERT INTO projects (
      user_id, title, topic, description, video_length_minutes,
      youtube_clip_duration, tiktok_clip_duration, tone, platform
    ) VALUES (
      ${input.userId},
      ${input.title},
      ${input.topic},
      ${input.description ?? null},
      ${input.videoLengthMinutes},
      ${input.youtubeClipDuration ?? 0},
      ${input.tiktokClipDuration ?? 15},
      ${input.tone},
      ${input.platform}
    )
    RETURNING id
  `)
  if (!row) throw new Error('Failed to create project')
  return row.id
}

export async function insertResult(projectId: string, userId: string): Promise<string> {
  const [row] = await rows<{ id: string }>(sql`
    INSERT INTO results (project_id, user_id, processing_status)
    VALUES (${projectId}, ${userId}, 'processing')
    RETURNING id
  `)
  if (!row) throw new Error('Failed to create result')
  return row.id
}

export async function updateResult(
  id: string,
  patch: Record<string, unknown>,
  userId?: string
): Promise<boolean> {
  const where = [{ column: 'id', value: id }]
  if (userId) where.push({ column: 'user_id', value: userId })
  const count = await updateColumns('results', patch, RESULT_COLUMNS, RESULT_JSON, where)
  return count > 0
}

export async function updateProject(
  id: string,
  patch: Record<string, unknown>,
  userId?: string
): Promise<boolean> {
  const where = [{ column: 'id', value: id }]
  if (userId) where.push({ column: 'user_id', value: userId })
  const count = await updateColumns('projects', patch, PROJECT_COLUMNS, new Set(), where)
  return count > 0
}

export async function getResultForUser<T>(id: string, userId: string): Promise<T | null> {
  const [doc] = await docs<T>(sql`
    SELECT to_jsonb(results.*) AS doc
    FROM results
    WHERE id = ${id} AND user_id = ${userId}
  `)
  return doc ?? null
}

export async function getResultById<T>(id: string): Promise<T | null> {
  const [doc] = await docs<T>(sql`
    SELECT to_jsonb(results.*) AS doc
    FROM results
    WHERE id = ${id}
  `)
  return doc ?? null
}

export async function getResultWithProject<T>(id: string, userId?: string): Promise<T | null> {
  const [doc] = await docs<T>(sql`
    SELECT (to_jsonb(r.*) || jsonb_build_object(
      'projects', jsonb_build_object(
        'platform', p.platform,
        'video_length_minutes', p.video_length_minutes,
        'youtube_clip_duration', p.youtube_clip_duration,
        'tiktok_clip_duration', p.tiktok_clip_duration,
        'tone', p.tone
      )
    )) AS doc
    FROM results r
    JOIN projects p ON p.id = r.project_id
    WHERE r.id = ${id}
      AND (${userId ?? null}::text IS NULL OR r.user_id = ${userId ?? null})
  `)
  return doc ?? null
}

export async function getProjectForUser<T>(id: string, userId: string): Promise<T | null> {
  const [doc] = await docs<T>(sql`
    SELECT to_jsonb(projects.*) AS doc
    FROM projects
    WHERE id = ${id} AND user_id = ${userId}
  `)
  return doc ?? null
}

export async function listProjectsForUser<T>(userId: string, limit = 10): Promise<T[]> {
  return docs<T>(sql`
    SELECT (to_jsonb(p.*) || jsonb_build_object(
      'results', COALESCE((
        SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC)
        FROM results r
        WHERE r.project_id = p.id AND r.user_id = p.user_id
      ), '[]'::jsonb)
    )) AS doc
    FROM projects p
    WHERE p.user_id = ${userId}
    ORDER BY p.created_at DESC
    LIMIT ${limit}
  `)
}

export async function listScheduledProjects<T>(userId: string): Promise<T[]> {
  return docs<T>(sql`
    SELECT (to_jsonb(p.*) || jsonb_build_object(
      'results', COALESCE((
        SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC)
        FROM results r
        WHERE r.project_id = p.id AND r.user_id = p.user_id
      ), '[]'::jsonb)
    )) AS doc
    FROM projects p
    WHERE p.user_id = ${userId} AND p.status = 'scheduled'
    ORDER BY p.scheduled_for ASC
  `)
}

export async function listDueScheduledProjects<T>(limit = 10): Promise<T[]> {
  return docs<T>(sql`
    SELECT (to_jsonb(p.*) || jsonb_build_object(
      'results', COALESCE((
        SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC)
        FROM results r
        WHERE r.project_id = p.id
      ), '[]'::jsonb)
    )) AS doc
    FROM projects p
    WHERE p.status = 'scheduled' AND p.scheduled_for <= now()
    ORDER BY p.scheduled_for ASC
    LIMIT ${limit}
  `)
}

export async function countProjectsSince(userId: string, since: Date): Promise<number> {
  const [row] = await rows<{ count: string }>(sql`
    SELECT count(*)::text AS count
    FROM projects
    WHERE user_id = ${userId} AND created_at >= ${since.toISOString()}
  `)
  return Number(row?.count ?? 0)
}
