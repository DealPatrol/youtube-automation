import { NextResponse } from 'next/server'

const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY
const SHOTSTACK_BASE_URL = 'https://api.shotstack.io/v1'

interface ShotstackScene {
  duration: number
  clips: Array<{
    asset: {
      type: string
      src?: string
      text?: string
    }
    start: number
    length: number
    transition?: {
      in: string
      out: string
    }
  }>
  background?: string
}

export async function POST(request: Request) {
  try {
    if (!SHOTSTACK_API_KEY) {
      return NextResponse.json(
        { error: 'Shotstack API key not configured' },
        { status: 500 }
      )
    }

    const { title, scenes, voiceoverUrl, backgroundMusicUrl } = await request.json()

    if (!scenes || scenes.length === 0) {
      return NextResponse.json(
        { error: 'No scenes provided' },
        { status: 400 }
      )
    }

    // Build Shotstack timeline
    const timeline = {
      tracks: [
        {
          clips: scenes.map((scene: any, index: number) => ({
            asset: {
              type: 'video',
              src: scene.videoUrl || 'https://shotstack-assets.s3.amazonaws.com/template-assets/background.mp4',
            },
            start: scene.startTime || index * 5,
            length: scene.duration || 5,
            transition: {
              in: 'fade',
              out: 'fade',
            },
          })),
        },
        // Audio track for voiceover
        ...(voiceoverUrl
          ? [
              {
                clips: [
                  {
                    asset: {
                      type: 'audio',
                      src: voiceoverUrl,
                    },
                    start: 0,
                    length: scenes.reduce((sum: number, scene: any) => sum + (scene.duration || 5), 0),
                  },
                ],
              },
            ]
          : []),
        // Background music track
        ...(backgroundMusicUrl
          ? [
              {
                clips: [
                  {
                    asset: {
                      type: 'audio',
                      src: backgroundMusicUrl,
                    },
                    start: 0,
                    length: scenes.reduce((sum: number, scene: any) => sum + (scene.duration || 5), 0),
                  },
                ],
              },
            ]
          : []),
      ],
    }

    const payload = {
      timeline,
      output: {
        format: 'mp4',
        resolution: '1080p',
      },
      callback: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/webhooks/shotstack`,
    }

    console.log('[Shotstack] Creating render job with scenes:', scenes.length)

    const response = await fetch(`${SHOTSTACK_BASE_URL}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SHOTSTACK_API_KEY,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Shotstack] API error:', error)
      return NextResponse.json(
        { error: `Shotstack API error: ${error}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      renderJobId: data.response.id,
      status: 'queued',
    })
  } catch (error) {
    console.error('[API] Render error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Render failed' },
      { status: 500 }
    )
  }
}
