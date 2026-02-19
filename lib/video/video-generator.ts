/**
 * Video Generation Service
 * Handles video creation using AI-generated video clips for scenes
 */

export interface VideoScene {
  id: number
  title: string
  visual_description: string
  on_screen_text: string
  narration?: string
  start_time?: string
  end_time?: string
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
}

/**
 * Generate audio voiceover for scenes using OpenAI TTS
 */
export async function generateSceneAudio(
  scenes: VideoScene[],
  options: VoiceOptions = {}
): Promise<VideoScene[]> {
  const updatedScenes = []
  const { provider, voice = 'alloy', voiceId } = options

  for (const scene of scenes) {
    try {
      // Skip if no narration text
      if (!scene.narration) {
        console.log(`[v0] Scene ${scene.id} has no narration, skipping audio generation`)
        updatedScenes.push(scene)
        continue
      }

      console.log(`[v0] Generating voiceover for scene ${scene.id}: ${scene.title}`)
      
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/generate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narration: scene.narration,
          sceneId: scene.id,
          voice,
          voiceProvider: provider,
          voiceId,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to generate audio for scene ${scene.id}`)
      }

      const data = await response.json()
      
      updatedScenes.push({
        ...scene,
        audio_url: data.audioUrl,
        duration: typeof data.duration === 'number' && data.duration > 0 ? data.duration : scene.duration,
      })

      console.log(`[v0] Scene ${scene.id} voiceover generated`)
    } catch (error) {
      console.error(`[v0] Error generating audio for scene ${scene.id}:`, error)
      
      // Continue without audio if generation fails
      updatedScenes.push(scene)
    }
  }

  return updatedScenes
}

/**
 * Generate video clips for each scene using Kling Video API
 */
export async function generateSceneVideos(scenes: VideoScene[], duration: number = 5): Promise<VideoScene[]> {
  const updatedScenes = []

  for (const scene of scenes) {
    try {
      console.log(`[v0] Generating ${duration}s video for scene ${scene.id}: ${scene.title}`)
      
      // Use fal.ai Kling Video to generate actual video clips
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${scene.visual_description}. ${scene.on_screen_text}`,
          sceneId: scene.id,
          duration: duration,
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
      
      // Fallback to image generation if video fails
      try {
        const imageResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/generate-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: scene.visual_description,
            aspectRatio: '16:9',
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
        updatedScenes.push({
          ...scene,
          image_url: `/placeholder.svg`,
        })
      }
    }
  }

  return updatedScenes
}

/**
 * Generate images for each scene using AI (legacy support)
 */
export async function generateSceneImages(scenes: VideoScene[]): Promise<VideoScene[]> {
  const updatedScenes = []

  for (const scene of scenes) {
    try {
      console.log(`[v0] Generating image for scene ${scene.id}: ${scene.title}`)
      
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: scene.visual_description,
          aspectRatio: '16:9',
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to generate image for scene ${scene.id}`)
      }

      const data = await response.json()
      
      updatedScenes.push({
        ...scene,
        image_url: data.imageUrl,
      })

      console.log(`[v0] Scene ${scene.id} image generated: ${data.imageUrl}`)
    } catch (error) {
      console.error(`[v0] Error generating image for scene ${scene.id}:`, error)
      
      updatedScenes.push({
        ...scene,
        image_url: `/placeholder.svg`,
      })
    }
  }

  return updatedScenes
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
