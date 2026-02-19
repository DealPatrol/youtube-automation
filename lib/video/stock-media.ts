const PEXELS_API_KEY = process.env.PEXELS_API_KEY

function buildHeaders() {
  return PEXELS_API_KEY ? { Authorization: PEXELS_API_KEY } : {}
}

export async function getStockVideoUrl(query: string): Promise<string | null> {
  if (!PEXELS_API_KEY || !query.trim()) return null

  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`
  const response = await fetch(url, { headers: buildHeaders() })
  if (!response.ok) {
    console.warn('[Stock] Pexels video search failed:', response.status)
    return null
  }

  const data = await response.json()
  const video = data?.videos?.[0]
  const files = video?.video_files || []
  const preferred =
    files.find((file: any) => file.file_type === 'video/mp4' && file.width >= 1280) ||
    files.find((file: any) => file.file_type === 'video/mp4')

  return preferred?.link || null
}

export async function getStockImageUrl(query: string): Promise<string | null> {
  if (!PEXELS_API_KEY || !query.trim()) return null

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`
  const response = await fetch(url, { headers: buildHeaders() })
  if (!response.ok) {
    console.warn('[Stock] Pexels image search failed:', response.status)
    return null
  }

  const data = await response.json()
  const photo = data?.photos?.[0]
  return photo?.src?.large || photo?.src?.original || null
}
