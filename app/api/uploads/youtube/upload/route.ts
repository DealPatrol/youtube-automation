import { NextRequest, NextResponse } from 'next/server';
import { youtubeUploader } from '@/lib/youtube/youtube-uploader';
import { getVideo, updateVideo } from '@/lib/db/queries';
import type { ApiResponse } from '@/lib/types';
import * as fs from 'fs/promises';

interface YouTubeUploadRequest {
  video_id: string;
  access_token: string;
  title: string;
  description: string;
  tags: string[];
  privacy_status?: 'public' | 'unlisted' | 'private';
}

/**
 * POST /api/uploads/youtube/upload
 * Upload a video to YouTube
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
    const body: YouTubeUploadRequest = await request.json();

    if (!body.video_id || !body.access_token || !body.title) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: video_id, access_token, title',
        } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // Fetch video from database
    const video = await getVideo(body.video_id, userId);

    if (!video) {
      return NextResponse.json(
        {
          success: false,
          error: 'Video not found',
        } as ApiResponse<null>,
        { status: 404 }
      );
    }

    if (!video.video_url) {
      return NextResponse.json(
        {
          success: false,
          error: 'Video file not available for upload',
        } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // Download video file to temp location
    const tempPath = `/tmp/video-${video.id}.mp4`;
    const response = await fetch(video.video_url);

    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }

    const videoBuffer = await response.arrayBuffer();
    await fs.writeFile(tempPath, Buffer.from(videoBuffer));

    try {
      // Upload to YouTube
      console.log('[v0] Uploading video to YouTube:', body.title);

      const result = await youtubeUploader.uploadVideo(body.access_token, tempPath, {
        title: body.title,
        description: body.description,
        tags: body.tags,
        privacyStatus: body.privacy_status || 'unlisted',
      });

      // Update video record
      await updateVideo(video.id, userId, {
        uploaded_to_youtube: true,
        youtube_url: result.url,
        youtube_video_id: result.videoId,
        youtube_upload_status: 'completed',
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            youtube_url: result.url,
            youtube_video_id: result.videoId,
            estimated_upload_time: youtubeUploader.estimateUploadTime(video.file_size_mb || 0),
          },
          timestamp: new Date().toISOString(),
        } as ApiResponse<unknown>,
        { status: 201 }
      );
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempPath);
      } catch (error) {
        console.error('[v0] Failed to cleanup temp file:', error);
      }
    }
  } catch (error) {
    console.error('[v0] YouTube upload API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload to YouTube',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>,
      { status: 500 }
    );
  }
}
