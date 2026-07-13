'use server';

import type { Voiceover, VoiceProvider } from '../types';
import { GoogleCloudTTSProvider } from './providers/google-cloud';
import { ElevenLabsTTSProvider } from './providers/elevenlabs';

export interface TTSGenerationRequest {
  text: string;
  voiceId?: string;
  provider?: VoiceProvider;
  speed?: number;
}

export interface TTSGenerationResponse {
  audioUrl: string;
  duration_seconds: number;
  cost_usd: number;
  provider: VoiceProvider;
}

/**
 * Unified TTS service that abstracts away provider-specific details
 * Development: Google Cloud TTS (free tier, reasonable quality)
 * Production: ElevenLabs (premium natural voices)
 */
export class TTSService {
  private googleProvider: GoogleCloudTTSProvider;
  private elevenLabsProvider: ElevenLabsTTSProvider;

  constructor() {
    this.googleProvider = new GoogleCloudTTSProvider();
    this.elevenLabsProvider = new ElevenLabsTTSProvider();
  }

  /**
   * Generate audio from text using the configured provider
   * Falls back to Google Cloud if ElevenLabs fails
   */
  async generateAudio(request: TTSGenerationRequest): Promise<TTSGenerationResponse> {
    const provider = request.provider || this.getDefaultProvider();

    try {
      console.log('[v0] Generating TTS with provider:', provider);

      if (provider === 'elevenlabs') {
        return await this.elevenLabsProvider.generate(request);
      } else if (provider === 'google-cloud') {
        return await this.googleProvider.generate(request);
      } else {
        // Default to Google Cloud
        return await this.googleProvider.generate(request);
      }
    } catch (error) {
      console.error(`[v0] TTS generation failed with ${provider}:`, error);

      // Fallback to Google Cloud if primary provider fails
      if (provider !== 'google-cloud') {
        console.log('[v0] Falling back to Google Cloud TTS');
        try {
          return await this.googleProvider.generate(request);
        } catch (fallbackError) {
          console.error('[v0] Fallback TTS generation also failed:', fallbackError);
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  /**
   * Determine which provider to use based on environment
   * Production: ElevenLabs (if API key is set)
   * Development/Free tier: Google Cloud
   */
  private getDefaultProvider(): VoiceProvider {
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

    if (elevenLabsKey && elevenLabsKey.length > 0) {
      return 'elevenlabs';
    }

    return 'google-cloud';
  }

  /**
   * Get list of available voices for a provider
   */
  async getAvailableVoices(provider: VoiceProvider): Promise<Array<{ id: string; name: string }>> {
    if (provider === 'elevenlabs') {
      return this.elevenLabsProvider.getVoices();
    } else if (provider === 'google-cloud') {
      return this.googleProvider.getVoices();
    }

    return [];
  }

  /**
   * Estimate cost of TTS generation
   */
  estimateCost(textLength: number, provider: VoiceProvider): number {
    if (provider === 'elevenlabs') {
      return this.elevenLabsProvider.estimateCost(textLength);
    } else if (provider === 'google-cloud') {
      return this.googleProvider.estimateCost(textLength);
    }

    return 0;
  }
}

// Export singleton instance
export const ttsService = new TTSService();
