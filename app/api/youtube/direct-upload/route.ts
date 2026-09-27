import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'
import { getPublicAppUrl } from '@/lib/config/app-url'
import { getSessionUserId } from '@/lib/auth/session'
import { getResultForUser, updateProject, updateResult } from '@/lib/db/records'

export async function POST(request: NextRequest) {
  try {
    // Validate required environment variables
    if (!process.env.YOUTUBE_CLIENT_ID) {
      console.error('[API] Missing YOUTUBE_CLIENT_ID environment variable')
      return NextResponse.json(
        { error: 'Server configuration error: Missing YouTube Client ID' },
        { status: 500 }
      )
    }

    if (!process.env.YOUTUBE_CLIENT_SECRET) {
      console.error('[API] Missing YOUTUBE_CLIENT_SECRET environment variable')
      return NextResponse.json(
        { error: 'Server configuration error: Missing YouTube Client Secret' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const resultId = searchParams.get('resultId')
    const title = searchParams.get('title') || 'Untitled Video'
    const description = searchParams.get('description') || ''
    const tags = searchParams.get('tags')?.split(',') || []
    const publishAt = searchParams.get('publishAt')

    if (!resultId) {
      return NextResponse.json(
        { error: 'Missing resultId' },
        { status: 400 }
      )
    }

    console.log('[API] YouTube upload initiated for:', resultId)

    const userId = await getSessionUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }

    const result = await getResultForUser<{
      youtube_refresh_token?: string | null
      project_id?: string
    }>(resultId, userId)

    if (!result?.youtube_refresh_token) {
      console.error('[API] No YouTube token found for result:', resultId)
      return NextResponse.json(
        { error: 'YouTube not authenticated. Please reconnect your YouTube account.' },
        { status: 401 }
      )
    }

    // Initialize OAuth2 client with validated environment variables
    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      `${getPublicAppUrl()}/api/auth/youtube/callback`
    )

    oauth2Client.setCredentials({
      refresh_token: result.youtube_refresh_token,
    })

    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client,
    })

    console.log('[API] Uploading to YouTube with title:', title)

    // Get video file from body
    const formData = await request.formData()
    const videoFile = formData.get('video') as File

    if (!videoFile) {
      return NextResponse.json(
        { error: 'No video file provided' },
        { status: 400 }
      )
    }

    // Convert File to Buffer
    const buffer = await videoFile.arrayBuffer()

    // Upload to YouTube
    const response = await youtube.videos.insert(
      {
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: title || 'Untitled Video',
            description: description || '',
            tags: tags.filter(Boolean),
            categoryId: '22', // People & Blogs
          },
          status: {
            privacyStatus: publishAt ? 'private' : 'unlisted',
            madeForKids: false,
            publishAt: publishAt || undefined,
          },
        },
        media: {
          body: Buffer.from(buffer),
        },
      }
    )

    const youtubeVideoId = response.data.id
    const youtubeUrl = `https://youtube.com/watch?v=${youtubeVideoId}`

    console.log('[API] Video uploaded successfully:', youtubeUrl)

    const updated = await updateResult(resultId, {
      youtube_video_id: youtubeVideoId,
      youtube_url: youtubeUrl,
      youtube_status: 'uploaded',
    }, userId)

    if (!updated) {
      console.error('[API] Failed to update result')
    }
    if (publishAt && result.project_id) {
      const scheduled = await updateProject(result.project_id, {
        status: 'scheduled',
        scheduled_for: publishAt,
        youtube_video_id: youtubeVideoId,
      }, userId)
      if (!scheduled) {
        console.error('[API] Failed to update project schedule')
      }
    }

    return NextResponse.json({
      success: true,
      videoId: youtubeVideoId,
      url: youtubeUrl,
      message: 'Video uploaded to YouTube successfully!',
    })
  } catch (error) {
    console.error('[API] YouTube upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'YouTube upload failed' },
      { status: 500 }
    )
  }
}
