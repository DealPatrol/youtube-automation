export type VideoAspectRatio = '16:9' | '9:16'

export interface VideoFormat {
  aspectRatio: VideoAspectRatio
  width: number
  height: number
}

const FORMATS: Record<VideoAspectRatio, VideoFormat> = {
  '16:9': { aspectRatio: '16:9', width: 1920, height: 1080 },
  '9:16': { aspectRatio: '9:16', width: 1080, height: 1920 },
}

export function resolveVideoFormat(aspectRatio?: string | null): VideoFormat {
  return aspectRatio === '9:16' ? FORMATS['9:16'] : FORMATS['16:9']
}

export function isVerticalPlatform(platform?: string | null): boolean {
  const normalized = platform?.toLowerCase()
  return normalized === 'tiktok' || normalized === 'instagram'
}

/** Longest video (in minutes) that is produced as a vertical YouTube Short. */
export const SHORT_FORM_MAX_MINUTES = 1

/**
 * Per-scene clip length configured on the project. Vertical platforms and
 * YouTube Shorts (<= 60s) use the vertical clip setting; long-form YouTube uses
 * the YouTube scene setting. Falls back to 5 seconds.
 */
export function resolveProjectClipSeconds(project?: {
  platform?: string | null
  video_length_minutes?: number | string | null
  youtube_clip_duration?: number | null
  tiktok_clip_duration?: number | null
} | null): number {
  const minutes = Number(project?.video_length_minutes)
  const vertical =
    isVerticalPlatform(project?.platform) ||
    (Number.isFinite(minutes) && minutes > 0 && minutes <= SHORT_FORM_MAX_MINUTES)
  const configured = vertical ? project?.tiktok_clip_duration : project?.youtube_clip_duration
  return Number(configured) > 0 ? Number(configured) : 5
}

export function inferVideoAspectRatio(
  requestedAspectRatio: string | undefined,
  videoLengthMinutes: number | string | null | undefined,
  platform?: string | null
): VideoAspectRatio {
  if (requestedAspectRatio === '9:16' || requestedAspectRatio === '16:9') {
    return requestedAspectRatio
  }

  if (isVerticalPlatform(platform)) {
    return '9:16'
  }

  // Postgres NUMERIC columns arrive as strings through node-postgres/to_jsonb,
  // so coerce before comparing.
  const minutes = Number(videoLengthMinutes)
  return videoLengthMinutes !== null &&
    videoLengthMinutes !== undefined &&
    Number.isFinite(minutes) &&
    minutes > 0 &&
    minutes <= SHORT_FORM_MAX_MINUTES
    ? '9:16'
    : '16:9'
}

export function buildVideoFilter(
  format: VideoFormat
): string {
  return [
    `scale=${format.width}:${format.height}:force_original_aspect_ratio=increase`,
    `crop=${format.width}:${format.height}`,
    'format=yuv420p',
  ].join(',')
}
