import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import VideoProcessor from '@/lib/video/video-processor'
import * as path from 'path'
import * as fs from 'fs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: Request) {
  let processor: VideoProcessor | null = null

  try {
    const { resultId } = await request.json()

    if (!resultId) {
      return NextResponse.json(
        { error: 'Missing resultId' },
        { status: 400 }
      )
    }

    console.log('[API] Rendering video for result:', resultId)

    // Fetch result data from Supabase
    const { data: result, error: dbError } = await supabase
      .from('results')
      .select('*')
      .eq('id', resultId)
      .single()

    if (dbError) {
      console.error('[API] Database error:', dbError)
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      )
    }

    if (!result) {
      console.error('[API] Result not found:', resultId)
      return NextResponse.json(
        { error: 'Result not found' },
        { status: 404 }
      )
    }

    console.log('[API] Result found, scenes:', result.scenes?.length || 0)

    const scenes = result.scenes || []
    const scriptSections = result.script?.sections || []

    if (scenes.length === 0) {
      console.error('[API] No scenes available')
      return NextResponse.json(
        { error: 'No scenes available for video generation' },
        { status: 400 }
      )
    }

    console.log('[API] Initializing video processor...')
    
    // Initialize video processor
    processor = new VideoProcessor()
    
    try {
      await processor.initialize()
      console.log('[API] Video processor initialized successfully')
    } catch (initError) {
      console.error('[API] Failed to initialize processor:', initError)
      throw new Error(`Video processor initialization failed: ${initError instanceof Error ? initError.message : 'Unknown error'}`)
    }

    // Create output video path
    const outputDir = path.join(process.cwd(), 'public', 'videos')
    if (!fs.existsSync(outputDir)) {
      console.log('[API] Creating output directory:', outputDir)
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const videoFileName = `video_${resultId}_${Date.now()}.mp4`
    const videoPath = path.join(outputDir, videoFileName)

    console.log('[API] Output path:', videoPath)
    console.log('[API] Starting video composition with', scenes.length, 'scenes...')

    // Create video from scenes
    await processor.createVideoFromScenes(scenes, scriptSections, videoPath)

    console.log('[API] Video created successfully:', videoPath)
    
    // Verify file exists
    if (!fs.existsSync(videoPath)) {
      throw new Error('Video file was not created')
    }
    
    const stats = fs.statSync(videoPath)
    console.log('[API] Video file size:', stats.size, 'bytes')

    // Update result with video URL
    const videoUrl = `/videos/${videoFileName}`
    const { error: updateError } = await supabase
      .from('results')
      .update({
        video_url: videoUrl,
        video_status: 'completed',
      })
      .eq('id', resultId)

    if (updateError) {
      console.error('[API] Failed to update result:', updateError)
    }

    return NextResponse.json({
      success: true,
      message: 'Video rendered successfully',
      resultId,
      videoUrl,
      status: 'completed',
    })
  } catch (error) {
    console.error('[API] Video render error:', error)

    // Cleanup on error
    if (processor) {
      try {
        await processor.cleanup()
      } catch (cleanupError) {
        console.error('[API] Cleanup error:', cleanupError)
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to render video' },
      { status: 500 }
    )
  }
}
