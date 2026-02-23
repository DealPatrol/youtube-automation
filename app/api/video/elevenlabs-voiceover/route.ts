import { NextResponse } from 'next/server'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1'

export async function POST(request: Request) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      )
    }

    const { text, voiceId = 'EXAVITQu4vr4xnSDxMaL', language = 'en' } = await request.json()

    if (!text) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      )
    }

    console.log('[ElevenLabs] Generating voiceover for text length:', text.length)

    const response = await fetch(`${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[ElevenLabs] API error:', error)
      return NextResponse.json(
        { error: `ElevenLabs API error: ${error}` },
        { status: response.status }
      )
    }

    const audioBuffer = await response.arrayBuffer()

    // Return audio as base64 or URL (depending on your storage setup)
    const audioBase64 = Buffer.from(audioBuffer).toString('base64')

    return NextResponse.json({
      audio: `data:audio/mpeg;base64,${audioBase64}`,
      duration: Math.ceil(text.split(' ').length / 150), // Rough estimate: ~150 words per minute
    })
  } catch (error) {
    console.error('[API] Voiceover error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Voiceover generation failed' },
      { status: 500 }
    )
  }
}
