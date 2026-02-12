import { NextResponse } from 'next/server'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

export async function POST(request: Request) {
  try {
    const { narration, sceneId, voice = 'alloy' } = await request.json()

    if (!narration) {
      return NextResponse.json(
        { error: 'Missing narration text' },
        { status: 400 }
      )
    }

    if (!OPENAI_API_KEY) {
      console.error('[Audio API] OPENAI_API_KEY not configured')
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    console.log(`[Audio API] Generating voiceover for scene ${sceneId || 'unknown'}`)

    // Call OpenAI TTS API
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: narration,
        voice: voice, // Options: alloy, echo, fable, onyx, nova, shimmer
        response_format: 'mp3',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Audio API] OpenAI TTS error:', errorText)
      throw new Error(`OpenAI TTS failed: ${response.status}`)
    }

    // Get the audio as a buffer
    const audioBuffer = await response.arrayBuffer()
    const audioBase64 = Buffer.from(audioBuffer).toString('base64')
    const audioDataUrl = `data:audio/mp3;base64,${audioBase64}`

    console.log(`[Audio API] Voiceover generated for scene ${sceneId}, size: ${audioBuffer.byteLength} bytes`)

    return NextResponse.json({
      success: true,
      audioUrl: audioDataUrl,
      sceneId,
      duration: Math.floor(narration.split(' ').length / 2.5), // Approximate duration in seconds
    })
  } catch (error) {
    console.error('[Audio API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate audio' },
      { status: 500 }
    )
  }
}
