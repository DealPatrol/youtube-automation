import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const resultId = searchParams.get('resultId')

    if (!resultId) {
      return NextResponse.json(
        { error: 'Missing resultId' },
        { status: 400 }
      )
    }

    // Validate required environment variables
    const clientId = process.env.YOUTUBE_CLIENT_ID
    if (!clientId) {
      console.error('[API] Missing YOUTUBE_CLIENT_ID environment variable')
      return NextResponse.json(
        { error: 'Server configuration error: Missing YOUTUBE_CLIENT_ID' },
        { status: 500 }
      )
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const callbackUrl = `${baseUrl}/api/auth/youtube/callback`

    // Build OAuth consent URL with proper URL encoding
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube',
      access_type: 'offline',
      prompt: 'consent',
      state: resultId, // Use state parameter to pass resultId securely
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    return NextResponse.redirect(new URL(authUrl))
  } catch (error) {
    console.error('[API] Error generating YouTube auth URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    )
  }
}
