import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { Readable } from 'stream'

const youtube = google.youtube({
  version: 'v3',
  auth: new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/youtube/callback`
  ),
})

export async function POST(request: Request) {
  try {
    const { videoTitle, description, tags, accessToken, videoFile } = await request.json()

    if (!accessToken || !videoTitle || !videoFile) {
      return NextResponse.json(
        { error: 'Missing required fields: accessToken, videoTitle, videoFile' },
        { status: 400 }
      )
    }

    const oauth2 = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/youtube/callback`
    )

    oauth2.setCredentials({ access_token: accessToken })

    // Convert base64 video file to buffer
    const buffer = Buffer.from(videoFile.split(',')[1], 'base64')
    const readable = Readable.from([buffer])

    const response = await youtube.videos.insert(
      {
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: videoTitle,
            description: description || '',
            tags: tags || [],
            categoryId: '22', // People & Blogs
          },
          status: {
            privacyStatus: 'private', // Default to private for safety
          },
        },
        media: {
          body: readable,
        },
      },
      {
        auth: oauth2,
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
        },
      }
    )

    return NextResponse.json({
      success: true,
      videoId: response.data.id,
      message: `Video uploaded successfully! Video ID: ${response.data.id}`,
    })
  } catch (error) {
    console.error('[API] YouTube upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload to YouTube' },
      { status: 500 }
    )
  }
}
