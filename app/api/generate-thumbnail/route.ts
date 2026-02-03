import { NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

const FAL_KEY = process.env.FAL_KEY

if (FAL_KEY) {
  fal.config({
    credentials: FAL_KEY,
  })
}

interface ThumbnailRequest {
  text: string
  imagePrompt: string
  emotion?: string
}

export async function POST(request: Request) {
  try {
    const { text, imagePrompt, emotion }: ThumbnailRequest = await request.json()

    if (!imagePrompt) {
      return NextResponse.json(
        { error: 'Missing imagePrompt' },
        { status: 400 }
      )
    }

    if (!FAL_KEY) {
      console.error('[API] FAL_KEY not configured')
      return NextResponse.json(
        { error: 'Thumbnail generation not configured. Please add FAL_KEY to environment variables.' },
        { status: 500 }
      )
    }

    console.log('[API] Generating YouTube thumbnail:', imagePrompt.substring(0, 100))

    // Enhanced prompt for YouTube thumbnail style
    const thumbnailPrompt = `YouTube thumbnail style image: ${imagePrompt}. 
High quality, vibrant colors, attention-grabbing composition, professional lighting.
${emotion ? `Emotion: ${emotion}.` : ''}
16:9 aspect ratio, bold visual elements, clear focus point.
${text ? `Text overlay will read: "${text}"` : ''}`

    // Use fal.ai Flux for high-quality thumbnail generation
    const result = await fal.subscribe('fal-ai/flux/dev', {
      input: {
        prompt: thumbnailPrompt,
        image_size: {
          width: 1280,
          height: 720,
        },
        num_images: 1,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          update.logs?.map((log) => log.message).forEach((msg) => {
            console.log(`[API] Thumbnail generation: ${msg}`)
          })
        }
      },
    })

    if (!result.data || !result.data.images || result.data.images.length === 0) {
      throw new Error('No thumbnail image returned from fal.ai')
    }

    const thumbnailUrl = result.data.images[0].url

    console.log('[API] Thumbnail generated:', thumbnailUrl)

    return NextResponse.json({
      success: true,
      thumbnailUrl,
      text,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[API] Thumbnail generation error:', errorMessage)

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
