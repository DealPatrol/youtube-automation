import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { prompt, aspectRatio = '16:9' } = await request.json()

    if (!prompt) {
      return NextResponse.json(
        { error: 'Missing prompt' },
        { status: 400 }
      )
    }

    console.log('[API] Generating image for prompt:', prompt.substring(0, 100))

    // Use fal.ai for image generation
    const falApiKey = process.env.FAL_KEY
    
    if (!falApiKey) {
      console.error('[API] FAL_KEY not configured')
      return NextResponse.json(
        { error: 'Image generation not configured. Please add FAL_KEY to environment variables.' },
        { status: 500 }
      )
    }

    const response = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: `${prompt}, cinematic, high quality, 4k, professional video production`,
        image_size: aspectRatio === '16:9' ? 'landscape_16_9' : 'landscape_4_3',
        num_inference_steps: 4,
        num_images: 1,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[API] fal.ai error:', errorText)
      throw new Error(`Image generation failed: ${errorText}`)
    }

    const data = await response.json()
    const imageUrl = data.images?.[0]?.url

    if (!imageUrl) {
      throw new Error('No image URL in response')
    }

    console.log('[API] Image generated successfully')

    return NextResponse.json({
      success: true,
      imageUrl,
    })
  } catch (error) {
    console.error('[API] Image generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    )
  }
}
