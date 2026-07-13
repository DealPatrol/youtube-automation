import type { VoiceProvider } from '../types';

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
  private googleProvider: any = null;
  private elevenLabsProvider: any = null;

  /**
   * Generate audio from text using the configured provider
   * Falls back to Google Cloud if ElevenLabs fails
   */
  async generateAudio(request: TTSGenerationRequest): Promise<TTSGenerationResponse> {
    const provider = request.provider || this.getDefaultProvider();

    try {
      console.log('[v0] Generating TTS with provider:', provider);

      // Dynamically import providers to avoid circular dependencies
      if (provider === 'elevenlabs') {
        const { ElevenLabsTTSProvider } = await import('./providers/elevenlabs');
        const elevenLabsProvider = new ElevenLabsTTSProvider();
        return await elevenLabsProvider.generate(request);
      } else {
        // Default to Google Cloud
        const { GoogleCloudTTSProvider } = await import('./providers/google-cloud');
        const googleProvider = new GoogleCloudTTSProvider();
        return await googleProvider.generate(request);
      }
    } catch (error) {
      console.error(`[v0] TTS generation failed with ${provider}:`, error);

      // Fallback to Google Cloud if primary provider fails
      if (provider !== 'google-cloud') {
        console.log('[v0] Falling back to Google Cloud TTS');
        try {
          const { GoogleCloudTTSProvider } = await import('./providers/google-cloud');
          const googleProvider = new GoogleCloudTTSProvider();
          return await googleProvider.generate(request);
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
    try {
      if (provider === 'elevenlabs') {
        const { ElevenLabsTTSProvider } = await import('./providers/elevenlabs');
        const elevenLabsProvider = new ElevenLabsTTSProvider();
        return await elevenLabsProvider.getVoices();
      } else {
        const { GoogleCloudTTSProvider } = await import('./providers/google-cloud');
        const googleProvider = new GoogleCloudTTSProvider();
        return await googleProvider.getVoices();
      }
    } catch (error) {
      console.error('[v0] Failed to get available voices:', error);
      return [];
    }
  }

  /**
   * Estimate cost of TTS generation
   */
  estimateCost(textLength: number, provider: VoiceProvider): number {
    // Rough estimates
    if (provider === 'elevenlabs') {
      // ElevenLabs: ~$0.30 per 1M characters
      return (textLength / 1000000) * 0.30;
    } else {
      // Google Cloud: ~$16 per 1M characters (free tier: 1M/month)
      return (textLength / 1000000) * 0.016;
    }
  }
}

// Export singleton instance
export const ttsService = new TTSService();
