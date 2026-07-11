import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { probeMediaDuration } from '@/lib/video/ffmpeg'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || 'videos'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  let tempDir: string | null = null
  try {
    const {
      narration,
      sceneId,
      resultId,
      voice = 'alloy',
      voiceProvider,
      voiceId,
      voiceInstructions,
    } = await request.json()

    if (!narration?.trim()) {
      return NextResponse.json(
        { error: 'Missing narration text' },
        { status: 400 }
      )
    }
    if (narration.length > 8000) {
      return NextResponse.json({ error: 'Narration is too long for one scene' }, { status: 400 })
    }

    console.log(`[Audio API] Generating voiceover for scene ${sceneId || 'unknown'}`)

    let audioBuffer: ArrayBuffer

    const useElevenLabs = Boolean(
      ELEVENLABS_API_KEY && (voiceProvider === 'elevenlabs' || voiceId)
    )

    if (useElevenLabs) {
      console.log('[Audio API] Using ElevenLabs TTS')
      const selectedVoiceId = voiceId || ELEVENLABS_VOICE_ID
      const elevenLabsKey = ELEVENLABS_API_KEY as string
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: narration,
          model_id: ELEVENLABS_MODEL_ID,
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.75,
            style: voiceInstructions ? 0.35 : 0,
            use_speaker_boost: true,
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
          model: OPENAI_TTS_MODEL,
          input: narration,
          voice,
          instructions: voiceInstructions || 'Speak naturally, clearly, and conversationally.',
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

    const buffer = Buffer.from(audioBuffer)
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'voiceover-'))
    const audioPath = path.join(tempDir, `scene-${sceneId || 'unknown'}.mp3`)
    await fs.promises.writeFile(audioPath, buffer)
    const duration = await probeMediaDuration(audioPath)

    let audioUrl: string
    if (supabaseUrl && supabaseKey && resultId) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const safeSceneId = String(sceneId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '')
      const storagePath = `results/${resultId}/audio/scene-${safeSceneId}-${Date.now()}.mp3`
      const { error: uploadError } = await supabase.storage
        .from(storageBucket)
        .upload(storagePath, buffer, {
          contentType: 'audio/mpeg',
          upsert: true,
        })
      if (uploadError) {
        throw new Error(`Could not store generated voiceover: ${uploadError.message}`)
      }
      audioUrl = supabase.storage.from(storageBucket).getPublicUrl(storagePath).data.publicUrl
    } else {
      audioUrl = `data:audio/mp3;base64,${buffer.toString('base64')}`
    }

    console.log(`[Audio API] Voiceover generated for scene ${sceneId}, size: ${audioBuffer.byteLength} bytes`)

    return NextResponse.json({
      success: true,
      audioUrl,
      sceneId,
      duration,
    })
  } catch (error) {
    console.error('[Audio API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate audio' },
      { status: 500 }
    )
  } finally {
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    }
  }
}
