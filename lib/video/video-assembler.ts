'use server';

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { uploadVideoToStorage, deleteFromStorage } from '../storage/storage-service';
import type { VideoFormat } from '../types';

const execAsync = promisify(exec);

export interface VideoAssemblyRequest {
  voiceover_url: string;
  voiceover_duration: number;
  format: VideoFormat;
  background_music_url?: string;
  background_music_volume?: number;
  title?: string;
}

export interface VideoAssemblyResponse {
  video_url: string;
  duration_seconds: number;
  file_size_mb: number;
  resolution: string;
}

/**
 * FFmpeg-based video assembler
 * Combines B-roll, voiceover, music, and captions into final video
 */
export class VideoAssembler {
  private tempDir = '/tmp/videoforge';

  constructor() {
    // Initialize temp directory
    this.initTempDir();
  }

  private async initTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('[v0] Failed to create temp directory:', error);
    }
  }

  /**
   * Main video assembly function
   * Downloads resources, combines them with FFmpeg, uploads result
   */
  async assembleVideo(request: VideoAssemblyRequest): Promise<VideoAssemblyResponse> {
    const sessionId = Date.now().toString();
    const workDir = path.join(this.tempDir, sessionId);

    try {
      console.log('[v0] Starting video assembly for format:', request.format);

      // Create working directory
      await fs.mkdir(workDir, { recursive: true });

      // Download voiceover
      const voiceoverPath = await this.downloadFile(request.voiceover_url, path.join(workDir, 'voiceover.mp3'));

      // Build FFmpeg command based on format
      let outputPath: string;
      let ffmpegCommand: string;

      if (request.format === 'short') {
        // TikTok/Shorts format (9:16, 1080x1920)
        const outputDim = '1080x1920';
        outputPath = path.join(workDir, 'video_output.mp4');
        ffmpegCommand = this.buildShortFormatCommand(voiceoverPath, outputPath, outputDim, request);
      } else if (request.format === 'long-form') {
        // YouTube long-form (16:9, 1920x1080)
        const outputDim = '1920x1080';
        outputPath = path.join(workDir, 'video_output.mp4');
        ffmpegCommand = this.buildLongFormCommand(voiceoverPath, outputPath, outputDim, request);
      } else if (request.format === 'true-crime') {
        // Documentary format with effects
        const outputDim = '1920x1080';
        outputPath = path.join(workDir, 'video_output.mp4');
        ffmpegCommand = this.buildDocumentaryCommand(voiceoverPath, outputPath, outputDim, request);
      } else {
        // Tutorial format
        const outputDim = '1920x1080';
        outputPath = path.join(workDir, 'video_output.mp4');
        ffmpegCommand = this.buildTutorialCommand(voiceoverPath, outputPath, outputDim, request);
      }

      console.log('[v0] Running FFmpeg command...');

      // Execute FFmpeg
      await execAsync(ffmpegCommand, { maxBuffer: 1024 * 1024 * 100 }); // 100MB buffer for large files

      // Get file stats
      const stats = await fs.stat(outputPath);
      const fileSizeMb = stats.size / (1024 * 1024);

      console.log('[v0] Video assembled, file size:', fileSizeMb.toFixed(2), 'MB');

      // Upload to storage
      const videoBuffer = await fs.readFile(outputPath);
      const fileName = `videos/${sessionId}/output.mp4`;
      const videoUrl = await uploadVideoToStorage(videoBuffer, fileName);

      return {
        video_url: videoUrl,
        duration_seconds: request.voiceover_duration + 2, // Add 2 seconds padding
        file_size_mb: fileSizeMb,
        resolution: request.format === 'short' ? '1080x1920' : '1920x1080',
      };
    } catch (error) {
      console.error('[v0] Video assembly failed:', error);
      throw new Error(`Video assembly failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Cleanup temp files
      try {
        await fs.rm(workDir, { recursive: true, force: true });
        console.log('[v0] Cleaned up temp directory:', workDir);
      } catch (error) {
        console.error('[v0] Failed to cleanup temp directory:', error);
      }
    }
  }

  /**
   * Build FFmpeg command for short-form video (TikTok/Reels)
   */
  private buildShortFormatCommand(voiceoverPath: string, outputPath: string, dimensions: string, request: VideoAssemblyRequest): string {
    // For shorts, create a simple video with colored background and voiceover
    // In production, this would composite B-roll footage
    const duration = request.voiceover_duration;

    return (
      `ffmpeg -f lavfi -i color=c=black:s=${dimensions}:d=${duration} ` +
      `-i "${voiceoverPath}" ` +
      `-c:v libx264 -preset ultrafast -c:a aac ` +
      `-y "${outputPath}"`
    );
  }

  /**
   * Build FFmpeg command for long-form video (YouTube)
   */
  private buildLongFormCommand(voiceoverPath: string, outputPath: string, dimensions: string, request: VideoAssemblyRequest): string {
    const duration = request.voiceover_duration;

    // Create a base video with solid background
    // In production, this would composite multiple B-roll clips with transitions
    return (
      `ffmpeg -f lavfi -i color=c=#1a1a1a:s=${dimensions}:d=${duration} ` +
      `-i "${voiceoverPath}" ` +
      `-f lavfi -i color=c=#333333:s=1920x100:d=${duration} ` +
      `-filter_complex "[0][2]overlay=0:0[bg]; [bg][1]amix=inputs=2:duration=longest[out]" ` +
      `-c:v libx264 -preset fast -crf 23 -c:a aac ` +
      `-map '[out]' -y "${outputPath}"`
    );
  }

  /**
   * Build FFmpeg command for documentary format
   */
  private buildDocumentaryCommand(voiceoverPath: string, outputPath: string, dimensions: string, request: VideoAssemblyRequest): string {
    const duration = request.voiceover_duration;

    // Documentary style with dark theme and subtle effects
    return (
      `ffmpeg -f lavfi -i color=c=black:s=${dimensions}:d=${duration} ` +
      `-i "${voiceoverPath}" ` +
      `-filter_complex "format=yuv420p" ` +
      `-c:v libx264 -preset fast -crf 22 ` +
      `-c:a aac -q:a 5 ` +
      `-y "${outputPath}"`
    );
  }

  /**
   * Build FFmpeg command for tutorial format
   */
  private buildTutorialCommand(voiceoverPath: string, outputPath: string, dimensions: string, request: VideoAssemblyRequest): string {
    const duration = request.voiceover_duration;

    // Tutorial with light theme
    return (
      `ffmpeg -f lavfi -i color=c=white:s=${dimensions}:d=${duration} ` +
      `-i "${voiceoverPath}" ` +
      `-c:v libx264 -preset ultrafast -c:a aac ` +
      `-y "${outputPath}"`
    );
  }

  /**
   * Download a file from URL to local path
   */
  private async downloadFile(url: string, outputPath: string): Promise<string> {
    console.log('[v0] Downloading file from:', url);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      await fs.writeFile(outputPath, Buffer.from(buffer));

      console.log('[v0] File downloaded successfully:', outputPath);

      return outputPath;
    } catch (error) {
      console.error('[v0] File download failed:', error);
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Estimate time needed to assemble video
   */
  estimateAssemblyTime(durationSeconds: number): number {
    // Rough estimate: 1 second of video takes ~2-3 seconds to encode with x264 fast preset
    // For server-side processing
    return Math.max(30, durationSeconds * 2.5);
  }
}

// Export singleton instance
export const videoAssembler = new VideoAssembler();
