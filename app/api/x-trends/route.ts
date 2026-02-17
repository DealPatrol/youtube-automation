import { NextResponse } from 'next/server'

/**
 * X (Twitter) Trending Topics API
 * Fetches trending topics from recent public tweets.
 */

type TrendingTopic = {
  id: string
  name: string
  category: 'news' | 'entertainment' | 'technology' | 'sports' | 'business' | 'politics'
  description: string
  tweetCount: number
  engagement: {
    retweets: number
    likes: number
    replies: number
  }
  hashtags: string[]
  topTweet: string
  timestamp: string
  url: string
}

type XTweet = {
  id: string
  text: string
  created_at?: string
  public_metrics?: {
    retweet_count?: number
    reply_count?: number
    like_count?: number
  }
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  technology: ['ai', 'tech', 'software', 'startup', 'saas', 'robot', 'gpt'],
  sports: ['nba', 'nfl', 'soccer', 'football', 'mlb', 'nhl', 'olympics'],
  business: ['market', 'stocks', 'economy', 'finance', 'crypto', 'earnings'],
  entertainment: ['movie', 'music', 'tv', 'celebrity', 'concert', 'festival'],
  politics: ['election', 'policy', 'government', 'senate', 'congress', 'vote'],
  news: ['breaking', 'update', 'report', 'alert', 'headline'],
}

function categorizeTag(tag: string): TrendingTopic['category'] {
  const normalized = tag.replace('#', '').toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return category as TrendingTopic['category']
    }
  }
  return 'news'
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu)
  return matches ? Array.from(new Set(matches)) : []
}

function buildSearchQuery(category?: string): string {
  const base = 'lang:en -is:retweet -is:reply'
  if (!category || category === 'all') return base
  const keywords = CATEGORY_KEYWORDS[category] || []
  if (!keywords.length) return base
  const clause = keywords.map((keyword) => `"${keyword}"`).join(' OR ')
  return `${base} (${clause})`
}

