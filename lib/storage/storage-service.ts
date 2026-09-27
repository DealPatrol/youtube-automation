'use server';

import { blobMetadata, deleteBlob, uploadBlob } from './blob';

export async function uploadAudioToStorage(audioBuffer: Buffer, fileName: string): Promise<string> {
  console.log('[storage] Uploading audio:', fileName, 'size:', audioBuffer.length, 'bytes');
  const url = await uploadBlob(fileName, audioBuffer, 'audio/mpeg');
  console.log('[storage] Audio uploaded:', url);
  return url;
}

export async function uploadVideoToStorage(videoBuffer: Buffer, fileName: string): Promise<string> {
  console.log('[storage] Uploading video:', fileName, 'size:', (videoBuffer.length / 1024 / 1024).toFixed(2), 'MB');
  const url = await uploadBlob(fileName, videoBuffer, 'video/mp4');
  console.log('[storage] Video uploaded:', url);
  return url;
}

export async function deleteFromStorage(fileName: string): Promise<void> {
  console.log('[storage] Deleting file:', fileName);
  await deleteBlob(fileName);
}

export async function getFileMetadata(fileName: string): Promise<unknown | null> {
  try {
    return await blobMetadata(fileName);
  } catch (error) {
    console.error('[storage] Metadata error:', error);
    return null;
  }
}
