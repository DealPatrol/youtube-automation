import { fal } from '@fal-ai/client'
import { MediaInputError } from '@/lib/media/voiceover'

let configuredKey: string | undefined

function requireFal(): void {
  const key = process.env.FAL_KEY?.trim()
  if (!key) {
    throw new MediaInputError(
      'Image/video generation not configured. Add FAL_KEY to environment variables.',
      500
    )
  }
  if (configuredKey !== key) {
    fal.config({ credentials: key })
    configuredKey = key
  }
}

const IMAGE_SIZES: Record<string, 'landscape_16_9' | 'landscape_4_3' | 'square' | 'portrait_16_9'> = {
  '16:9': 'landscape_16_9',
  '4:3': 'landscape_4_3',
  '1:1': 'square',
  '9:16': 'portrait_16_9',
}

export const MAX_PROMPT_CHARS = 2000

function cleanPrompt(prompt: unknown): string {
  const text = typeof prompt === 'string' ? prompt.trim() : ''
  if (!text) throw new MediaInputError('Missing prompt')
  return text.slice(0, MAX_PROMPT_CHARS)
}

/**
 * Still image for a scene. Uses FLUX dev on fal.ai (a few cents per image),
 * which is the low-cost default visual for every render.
 */
export async function generateImage(input: {
  prompt: string
  aspectRatio?: string
}): Promise<{ imageUrl: string; requestId?: string }> {
  const prompt = cleanPrompt(input.prompt)
  requireFal()
  const imageSize = IMAGE_SIZES[input.aspectRatio || '16:9'] || 'landscape_16_9'
  const result = await fal.subscribe('fal-ai/flux/dev', {
    input: {
      prompt: `${prompt}, cinematic, high quality, 4k, professional video production`,
      image_size: imageSize,
      num_images: 1,
    },
  })
  const imageUrl = result.data?.images?.[0]?.url
  if (!imageUrl) throw new Error('No image URL in response')
  return { imageUrl, requestId: result.requestId }
}

/**
 * AI motion clip for a scene (Kling 2.6 Pro on fal.ai). This is the expensive
 * path, so callers cap how many scenes use it (MAX_AI_VIDEO_SCENES).
 */
export async function generateVideoClip(input: {
  prompt: string
  duration?: number
  aspectRatio?: string
}): Promise<{ videoUrl: string; thumbnailUrl?: string; requestId?: string }> {
  const prompt = cleanPrompt(input.prompt)
  requireFal()
  const supportedDuration = Number(input.duration) >= 10 ? '10' : '5'
  const supportedAspectRatio = input.aspectRatio === '9:16' ? '9:16' : '16:9'
  const result = await fal.subscribe('fal-ai/kling-video/v2.6/pro/text-to-video', {
    input: {
      prompt,
      duration: supportedDuration,
      aspect_ratio: supportedAspectRatio,
    },
  })
  const data = result.data as { video?: { url?: string }; thumbnail_url?: string } | undefined
  const videoUrl = data?.video?.url
  if (!videoUrl) throw new Error('No video URL in response')
  return { videoUrl, thumbnailUrl: data?.thumbnail_url, requestId: result.requestId }
}
