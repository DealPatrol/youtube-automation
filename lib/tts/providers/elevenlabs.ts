'use server';

import { ElevenLabsClient } from 'elevenlabs';
import type { TTSGenerationRequest, TTSGenerationResponse } from '../tts-service';
import { uploadAudioToStorage } from '../../storage/storage-service';

/**
 * ElevenLabs Text-to-Speech implementation
 * - Premium voice quality
 * - Multilingual support
 * - ~$5-15 per 1M characters depending on model
 */
export class ElevenLabsTTSProvider {
  private client: ElevenLabsClient;

  constructor() {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY environment variable not set');
    }

    this.client = new ElevenLabsClient({ apiKey });
  }

  /**
   * Generate audio using ElevenLabs
   */
  async generate(request: TTSGenerationRequest): Promise<TTSGenerationResponse> {
    try {
      console.log('[v0] ElevenLabs: generating audio for', request.text.length, 'characters');

      const voiceId = request.voiceId || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Bella voice
      const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

      // Generate audio using ElevenLabs
      const audioStream = await this.client.generate({
        voice: voiceId,
        text: request.text,
        model_id: modelId,
      });

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk);
      }

      const audioBuffer = Buffer.concat(chunks);

      // Calculate duration (ElevenLabs: ~150 words per minute on average)
      const wordCount = request.text.split(/\s+/).length;
      const estimatedDurationSeconds = (wordCount / 150) * 60;

      // Upload to storage
      const fileName = `voiceovers/${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;
      const audioUrl = await uploadAudioToStorage(audioBuffer, fileName);

      // Calculate cost
      const cost = this.estimateCost(request.text.length);

      console.log('[v0] ElevenLabs: generated audio, estimated duration:', estimatedDurationSeconds.toFixed(1), 'seconds');

      return {
        audioUrl,
        duration_seconds: estimatedDurationSeconds,
        cost_usd: cost,
        provider: 'elevenlabs',
      };
    } catch (error) {
      console.error('[v0] ElevenLabs TTS error:', error);
      throw new Error(`ElevenLabs TTS generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get list of available ElevenLabs voices
   */
  async getVoices(): Promise<Array<{ id: string; name: string }>> {
    try {
      const voices = await this.client.voices.getAll();

      return voices.voices.map((voice) => ({
        id: voice.voice_id,
        name: voice.name,
      }));
    } catch (error) {
      console.error('[v0] Failed to fetch ElevenLabs voices:', error);
      // Return default voices if API call fails
      return [
        { id: '21m00Tcm4TlvDq8ikWAM', name: 'Bella (Female, Warm)' },
        { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Premade Voice 1 (Male, Deep)' },
        { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Premade Voice 2 (Female, Professional)' },
        { id: 'VR6AewLTigWG4xSOukaG', name: 'Premade Voice 3 (Male, Casual)' },
      ];
    }
  }

  /**
   * Estimate cost of ElevenLabs TTS
   * Pricing varies by model:
   * - Starter plan: $5 per 1M characters
   * - Professional: $15 per 1M characters
   * Using average of $10 per 1M characters
   */
  estimateCost(textLength: number): number {
    const costPer1MChars = 10; // Average $10 per 1M characters
    return (textLength / 1000000) * costPer1MChars;
  }
}
