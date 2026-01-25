import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        new URL(`/?youtube_error=${encodeURIComponent(error)}`, request.url)
      )
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/?youtube_error=No authorization code received', request.url)
      )
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.YOUTUBE_CLIENT_ID || '',
        client_secret: process.env.YOUTUBE_CLIENT_SECRET || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/youtube/callback`,
      }).toString(),
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange authorization code')
    }

    const { access_token } = await tokenResponse.json()

    // Store the access token and redirect back with it
    return NextResponse.redirect(
      new URL(
        `/?youtube_token=${encodeURIComponent(access_token)}&youtube_connected=true`,
        request.url
      )
    )
  } catch (error) {
    console.error('[YouTube OAuth] Error:', error)
    return NextResponse.redirect(
      new URL(
        `/?youtube_error=${encodeURIComponent(error instanceof Error ? error.message : 'OAuth failed')}`,
        request.url
      )
    )
  }
}
