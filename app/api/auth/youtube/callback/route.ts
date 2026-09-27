import { NextResponse } from 'next/server'
import { getPublicAppUrl } from '@/lib/config/app-url'
import { getSessionUserId } from '@/lib/auth/session'
import { updateResult } from '@/lib/db/records'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const authorizationError = searchParams.get('error')
    const code = searchParams.get('code')
    const resultId = searchParams.get('state')
    const clientId = process.env.YOUTUBE_CLIENT_ID
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new Error('YouTube OAuth is not configured')
    }

    if (authorizationError) {
      const redirectUrl = resultId && resultId !== 'unknown' 
        ? `/results/${resultId}?youtube_error=${encodeURIComponent(authorizationError)}`
        : `/?youtube_error=${encodeURIComponent(authorizationError)}`
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    if (!code) {
      const redirectUrl = resultId && resultId !== 'unknown'
        ? `/results/${resultId}?youtube_error=No authorization code received`
        : '/?youtube_error=No authorization code received'
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    // Exchange authorization code for access and refresh tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${getPublicAppUrl()}/api/auth/youtube/callback`,
      }).toString(),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('[OAuth] Token exchange failed:', errorText)
      throw new Error(`Failed to exchange authorization code: ${errorText}`)
    }

    const tokenData = await tokenResponse.json()
    const { access_token, refresh_token } = tokenData

    console.log('[OAuth] Token exchange successful')

    if (resultId && resultId !== 'unknown') {
      const userId = await getSessionUserId()
      if (!userId) {
        return NextResponse.redirect(
          new URL(`/results/${resultId}?youtube_error=${encodeURIComponent('Sign in required')}`, request.url)
        )
      }
      const updated = await updateResult(resultId, {
        youtube_refresh_token: refresh_token,
        youtube_access_token: access_token,
      }, userId)

      if (!updated) {
        console.error('[OAuth] Failed to store tokens for result:', resultId)
      } else {
        console.log('[OAuth] Tokens stored successfully for result:', resultId)
      }

      // Redirect back to results page with success
      return NextResponse.redirect(
        new URL(`/results/${resultId}?youtube_connected=true`, request.url)
      )
    } else {
      // No resultId - redirect to dashboard
      console.log('[OAuth] No resultId provided, redirecting to dashboard')
      return NextResponse.redirect(new URL('/?youtube_connected=true', request.url))
    }
  } catch (error) {
    console.error('[YouTube OAuth] Error:', error)
    const state = new URL(request.url).searchParams.get('state')
    const resultId = state || null
    const errorMessage = error instanceof Error ? error.message : 'OAuth failed'
    
    const redirectUrl = resultId
      ? `/results/${resultId}?youtube_error=${encodeURIComponent(errorMessage)}`
      : `/?youtube_error=${encodeURIComponent(errorMessage)}`
    
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  }
}
