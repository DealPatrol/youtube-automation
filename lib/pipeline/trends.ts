import type { TrendCandidate } from './types'

/**
 * Stage 1 — topic trend discovery.
 *
 * Sources, in order of preference:
 *  - YouTube Data API most-popular chart (needs YOUTUBE_API_KEY)
 *  - Google Trends daily RSS (no key required)
 *  - X recent search hashtag aggregation (needs X_BEARER_TOKEN)
 * All sources are merged and ranked with a normalized 0-100 score.
 */

const FALLBACK_TOPICS: TrendCandidate[] = [
  { source: 'fallback', topic: 'AI tools that actually save you time', score: 50 },
  { source: 'fallback', topic: 'Things nobody tells you about working from home', score: 45 },
  { source: 'fallback', topic: 'Simple money habits that compound fast', score: 40 },
  { source: 'fallback', topic: 'How algorithms decide what you watch', score: 35 },
]

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
}

export function normalizeScores(candidates: TrendCandidate[]): TrendCandidate[] {
  const max = Math.max(...candidates.map((c) => c.score), 1)
  return candidates.map((c) => ({ ...c, score: Math.round((c.score / max) * 100) }))
}

export async function fetchGoogleTrends(geo = 'US'): Promise<TrendCandidate[]> {
  try {
    const response = await fetch(
      `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (content-pipeline)' } }
    )
    if (!response.ok) return []
    const xml = await response.text()
    const items = xml.split('<item>').slice(1)
    const candidates: TrendCandidate[] = []
    for (const item of items) {
      const title = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]
      const traffic = item.match(/<ht:approx_traffic>(?:<!\[CDATA\[)?([\d,+]+)/)?.[1]
      if (!title) continue
      const volume = Number((traffic || '0').replace(/[,+]/g, '')) || 1000
      candidates.push({
        source: 'google-trends',
        topic: decodeXmlEntities(title.trim()),
        score: volume,
        detail: traffic ? `~${traffic} searches` : undefined,
      })
    }
    return candidates.slice(0, 15)
  } catch (error) {
    console.warn('[trends] Google Trends fetch failed:', error instanceof Error ? error.message : error)
    return []
  }
}

export async function fetchYouTubeTrending(regionCode = 'US'): Promise<TrendCandidate[]> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim()
  if (!apiKey) return []
  try {
    const url =
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular` +
      `&regionCode=${encodeURIComponent(regionCode)}&maxResults=25&key=${apiKey}`
    const response = await fetch(url)
    if (!response.ok) {
      console.warn('[trends] YouTube trending fetch failed:', response.status)
      return []
    }
    const data = await response.json()
    const items: any[] = data?.items || []
    return items.map((item) => ({
      source: 'youtube' as const,
      topic: String(item?.snippet?.title || '').trim(),
      score: Number(item?.statistics?.viewCount || 0),
      detail: `${Number(item?.statistics?.viewCount || 0).toLocaleString()} views · ${
        item?.snippet?.channelTitle || 'unknown channel'
      }`,
      url: item?.id ? `https://www.youtube.com/watch?v=${item.id}` : undefined,
    })).filter((candidate) => candidate.topic)
  } catch (error) {
    console.warn('[trends] YouTube trending fetch failed:', error instanceof Error ? error.message : error)
    return []
  }
}

export async function fetchXTrends(): Promise<TrendCandidate[]> {
  const bearerToken = process.env.X_BEARER_TOKEN?.trim()
  if (!bearerToken) return []
  try {
    const query = process.env.X_TREND_QUERY?.trim() || 'lang:en -is:retweet -is:reply'
    const response = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(
        query
      )}&max_results=100&tweet.fields=public_metrics`,
      { headers: { Authorization: `Bearer ${bearerToken}` } }
    )
    if (!response.ok) {
      console.warn('[trends] X search failed:', response.status)
      return []
    }
    const payload = (await response.json()) as {
      data?: Array<{ text: string; public_metrics?: { like_count?: number; retweet_count?: number } }>
    }
    const tallies = new Map<string, { count: number; engagement: number }>()
    for (const tweet of payload.data || []) {
      const tags = tweet.text.match(/#[\p{L}\p{N}_]+/gu) || []
      const metrics = tweet.public_metrics || {}
      const engagement = (metrics.like_count || 0) + (metrics.retweet_count || 0)
      for (const tag of new Set(tags)) {
        const current = tallies.get(tag) || { count: 0, engagement: 0 }
        current.count += 1
        current.engagement += engagement
        tallies.set(tag, current)
      }
    }
    return Array.from(tallies.entries())
      .map(([tag, stats]) => ({
        source: 'x' as const,
        topic: tag.replace('#', ''),
        score: stats.count * 10 + stats.engagement,
        detail: `${stats.count} recent posts, ${stats.engagement} engagements`,
        url: `https://x.com/hashtag/${encodeURIComponent(tag.replace('#', ''))}`,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  } catch (error) {
    console.warn('[trends] X trends fetch failed:', error instanceof Error ? error.message : error)
    return []
  }
}

export async function discoverTrends(): Promise<TrendCandidate[]> {
  const [youtube, google, x] = await Promise.all([
    fetchYouTubeTrending(),
    fetchGoogleTrends(),
    fetchXTrends(),
  ])

  // Normalize each source independently so one source's raw scale doesn't drown the others
  const merged = [
    ...(youtube.length ? normalizeScores(youtube) : []),
    ...(google.length ? normalizeScores(google) : []),
    ...(x.length ? normalizeScores(x) : []),
  ]

  if (merged.length === 0) {
    console.warn('[trends] No live trend sources available; using fallback topics')
    return FALLBACK_TOPICS
  }

  return merged.sort((a, b) => b.score - a.score)
}

/** Pick the strongest candidate that looks usable as a video topic. */
export function selectTopic(candidates: TrendCandidate[]): TrendCandidate {
  const usable = candidates.filter((c) => c.topic.length >= 4 && c.topic.length <= 120)
  return usable[0] || candidates[0] || FALLBACK_TOPICS[0]
}
