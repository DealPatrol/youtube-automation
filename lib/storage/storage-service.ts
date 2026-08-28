'use server';

import { getSupabaseServerClient } from '../db/supabase-client';

/**
 * Upload audio file to Supabase Storage
 * Uses the 'videos' bucket (configured in .env)
 */
export async function uploadAudioToStorage(
  audioBuffer: Buffer,
  fileName: string
): Promise<string> {
  try {
    const supabase = getSupabaseServerClient();
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'videos';

    console.log('[v0] Uploading audio to storage:', fileName, 'size:', audioBuffer.length, 'bytes');

    // Upload file
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        cacheControl: '3600', // 1 hour cache
        upsert: false,
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from storage upload');
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucketName).getPublicUrl(data.path);

    console.log('[v0] Audio uploaded successfully:', publicUrl);

    return publicUrl;
  } catch (error) {
    console.error('[v0] Storage upload error:', error);
    throw error;
  }
}

/**
 * Upload video file to Supabase Storage
 */
export async function uploadVideoToStorage(
  videoBuffer: Buffer,
  fileName: string
): Promise<string> {
  try {
    const supabase = getSupabaseServerClient();
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'videos';

    console.log('[v0] Uploading video to storage:', fileName, 'size:', (videoBuffer.length / 1024 / 1024).toFixed(2), 'MB');

    // Upload file
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, videoBuffer, {
        contentType: 'video/mp4',
        cacheControl: '86400', // 24 hour cache
        upsert: false,
      });

    if (error) {
      throw new Error(`Video upload failed: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from storage upload');
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucketName).getPublicUrl(data.path);

    console.log('[v0] Video uploaded successfully:', publicUrl);

    return publicUrl;
  } catch (error) {
    console.error('[v0] Video storage error:', error);
    throw error;
  }
}

/**
 * Delete file from storage
 */
export async function deleteFromStorage(fileName: string): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'videos';

    console.log('[v0] Deleting file from storage:', fileName);

    const { error } = await supabase.storage.from(bucketName).remove([fileName]);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }

    console.log('[v0] File deleted successfully:', fileName);
  } catch (error) {
    console.error('[v0] Storage delete error:', error);
    throw error;
  }
}

/**
 * Get file metadata from storage
 */
export async function getFileMetadata(fileName: string): Promise<Record<string, unknown> | null> {
  try {
    const supabase = getSupabaseServerClient();
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'videos';

    const { data, error } = await supabase.storage.from(bucketName).list(fileName.split('/')[0]);

    if (error) {
      throw new Error(`Get metadata failed: ${error.message}`);
    }

    const file = data?.find((f) => f.name === fileName.split('/').pop());

    return file ? { ...file } : null;
  } catch (error) {
    console.error('[v0] Storage metadata error:', error);
    return null;
  }
}
