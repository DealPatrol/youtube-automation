/**
 * Video Generation Service
 * Handles video creation using AI-generated video clips for scenes
 */
import { getPublicAppUrl } from '@/lib/config/app-url'

export interface VideoScene {
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

export interface VideoGenerationOptions {
  resultId: string
  scenes: VideoScene[]
  script: any
  duration?: number
}

export type VoiceProvider = 'openai' | 'elevenlabs'

export interface VoiceOptions {
  provider?: VoiceProvider
  voice?: string
  voiceId?: string
  baseUrl?: string
  aspectRatio?: '16:9' | '9:16'
  resultId?: string
  voiceInstructions?: string
}

function resolveBaseUrl(baseUrl?: string): string {
  return (baseUrl || getPublicAppUrl()).replace(/\/$/, '')
}

function configuredConcurrency(envName: string, fallback: number, maximum: number): number {
  const value = Number(process.env[envName])
  return Number.isFinite(value) ? Math.min(maximum, Math.max(1, Math.floor(value))) : fallback
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(items[index], index)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker())
  )
  return results
}

/**
 * Generate audio voiceover for scenes using OpenAI TTS
 */
export async function generateSceneAudio(
  scenes: VideoScene[],
  options: VoiceOptions = {}
): Promise<VideoScene[]> {
  const { provider, voice = 'alloy', voiceId, baseUrl, resultId, voiceInstructions } = options
  const concurrency = configuredConcurrency('MEDIA_GENERATION_CONCURRENCY', 3, 5)

  return mapWithConcurrency(scenes, concurrency, async (scene) => {
      if (!scene.narration?.trim()) {
        throw new Error(`Scene ${scene.id} is missing narration`)
      }
      console.log(`[v0] Generating voiceover for scene ${scene.id}: ${scene.title}`)
      
      const response = await fetch(`${resolveBaseUrl(baseUrl)}/api/generate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narration: scene.narration,
          sceneId: scene.id,
          voice,
          voiceProvider: provider,
          voiceId,
          resultId,
          voiceInstructions,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`Failed to generate audio for scene ${scene.id}: ${errorBody}`)
      }

      const data = await response.json()
      if (!data.audioUrl || !Number.isFinite(data.duration) || data.duration <= 0) {
        throw new Error(`Voiceover service returned invalid media for scene ${scene.id}`)
      }

      const updatedScene = {
        ...scene,
        audio_url: data.audioUrl,
        duration: data.duration,
      }

      console.log(`[v0] Scene ${scene.id} voiceover generated`)
      return updatedScene
  })
}

/**
 * Generate video clips for each scene using Kling Video API
 */
export async function generateSceneVideos(
  scenes: VideoScene[],
  duration: number = 5,
  options: Pick<VoiceOptions, 'baseUrl' | 'aspectRatio'> = {}
): Promise<VideoScene[]> {
  const updatedScenes = []
  const baseUrl = resolveBaseUrl(options.baseUrl)
  const aspectRatio = options.aspectRatio || '16:9'

  for (const scene of scenes) {
    try {
      console.log(`[v0] Generating ${duration}s video for scene ${scene.id}: ${scene.title}`)
      
      // Use fal.ai Kling Video to generate actual video clips
      const response = await fetch(`${baseUrl}/api/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${scene.visual_description}. ${scene.on_screen_text}`,
          sceneId: scene.id,
          duration: duration,
          aspectRatio,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to generate video for scene ${scene.id}`)
      }

      const data = await response.json()
      
      updatedScenes.push({
        ...scene,
        video_url: data.videoUrl,
        image_url: data.thumbnailUrl || data.videoUrl, // Use video as fallback
      })

      console.log(`[v0] Scene ${scene.id} video generated: ${data.videoUrl}`)
    } catch (error) {
      console.error(`[v0] Error generating video for scene ${scene.id}:`, error)

      try {
        const { getStockVideoUrl, getStockImageUrl } = await import('@/lib/video/stock-media')
        const stockVideo = await getStockVideoUrl(scene.visual_description, aspectRatio)
        if (stockVideo) {
          const stockImage = await getStockImageUrl(scene.visual_description, aspectRatio)
          updatedScenes.push({
            ...scene,
            video_url: stockVideo,
            image_url: stockImage || stockVideo,
          })
          continue
        }
      } catch (stockError) {
        console.warn('[v0] Stock video fallback failed:', stockError)
      }

      // Fallback to image generation if video fails
      try {
        const imageResponse = await fetch(`${baseUrl}/api/generate-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: scene.visual_description,
            aspectRatio,
          }),
        })

        if (imageResponse.ok) {
          const imageData = await imageResponse.json()
          updatedScenes.push({
            ...scene,
            image_url: imageData.imageUrl,
          })
        } else {
          throw new Error('Image fallback failed')
        }
      } catch (fallbackError) {
        console.error(`[v0] Fallback image generation failed for scene ${scene.id}:`, fallbackError)

        try {
          const { getStockImageUrl } = await import('@/lib/video/stock-media')
          const stockImage = await getStockImageUrl(scene.visual_description, aspectRatio)
          if (stockImage) {
            updatedScenes.push({
              ...scene,
              image_url: stockImage,
            })
            continue
          }
        } catch (stockError) {
          console.warn('[v0] Stock image fallback failed:', stockError)
        }

        throw new Error(`Unable to generate a visual asset for scene ${scene.id}`)
      }
    }
  }

  return updatedScenes
}

/**
 * Generate images for each scene using AI (legacy support)
 */
export async function generateSceneImages(
  scenes: VideoScene[],
  options: Pick<VoiceOptions, 'baseUrl' | 'aspectRatio'> = {}
): Promise<VideoScene[]> {
  const baseUrl = resolveBaseUrl(options.baseUrl)
  const aspectRatio = options.aspectRatio || '16:9'
  const concurrency = configuredConcurrency('MEDIA_GENERATION_CONCURRENCY', 3, 5)

  return mapWithConcurrency(scenes, concurrency, async (scene) => {
    try {
      console.log(`[v0] Generating image for scene ${scene.id}: ${scene.title}`)
      
      const response = await fetch(`${baseUrl}/api/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: scene.visual_description,
          aspectRatio,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to generate image for scene ${scene.id}`)
      }

      const data = await response.json()
      if (!data.imageUrl) throw new Error(`Image service returned no URL for scene ${scene.id}`)
      const updatedScene = {
        ...scene,
        image_url: data.imageUrl,
      }

      console.log(`[v0] Scene ${scene.id} image generated: ${data.imageUrl}`)
      return updatedScene
    } catch (error) {
      console.error(`[v0] Error generating image for scene ${scene.id}:`, error)

      try {
        const { getStockImageUrl } = await import('@/lib/video/stock-media')
        const stockImage = await getStockImageUrl(scene.visual_description, aspectRatio)
        if (stockImage) {
          return {
            ...scene,
            image_url: stockImage,
          }
        }
      } catch (stockError) {
        console.warn('[v0] Stock image fallback failed:', stockError)
      }

      throw new Error(`Unable to generate an image for scene ${scene.id}`)
    }
  })
}

/**
 * Create video from scenes (simplified approach for serverless)
 */
export async function createVideoFromScenes(options: VideoGenerationOptions) {
  const { resultId, scenes, script } = options

  console.log(`[v0] Creating video for result ${resultId}`)
  console.log(`[v0] Processing ${scenes.length} scenes`)

  // Generate images for all scenes
  const scenesWithImages = await generateSceneImages(scenes)

  // For now, we'll store the scenes with images and let the editor handle assembly
  // In production, you'd use a video rendering service here
  return {
    success: true,
    resultId,
    scenes: scenesWithImages,
    message: 'Scenes with images generated. Use the editor to assemble the final video.',
  }
}

/**
 * Estimate video generation time based on scene count
 */
export function estimateGenerationTime(sceneCount: number): string {
  const timePerScene = 30 // seconds
  const totalSeconds = sceneCount * timePerScene
  const minutes = Math.ceil(totalSeconds / 60)
  
  return `${minutes}-${minutes + 2} minutes`
}
