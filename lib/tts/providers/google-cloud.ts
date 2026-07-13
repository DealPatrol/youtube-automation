'use server';

import * as fs from 'fs/promises';
import * as path from 'path';
import textToSpeech from 'google-cloud-text-to-speech';
import type { TTSGenerationRequest, TTSGenerationResponse } from '../tts-service';
import { uploadAudioToStorage } from '../../storage/storage-service';

/**
 * Google Cloud Text-to-Speech implementation
 * - Free tier: 1M characters/month
 * - Reasonable voice quality
 * - Multiple languages supported
 */
export class GoogleCloudTTSProvider {
  private client: textToSpeech.TextToSpeechClient;

  constructor() {
    // Google Cloud client will use GOOGLE_APPLICATION_CREDENTIALS env var
    this.client = new textToSpeech.TextToSpeechClient();
  }

  /**
   * Generate audio using Google Cloud TTS
   */
  async generate(request: TTSGenerationRequest): Promise<TTSGenerationResponse> {
    try {
      console.log('[v0] Google Cloud TTS: generating audio for', request.text.length, 'characters');

      // Prepare the request
      const googleRequest = {
        input: { text: request.text },
        voice: {
          languageCode: 'en-US',
          name: request.voiceId || 'en-US-Neural2-C', // Neural voice (high quality)
        },
        audioConfig: {
          audioEncoding: 'MP3',
          pitch: 0,
          speakingRate: request.speed || 1.0,
        },
      };

      // Generate audio
      const [response] = await this.client.synthesizeSpeech(googleRequest);

      if (!response.audioContent) {
        throw new Error('No audio content returned from Google Cloud TTS');
      }

      // Convert to Buffer
      const audioBuffer = response.audioContent as Buffer;

      // Calculate duration (rough estimate: 130 words per minute = ~0.46 seconds per word)
      const wordCount = request.text.split(/\s+/).length;
      const estimatedDurationSeconds = (wordCount / 130) * 60;

      // Upload to storage
      const fileName = `voiceovers/${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;
      const audioUrl = await uploadAudioToStorage(audioBuffer, fileName);

      // Calculate cost (Google Cloud: $16 per 1M characters for neural voices)
      const cost = this.estimateCost(request.text.length);

      console.log('[v0] Google Cloud TTS: generated audio, estimated duration:', estimatedDurationSeconds.toFixed(1), 'seconds');

      return {
        audioUrl,
        duration_seconds: estimatedDurationSeconds,
        cost_usd: cost,
        provider: 'google-cloud',
      };
    } catch (error) {
      console.error('[v0] Google Cloud TTS error:', error);
      throw new Error(`Google Cloud TTS generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get list of available Google Cloud voices
   */
  async getVoices(): Promise<Array<{ id: string; name: string }>> {
    try {
      const [result] = await this.client.listVoices({});

      return (result.voices || []).map((voice) => ({
        id: voice.name || '',
        name: `${voice.displayName} (${voice.ssmlGender})`,
      }));
    } catch (error) {
      console.error('[v0] Failed to fetch Google Cloud voices:', error);
      return [
        { id: 'en-US-Neural2-A', name: 'Google Cloud Neural A (Female)' },
        { id: 'en-US-Neural2-C', name: 'Google Cloud Neural C (Female)' },
        { id: 'en-US-Neural2-D', name: 'Google Cloud Neural D (Male)' },
        { id: 'en-US-Neural2-E', name: 'Google Cloud Neural E (Male)' },
      ];
    }
  }

  /**
   * Estimate cost of Google Cloud TTS
   * Pricing: $16 per 1M characters for neural voices
   */
  estimateCost(textLength: number): number {
    const costPer1MChars = 16; // $16 per 1M characters
    return (textLength / 1000000) * costPer1MChars;
  }
}