function getMockTrendingTopics(): TrendingTopic[] {
  const topics: TrendingTopic[] = [
    {
      id: '1',
      name: 'AI Breakthrough in Medical Imaging',
      category: 'technology',
      description: 'New AI model detects early-stage cancer with 98% accuracy, revolutionizing diagnostic medicine',
      tweetCount: 45700,
      engagement: { retweets: 12300, likes: 34500, replies: 8900 },
      hashtags: ['#AI', '#HealthTech', '#MedicalAI'],
      topTweet: 'This AI breakthrough could save millions of lives. Early detection is everything.',
      timestamp: new Date().toISOString(),
      url: 'https://x.com/trending/ai-medical-imaging'
    },
    {
      id: '2',
      name: 'Climate Summit 2026',
      category: 'news',
      description: '150+ nations commit to aggressive carbon reduction targets at historic climate summit',
      tweetCount: 89200,
      engagement: { retweets: 23400, likes: 67800, replies: 15600 },
      hashtags: ['#ClimateSummit2026', '#ClimateAction', '#NetZero'],
      topTweet: 'Finally seeing global action on climate. This is the moment we\'ve been waiting for.',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      url: 'https://x.com/trending/climate-summit'
    },
    {
      id: '3',
      name: 'SpaceX Mars Mission Update',
      category: 'technology',
      description: 'Successful test of new Mars propulsion system brings human mission timeline closer',
      tweetCount: 123400,
      engagement: { retweets: 34500, likes: 89000, replies: 21200 },
      hashtags: ['#SpaceX', '#Mars', '#SpaceExploration'],
      topTweet: 'We\'re witnessing history. Mars is no longer science fiction.',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      url: 'https://x.com/trending/spacex-mars'
    },
    {
      id: '4',
      name: 'Remote Work Revolution',
      category: 'business',
      description: 'Major tech companies announce permanent 4-day work week policies',
      tweetCount: 67800,
      engagement: { retweets: 18900, likes: 45600, replies: 12300 },
      hashtags: ['#4DayWorkWeek', '#FutureOfWork', '#WorkLifeBalance'],
      topTweet: 'This is the future. Productivity up, burnout down. Everyone wins.',
      timestamp: new Date(Date.now() - 10800000).toISOString(),
      url: 'https://x.com/trending/remote-work'
    },
    {
      id: '5',
      name: 'Olympic Games Highlights',
      category: 'sports',
      description: 'Record-breaking performances and underdog victories captivate global audience',
      tweetCount: 234500,
      engagement: { retweets: 56700, likes: 178900, replies: 34500 },
      hashtags: ['#Olympics2026', '#TeamUSA', '#GoldMedal'],
      topTweet: 'That finish was INSANE. One of the greatest Olympic moments ever!',
      timestamp: new Date(Date.now() - 14400000).toISOString(),
      url: 'https://x.com/trending/olympics'
    }
  ]

  return topics
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '20')

    console.log('[X Trends API] Fetching trending topics...')

    const bearerToken = process.env.X_BEARER_TOKEN?.trim()
    if (!bearerToken) {
      let trends = getMockTrendingTopics()
      if (category && category !== 'all') {
        trends = trends.filter((trend) => trend.category === category)
      }
      trends = trends.slice(0, limit).sort((a, b) => b.tweetCount - a.tweetCount)
      return NextResponse.json({
        success: true,
        trends,
        timestamp: new Date().toISOString(),
        totalCount: trends.length,
        source: 'mock',
      })
    }

    const query = buildSearchQuery(category || undefined)
    const maxResults = Math.min(Math.max(limit, 10), 100)
    const response = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(
        query
      )}&max_results=${maxResults}&tweet.fields=public_metrics,created_at`,
      {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      }
    )

    if (!response.ok) {
      const text = await response.text()
      console.warn('[X Trends API] X API error, falling back to mock:', text)
      let trends = getMockTrendingTopics()
      if (category && category !== 'all') {
        trends = trends.filter((trend) => trend.category === category)
      }
      trends = trends.slice(0, limit).sort((a, b) => b.tweetCount - a.tweetCount)
      return NextResponse.json({
        success: true,
        trends,
        timestamp: new Date().toISOString(),
        totalCount: trends.length,
        source: 'mock',
      })
    }

    const payload = (await response.json()) as { data?: XTweet[] }
    const tweets = payload.data ?? []
    const topics = new Map<
      string,
      {
        count: number
        retweets: number
        likes: number
        replies: number
        topTweet: string
        topScore: number
        newest?: string
      }
    >()

    for (const tweet of tweets) {
      const tags = extractHashtags(tweet.text)
      if (tags.length === 0) continue
      const metrics = tweet.public_metrics || {}
      const score = (metrics.like_count || 0) + (metrics.retweet_count || 0)

      for (const tag of tags) {
        const current = topics.get(tag) || {
          count: 0,
          retweets: 0,
          likes: 0,
          replies: 0,
          topTweet: '',
          topScore: 0,
          newest: tweet.created_at,
        }
        current.count += 1
        current.retweets += metrics.retweet_count || 0
        current.likes += metrics.like_count || 0
        current.replies += metrics.reply_count || 0
        if (score >= current.topScore) {
          current.topScore = score
          current.topTweet = tweet.text.replace(/\s+/g, ' ').trim()
        }
        if (tweet.created_at && (!current.newest || tweet.created_at > current.newest)) {
          current.newest = tweet.created_at
        }
        topics.set(tag, current)
      }
    }

    let trends = Array.from(topics.entries()).map(([tag, stats]) => {
      const categoryLabel =
        category && category !== 'all' ? category : categorizeTag(tag)
      const name = tag.replace('#', '')
      return {
        id: tag,
        name,
        category: categoryLabel as TrendingTopic['category'],
        description: `Trending on X based on recent posts mentioning #${name}.`,
        tweetCount: stats.count,
        engagement: {
          retweets: stats.retweets,
          likes: stats.likes,
          replies: stats.replies,
        },
        hashtags: [tag],
        topTweet: stats.topTweet || `#${name} is trending right now.`,
        timestamp: stats.newest || new Date().toISOString(),
        url: `https://x.com/hashtag/${encodeURIComponent(name)}`,
      }
    })

    if (category && category !== 'all') {
      trends = trends.filter((trend) => trend.category === category)
    }

    trends = trends.sort((a, b) => b.tweetCount - a.tweetCount).slice(0, limit)

    if (trends.length === 0) {
      let fallback = getMockTrendingTopics()
      if (category && category !== 'all') {
        fallback = fallback.filter((trend) => trend.category === category)
      }
      fallback = fallback.slice(0, limit)
      return NextResponse.json({
        success: true,
        trends: fallback,
        timestamp: new Date().toISOString(),
        totalCount: fallback.length,
        source: 'mock',
      })
    }

    console.log(`[X Trends API] Returning ${trends.length} trending topics`)

    return NextResponse.json({
      success: true,
      trends,
      timestamp: new Date().toISOString(),
      totalCount: trends.length,
      source: 'x-api',
    })

  } catch (error) {
    console.error('[X Trends API] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch trending topics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
