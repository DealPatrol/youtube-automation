import crypto from 'node:crypto'

type SearchTweet = {
  id: string
  text: string
  created_at?: string
  public_metrics?: {
    retweet_count?: number
    reply_count?: number
    like_count?: number
  }
}

export type XCredentials = {
  consumerKey: string
  consumerSecret: string
  accessToken: string
  accessTokenSecret: string
}

function percentEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

function buildOAuthHeader(method: string, url: string, query: Record<string, string>, creds: XCredentials) {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  }

  const signatureParams = { ...query, ...oauthParams }
  const normalized = Object.keys(signatureParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(signatureParams[key])}`)
    .join('&')

  const signatureBase = [method.toUpperCase(), percentEncode(url), percentEncode(normalized)].join('&')
  const signingKey = `${percentEncode(creds.consumerSecret)}&${percentEncode(creds.accessTokenSecret)}`

  oauthParams.oauth_signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64')

  return `OAuth ${Object.keys(oauthParams)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
    .join(', ')}`
}

export async function searchRecentTweets(options: {
  query: string
  maxResults?: number
  credentials: XCredentials
}): Promise<{ data?: SearchTweet[] }> {
  const endpoint = 'https://api.twitter.com/2/tweets/search/recent'
  const query = {
    query: options.query,
    max_results: String(Math.min(Math.max(options.maxResults ?? 40, 10), 100)),
    'tweet.fields': 'created_at,public_metrics',
  }

  const url = `${endpoint}?${new URLSearchParams(query).toString()}`
  const response = await fetch(url, {
    headers: {
      Authorization: buildOAuthHeader('GET', endpoint, query, options.credentials),
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`X API error ${response.status}: ${detail}`)
  }

  return (await response.json()) as { data?: SearchTweet[] }
}
