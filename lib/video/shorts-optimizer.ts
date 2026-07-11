/**
 * YouTube Shorts format optimizer.
 * Enforces 9:16 aspect ratio and ≤60-second duration constraints.
 */

export const SHORTS_ASPECT_RATIO = '9:16'
export const SHORTS_WIDTH = 1080
export const SHORTS_HEIGHT = 1920
export const SHORTS_MAX_DURATION_SECONDS = 60
export const SHORTS_DEFAULT_SCENE_DURATION = 5
export const SHORTS_MAX_SCENES = 12

export interface ShortsScene {
  id: number
  title: string
  visual_description: string
  on_screen_text: string
  narration?: string
  start_time?: string
  end_time?: string
  duration?: number
  image_url?: string
  video_url?: string
  audio_url?: string
}

export interface ShortsMetadata {
  title: string
  description: string
  tags: string[]
  durationSeconds: number
  sceneCount: number
  aspectRatio: string
}

export interface ShortsOptimizationResult {
  scenes: ShortsScene[]
  totalDurationSeconds: number
  sceneCount: number
  ffmpegVideoFilter: string
  ffmpegScaleArgs: string[]
  metadata: ShortsMetadata
}

/**
 * Clamps total content to 60 seconds and distributes evenly across scenes.
 */
export function optimizeScenesForShorts(
  scenes: ShortsScene[],
  requestedDurationSeconds = SHORTS_MAX_DURATION_SECONDS
): ShortsScene[] {
  const totalDuration = Math.min(requestedDurationSeconds, SHORTS_MAX_DURATION_SECONDS)
  const sceneCount = Math.min(scenes.length, SHORTS_MAX_SCENES)
  if (sceneCount === 0) return []
  const trimmedScenes = scenes.slice(0, sceneCount)
  const sceneDuration = Math.floor(totalDuration / sceneCount)

  let cursor = 0
  return trimmedScenes.map((scene, index) => {
    const isLast = index === sceneCount - 1
    const duration = isLast ? totalDuration - cursor : sceneDuration
    const startSeconds = cursor
    const endSeconds = cursor + duration
    cursor += duration

    return {
      ...scene,
      duration,
      start_time: formatSeconds(startSeconds),
      end_time: formatSeconds(endSeconds),
    }
  })
}

/**
 * Returns the FFmpeg video filter string for 9:16 vertical output.
 * Scales to fill 1080x1920, crops center, adds text overlay if provided.
 */
export function buildShortsVideoFilter(onScreenText?: string): string {
  const base = [
    `scale=${SHORTS_WIDTH}:${SHORTS_HEIGHT}:force_original_aspect_ratio=increase`,
    `crop=${SHORTS_WIDTH}:${SHORTS_HEIGHT}`,
    'format=yuv420p',
  ]

  if (onScreenText?.trim()) {
    const safe = escapeDrawtext(onScreenText.trim())
    base.push(
      `drawtext=text='${safe}':fontsize=56:fontcolor=white:box=1:boxcolor=black@0.6:x=(w-text_w)/2:y=h-160:line_spacing=8`
    )
  }

  return base.join(',')
}

/**
 * FFmpeg args to encode at Shorts resolution (1080x1920).
 */
export function buildShortsEncodeArgs(): string[] {
  return [
    '-vf',
    `scale=${SHORTS_WIDTH}:${SHORTS_HEIGHT}:force_original_aspect_ratio=increase,crop=${SHORTS_WIDTH}:${SHORTS_HEIGHT},format=yuv420p`,
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-c:a',
    'aac',
  ]
}

/**
 * Derives a full ShortsOptimizationResult from scenes and SEO data.
 */
export function buildShortsOptimization(
  scenes: ShortsScene[],
  seo: { title?: string; description?: string; tags?: string[] },
  requestedDurationSeconds = SHORTS_MAX_DURATION_SECONDS
): ShortsOptimizationResult {
  const optimizedScenes = optimizeScenesForShorts(scenes, requestedDurationSeconds)
  const totalDurationSeconds = optimizedScenes.reduce((sum, s) => sum + (s.duration ?? 0), 0)

  return {
    scenes: optimizedScenes,
    totalDurationSeconds,
    sceneCount: optimizedScenes.length,
    ffmpegVideoFilter: buildShortsVideoFilter(),
    ffmpegScaleArgs: buildShortsEncodeArgs(),
    metadata: {
      title: seo.title || 'YouTube Short',
      description: seo.description || '',
      tags: [...(seo.tags || []), 'Shorts', 'YouTubeShorts'],
      durationSeconds: totalDurationSeconds,
      sceneCount: optimizedScenes.length,
      aspectRatio: SHORTS_ASPECT_RATIO,
    },
  }
}

/**
 * Builds the OpenAI prompt parameters for a ≤60-second Shorts script.
 */
export function buildShortsPromptParams(
  topic: string,
  tone: string,
  durationSeconds = SHORTS_MAX_DURATION_SECONDS
): {
  numScenes: number
  avgSceneSeconds: number
  totalSeconds: number
  systemAddendum: string
} {
  const totalSeconds = Math.min(durationSeconds, SHORTS_MAX_DURATION_SECONDS)
  const numScenes = Math.min(Math.max(Math.floor(totalSeconds / SHORTS_DEFAULT_SCENE_DURATION), 4), SHORTS_MAX_SCENES)
  const avgSceneSeconds = Math.floor(totalSeconds / numScenes)

  const systemAddendum = `SHORTS FORMAT REQUIREMENTS:
- Vertical video (9:16 aspect ratio, 1080x1920)
- Total duration: exactly ${totalSeconds} seconds (YouTube Shorts limit)
- Generate exactly ${numScenes} scenes, each ~${avgSceneSeconds} seconds
- Hook must appear in first 3 seconds to stop the scroll
- Keep narration punchy — every word must earn its place
- on_screen_text: max 5 words, large and bold
- Visual descriptions must work in portrait/vertical orientation`

  return { numScenes, avgSceneSeconds, totalSeconds, systemAddendum }
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
}
