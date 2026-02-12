import { NextRequest, NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { searchRecentTweets, type XCredentials } from '@/lib/x/client'

export const runtime = 'nodejs'

const DEFAULT_QUERY = 'lang:en -is:retweet -is:reply'
const STOP_WORDS = new Set([
  'the','and','for','with','that','this','you','your','are','from','was','what','who','how','why','when','where',
  'they','their','them','our','out','about','just','into','than','then','has','have','had','but','not','can','will',
  'its','it','to','of','in','on','is','a','an','as','at','be','by','or','if','we','i','me','my','so','up','rt'
])

function getCredentials(): XCredentials {
  const consumerKey = process.env.X_CONSUMER_KEY
  const consumerSecret = process.env.X_CONSUMER_SECRET
  const accessToken = process.env.X_ACCESS_TOKEN
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    throw new Error('Missing X API credentials')
  }

  return { consumerKey, consumerSecret, accessToken, accessTokenSecret }
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null
  return new OpenAI({ apiKey })
}

function buildQuery(options: { keywords?: string[]; query?: string | null }): string {
  if (options.query && options.query.trim().length > 0) {
    return options.query.trim()
  }
  const keywords = (options.keywords || []).map((value) => value.trim()).filter(Boolean)
  if (keywords.length === 0) {
    return process.env.X_TREND_QUERY?.trim() || DEFAULT_QUERY
  }
  const quoted = keywords.map((keyword) => `"${keyword}"`).join(' OR ')
  return `${quoted} ${DEFAULT_QUERY}`
}

function extractTopics(texts: string[]) {
  const hashtagCounts = new Map<string, number>()
  const keywordCounts = new Map<string, number>()

  for (const text of texts) {
    const hashtags = text.match(/#\w+/g) || []
    for (const tag of hashtags) {
      const key = tag.toLowerCase()
      hashtagCounts.set(key, (hashtagCounts.get(key) || 0) + 1)
    }

    const tokens = text
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[^\w\s#]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token) && !token.startsWith('#'))

    for (const token of tokens) {
      keywordCounts.set(token, (keywordCounts.get(token) || 0) + 1)
    }
  }

  const topHashtags = Array.from(hashtagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }))

  const topKeywords = Array.from(keywordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword, count]) => ({ keyword, count }))

  return { topHashtags, topKeywords }
}

async function summarizeTrends(
  openai: OpenAI | null,
  options: {
    query: string
    topHashtags: Array<{ tag: string; count: number }>
    topKeywords: Array<{ keyword: string; count: number }>
    sampleTweets: string[]
  }
) {
  if (!openai) {
    return `Top hashtags: ${options.topHashtags.map((t) => t.tag).join(', ')}. Top keywords: ${options.topKeywords
      .map((t) => t.keyword)
      .join(', ')}.`
  }
  const prompt = [
    'You are a social media strategist.',
    `Summarize the biggest conversations on X for this query: ${options.query}`,
    `Top hashtags: ${options.topHashtags.map((t) => t.tag).join(', ') || 'none'}`,
    `Top keywords: ${options.topKeywords.map((t) => t.keyword).join(', ') || 'none'}`,
    'Sample tweets:',
    options.sampleTweets.slice(0, 6).map((tweet) => `- ${tweet}`).join('\n'),
    'Return 4-6 bullet points, each under 20 words.',
  ].join('\n')

  const response = await openai.responses.create({
    model: 'gpt-4o-mini',
    input: prompt,
  })
  return response.output_text?.trim() || 'Summary unavailable.'
}

async function buildVideoSuggestions(
  openai: OpenAI | null,
  options: {
    query: string
    topHashtags: Array<{ tag: string; count: number }>
    topKeywords: Array<{ keyword: string; count: number }>
    sampleTweets: string[]
  }
) {
  const fallback = [
    ...options.topKeywords.slice(0, 5).map((item) => `Video idea: ${item.keyword}`),
    ...options.topHashtags.slice(0, 3).map((item) => `Explainer on ${item.tag.replace('#', '')}`),
  ].slice(0, 5)

  if (!openai) {
    return fallback
  }

  const prompt = [
    'You are a YouTube strategist.',
    `Based on this X trend query: ${options.query}`,
    `Top hashtags: ${options.topHashtags.map((t) => t.tag).join(', ') || 'none'}`,
    `Top keywords: ${options.topKeywords.map((t) => t.keyword).join(', ') || 'none'}`,
    'Sample tweets:',
    options.sampleTweets.slice(0, 6).map((tweet) => `- ${tweet}`).join('\n'),
    'Return 3-5 concise YouTube video topic ideas (no numbering, one per line).',
  ].join('\n')

  const response = await openai.responses.create({
    model: 'gpt-4o-mini',
    input: prompt,
  })

  const text = response.output_text?.trim()
  if (!text) return fallback

  const ideas = text
    .split('\n')
    .map((line) => line.replace(/^\s*[-•\d.]+\s*/, '').trim())
    .filter(Boolean)

  return ideas.length ? ideas.slice(0, 5) : fallback
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const credentials = getCredentials()
    const openai = getOpenAIClient()
    const maxResults = Math.min(Number(body.maxResults ?? 40), 100)
    const query = buildQuery({ keywords: body.keywords, query: body.query })

    const results = await searchRecentTweets({
      query,
      maxResults,
      credentials,
    })
    const tweets = results.data ?? []
    const sampleTweets = tweets.map((tweet) => tweet.text).slice(0, 10)
    const { topHashtags, topKeywords } = extractTopics(sampleTweets)
    const summary = await summarizeTrends(openai, {
      query,
      topHashtags,
      topKeywords,
      sampleTweets,
    })
    const videoSuggestions = await buildVideoSuggestions(openai, {
      query,
      topHashtags,
      topKeywords,
      sampleTweets,
    })

    return NextResponse.json({
      success: true,
      query,
      totalTweets: tweets.length,
      topHashtags,
      topKeywords,
      summary,
      videoSuggestions,
      sampleTweets,
    })
  } catch (error) {
    console.error('[X Agent] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'X agent failed' },
      { status: 500 }
    )
  }
}
