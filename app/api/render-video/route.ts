import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateSceneVideos, generateSceneImages, generateSceneAudio } from '@/lib/video/video-generator'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: Request) {
  try {
    const { resultId, mode = 'images' } = await request.json()

    if (!resultId) {
      return NextResponse.json(
        { error: 'Missing resultId' },
        { status: 400 }
      )
    }

    console.log('[API] Rendering video for result:', resultId, 'Mode:', mode)

    // Fetch result data from Supabase
    const { data: result, error: dbError } = await supabase
      .from('results')
      .select('*, projects(user_id)')
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

    // Fetch project to get clip duration
    const { data: project } = await supabase
      .from('projects')
      .select('clip_duration_seconds')
      .eq('id', result.project_id)
      .single()

    const clipDuration = project?.clip_duration_seconds || 5

    // Update status to rendering
    await supabase
      .from('results')
      .update({ processing_status: 'rendering' })
      .eq('id', resultId)

    let scenesWithContent
    let successMessage

    if (mode === 'videos') {
      console.log(`[API] Generating ${clipDuration}s AI video clips for scenes (Kling Video)...`)
      scenesWithContent = await generateSceneVideos(scenes, clipDuration)
      successMessage = `AI video clips (${clipDuration}s each) generated successfully`
    } else {
      console.log('[API] Generating static images for scenes (faster)...')
      scenesWithContent = await generateSceneImages(scenes)
      successMessage = 'Scene images generated successfully'
    }

    // Generate AI voiceover for all scenes
    console.log('[API] Generating AI voiceover for scenes...')
    scenesWithContent = await generateSceneAudio(scenesWithContent)
    console.log('[API] Voiceover generation complete')

    console.log('[API] Generation complete, updating database...')

    // Update result with scene content
    const { error: updateError } = await supabase
      .from('results')
      .update({
        scenes: scenesWithContent,
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
      message: successMessage,
      resultId,
      sceneCount: scenesWithContent.length,
      mode,
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
