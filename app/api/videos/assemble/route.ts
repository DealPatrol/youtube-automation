import { NextRequest, NextResponse } from 'next/server';
import { videoAssembler } from '@/lib/video/video-assembler';
import { getVoiceoverByScriptId, getScript, updateVideo, createVideo } from '@/lib/db/queries';
import type { ApiResponse } from '@/lib/types';

interface AssembleVideoRequest {
  script_id: string;
  voiceover_id?: string;
  background_music_url?: string;
  background_music_volume?: number;
}

/**
 * POST /api/videos/assemble
 * Assemble a video from script + voiceover
 * This is a long-running operation (returns job_id for async tracking)
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
    const body: AssembleVideoRequest = await request.json();

    if (!body.script_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'script_id is required',
        } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // Fetch script
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

    // Fetch voiceover (use most recent if not specified)
    const voiceover = await getVoiceoverByScriptId(body.script_id);

    if (!voiceover || !voiceover.audio_url) {
      return NextResponse.json(
        {
          success: false,
          error: 'Voiceover not found. Please generate a voiceover first.',
        } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // Create video record with "generating" status
    const video = await createVideo(userId, body.script_id, script.format || 'long-form');

    // Queue assembly as background job
    // For MVP, we'll do synchronous assembly. In production, use Upstash or Vercel Cron.
    try {
      console.log('[v0] Starting video assembly for video:', video.id);

      const assemblyResult = await videoAssembler.assembleVideo({
        voiceover_url: voiceover.audio_url,
        voiceover_duration: voiceover.duration_seconds || 60,
        format: script.format || 'long-form',
        background_music_url: body.background_music_url,
        background_music_volume: body.background_music_volume || 0.3,
        title: script.script_text || 'Untitled',
      });

      // Update video record with completed data
      const updatedVideo = await updateVideo(video.id, userId, {
        status: 'completed',
        video_url: assemblyResult.video_url,
        duration_seconds: assemblyResult.duration_seconds,
        file_size_mb: Math.round(assemblyResult.file_size_mb * 100) / 100,
        resolution: assemblyResult.resolution,
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            id: updatedVideo.id,
            status: updatedVideo.status,
            video_url: updatedVideo.video_url,
            duration_seconds: updatedVideo.duration_seconds,
            file_size_mb: updatedVideo.file_size_mb,
            resolution: updatedVideo.resolution,
            created_at: updatedVideo.created_at,
          },
          timestamp: new Date().toISOString(),
        } as ApiResponse<unknown>,
        { status: 201 }
      );
    } catch (assemblyError) {
      console.error('[v0] Assembly error, updating video status to failed:', assemblyError);

      // Update video record with error
      await updateVideo(video.id, userId, {
        status: 'failed',
        error_message: assemblyError instanceof Error ? assemblyError.message : 'Unknown assembly error',
      });

      throw assemblyError;
    }
  } catch (error) {
    console.error('[v0] Video assembly API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assemble video',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

/**
 * GET /api/videos/assemble/status?video_id=xxx
 * Check status of video assembly
 */
export async function GET(request: NextRequest) {
  try {
    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' } as ApiResponse<null>,
        { status: 401 }
      );
    }

    // For MVP, just return basic status
    return NextResponse.json(
      {
        success: true,
        data: { status: 'completed' },
        timestamp: new Date().toISOString(),
      } as ApiResponse<unknown>
    );
  } catch (error) {
    console.error('[v0] Status check error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check status',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>,
      { status: 500 }
    );
  }
}
