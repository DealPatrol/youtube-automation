import { sql } from 'drizzle-orm'
import { execute, rows } from './client'

/** Shortest supported video: a 15-second Short. */
export const MIN_VIDEO_LENGTH_MINUTES = 0.25
/** Longest supported long-form video. */
export const MAX_VIDEO_LENGTH_MINUTES = 120

/**
 * Validate a requested video length in minutes. Fractional minutes are
 * intentional (0.25 = 15s Short, 0.5 = 30s, 1.5 = 90s) and are preserved
 * exactly to two decimals; they are never rounded to whole minutes.
 */
export function normalizeVideoLengthMinutes(value: unknown): number {
  const minutes = typeof value === 'string' ? Number(value.trim()) : Number(value)
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new RangeError('video_length_minutes must be a positive number')
  }
  if (minutes < MIN_VIDEO_LENGTH_MINUTES || minutes > MAX_VIDEO_LENGTH_MINUTES) {
    throw new RangeError(
      `video_length_minutes must be between ${MIN_VIDEO_LENGTH_MINUTES} and ${MAX_VIDEO_LENGTH_MINUTES}`
    )
  }
  return Math.round(minutes * 100) / 100
}

let ensured: Promise<void> | null = null

/**
 * Production databases created before this fix have
 * projects.video_length_minutes as INTEGER, which rejects Shorts lengths like
 * 0.25. Upgrade the column in place once per server process (lossless,
 * idempotent) so Shorts work without waiting for a manual `npm run migrate`.
 */
export function ensureFractionalVideoLengthColumn(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const [column] = await rows<{ data_type: string }>(sql`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'projects'
          AND column_name = 'video_length_minutes'
      `)
      if (column?.data_type === 'integer') {
        console.log('[db] Upgrading projects.video_length_minutes to numeric(6,2) for Shorts lengths')
        await execute(sql`
          ALTER TABLE public.projects
          ALTER COLUMN video_length_minutes TYPE numeric(6,2)
        `)
      }
    })().catch((error: unknown) => {
      ensured = null
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Database schema needs projects.video_length_minutes as numeric for Shorts. Run "npm run migrate". (${message})`
      )
    })
  }
  return ensured
}
