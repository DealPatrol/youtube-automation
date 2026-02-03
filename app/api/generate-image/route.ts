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
    const { prompt, aspectRatio = '16:9' } = await request.json()

    if (!prompt) {
      return NextResponse.json(
        { error: 'Missing prompt' },
        { status: 400 }
      )
    }

    if (!FAL_KEY) {
      console.error('[API] FAL_KEY not configured')
      return NextResponse.json(
        { error: 'Image generation not configured. Please add FAL_KEY to environment variables.' },
        { status: 500 }
      )
    }

    console.log('[API] Generating image for prompt:', prompt.substring(0, 100))

    // Map aspect ratios to fal.ai image sizes
    const imageSizeMap: Record<string, string> = {
      '16:9': 'landscape_16_9',
      '4:3': 'landscape_4_3',
      '1:1': 'square',
      '9:16': 'portrait_16_9',
    }

    const imageSize = imageSizeMap[aspectRatio] || 'landscape_16_9'

    // Use fal.subscribe for image generation with progress tracking
    const result = await fal.subscribe('fal-ai/flux/dev', {
      input: {
        prompt: `${prompt}, cinematic, high quality, 4k, professional video production`,
        image_size: imageSize,
        num_images: 1,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          update.logs?.map((log) => log.message).forEach((msg) => {
            console.log(`[API] Generation progress: ${msg}`)
          })
        }
      },
    })

    const imageUrl = result.data?.images?.[0]?.url

    if (!imageUrl) {
      throw new Error('No image URL in response')
    }

    console.log('[API] Image generated successfully:', imageUrl)

    return NextResponse.json({
      success: true,
      imageUrl,
      requestId: result.requestId,
    })
  } catch (error) {
    console.error('[API] Image generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    )
  }
}
