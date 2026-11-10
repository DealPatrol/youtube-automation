import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { MediaInputError, synthesizeVoiceover } from '@/lib/media/voiceover'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  try {
    const body = await request.json()
    const output = await synthesizeVoiceover({
      narration: body?.narration,
      sceneId: body?.sceneId,
      resultId: body?.resultId,
      voice: body?.voice,
      voiceProvider: body?.voiceProvider,
      voiceId: body?.voiceId,
      voiceInstructions: body?.voiceInstructions,
    })
    return NextResponse.json({ success: true, ...output })
  } catch (error) {
    console.error('[Audio API] Error:', error instanceof Error ? error.message : error)
    const status = error instanceof MediaInputError ? error.status : 500
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate audio' },
      { status }
    )
  }
}
