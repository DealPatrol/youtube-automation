import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials')
}

export const runtime = 'nodejs'

const supabase = createClient(supabaseUrl, supabaseKey)
const enableYouTubeCaptions = process.env.ENABLE_YOUTUBE_CAPTIONS !== 'false'

/**
 * Upload video to YouTube with OAuth2 access token
 */
async function uploadVideoToYouTube(
  videoPath: string,
  metadata: {
    title: string
    description: string
    tags: string[]
    categoryId: string
    privacyStatus: string
    madeForKids: boolean
  },
  accessToken: string
) {
  try {
    console.log('[YouTube] Starting upload:', metadata.title)

    // Authenticate with the access token
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })

    const youtube = google.youtube({
      version: 'v3',
      auth,
    })

    // Get file size
    const stats = fs.statSync(videoPath)
    const fileSize = stats.size

    console.log(`[YouTube] File size: ${fileSize} bytes`)

    // Upload video with resumable upload
    const response = await youtube.videos.insert(
      {
        part: 'snippet,status,processingDetails',
        requestBody: {
          snippet: {
            title: metadata.title || 'Untitled Video',
            description: metadata.description || 'Generated with AI Video Creator',
            tags: metadata.tags || [],
            categoryId: metadata.categoryId || '22',
            defaultLanguage: 'en',
            localized: {
              title: metadata.title,
              description: metadata.description,
            },
          },
          status: {
            privacyStatus: metadata.privacyStatus || 'private',
            selfDeclaredMadeForKids: metadata.madeForKids || false,
          },
        },
        media: {
          body: fs.createReadStream(videoPath),
        },
      },
      {
        onUploadProgress: (event: any) => {
          if (event.bytesRead) {
            const percentComplete = Math.round((event.bytesRead / fileSize) * 100)
            console.log(`[YouTube] Upload progress: ${percentComplete}%`)
          }
        },
      }
    )

    console.log(`[YouTube] Upload complete! Video ID: ${response.data.id}`)

    return {
      success: true,
      videoId: response.data.id,
      title: response.data.snippet?.title,
      url: `https://www.youtube.com/watch?v=${response.data.id}`,
    }
  } catch (error) {
    console.error('[YouTube] Upload error:', error)
    throw error
  }
}

function formatTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const milliseconds = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 1000)
  const pad = (value: number, length: number) => value.toString().padStart(length, '0')
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(milliseconds, 3)}`
}

function parseTimestamp(value?: string): number | null {
  if (!value) return null
  const parts = value.split(':').map((part) => Number(part))
  if (parts.some((part) => Number.isNaN(part))) return null
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

function resolveDuration(scene: any, fallback: number): number {
  if (typeof scene.duration === 'number' && scene.duration > 0) {
    return Math.max(1, Math.round(scene.duration))
  }
  const start = parseTimestamp(scene.start_time)
  const end = parseTimestamp(scene.end_time)
  if (start !== null && end !== null && end > start) {
    return Math.max(1, Math.round(end - start))
  }
  return Math.max(1, Math.round(fallback))
}

function createVttFromScenes(scenes: any[], defaultDuration: number): string | null {
  let cursor = 0
  const cues: string[] = []

  for (const scene of scenes) {
    const duration = resolveDuration(scene, defaultDuration)
    const text = scene.narration || scene.on_screen_text || scene.title || ''
    if (!text.trim()) {
      cursor += duration
      continue
    }
    const start = formatTimestamp(cursor)
    const end = formatTimestamp(cursor + duration)
    cues.push(`${start} --> ${end}\n${text.trim()}`)
    cursor += duration
  }

  if (cues.length === 0) {
    return null
  }

  return `WEBVTT\n\n${cues.join('\n\n')}\n`
}

async function downloadVideoToTempFile(videoUrl: string, workDir: string): Promise<string> {
  const outputPath = path.join(workDir, `upload_${Date.now()}.mp4`)

  if (videoUrl.startsWith('data:')) {
    const match = videoUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      throw new Error('Invalid data URL')
    }
    const buffer = Buffer.from(match[2], 'base64')
    await fs.promises.writeFile(outputPath, buffer)
    return outputPath
  }

  const response = await fetch(videoUrl)
  if (!response.ok || !response.body) {
    throw new Error('Failed to download video file')
  }

  await pipeline(Readable.fromWeb(response.body as any), fs.createWriteStream(outputPath))
  return outputPath
}

async function uploadCaptionsToYouTube(options: {
  videoId: string
  captionsPath: string
  accessToken: string
}) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: options.accessToken })
  const youtube = google.youtube({ version: 'v3', auth })

  await youtube.captions.insert({
    part: 'snippet',
    requestBody: {
      snippet: {
        videoId: options.videoId,
        language: 'en',
        name: 'English',
        isDraft: false,
      },
    },
    media: {
      body: fs.createReadStream(options.captionsPath),
    },
  })
}

/**
 * Get YouTube video upload status
 */
async function getYouTubeUploadStatus(videoId: string, accessToken: string) {
  try {
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })

    const youtube = google.youtube({
      version: 'v3',
      auth,
    })

    const response = await youtube.videos.list({
      part: 'processingDetails,status,snippet',
      id: [videoId],
    })

    const video = response.data.items?.[0]

    if (!video) {
      throw new Error('Video not found')
    }

    return {
      videoId,
      uploadStatus: video.status?.uploadStatus,
      processingProgress: video.processingDetails?.processingProgress,
      privacyStatus: video.status?.privacyStatus,
      title: video.snippet?.title,
    }
  } catch (error) {
    console.error('[YouTube] Status check error:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const resultId = searchParams.get('resultId')
    const accessToken = searchParams.get('accessToken')
    const action = searchParams.get('action') || 'upload'

    if (!accessToken) {
      return NextResponse.json({ error: 'Missing accessToken' }, { status: 400 })
    }

    // Handle status check
    if (action === 'status') {
      const videoId = searchParams.get('videoId')
      if (!videoId) {
        return NextResponse.json({ error: 'Missing videoId' }, { status: 400 })
      }

      const status = await getYouTubeUploadStatus(videoId, accessToken)
      return NextResponse.json(status)
    }

    // Handle video upload
    if (action === 'upload') {
      if (!resultId) {
        return NextResponse.json({ error: 'Missing resultId' }, { status: 400 })
      }

      console.log('[API] YouTube upload started for result:', resultId)

      // Fetch result from Supabase
      const { data: result, error: dbError } = await supabase
        .from('results')
        .select('*')
        .eq('id', resultId)
        .single()

      if (dbError || !result) {
        return NextResponse.json({ error: 'Result not found' }, { status: 404 })
      }

      if (!result.video_url) {
        return NextResponse.json(
          { error: 'No video file available for upload' },
          { status: 400 }
        )
      }

      const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'youtube-upload-'))

      // Prepare metadata
      const metadata = {
        title: result.seo?.title || 'Untitled Video',
        description: result.seo?.description || 'Generated with AI Video Creator',
        tags: result.seo?.tags || [],
        categoryId: result.seo?.categoryId || '22',
        privacyStatus: result.seo?.privacyStatus || 'private',
        madeForKids: result.seo?.madeForKids || false,
      }

      const { error: startUploadError } = await supabase
        .from('results')
        .update({
          youtube_status: 'uploading',
          youtube_metadata: metadata,
        })
        .eq('id', resultId)

      if (startUploadError) {
        console.error('[API] Failed to mark upload as in-progress:', startUploadError)
      }

      let videoPath: string | null = null
      let captionsPath: string | null = null
      let uploadedVideoId: string | null = null

      try {
        videoPath = await downloadVideoToTempFile(result.video_url, workDir)

        const uploadResult = await uploadVideoToYouTube(videoPath, metadata, accessToken)
        uploadedVideoId = uploadResult.videoId

        if (enableYouTubeCaptions && result.scenes) {
          try {
            const captions = createVttFromScenes(result.scenes, 5)
            if (captions) {
              captionsPath = path.join(workDir, `captions_${Date.now()}.vtt`)
              await fs.promises.writeFile(captionsPath, captions)
              await uploadCaptionsToYouTube({
                videoId: uploadResult.videoId,
                captionsPath,
                accessToken,
              })
            }
          } catch (captionError) {
            console.error('[API] Caption upload failed (continuing):', captionError)
          }
        }

        await supabase
          .from('results')
          .update({
            youtube_status: 'uploaded',
            youtube_video_id: uploadResult.videoId,
            youtube_metadata: metadata,
          })
          .eq('id', resultId)

        return NextResponse.json({
          success: true,
          message: 'Video uploaded to YouTube',
          resultId,
          metadata,
          videoId: uploadResult.videoId,
          url: uploadResult.url,
        })
      } catch (uploadError) {
        console.error('[API] YouTube upload failed:', uploadError)
        await supabase
          .from('results')
          .update({
            youtube_status: 'error',
            youtube_error: uploadError instanceof Error ? uploadError.message : 'Upload failed',
            youtube_video_id: uploadedVideoId,
          })
          .eq('id', resultId)

        throw uploadError
      } finally {
        try {
          if (videoPath && fs.existsSync(videoPath)) {
            await fs.promises.rm(videoPath, { force: true })
          }
          if (captionsPath && fs.existsSync(captionsPath)) {
            await fs.promises.rm(captionsPath, { force: true })
          }
          await fs.promises.rm(workDir, { recursive: true, force: true })
        } catch (cleanupError) {
          console.error('[API] Failed to clean up temp files:', cleanupError)
        }
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[API] YouTube error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'YouTube operation failed' },
      { status: 500 }
    )
  }
}
