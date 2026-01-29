import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'

const execPromise = promisify(exec)

interface Scene {
  id: number
  title: string
  start_time: string
  end_time: string
  visual_description: string
  on_screen_text?: string
}

interface ScriptSection {
  time: string
  speaker: string
  text: string
}

export class VideoProcessor {
  private tempDir: string

  constructor() {
    this.tempDir = path.join(process.cwd(), 'tmp', `video-${Date.now()}`)
  }

  async initialize() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }
  }

  async cleanup() {
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true })
    }
  }

  async fetchImage(searchTerm: string): Promise<string> {
    try {
      // Use Unsplash API for free stock images
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchTerm)}&client_id=${process.env.UNSPLASH_ACCESS_KEY}&per_page=1`
      )
      const data = (await response.json()) as any

      if (data.results && data.results.length > 0) {
        const imageUrl = data.results[0].urls.regular
        const imagePath = path.join(this.tempDir, `scene_${Date.now()}.jpg`)
        
        const imageResponse = await fetch(imageUrl)
        const buffer = await imageResponse.buffer()
        fs.writeFileSync(imagePath, buffer)
        
        return imagePath
      }
    } catch (error) {
      console.error('Failed to fetch image:', error)
    }

    // Fallback: create a placeholder image
    return this.createPlaceholderImage()
  }

  async createPlaceholderImage(): Promise<string> {
    const imagePath = path.join(this.tempDir, `placeholder_${Date.now()}.jpg`)
    
    // Create a simple colored image using ffmpeg
    await execPromise(
      `ffmpeg -f lavfi -i color=c=0x1a1a1a:s=1920x1080:d=1 -q:v 5 ${imagePath}`
    )
    
    return imagePath
  }

  async generateVoiceover(text: string): Promise<string> {
    const audioPath = path.join(this.tempDir, `voiceover_${Date.now()}.mp3`)

    try {
      // Use Google Cloud Text-to-Speech or similar service
      // For now, we'll create a placeholder audio file
      await execPromise(
        `ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 3 -q:a 9 -acodec libmp3lame ${audioPath}`
      )
      return audioPath
    } catch (error) {
      console.error('Failed to generate voiceover:', error)
      throw error
    }
  }

  async addTextOverlay(
    imagePath: string,
    text: string,
    outputPath: string
  ): Promise<string> {
    const escapedText = text.replace(/'/g, "'\\''")
    
    try {
      await execPromise(
        `ffmpeg -i ${imagePath} -vf "drawtext=text='${escapedText}':fontsize=60:fontcolor=white:box=1:boxcolor=black@0.5:x=(w-text_w)/2:y=h-100:borderw=2" -q:v 5 ${outputPath}`
      )
      return outputPath
    } catch (error) {
      console.error('Failed to add text overlay:', error)
      return imagePath // Return original if overlay fails
    }
  }

  async parseTimestamp(timestamp: string): Promise<number> {
    const parts = timestamp.split(':').map(Number)
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1]
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
    return 0
  }

  async createVideoFromScenes(
    scenes: Scene[],
    sections: ScriptSection[],
    outputPath: string
  ): Promise<void> {
    const clips: { path: string; duration: number }[] = []

    for (const scene of scenes) {
      try {
        const startTime = await this.parseTimestamp(scene.start_time)
        const endTime = await this.parseTimestamp(scene.end_time)
        const duration = endTime - startTime

        // Fetch image for scene
        const imagePath = await this.fetchImage(scene.visual_description)

        // Add text overlay if available
        let finalImagePath = imagePath
        if (scene.on_screen_text) {
          const textImagePath = path.join(this.tempDir, `scene_text_${scene.id}.jpg`)
          finalImagePath = await this.addTextOverlay(imagePath, scene.on_screen_text, textImagePath)
        }

        clips.push({ path: finalImagePath, duration })
      } catch (error) {
        console.error(`Failed to process scene ${scene.id}:`, error)
      }
    }

    if (clips.length === 0) {
      throw new Error('No valid clips to create video')
    }

    // Create concat demuxer file
    const concatPath = path.join(this.tempDir, 'concat.txt')
    const concatContent = clips
      .map(clip => `file '${clip.path}'\nduration ${clip.duration}`)
      .join('\n')
    fs.writeFileSync(concatPath, concatContent)

    // Combine clips
    await execPromise(
      `ffmpeg -f concat -safe 0 -i ${concatPath} -c:v libx264 -pix_fmt yuv420p -c:a aac ${outputPath}`
    )
  }

  async exportMP4(inputPath: string, outputPath: string): Promise<void> {
    try {
      await execPromise(
        `ffmpeg -i ${inputPath} -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k ${outputPath}`
      )
    } catch (error) {
      console.error('Failed to export MP4:', error)
      throw error
    }
  }
}

export default VideoProcessor
