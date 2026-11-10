import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { generateVideoClip } from '@/lib/media/fal-media'
import { MediaInputError } from '@/lib/media/voiceover'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  try {
    const { prompt, sceneId, duration = 5, aspectRatio = '16:9' } = await request.json()
    const output = await generateVideoClip({ prompt, duration, aspectRatio })
    return NextResponse.json({ success: true, ...output, sceneId })
  } catch (error) {
    console.error('[API] Video generation error:', error instanceof Error ? error.message : error)
    const status = error instanceof MediaInputError ? error.status : 500
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate video' },
      { status }
    )
  }
}
