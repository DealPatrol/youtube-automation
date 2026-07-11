import { NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import { createClient } from '@supabase/supabase-js'

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
  aspectRatio?: '16:9' | '9:16'
  resultId?: string
}

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const {
      text,
      imagePrompt,
      emotion,
      aspectRatio = '16:9',
      resultId,
    }: ThumbnailRequest = await request.json()

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

    console.log('[API] Generating cover image:', imagePrompt.substring(0, 100))

    const vertical = aspectRatio === '9:16'
    const thumbnailPrompt = `${vertical ? 'Vertical social cover' : 'YouTube thumbnail'} style image: ${imagePrompt}. 
High quality, vibrant colors, attention-grabbing composition, professional lighting.
${emotion ? `Emotion: ${emotion}.` : ''}
${aspectRatio} aspect ratio, bold visual elements, clear focus point.
Do not draw letters or words. ${text ? `Leave uncluttered negative space for the later text overlay "${text}".` : ''}`

    // Use fal.ai Flux for high-quality thumbnail generation
    const result = await fal.subscribe('fal-ai/flux/dev', {
      input: {
        prompt: thumbnailPrompt,
        image_size: {
          width: vertical ? 720 : 1280,
          height: vertical ? 1280 : 720,
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (resultId && supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { error: updateError } = await supabase
        .from('results')
        .update({ thumbnail_url: thumbnailUrl })
        .eq('id', resultId)
      if (updateError) {
        console.warn('[API] Could not persist thumbnail URL:', updateError.message)
      }
    }

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
