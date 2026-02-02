#!/usr/bin/env node

/**
 * YouTube Video Upload Handler
 * Handles multipart file uploads to YouTube using OAuth2
 */

const { google } = require('googleapis');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');

// Configuration
const YOUTUBE_API = google.youtube({
  version: 'v3',
  auth: null, // Will be set per request with OAuth token
});

const CHUNK_SIZE = 256 * 1024; // 256KB chunks for resumable upload

/**
 * Parse multipart form data
 */
async function parseForm(request) {
  return new Promise((resolve, reject) => {
    const form = new formidable.IncomingForm({
      multiples: false,
      maxFileSize: 128 * 1024 * 1024, // 128GB max (YouTube limit)
    });

    form.parse(request, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

/**
 * Upload video file to YouTube
 */
async function uploadToYouTube(videoFile, metadata, accessToken) {
  try {
    // Authenticate with the access token
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({
      version: 'v3',
      auth,
    });

    console.log(`[YouTube] Starting upload for: ${videoFile.originalFilename}`);
    console.log(`[YouTube] File size: ${videoFile.size} bytes`);

    // Create resumable upload session
    const response = await youtube.videos.insert(
      {
        part: 'snippet,status',
        requestBody: {
          snippet: {
            title: metadata.title || 'Untitled Video',
            description: metadata.description || 'Generated with AI Video Creator',
            tags: metadata.tags ? metadata.tags.split(',').map(t => t.trim()) : [],
            categoryId: metadata.categoryId || '22', // People & Blogs
            defaultLanguage: 'en',
            localized: {
              title: metadata.title || 'Untitled Video',
              description: metadata.description || 'Generated with AI Video Creator',
            },
          },
          status: {
            privacyStatus: metadata.privacyStatus || 'private',
            selfDeclaredMadeForKids: metadata.madeForKids === 'true' || false,
          },
        },
        media: {
          body: fs.createReadStream(videoFile.filepath),
        },
      },
      {
        onUploadProgress: (event) => {
          const percentComplete = Math.round((event.bytesRead / videoFile.size) * 100);
          console.log(`[YouTube] Upload progress: ${percentComplete}%`);
        },
      }
    );

    console.log(`[YouTube] Upload complete! Video ID: ${response.data.id}`);

    return {
      success: true,
      videoId: response.data.id,
      title: response.data.snippet.title,
      url: `https://www.youtube.com/watch?v=${response.data.id}`,
    };
  } catch (error) {
    console.error('[YouTube] Upload error:', error);
    throw error;
  }
}

/**
 * Get upload status
 */
async function getUploadStatus(videoId, accessToken) {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({
      version: 'v3',
      auth,
    });

    const response = await youtube.videos.list({
      part: 'processingDetails,status',
      id: videoId,
    });

    const video = response.data.items[0];

    if (!video) {
      throw new Error('Video not found');
    }

    const processingStatus = video.processingDetails?.processingProgress;
    const uploadStatus = video.status?.uploadStatus;

    return {
      videoId,
      uploadStatus, // UPLOADED, PROCESSING, FAILED
      processingProgress: processingStatus ? {
        partsProcessed: processingStatus.partsProcessed,
        partsTotal: processingStatus.partsTotal,
        timeLeftMs: processingStatus.timeLeftMs,
      } : null,
      privacyStatus: video.status.privacyStatus,
      publishedAt: video.snippet?.publishedAt,
    };
  } catch (error) {
    console.error('[YouTube] Status check error:', error);
    throw error;
  }
}

/**
 * Update video metadata
 */
async function updateVideoMetadata(videoId, metadata, accessToken) {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({
      version: 'v3',
      auth,
    });

    const response = await youtube.videos.update(
      {
        part: 'snippet,status',
        requestBody: {
          id: videoId,
          snippet: {
            title: metadata.title,
            description: metadata.description,
            tags: metadata.tags ? metadata.tags.split(',').map(t => t.trim()) : [],
            categoryId: metadata.categoryId || '22',
          },
          status: {
            privacyStatus: metadata.privacyStatus || 'private',
          },
        },
      }
    );

    console.log(`[YouTube] Metadata updated for video: ${videoId}`);

    return {
      success: true,
      videoId: response.data.id,
    };
  } catch (error) {
    console.error('[YouTube] Update error:', error);
    throw error;
  }
}

module.exports = {
  parseForm,
  uploadToYouTube,
  getUploadStatus,
  updateVideoMetadata,
  CHUNK_SIZE,
};
