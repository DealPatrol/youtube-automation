import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state') // OAuth state parameter contains resultId
    const resultId = state || 'unknown'

    if (error) {
      const redirectUrl = resultId && resultId !== 'unknown' 
        ? `/results/${resultId}?youtube_error=${encodeURIComponent(error)}`
        : `/?youtube_error=${encodeURIComponent(error)}`
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
        client_id: process.env.YOUTUBE_CLIENT_ID || '',
        client_secret: process.env.YOUTUBE_CLIENT_SECRET || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/youtube/callback`,
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

    // Store refresh token in Supabase if we have a resultId
    if (resultId && resultId !== 'unknown') {
      const { error: updateError } = await supabase
        .from('results')
        .update({
          youtube_refresh_token: refresh_token,
          youtube_access_token: access_token,
        })
        .eq('id', resultId)

      if (updateError) {
        console.error('[OAuth] Failed to store tokens:', updateError)
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
