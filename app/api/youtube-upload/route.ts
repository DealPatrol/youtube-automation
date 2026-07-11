import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const resultId = body.resultId
    const accessToken = body.accessToken

    if (!resultId || !accessToken) {
      return NextResponse.json(
        { error: 'Missing resultId or accessToken' },
        { status: 400 }
      )
    }

    const uploadUrl = new URL('/api/youtube/upload', request.url)
    uploadUrl.searchParams.set('resultId', resultId)
    uploadUrl.searchParams.set('accessToken', accessToken)
    if (body.publishAt) uploadUrl.searchParams.set('publishAt', body.publishAt)

    const response = await fetch(uploadUrl, {
      method: 'POST',
    })
    const responseBody = await response.text()
    return new NextResponse(responseBody, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' },
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
