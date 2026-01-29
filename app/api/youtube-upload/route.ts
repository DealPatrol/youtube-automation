import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { title, description, tags, accessToken } = await request.json()

    if (!accessToken || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: accessToken, title' },
        { status: 400 }
      )
    }

    // Create video metadata on YouTube
    const response = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        snippet: {
          title: title,
          description: description || 'Generated with AI Video Creator',
          tags: tags || [],
          categoryId: '22', // People & Blogs
          defaultLanguage: 'en',
          localized: {
            title: title,
            description: description || 'Generated with AI Video Creator',
          },
        },
        status: {
          privacyStatus: 'private', // Default to private for safety
          selfDeclaredMadeForKids: false,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[API] YouTube API error:', error)
      throw new Error(error.error?.message || 'Failed to create video on YouTube')
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      videoId: data.id,
      message: `Video created on YouTube! Video ID: ${data.id}. Note: Video file upload requires multipart upload. Upload your video file separately at youtube.com/studio`,
    })
  } catch (error) {
    console.error('[API] YouTube upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload to YouTube' },
      { status: 500 }
    )
  }
}
