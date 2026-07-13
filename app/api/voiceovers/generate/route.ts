import { NextRequest, NextResponse } from 'next/server';
import { ttsService } from '@/lib/tts/tts-service';
import { getScript } from '@/lib/db/queries';
import { createVoiceover } from '@/lib/db/queries';
import type { ApiResponse } from '@/lib/types';

interface GenerateVoiceoverRequest {
  script_id: string;
  text?: string;
  voice_id?: string;
  provider?: 'elevenlabs' | 'google-cloud';
  speed?: number;
}

/**
 * POST /api/voiceovers/generate
 * Generate a voiceover for a script using TTS
 */
export async function POST(request: NextRequest) {
  try {
    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' } as ApiResponse<null>,
        { status: 401 }
      );
    }

    const userId = authHeader.replace('Bearer ', '');

    // Parse request body
    const body: GenerateVoiceoverRequest = await request.json();

    if (!body.script_id && !body.text) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either script_id or text must be provided',
        } as ApiResponse<null>,
        { status: 400 }
      );
    }

    let textToConvert = body.text;

    // If script_id is provided, fetch the script and extract voiceover text
    if (body.script_id) {
      const script = await getScript(body.script_id, userId);

      if (!script) {
        return NextResponse.json(
          {
            success: false,
            error: 'Script not found',
          } as ApiResponse<null>,
          { status: 404 }
        );
      }

      // Extract voiceover text from script JSON
      if (script.script_json && typeof script.script_json === 'object') {
        const scenes = (script.script_json as Record<string, unknown>).scenes as Array<{ voiceover: string }> | undefined;
        if (scenes && Array.isArray(scenes)) {
          textToConvert = scenes.map((s) => s.voiceover || '').join(' ');
        } else {
          textToConvert = script.script_text || '';
        }
      }
    }

    if (!textToConvert || textToConvert.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No text content found to convert to speech',
        } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // Generate voiceover
    const ttsResult = await ttsService.generateAudio({
      text: textToConvert,
      voiceId: body.voice_id,
      provider: body.provider,
      speed: body.speed || 1.0,
    });

    // Save voiceover to database
    const voiceover = await createVoiceover(
      userId,
      body.script_id,
      ttsResult.audioUrl,
      ttsResult.provider,
      ttsResult.duration_seconds,
      ttsResult.cost_usd
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          id: voiceover.id,
          audio_url: voiceover.audio_url,
          duration_seconds: voiceover.duration_seconds,
          voice_provider: voiceover.voice_provider,
          cost_usd: voiceover.cost_usd,
          created_at: voiceover.created_at,
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse<unknown>,
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Voiceover generation API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate voiceover',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

/**
 * GET /api/voiceovers/voices
 * Get list of available voices
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const provider = (searchParams.get('provider') || 'google-cloud') as 'elevenlabs' | 'google-cloud';

    const voices = await ttsService.getAvailableVoices(provider);

    return NextResponse.json(
      {
        success: true,
        data: { voices, provider },
        timestamp: new Date().toISOString(),
      } as ApiResponse<unknown>
    );
  } catch (error) {
    console.error('[v0] Voices API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch voices',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>,
      { status: 500 }
    );
  }
}
