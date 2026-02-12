import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const resultId = searchParams.get('resultId')
    const accessToken = searchParams.get('accessToken')

    if (!resultId || !accessToken) {
      return NextResponse.json(
        { error: 'Missing resultId or accessToken' },
        { status: 400 }
      )
    }

    console.log('[API] YouTube upload started for result:', resultId)

    // Fetch result data from Supabase
    const { data: result, error: dbError } = await supabase
      .from('results')
      .select('*')
      .eq('id', resultId)
      .single()

    if (dbError || !result) {
      return NextResponse.json({ error: 'Result not found' }, { status: 404 })
    }

    // Prepare video metadata from result
    const metadata = {
      title: result.seo?.title || 'Untitled Video',
      description: result.seo?.description || 'Generated with AI Video Creator',
      tags: result.seo?.tags || [],
      categoryId: result.seo?.categoryId || '22',
      privacyStatus: result.seo?.privacyStatus || 'private',
      madeForKids: result.seo?.madeForKids || false,
    }

    // Call the Python backend or Node.js handler to upload
    // For now, we'll create a mock response since actual file upload needs the backend
    console.log('[API] Upload metadata:', metadata)

    // Update result status in Supabase
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
      note: 'For production, connect your FastAPI backend to handle actual file uploads with googleapis library',
    })
  } catch (error) {
    console.error('[API] YouTube upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload to YouTube' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const videoId = searchParams.get('videoId')
    const accessToken = searchParams.get('accessToken')

    if (!videoId || !accessToken) {
      return NextResponse.json(
        { error: 'Missing videoId or accessToken' },
        { status: 400 }
      )
    }

    console.log('[API] Checking upload status for video:', videoId)

    // In production, call the backend service to check status with googleapis
    return NextResponse.json({
      videoId,
      uploadStatus: 'UPLOADED',
      processingProgress: {
        partsProcessed: 100,
        partsTotal: 100,
        timeLeftMs: 0,
      },
      note: 'Status check requires backend integration with googleapis',
    })
  } catch (error) {
    console.error('[API] Status check error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check status' },
      { status: 500 }
    )
  }
}
