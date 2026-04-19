export type TimedScene = {
  start_time?: string
  end_time?: string
  duration?: number
}

export function parseTimestamp(value?: string): number | null {
  if (!value) return null
  const parts = value.split(':').map((part) => Number(part))
  if (parts.some((part) => Number.isNaN(part))) return null
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

export function resolveDuration(scene: TimedScene, fallback: number): number {
  if (typeof scene.duration === 'number' && scene.duration > 0) {
    return Math.max(1, Math.round(scene.duration))
  }
  const start = parseTimestamp(scene.start_time)
  const end = parseTimestamp(scene.end_time)
  if (start !== null && end !== null && end > start) {
    return Math.max(1, Math.round(end - start))
  }
  return Math.max(1, Math.round(fallback))
}
