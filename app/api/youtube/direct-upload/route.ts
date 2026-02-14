import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
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

// Parse multipart form data
async function parseFormData(request: NextRequest) {
  const buffer = await request.arrayBuffer()
  const contentType = request.headers.get('content-type') || ''
  
  return new Promise((resolve, reject) => {
    const form = new formidable.IncomingForm()
    const fakeReq = {
      headers: {
        'content-type': contentType,
        'content-length': buffer.byteLength.toString(),
      },
      on: (event: string, handler: Function) => {
        if (event === 'data') {
          handler(Buffer.from(buffer))
        } else if (event === 'end') {
          handler()
        }
      },
    } as any

    form.parse(fakeReq, (err, fields, files) => {
      if (err) reject(err)
      else resolve({ fields, files })
    })
  })
}

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

    if (!process.env.NEXTAUTH_URL) {
      console.error('[API] Missing NEXTAUTH_URL environment variable')
      return NextResponse.json(
        { error: 'Server configuration error: Missing authentication URL' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const resultId = searchParams.get('resultId')
    const title = searchParams.get('title') || 'Untitled Video'
    const description = searchParams.get('description') || ''
    const tags = searchParams.get('tags')?.split(',') || []

    if (!resultId) {
      return NextResponse.json(
        { error: 'Missing resultId' },
        { status: 400 }
      )
    }

    console.log('[API] YouTube upload initiated for:', resultId)

    // Get user's YouTube refresh token from Supabase
    const { data: result, error: dbError } = await supabase
      .from('results')
      .select('youtube_refresh_token')
      .eq('id', resultId)
      .single()

    if (dbError || !result?.youtube_refresh_token) {
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
      `${process.env.NEXTAUTH_URL}/api/auth/youtube/callback`
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
        part: 'snippet,status',
        requestBody: {
          snippet: {
            title: title || 'Untitled Video',
            description: description || '',
            tags: tags.filter(Boolean),
            categoryId: '22', // People & Blogs
          },
          status: {
            privacyStatus: 'unlisted',
            madeForKids: false,
          },
        },
      },
      {
        media: {
          body: Buffer.from(buffer),
        },
      } as any
    )

    const youtubeVideoId = response.data.id
    const youtubeUrl = `https://youtube.com/watch?v=${youtubeVideoId}`

    console.log('[API] Video uploaded successfully:', youtubeUrl)

    // Update result in Supabase
    const { error: updateError } = await supabase
      .from('results')
      .update({
        youtube_video_id: youtubeVideoId,
        youtube_url: youtubeUrl,
        youtube_status: 'uploaded',
      })
      .eq('id', resultId)

    if (updateError) {
      console.error('[API] Failed to update result:', updateError)
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
