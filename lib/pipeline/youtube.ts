import * as fs from 'fs'
import * as http from 'http'
import { google } from 'googleapis'

import type { PipelineJob, RightsManifest } from './types'
import { assertPublishable } from './rights'

/**
 * Stage 7b — YouTube publishing. Uses an offline refresh token so the CLI can
 * upload unattended. Run `npm run pipeline -- auth` once to obtain the token.
 */

function resolveClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env to publish')
  }
  return { clientId, clientSecret }
}

const AUTH_PORT = Number(process.env.PIPELINE_AUTH_PORT || 8787)
const AUTH_REDIRECT = `http://localhost:${AUTH_PORT}/callback`
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.force-ssl',
]

/**
 * One-time interactive OAuth flow: prints an auth URL, catches the redirect on
 * localhost, and prints the refresh token to store as YOUTUBE_REFRESH_TOKEN.
 */
export async function runAuthFlow(): Promise<void> {
  const { clientId, clientSecret } = resolveClientCredentials()
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, AUTH_REDIRECT)
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  })

  console.log('\nOpen this URL in your browser and authorize the channel:\n')
  console.log(`  ${authUrl}\n`)
  console.log(`Waiting for the OAuth redirect on ${AUTH_REDIRECT} ...`)
  console.log('(Add this exact redirect URI to your Google Cloud OAuth client if it is missing.)\n')

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${AUTH_PORT}`)
      if (url.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }
      const authCode = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        authCode
          ? '<h2>Authorized. You can close this tab and return to the terminal.</h2>'
          : `<h2>Authorization failed: ${error || 'no code returned'}</h2>`
      )
      server.close()
      if (authCode) resolve(authCode)
      else reject(new Error(`OAuth failed: ${error || 'no code returned'}`))
    })
    server.on('error', reject)
    server.listen(AUTH_PORT)
  })

  const { tokens } = await oauth2.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. Remove prior app access at https://myaccount.google.com/permissions and rerun.'
    )
  }

  console.log('\nSuccess! Add this line to your .env:\n')
  console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}\n`)
}

function buildAuthorizedClient() {
  const { clientId, clientSecret } = resolveClientCredentials()
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN?.trim()
  if (!refreshToken) {
    throw new Error('Set YOUTUBE_REFRESH_TOKEN in .env (run: npm run pipeline -- auth)')
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, AUTH_REDIRECT)
  oauth2.setCredentials({ refresh_token: refreshToken })
  return google.youtube({ version: 'v3', auth: oauth2 })
}

export function isPublishConfigured(): boolean {
  return Boolean(
    (process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID) &&
      (process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET) &&
      process.env.YOUTUBE_REFRESH_TOKEN
  )
}

export async function publishToYouTube(options: {
  job: PipelineJob
  manifest: RightsManifest
  privacy: 'private' | 'unlisted' | 'public'
}): Promise<NonNullable<PipelineJob['publish']>> {
  const { job, manifest, privacy } = options
  const content = job.content
  const render = job.render
  if (!content || !render) throw new Error('Job has no rendered video to publish')
  assertPublishable(manifest)

  const youtube = buildAuthorizedClient()

  const description = [
    content.seo.description,
    '',
    content.seo.hashtags.join(' '),
    manifest.attributionText ? `\n${manifest.attributionText}` : '',
  ]
    .join('\n')
    .trim()

  console.log(`[publish] Uploading "${content.seo.title}" (${privacy}) ...`)
  const insertResponse = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: content.seo.title,
        description,
        tags: content.seo.tags,
        categoryId: '27', // Education
        defaultLanguage: 'en',
      },
      status: {
        privacyStatus: privacy,
        selfDeclaredMadeForKids: false,
        // Required disclosure when realistic AI-generated media is present
        containsSyntheticMedia: manifest.aiDisclosure,
      },
    },
    media: { body: fs.createReadStream(render.videoFile) },
  })

  const videoId = insertResponse.data.id
  if (!videoId) throw new Error('YouTube upload did not return a video id')
  const url = `https://www.youtube.com/watch?v=${videoId}`
  console.log(`[publish] Uploaded: ${url}`)

  let captionsUploaded = false
  if (job.captions?.srtFile && fs.existsSync(job.captions.srtFile)) {
    try {
      await youtube.captions.insert({
        part: ['snippet'],
        requestBody: {
          snippet: { videoId, language: 'en', name: 'English', isDraft: false },
        },
        media: { mimeType: 'application/octet-stream', body: fs.createReadStream(job.captions.srtFile) },
      })
      captionsUploaded = true
      console.log('[publish] Captions uploaded')
    } catch (error) {
      console.warn('[publish] Caption upload failed:', error instanceof Error ? error.message : error)
    }
  }

  let thumbnailSet = false
  if (job.thumbnailFile && fs.existsSync(job.thumbnailFile)) {
    try {
      await youtube.thumbnails.set({
        videoId,
        media: { mimeType: 'image/jpeg', body: fs.createReadStream(job.thumbnailFile) },
      })
      thumbnailSet = true
      console.log('[publish] Thumbnail set')
    } catch (error) {
      // Custom thumbnails require a verified channel; not fatal
      console.warn('[publish] Thumbnail set failed:', error instanceof Error ? error.message : error)
    }
  }

  return {
    videoId,
    url,
    privacy,
    publishedAt: new Date().toISOString(),
    captionsUploaded,
    thumbnailSet,
  }
}
