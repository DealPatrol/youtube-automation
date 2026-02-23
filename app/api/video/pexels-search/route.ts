import { NextResponse } from 'next/server'

const PEXELS_API_KEY = process.env.PEXELS_API_KEY

export async function GET(request: Request) {
  try {
    if (!PEXELS_API_KEY) {
      return NextResponse.json(
        { error: 'Pexels API key not configured' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || 'background'
    const perPage = searchParams.get('per_page') || '12'

    console.log('[Pexels] Searching for:', query)

    const response = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}`,
      {
        headers: {
          Authorization: PEXELS_API_KEY,
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('[Pexels] API error:', error)
      return NextResponse.json(
        { error: `Pexels API error: ${error}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Transform Pexels response to our format
    const videos = data.videos.map((video: any) => ({
      id: video.id,
      title: query,
      url: video.video_files[0]?.link || video.video_files[0]?.link,
      thumbnail: video.image,
      duration: video.duration,
      width: video.width,
      height: video.height,
      photographer: video.user.name,
    }))

    return NextResponse.json({
      videos,
      totalResults: data.total_results,
    })
  } catch (error) {
    console.error('[API] Pexels search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Stock footage search failed' },
      { status: 500 }
    )
  }
}
