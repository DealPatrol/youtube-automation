import { google } from 'googleapis';
import * as fs from 'fs/promises';

interface UploadProgressEvent {
  bytesProcessed: number;
  totalBytes?: number;
}

/**
 * YouTube uploader service
 * Handles OAuth2 flow and video uploads to YouTube
 */
export class YouTubeUploader {
  private oauth2Client: any;
  private youtube: any;

  constructor() {
    // Initialize OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3000/api/uploads/youtube/callback'
    );

    // Initialize YouTube API
    this.youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/youtube.upload',
      ],
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<{ accessToken: string; refreshToken: string | null }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
      };
    } catch (error) {
      console.error('[v0] OAuth token exchange failed:', error);
      throw new Error('Failed to exchange code for tokens');
    }
  }

  /**
   * Upload video to YouTube
   */
  async uploadVideo(
    accessToken: string,
    videoFilePath: string,
    metadata: {
      title: string;
      description: string;
      tags: string[];
      categoryId?: string;
      privacyStatus?: 'public' | 'unlisted' | 'private';
    }
  ): Promise<{ videoId: string; url: string }> {
    try {
      console.log('[v0] YouTube: uploading video with title:', metadata.title);

      // Set OAuth credentials
      this.oauth2Client.setCredentials({ access_token: accessToken });
      this.youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });

      // Read video file
      const fileStream = await fs.readFile(videoFilePath);

      // Upload video
      const response = await this.youtube.videos.insert(
        {
          part: ['snippet', 'status'],
          requestBody: {
            snippet: {
              title: metadata.title,
              description: metadata.description,
              tags: metadata.tags,
              categoryId: metadata.categoryId || '22', // 22 = Nonprofits & Activism
              defaultLanguage: 'en',
            },
            status: {
              privacyStatus: metadata.privacyStatus || 'private',
              publishAt: new Date().toISOString(),
            },
          },
          media: {
            body: fileStream,
          },
        },
        {
          onUploadProgress: (event: UploadProgressEvent) => {
            const bytesUploaded = event.bytesProcessed;
            const totalBytes = event.totalBytes || 0;
            if (totalBytes === 0) return;
            const progress = (bytesUploaded / totalBytes) * 100;
            console.log('[v0] Upload progress:', progress.toFixed(2), '%');
          },
        }
      );

      const videoId = response.data.id;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      console.log('[v0] Video uploaded successfully:', videoUrl);

      return { videoId, url: videoUrl };
    } catch (error) {
      console.error('[v0] YouTube upload failed:', error);
      throw new Error(`YouTube upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's YouTube channel info
   */
  async getChannelInfo(accessToken: string): Promise<{ channelId: string; title: string }> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      this.youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });

      const response = await this.youtube.channels.list({
        part: ['snippet'],
        mine: true,
      });

      if (!response.data.items || response.data.items.length === 0) {
        throw new Error('No channel found');
      }

      const channel = response.data.items[0];

      return {
        channelId: channel.id,
        title: channel.snippet.title,
      };
    } catch (error) {
      console.error('[v0] Failed to fetch channel info:', error);
      throw new Error(`Failed to fetch channel info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Estimate upload time based on file size
   */
  estimateUploadTime(fileSizeMb: number): number {
    // Assume 2 Mbps average upload speed
    return Math.ceil((fileSizeMb * 8) / 2);
  }
}

// Export singleton instance
export const youtubeUploader = new YouTubeUploader();
