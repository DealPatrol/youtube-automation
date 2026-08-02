/**
 * Stage 4b — captions. Builds SRT (for YouTube caption upload) and WebVTT
 * sidecars from scene narrations, timed against the measured TTS audio
 * durations so cues track the actual voiceover.
 */

export interface CaptionScene {
  narration: string
  /** Measured narration audio length in seconds */
  duration: number
}

export interface CaptionCue {
  start: number
  end: number
  text: string
}

const MAX_WORDS_PER_CUE = 7

/** Split one scene's narration into cues spread proportionally across its duration. */
export function cuesForScene(scene: CaptionScene, offsetSeconds: number): CaptionCue[] {
  const words = scene.narration.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0 || scene.duration <= 0) return []

  const chunks: string[][] = []
  for (let i = 0; i < words.length; i += MAX_WORDS_PER_CUE) {
    chunks.push(words.slice(i, i + MAX_WORDS_PER_CUE))
  }

  const secondsPerWord = scene.duration / words.length
  const cues: CaptionCue[] = []
  let cursor = offsetSeconds
  for (const chunk of chunks) {
    const chunkDuration = chunk.length * secondsPerWord
    cues.push({
      start: cursor,
      end: cursor + chunkDuration,
      text: chunk.join(' '),
    })
    cursor += chunkDuration
  }
  return cues
}

export function buildCues(scenes: CaptionScene[]): CaptionCue[] {
  const cues: CaptionCue[] = []
  let offset = 0
  for (const scene of scenes) {
    cues.push(...cuesForScene(scene, offset))
    offset += Math.max(0, scene.duration)
  }
  return cues
}

function pad(value: number, length: number): string {
  return Math.floor(value).toString().padStart(length, '0')
}

export function formatSrtTime(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const ms = Math.round((safe - Math.floor(safe)) * 1000)
  return `${pad(safe / 3600, 2)}:${pad((safe % 3600) / 60, 2)}:${pad(safe % 60, 2)},${ms
    .toString()
    .padStart(3, '0')}`
}

export function formatVttTime(totalSeconds: number): string {
  return formatSrtTime(totalSeconds).replace(',', '.')
}

export function buildSrt(cues: CaptionCue[]): string {
  return (
    cues
      .map(
        (cue, index) =>
          `${index + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cue.text}`
      )
      .join('\n\n') + '\n'
  )
}

export function buildVtt(cues: CaptionCue[]): string {
  return (
    'WEBVTT\n\n' +
    cues
      .map((cue) => `${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}\n${cue.text}`)
      .join('\n\n') +
    '\n'
  )
}
