import { NextResponse } from 'next/server'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'

export async function POST(request: Request) {
  try {
    const { narration, sceneId, voice = 'alloy', voiceProvider, voiceId } = await request.json()

    if (!narration) {
      return NextResponse.json(
        { error: 'Missing narration text' },
        { status: 400 }
      )
    }

    console.log(`[Audio API] Generating voiceover for scene ${sceneId || 'unknown'}`)

    let audioBuffer: ArrayBuffer

    const useElevenLabs = Boolean(
      ELEVENLABS_API_KEY && (voiceProvider === 'elevenlabs' || voiceId)
    )

    if (useElevenLabs) {
      console.log('[Audio API] Using ElevenLabs TTS')
      const selectedVoiceId = voiceId || ELEVENLABS_VOICE_ID
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: narration,
          model_id: ELEVENLABS_MODEL_ID,
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.75,
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Audio API] ElevenLabs error:', errorText)
        throw new Error(`ElevenLabs TTS failed: ${response.status}`)
      }

      audioBuffer = await response.arrayBuffer()
    } else {
      if (!OPENAI_API_KEY) {
        console.error('[Audio API] OPENAI_API_KEY not configured')
        return NextResponse.json(
          { error: 'OpenAI API key not configured' },
          { status: 500 }
        )
      }

      console.log('[Audio API] Using OpenAI TTS')
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
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

      audioBuffer = await response.arrayBuffer()
    }

    // Get the audio as a buffer
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
