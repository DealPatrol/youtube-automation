import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import { pipeline } from 'stream/promises'

import { google } from 'googleapis'

import { assertPublishable } from './rights'
import type { RightsManifest, RightsRecord } from './types'

type DriveVideoFile = {
  id: string
  name: string
  mimeType?: string | null
  size?: string | null
  webViewLink?: string | null
  modifiedTime?: string | null
}

export type DriveShortsRunOptions = {
  query: string
  maxResults: number
  folderId?: string
  publish: boolean
  rightsConfirmed: boolean
  privacy: 'private' | 'unlisted' | 'public'
  outputDir?: string
}

export type DriveShortsCandidate = {
  id: string
  name: string
  mimeType?: string | null
  size?: string | null
  modifiedTime?: string | null
  webViewLink?: string | null
}

export type DriveShortsPublishResult = {
  driveFileId: string
  driveFileName: string
  localFile: string
  manifestFile: string
  videoId: string
  url: string
  privacy: string
}

const DRIVE_AUTH_PORT = Number(process.env.DRIVE_AUTH_PORT || process.env.PIPELINE_AUTH_PORT || 8787)
const DRIVE_AUTH_REDIRECT = `http://localhost:${DRIVE_AUTH_PORT}/callback`
const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
const DEFAULT_DESCRIPTION =
  'Motivational short uploaded from an owned or licensed Google Drive video. #motivation #shorts'

function resolveDriveCredentials(): { clientId: string; clientSecret: string } {
  const clientId =
    process.env.DRIVE_CLIENT_ID ||
    process.env.GOOGLE_DRIVE_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.YOUTUBE_CLIENT_ID
  const clientSecret =
    process.env.DRIVE_CLIENT_SECRET ||
    process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    process.env.YOUTUBE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Set DRIVE_CLIENT_ID and DRIVE_CLIENT_SECRET (or GOOGLE_OAUTH_CLIENT_* values) to read Drive videos')
  }
  return { clientId, clientSecret }
}

function resolveYouTubeCredentials(): { clientId: string; clientSecret: string; refreshToken: string } {
  const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN?.trim()
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN to publish')
  }
  return { clientId, clientSecret, refreshToken }
}

function buildDriveClient() {
  const { clientId, clientSecret } = resolveDriveCredentials()
  const refreshToken = (
    process.env.DRIVE_REFRESH_TOKEN ||
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN ||
    process.env.GOOGLE_REFRESH_TOKEN ||
    ''
  ).trim()
  if (!refreshToken) {
    throw new Error('Set DRIVE_REFRESH_TOKEN in .env (run: npm run pipeline -- drive-auth)')
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, DRIVE_AUTH_REDIRECT)
  oauth2.setCredentials({ refresh_token: refreshToken })
  return google.drive({ version: 'v3', auth: oauth2 })
}

function buildYouTubeClient() {
  const { clientId, clientSecret, refreshToken } = resolveYouTubeCredentials()
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, DRIVE_AUTH_REDIRECT)
  oauth2.setCredentials({ refresh_token: refreshToken })
  return google.youtube({ version: 'v3', auth: oauth2 })
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function buildDriveVideoQuery(options: { query: string; folderId?: string }): string {
  const clauses = ["mimeType contains 'video/'", 'trashed = false']
  const query = options.query.trim()
  if (query) clauses.push(`name contains '${escapeDriveQueryValue(query)}'`)
  if (options.folderId?.trim()) clauses.push(`'${escapeDriveQueryValue(options.folderId.trim())}' in parents`)
  return clauses.join(' and ')
}

