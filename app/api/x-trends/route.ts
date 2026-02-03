import { NextResponse } from 'next/server'

/**
 * X (Twitter) Trending Topics API
 * Fetches trending topics, hashtags, and news stories with engagement metrics
 */

// Mock trending data structure (replace with actual X API integration)
interface TrendingTopic {
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

/**
 * Mock trending data generator
 * In production, replace with actual X API v2 calls
 */
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

    // In production, use actual X API v2
    // const response = await fetch('https://api.twitter.com/2/trends/place?id=1', {
    //   headers: { 'Authorization': `Bearer ${process.env.X_API_BEARER_TOKEN}` }
    // })

    let trends = getMockTrendingTopics()

    // Filter by category if specified
    if (category && category !== 'all') {
      trends = trends.filter(trend => trend.category === category)
    }

    // Limit results
    trends = trends.slice(0, limit)

    // Sort by engagement (tweet count)
    trends.sort((a, b) => b.tweetCount - a.tweetCount)

    console.log(`[X Trends API] Returning ${trends.length} trending topics`)

    return NextResponse.json({
      success: true,
      trends,
      timestamp: new Date().toISOString(),
      totalCount: trends.length
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
