import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateSceneVideos, generateSceneImages, generateSceneAudio } from '@/lib/video/video-generator'
import { inferVideoAspectRatio } from '@/lib/video/format'

export const runtime = 'nodejs'
export const maxDuration = 300

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let supabase: any = null

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey)
  } catch (error) {
    console.warn('[API] Failed to initialize Supabase:', error)
  }
} else {
  console.warn('[API] Supabase credentials not configured')
}

export async function POST(request: Request) {
  let resultId: string | undefined
  try {
    const {
      resultId: requestResultId,
      mode = 'images',
      voice,
      voiceProvider,
      voiceId,
      aspectRatio: requestedAspectRatio,
    } = await request.json()
    resultId = requestResultId

    if (!resultId) {
      return NextResponse.json(
        { error: 'Missing resultId' },
        { status: 400 }
      )
    }

    console.log('[API] Rendering video for result:', resultId, 'Mode:', mode)

    let result: any = null

    // Try to fetch from Supabase if available
    if (supabase) {
      try {
        const { data, error: dbError } = await supabase
          .from('results')
          .select('*, projects(video_length_minutes, youtube_clip_duration, tiktok_clip_duration, platform)')
          .eq('id', resultId)
          .single()

        if (!dbError && data) {
          result = data
        }
      } catch (supabaseErr) {
        console.warn('[API] Supabase fetch failed, checking demo mode')
      }
    }

    // Fallback to demo mode (stored globally)
    if (!result && typeof globalThis !== 'undefined' && globalThis.demoResults) {
      result = globalThis.demoResults[resultId]
      console.log('[API] Using demo mode result')
    }

    if (!result) {
      console.error('[API] Result not found:', resultId)
      return NextResponse.json(
        { error: 'Result not found. Please generate a video first.' },
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

    const project = Array.isArray(result.projects) ? result.projects[0] : result.projects
    const aspectRatio = inferVideoAspectRatio(requestedAspectRatio, project?.video_length_minutes)
    const configuredDuration =
      project?.platform === 'tiktok'
        ? project?.tiktok_clip_duration
        : project?.youtube_clip_duration
    const clipDuration = Number(configuredDuration) > 0 ? Number(configuredDuration) : 5
    const baseUrl = new URL(request.url).origin

    // Update status to rendering
    if (supabase) {
      await supabase
        .from('results')
        .update({ processing_status: 'rendering' })
        .eq('id', resultId)
    }

    let scenesWithContent
    let successMessage

    if (mode === 'videos') {
      console.log(`[API] Generating ${clipDuration}s AI video clips for scenes (Kling Video)...`)
      scenesWithContent = await generateSceneVideos(scenes, clipDuration, { baseUrl, aspectRatio })
      successMessage = `AI video clips (${clipDuration}s each) generated successfully`
    } else {
      console.log('[API] Generating static images for scenes (faster)...')
      scenesWithContent = await generateSceneImages(scenes, { baseUrl, aspectRatio })
      successMessage = 'Scene images generated successfully'
    }

    // Generate AI voiceover for all scenes
    console.log('[API] Generating AI voiceover for scenes...')
    scenesWithContent = await generateSceneAudio(scenesWithContent, {
      provider: voiceProvider,
      voice,
      voiceId,
      baseUrl,
      aspectRatio,
    })
    console.log('[API] Voiceover generation complete')

    console.log('[API] Generation complete, updating database...')

    // Update result with scene content
    const { error: updateError } = supabase
      ? await supabase
          .from('results')
          .update({
            scenes: scenesWithContent,
            processing_status: 'completed',
          })
          .eq('id', resultId)
      : { error: null }

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
      if (resultId && supabase) {
        await supabase
          .from('results')
          .update({
            processing_status: 'error',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', resultId)
      }
    } catch (updateError) {
      console.error('[API] Failed to update error status:', updateError)
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to render video' },
      { status: 500 }
    )
  }
}
