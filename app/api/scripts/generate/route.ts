import { NextRequest, NextResponse } from 'next/server';
import { generateVideoScript, estimateScriptCost } from '@/lib/ai/script-generator';
import type { ScriptGenerationRequest } from '@/lib/ai/script-generator';
import type { ApiResponse } from '@/lib/types';

/**
 * POST /api/scripts/generate
 * Generate a new video script using Claude AI
 */
export async function POST(request: NextRequest) {
  try {
    // Get user from auth header (implement your auth check here)
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' } as ApiResponse<null>,
        { status: 401 }
      );
    }

    const userId = authHeader.replace('Bearer ', '');

    // Parse request body
    const body: ScriptGenerationRequest = await request.json();

    // Validate required fields
    if (!body.topic || !body.format) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: topic, format',
        } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // Validate format
    const validFormats = ['long-form', 'short', 'true-crime', 'tutorial'];
    if (!validFormats.includes(body.format)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid format. Must be one of: ${validFormats.join(', ')}`,
        } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // Generate the script
    const script = await generateVideoScript(userId, body);

    return NextResponse.json(
      {
        success: true,
        data: {
          id: script.id,
          title: script.title,
          format: script.format,
          duration_seconds: script.duration_seconds,
          content: script.content,
          estimated_cost: estimateScriptCost(script.duration_seconds),
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse<unknown>,
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Script generation API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate script',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

/**
 * GET /api/scripts/generate/estimate
 * Estimate the cost of generating a script
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const duration = parseInt(searchParams.get('duration') || '600', 10);

    const estimatedCost = estimateScriptCost(duration);

    return NextResponse.json(
      {
        success: true,
        data: {
          estimated_cost: estimatedCost,
          duration_seconds: duration,
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse<unknown>
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to estimate cost',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>,
      { status: 500 }
    );
  }
}
