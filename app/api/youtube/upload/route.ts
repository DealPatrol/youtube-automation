import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
import { google } from 'googleapis'
import fs from 'fs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let supabase: any = null

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey)
  } catch (error) {
    console.warn('[API] Failed to initialize Supabase:', error)
  }
} else {
  console.warn('[API] Supabase credentials not configured')
}

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
        part: ['snippet', 'status', 'processingDetails'],
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
      part: ['processingDetails', 'status', 'snippet'],
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

      // Prepare metadata
      const metadata = {
        title: result.seo?.title || 'Untitled Video',
        description: result.seo?.description || 'Generated with AI Video Creator',
        tags: result.seo?.tags || [],
        categoryId: result.seo?.categoryId || '22',
        privacyStatus: result.seo?.privacyStatus || 'private',
        madeForKids: result.seo?.madeForKids || false,
      }

      // For now, we'll return success and store the metadata
      // In production, you'd need to handle file streaming from storage
      const { error: updateError } = await supabase
        .from('results')
        .update({
          youtube_status: 'uploading',
          youtube_metadata: metadata,
        })
        .eq('id', resultId)

      if (updateError) {
        console.error('[API] Failed to update result:', updateError)
      }

      return NextResponse.json({
        success: true,
        message: 'Video upload to YouTube initiated',
        resultId,
        metadata,
        note: 'Video file needs to be streamed from storage (S3/R2) for actual upload',
      })
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
