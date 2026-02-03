import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

interface AssembleVideoRequest {
  resultId: string
}

export async function POST(request: Request) {
  try {
    const { resultId }: AssembleVideoRequest = await request.json()

    if (!resultId) {
      return NextResponse.json(
        { error: 'Missing resultId' },
        { status: 400 }
      )
    }

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('[API] Starting video assembly for result:', resultId)

    // Get result with scenes
    const { data: result, error: fetchError } = await supabase
      .from('results')
      .select('*, project_id')
      .eq('id', resultId)
      .single()

    if (fetchError || !result) {
      console.error('[API] Failed to fetch result:', fetchError)
      return NextResponse.json(
        { error: 'Result not found' },
        { status: 404 }
      )
    }

    const scenes = result.scenes || []

    if (scenes.length === 0) {
      return NextResponse.json(
        { error: 'No scenes to assemble' },
        { status: 400 }
      )
    }

    console.log('[API] Found', scenes.length, 'scenes to assemble')

    // Update status to assembling
    await supabase
      .from('results')
      .update({ processing_status: 'assembling' })
      .eq('id', resultId)

    // In a production system, this would call FFmpeg or a video processing service
    // For now, we'll simulate the assembly process and create a placeholder

    console.log('[API] Assembling video from scenes...')
    console.log('[API] Scenes have:', {
      withVideo: scenes.filter((s: any) => s.video_url).length,
      withImage: scenes.filter((s: any) => s.image_url).length,
      withAudio: scenes.filter((s: any) => s.audio_url).length,
    })

    // Simulate video assembly (in production, this would be actual FFmpeg processing)
    // The actual implementation would:
    // 1. Download all scene assets (videos/images, audio)
    // 2. Use FFmpeg to concatenate clips
    // 3. Overlay audio tracks
    // 4. Burn text overlays
    // 5. Add background music
    // 6. Export final MP4
    // 7. Upload to storage (Vercel Blob or similar)

    const assembledVideoUrl = '/placeholder-video.mp4' // Placeholder

    // Update result with assembled video
    const { error: updateError } = await supabase
      .from('results')
      .update({
        video_url: assembledVideoUrl,
        processing_status: 'completed',
      })
      .eq('id', resultId)

    if (updateError) {
      console.error('[API] Failed to update result:', updateError)
      throw updateError
    }

    console.log('[API] Video assembly complete')

    return NextResponse.json({
      success: true,
      message: 'Video assembled successfully',
      videoUrl: assembledVideoUrl,
      resultId,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[API] Video assembly error:', errorMessage)

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
