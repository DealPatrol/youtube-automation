import * as fs from 'fs'

import { probeMediaDuration } from '@/lib/video/ffmpeg'
import { buildVoiceDirection } from '@/lib/content/generation'
import type { RightsRecord } from './types'

/**
 * Stage 4 — TTS narration. ElevenLabs when configured, otherwise OpenAI TTS.
 * Returns the measured audio duration so captions and render timings stay in sync.
 */

export interface NarrationResult {
  file: string
  duration: number
  rights: RightsRecord
}

async function synthesizeWithElevenLabs(text: string): Promise<{ buffer: Buffer; model: string; provider: string } | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  if (!apiKey) return null
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
  const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.4, similarity_boost: 0.75, use_speaker_boost: true },
    }),
  })
  if (!response.ok) {
    throw new Error(`ElevenLabs TTS failed: ${response.status} ${await response.text()}`)
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    model: modelId,
    provider: 'elevenlabs',
  }
}

async function synthesizeWithOpenAI(
  text: string,
  voiceInstructions: string
): Promise<{ buffer: Buffer; model: string; provider: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('No TTS provider configured. Set ELEVENLABS_API_KEY or OPENAI_API_KEY')
  }
  const model = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts'
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
      voice: process.env.OPENAI_TTS_VOICE || 'alloy',
      instructions: voiceInstructions,
      response_format: 'mp3',
    }),
  })
  if (!response.ok) {
    throw new Error(`OpenAI TTS failed: ${response.status} ${await response.text()}`)
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    model,
    provider: 'openai-tts',
  }
}

export async function synthesizeNarration(options: {
  assetId: string
  narration: string
  tone: string
  platform: string
  outFile: string
}): Promise<NarrationResult> {
  const { assetId, narration, tone, platform, outFile } = options
  const voiceInstructions = buildVoiceDirection(tone, platform)

  const result =
    (await synthesizeWithElevenLabs(narration).catch((error) => {
      console.warn('[tts] ElevenLabs failed, falling back to OpenAI:', error.message)
      return null
    })) || (await synthesizeWithOpenAI(narration, voiceInstructions))

  await fs.promises.writeFile(outFile, result.buffer)
  const duration = await probeMediaDuration(outFile)

  return {
    file: outFile,
    duration,
    rights: {
      assetId,
      file: outFile,
      type: 'audio',
      provider: result.provider,
      license:
        result.provider === 'elevenlabs'
          ? 'AI-generated voice (ElevenLabs commercial terms)'
          : 'AI-generated voice (OpenAI usage terms)',
      licenseUrl:
        result.provider === 'elevenlabs'
          ? 'https://elevenlabs.io/terms-of-use'
          : 'https://openai.com/policies/terms-of-use/',
      prompt: narration.slice(0, 200),
      model: result.model,
      generatedByAI: true,
      retrievedAt: new Date().toISOString(),
    },
  }
}
