import { NextRequest, NextResponse } from 'next/server';
import { youtubeUploader } from '@/lib/youtube/youtube-uploader';
import type { ApiResponse } from '@/lib/types';

/**
 * GET /api/uploads/youtube/auth
 * Get OAuth authorization URL
 */
export async function GET(request: NextRequest) {
  try {
    const authUrl = youtubeUploader.getAuthUrl();

    return NextResponse.json(
      {
        success: true,
        data: { auth_url: authUrl },
        timestamp: new Date().toISOString(),
      } as ApiResponse<unknown>
    );
  } catch (error) {
    console.error('[v0] Auth URL generation failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate auth URL',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>,
      { status: 500 }
    );
  }
}
