import { NextRequest, NextResponse } from 'next/server'

/**
 * Legacy endpoint kept for backwards compatibility.
 * Proxies to /api/youtube/upload, which holds the real googleapis
 * implementation (resumable upload, captions, status checks).
 */

const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { searchParams } = new URL(request.url)

    const resultId = body.resultId || searchParams.get('resultId')
    const accessToken = body.accessToken || searchParams.get('accessToken')
    const publishAt = body.publishAt || searchParams.get('publishAt')

    if (!resultId || !accessToken) {
      return NextResponse.json(
        { error: 'Missing resultId or accessToken' },
        { status: 400 }
      )
    }

    const target = new URL(`${baseUrl}/api/youtube/upload`)
    target.searchParams.set('action', 'upload')
    target.searchParams.set('resultId', resultId)
    target.searchParams.set('accessToken', accessToken)
    if (publishAt) {
      target.searchParams.set('publishAt', publishAt)
    }

    const response = await fetch(target.toString(), { method: 'POST' })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[API] YouTube upload proxy error:', error)
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

    const target = new URL(`${baseUrl}/api/youtube/upload`)
    target.searchParams.set('action', 'status')
    target.searchParams.set('videoId', videoId)
    target.searchParams.set('accessToken', accessToken)

    const response = await fetch(target.toString(), { method: 'POST' })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[API] Status check error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check status' },
      { status: 500 }
    )
  }
}