function sanitizeFileName(value: string): string {
  return value
    .trim()
    .replace(/\.[a-zA-Z0-9]{1,6}$/, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .trim()
}

function truncateTitle(value: string): string {
  return value.length <= 95 ? value : `${value.slice(0, 92).trim()}...`
}

export function buildDriveShortMetadata(fileName: string): { title: string; description: string; tags: string[] } {
  const baseName = sanitizeFileName(fileName) || 'Motivation Short'
  const title = truncateTitle(baseName.toLowerCase().includes('motivation') ? baseName : `${baseName} | Motivation`)
  return {
    title,
    description: DEFAULT_DESCRIPTION,
    tags: ['motivation', 'motivational video', 'shorts', 'mindset', 'inspiration'],
  }
}

export function assertDriveShortsPublishAllowed(options: {
  publish: boolean
  rightsConfirmed: boolean
  privacy: 'private' | 'unlisted' | 'public'
}): void {
  if (!options.publish) return
  if (!options.rightsConfirmed) {
    throw new Error('Refusing to publish Drive videos without --rights-confirmed')
  }
  if (!['private', 'unlisted', 'public'].includes(options.privacy)) {
    throw new Error(`Invalid privacy setting: ${options.privacy}`)
  }
}

export async function runDriveAuthFlow(): Promise<void> {
  const { clientId, clientSecret } = resolveDriveCredentials()
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, DRIVE_AUTH_REDIRECT)
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: DRIVE_SCOPES,
  })

  console.log('\nOpen this URL in your browser and authorize Google Drive read-only access:\n')
  console.log(`  ${authUrl}\n`)
  console.log(`Waiting for the OAuth redirect on ${DRIVE_AUTH_REDIRECT} ...`)
  console.log('(Add this exact redirect URI to your Google Cloud OAuth client if it is missing.)\n')

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${DRIVE_AUTH_PORT}`)
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
    server.listen(DRIVE_AUTH_PORT)
  })

  const { tokens } = await oauth2.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. Remove prior app access at https://myaccount.google.com/permissions and rerun.'
    )
  }

  console.log('\nSuccess! Add this line to your .env:\n')
  console.log(`DRIVE_REFRESH_TOKEN=${tokens.refresh_token}\n`)
}

export async function searchDriveVideos(options: {
  query: string
  maxResults: number
  folderId?: string
}): Promise<DriveShortsCandidate[]> {
  const drive = buildDriveClient()
  const response = await drive.files.list({
    q: buildDriveVideoQuery(options),
    pageSize: Math.min(Math.max(options.maxResults, 1), 20),
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,size,webViewLink,modifiedTime)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  return (response.data.files || [])
    .filter((file): file is DriveVideoFile => Boolean(file.id && file.name))
    .map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink,
    }))
}

async function downloadDriveVideo(file: DriveShortsCandidate, outputDir: string): Promise<string> {
  const drive = buildDriveClient()
  await fs.promises.mkdir(outputDir, { recursive: true })
  const extension = path.extname(file.name) || '.mp4'
  const localFile = path.join(outputDir, `${file.id}-${sanitizeFileName(file.name) || 'drive-video'}${extension}`)
  const response = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'stream' })
  await pipeline(response.data, fs.createWriteStream(localFile))
  return localFile
}

function buildRightsManifest(file: DriveShortsCandidate, localFile: string, title: string): RightsManifest {
  const record: RightsRecord = {
    assetId: `drive-video-${file.id}`,
    file: localFile,
    type: 'video',
    provider: 'google-drive',
    license: 'User-confirmed owned or licensed source video',
    sourceUrl: file.webViewLink || `drive://${file.id}`,
    generatedByAI: false,
    retrievedAt: new Date().toISOString(),
  }
  return {
    jobId: `drive-${file.id}`,
    createdAt: new Date().toISOString(),
    video: { title, durationSeconds: 0 },
    assets: [record],
    attributionText: '',
    aiDisclosure: false,
  }
}

async function publishVideoFile(options: {
  file: DriveShortsCandidate
  localFile: string
  manifest: RightsManifest
  privacy: 'private' | 'unlisted' | 'public'
}): Promise<{ videoId: string; url: string; privacy: string }> {
  assertPublishable(options.manifest)
  const youtube = buildYouTubeClient()
  const metadata = buildDriveShortMetadata(options.file.name)
  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        categoryId: '22',
        defaultLanguage: 'en',
      },
      status: {
        privacyStatus: options.privacy,
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: false,
      },
    },
    media: { body: fs.createReadStream(options.localFile) },
  })

  const videoId = response.data.id
  if (!videoId) throw new Error(`YouTube upload did not return a video id for ${options.file.name}`)
  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    privacy: options.privacy,
  }
}

export async function runDriveShorts(options: DriveShortsRunOptions): Promise<{
  candidates: DriveShortsCandidate[]
  published: DriveShortsPublishResult[]
}> {
  assertDriveShortsPublishAllowed(options)
  const candidates = await searchDriveVideos(options)
  const published: DriveShortsPublishResult[] = []
  if (!options.publish) return { candidates, published }

  const outputDir = options.outputDir || path.join(process.cwd(), 'content', 'drive-shorts', new Date().toISOString().slice(0, 10))
  for (const candidate of candidates) {
    console.log(`[drive-shorts] Downloading ${candidate.name}`)
    const localFile = await downloadDriveVideo(candidate, outputDir)
    const metadata = buildDriveShortMetadata(candidate.name)
    const manifest = buildRightsManifest(candidate, localFile, metadata.title)
    const manifestFile = path.join(outputDir, `${candidate.id}-rights-manifest.json`)
    await fs.promises.writeFile(manifestFile, JSON.stringify(manifest, null, 2))

    console.log(`[drive-shorts] Uploading ${candidate.name} (${options.privacy})`)
    const upload = await publishVideoFile({
      file: candidate,
      localFile,
      manifest,
      privacy: options.privacy,
    })
    published.push({
      driveFileId: candidate.id,
      driveFileName: candidate.name,
      localFile,
      manifestFile,
      videoId: upload.videoId,
      url: upload.url,
      privacy: upload.privacy,
    })
  }

  return { candidates, published }
}
