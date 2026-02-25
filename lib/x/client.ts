export interface XCredentials {
  consumerKey: string
  consumerSecret: string
  accessToken: string
  accessTokenSecret: string
}

interface SearchRecentTweetsOptions {
  query: string
  maxResults?: number
  credentials: XCredentials
}

interface Tweet {
  id: string
  text: string
  created_at?: string
  public_metrics?: {
    retweet_count?: number
    reply_count?: number
    like_count?: number
  }
}

interface SearchRecentTweetsResponse {
  data?: Tweet[]
  meta?: {
    newest_id?: string
    oldest_id?: string
    result_count?: number
    next_token?: string
  }
}

/**
 * Generate an OAuth 1.0a Authorization header for the X (Twitter) API.
 */
function buildOAuth1Header(
  method: string,
  url: string,
  params: Record<string, string>,
  credentials: XCredentials
): string {
  const oauthTimestamp = Math.floor(Date.now() / 1000).toString()
  const oauthNonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: credentials.consumerKey,
    oauth_nonce: oauthNonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: oauthTimestamp,
    oauth_token: credentials.accessToken,
    oauth_version: '1.0',
  }

  // Combine all parameters for signature base
  const allParams: Record<string, string> = { ...params, ...oauthParams }
  const sortedParams = Object.keys(allParams)
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`
    )
    .join('&')

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&')

  const signingKey = `${encodeURIComponent(credentials.consumerSecret)}&${encodeURIComponent(credentials.accessTokenSecret)}`

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto')
  const encoder = new TextEncoder()
  const signature = crypto
    .createHmac('sha1', Buffer.from(signingKey))
    .update(Buffer.from(signatureBase))
    .digest('base64')

  oauthParams['oauth_signature'] = signature

  const headerValue = Object.keys(oauthParams)
    .sort()
    .map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ')

  return `OAuth ${headerValue}`
}

/**
 * Search recent tweets using the X v2 API with OAuth 1.0a authentication.
 */
export async function searchRecentTweets(
  options: SearchRecentTweetsOptions
): Promise<SearchRecentTweetsResponse> {
  const { query, maxResults = 10, credentials } = options

  const baseUrl = 'https://api.twitter.com/2/tweets/search/recent'
  const queryParams: Record<string, string> = {
    query,
    max_results: String(Math.min(Math.max(maxResults, 10), 100)),
    'tweet.fields': 'public_metrics,created_at',
  }

  const queryString = Object.keys(queryParams)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
    .join('&')

  const fullUrl = `${baseUrl}?${queryString}`

  const authHeader = buildOAuth1Header('GET', baseUrl, queryParams, credentials)

  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`X API error ${response.status}: ${errorText}`)
  }

  return response.json() as Promise<SearchRecentTweetsResponse>
}
