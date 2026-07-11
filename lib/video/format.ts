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

export function inferVideoAspectRatio(
  requestedAspectRatio: string | undefined,
  videoLengthMinutes: number | null | undefined
): VideoAspectRatio {
  if (requestedAspectRatio === '9:16' || requestedAspectRatio === '16:9') {
    return requestedAspectRatio
  }

  return typeof videoLengthMinutes === 'number' && videoLengthMinutes <= 1 ? '9:16' : '16:9'
}

export function buildVideoFilter(
  format: VideoFormat,
  onScreenText?: string,
  escapeText: (text: string) => string = (text) => text
): string {
  const filters = [
    `scale=${format.width}:${format.height}:force_original_aspect_ratio=increase`,
    `crop=${format.width}:${format.height}`,
    'format=yuv420p',
  ]

  if (onScreenText?.trim()) {
    const fontSize = format.aspectRatio === '9:16' ? 56 : 64
    const bottomOffset = format.aspectRatio === '9:16' ? 160 : 140
    filters.push(
      `drawtext=text='${escapeText(onScreenText.trim())}':fontsize=${fontSize}:fontcolor=white:box=1:boxcolor=black@0.6:x=(w-text_w)/2:y=h-${bottomOffset}:line_spacing=8`
    )
  }

  return filters.join(',')
}
