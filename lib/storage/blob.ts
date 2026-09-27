import { del, list, put } from '@vercel/blob'

function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set')
  }
  return token
}

export function blobPath(fileName: string): string {
  const trimmed = fileName.replace(/^\/+/, '')
  return trimmed.startsWith('videos/') ? trimmed : `videos/${trimmed}`
}

export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim())
}

export async function uploadBlob(fileName: string, body: Buffer, contentType: string): Promise<string> {
  const blob = await put(blobPath(fileName), body, {
    access: 'public',
    token: blobToken(),
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  return blob.url
}

export async function deleteBlob(fileName: string): Promise<void> {
  const pathname = blobPath(fileName)
  const token = blobToken()
  const listed = await list({ prefix: pathname, token, limit: 20 })
  const match = listed.blobs.find((item) => item.pathname === pathname)
  if (!match) return
  await del(match.url, { token })
}

export async function blobMetadata(fileName: string): Promise<unknown | null> {
  const pathname = blobPath(fileName)
  const listed = await list({ prefix: pathname, token: blobToken(), limit: 20 })
  return listed.blobs.find((item) => item.pathname === pathname) ?? null
}
