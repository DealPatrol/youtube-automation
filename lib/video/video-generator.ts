/**
 * Video Generation Service
 * Handles video creation using AI-generated images for scenes
 */

export interface VideoScene {
  id: number
  title: string
  visual_description: string
  on_screen_text: string
  start_time?: string
  end_time?: string
  image_url?: string
}

export interface VideoGenerationOptions {
  resultId: string
  scenes: VideoScene[]
  script: any
  duration?: number
}

/**
 * Generate images for each scene using AI
 */
export async function generateSceneImages(scenes: VideoScene[]): Promise<VideoScene[]> {
  const updatedScenes = []

  for (const scene of scenes) {
    try {
      console.log(`[v0] Generating image for scene ${scene.id}: ${scene.title}`)
      
      // Use fal.ai to generate scene images
      const response = await fetch('/api/generate-image', {
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
      
      // Use placeholder if generation fails
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
