import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/session'
import { getResultWithProject, updateResult } from '@/lib/db/records'
import { generateSceneVideos, generateSceneImages, generateSceneAudio } from '@/lib/video/video-generator'
import { inferVideoAspectRatio } from '@/lib/video/format'
import { buildVoiceDirection } from '@/lib/content/generation'

export const runtime = 'nodejs'
export const maxDuration = 300

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
    const userId = await getSessionUserId()

    if (userId && process.env.DATABASE_URL) {
      try {
        result = await getResultWithProject(resultId, userId)
      } catch (dbError) {
        console.warn('[API] Database fetch failed, checking demo mode', dbError)
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
    const aspectRatio = inferVideoAspectRatio(
      requestedAspectRatio,
      project?.video_length_minutes,
      project?.platform
    )
    const configuredDuration =
      project?.platform === 'tiktok'
        ? project?.tiktok_clip_duration
        : project?.youtube_clip_duration
    const clipDuration = Number(configuredDuration) > 0 ? Number(configuredDuration) : 5
    const baseUrl = new URL(request.url).origin

    if (userId) {
      await updateResult(resultId, { processing_status: 'rendering' }, userId)
    }

    let scenesWithContent
    let successMessage

    if (mode === 'videos') {
      const configuredMax = Number(process.env.MAX_AI_VIDEO_SCENES || 8)
      const maxVideoScenes = Number.isFinite(configuredMax)
        ? Math.max(1, Math.min(scenes.length, Math.floor(configuredMax)))
        : Math.min(scenes.length, 8)
      const selectedIndexes = new Set<number>()
      for (let index = 0; index < maxVideoScenes; index += 1) {
        selectedIndexes.add(
          maxVideoScenes === 1
            ? 0
            : Math.round((index * (scenes.length - 1)) / (maxVideoScenes - 1))
        )
      }
      const videoScenes = scenes.filter((_: unknown, index: number) => selectedIndexes.has(index))
      const imageScenes = scenes.filter((_: unknown, index: number) => !selectedIndexes.has(index))

      console.log(
        `[API] Generating ${videoScenes.length} AI motion clips and ${imageScenes.length} supporting images`
      )
      const [generatedVideos, generatedImages] = await Promise.all([
        generateSceneVideos(videoScenes, clipDuration, { baseUrl, aspectRatio }),
        generateSceneImages(imageScenes, { baseUrl, aspectRatio }),
      ])
      const generatedById = new Map(
        [...generatedVideos, ...generatedImages].map((scene) => [scene.id, scene])
      )
      scenesWithContent = scenes.map((scene: { id: number }) => generatedById.get(scene.id))
      if (scenesWithContent.some((scene: unknown) => !scene)) {
        throw new Error('One or more generated scenes could not be matched to the script')
      }
      successMessage = `Hybrid render created ${videoScenes.length} motion clips and ${imageScenes.length} images`
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
      resultId,
      voiceInstructions: buildVoiceDirection(project?.tone, project?.platform),
    })
    console.log('[API] Voiceover generation complete')

    console.log('[API] Generation complete, updating database...')

    if (userId) {
      const updated = await updateResult(resultId, {
        scenes: scenesWithContent,
        processing_status: 'completed',
      }, userId)
      if (!updated) {
        throw new Error('Failed to update scenes')
      }
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
      if (resultId) {
        const userId = await getSessionUserId()
        if (userId) {
          await updateResult(resultId, {
            processing_status: 'error',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          }, userId)
        }
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
