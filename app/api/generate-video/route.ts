import { NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

// Configure fal client with API key
const FAL_KEY = process.env.FAL_KEY

if (FAL_KEY) {
  fal.config({
    credentials: FAL_KEY,
  })
}

export async function POST(request: Request) {
  try {
    const { prompt, sceneId, duration = 5 } = await request.json()

    if (!prompt) {
      return NextResponse.json(
        { error: 'Missing prompt' },
        { status: 400 }
      )
    }

    if (!FAL_KEY) {
      console.error('[API] FAL_KEY not configured')
      return NextResponse.json(
        { error: 'Video generation not configured. Please add FAL_KEY to environment variables.' },
        { status: 500 }
      )
    }

    console.log(`[API] Generating ${duration}s video for scene ${sceneId || 'unknown'}:`, prompt.substring(0, 100))

    // Use fal.subscribe for Kling Video generation with progress tracking
    const result = await fal.subscribe('fal-ai/kling-video/v2.6/pro/text-to-video', {
      input: {
        prompt: prompt,
        duration: duration,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          update.logs?.map((log) => log.message).forEach((msg) => {
            console.log(`[API] Video generation progress (scene ${sceneId}): ${msg}`)
          })
        }
      },
    })

    const videoUrl = result.data?.video?.url

    if (!videoUrl) {
      throw new Error('No video URL in response')
    }

    console.log(`[API] Video generated successfully for scene ${sceneId}:`, videoUrl)

    return NextResponse.json({
      success: true,
      videoUrl,
      thumbnailUrl: result.data?.thumbnail_url,
      requestId: result.requestId,
      sceneId,
    })
  } catch (error) {
    console.error('[API] Video generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate video' },
      { status: 500 }
    )
  }
}
