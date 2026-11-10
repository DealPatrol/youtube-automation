import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { probeMediaDuration } from '@/lib/video/ffmpeg'
import { blobConfigured, uploadBlob } from '@/lib/storage/blob'

export interface VoiceoverInput {
  narration: string
  sceneId?: string | number
  resultId?: string
  voice?: string
  voiceProvider?: string
  voiceId?: string
  voiceInstructions?: string
}

export interface VoiceoverOutput {
  audioUrl: string
  duration: number
  sceneId?: string | number
}

export class MediaInputError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export const MAX_SCENE_NARRATION_CHARS = 8000

/**
 * Synthesize one scene's narration. OpenAI gpt-4o-mini-tts is the low-cost
 * default; ElevenLabs is used only when explicitly requested and configured.
 * The measured audio duration is returned so the renderer can time visuals to
 * the actual voiceover.
 */
export async function synthesizeVoiceover(input: VoiceoverInput): Promise<VoiceoverOutput> {
  const narration = typeof input.narration === 'string' ? input.narration.trim() : ''
  if (!narration) throw new MediaInputError('Missing narration text')
  if (narration.length > MAX_SCENE_NARRATION_CHARS) {
    throw new MediaInputError('Narration is too long for one scene')
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim()
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY?.trim()
  const elevenLabsVoiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
  const elevenLabsModelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'
  const openAiTtsModel = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts'

  let audioBuffer: ArrayBuffer
  const useElevenLabs = Boolean(
    elevenLabsKey && (input.voiceProvider === 'elevenlabs' || input.voiceId)
  )

  if (useElevenLabs) {
    const selectedVoiceId = input.voiceId || elevenLabsVoiceId
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(selectedVoiceId)}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsKey as string,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: narration,
          model_id: elevenLabsModelId,
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.75,
            style: input.voiceInstructions ? 0.35 : 0,
            use_speaker_boost: true,
          },
        }),
      }
    )
    if (!response.ok) {
      console.error('[voiceover] ElevenLabs error status', response.status)
      throw new Error(`ElevenLabs TTS failed: ${response.status}`)
    }
    audioBuffer = await response.arrayBuffer()
  } else {
    if (!openAiKey) {
      throw new MediaInputError('OpenAI API key not configured', 500)
    }
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: openAiTtsModel,
        input: narration,
        voice: input.voice || 'alloy',
        instructions:
          input.voiceInstructions || 'Speak naturally, clearly, and conversationally.',
        response_format: 'mp3',
      }),
    })
    if (!response.ok) {
      console.error('[voiceover] OpenAI TTS error status', response.status)
      throw new Error(`OpenAI TTS failed: ${response.status}`)
    }
    audioBuffer = await response.arrayBuffer()
  }

  const buffer = Buffer.from(audioBuffer)
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'voiceover-'))
  try {
    const safeSceneId = String(input.sceneId ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g, '')
    const audioPath = path.join(tempDir, `scene-${safeSceneId}.mp3`)
    await fs.promises.writeFile(audioPath, buffer)
    const duration = await probeMediaDuration(audioPath)

    let audioUrl: string
    if (blobConfigured() && input.resultId) {
      const storagePath = `results/${input.resultId}/audio/scene-${safeSceneId}-${Date.now()}.mp3`
      try {
        audioUrl = await uploadBlob(storagePath, buffer, 'audio/mpeg')
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : 'Blob upload failed'
        throw new Error(`Could not store generated voiceover: ${message}`)
      }
    } else {
      audioUrl = `data:audio/mp3;base64,${buffer.toString('base64')}`
    }

    return { audioUrl, duration, sceneId: input.sceneId }
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true })
  }
}
