import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateSceneVideos, generateSceneImages } from '@/lib/video/video-generator'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: Request) {
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

    if (scenes.length === 0) {
      console.error('[API] No scenes available')
      return NextResponse.json(
        { error: 'No scenes available for video generation' },
        { status: 400 }
      )
    }

    // Update status to rendering
    await supabase
      .from('results')
      .update({ processing_status: 'rendering' })
      .eq('id', resultId)

    console.log('[API] Generating video clips for scenes...')

    // Generate actual video clips for all scenes (falls back to images if needed)
    const scenesWithVideos = await generateSceneVideos(scenes)

    console.log('[API] Video clips generated, updating database...')

    // Update result with scene videos
    const { error: updateError } = await supabase
      .from('results')
      .update({
        scenes: scenesWithVideos,
        processing_status: 'completed',
      })
      .eq('id', resultId)

    if (updateError) {
      console.error('[API] Failed to update scenes:', updateError)
      throw updateError
    }

    console.log('[API] Video generation complete')

    return NextResponse.json({
      success: true,
      message: 'Scene videos generated successfully',
      resultId,
      sceneCount: scenesWithVideos.length,
      status: 'completed',
    })
  } catch (error) {
    console.error('[API] Video render error:', error)

    // Update status to error
    try {
      const resultId = (await request.json()).resultId; // Declare resultId here
      await supabase
        .from('results')
        .update({
          processing_status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', resultId)
    } catch (updateError) {
      console.error('[API] Failed to update error status:', updateError)
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to render video' },
      { status: 500 }
    )
  }
}
