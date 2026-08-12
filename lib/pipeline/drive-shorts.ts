import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

import { google, type drive_v3 } from 'googleapis'

import { formatContentTimestamp } from '@/lib/content/generation'
import { createJob, jobDir, jobPath, relativeToJob, saveJob } from './job-store'
import { writeRightsManifest } from './rights'
import { isPublishConfigured, publishToYouTube } from './youtube'
import type { PipelineJob, RightsManifest, RightsRecord } from './types'

const DRIVE_AUTH_PORT = Number(process.env.PIPELINE_AUTH_PORT || 8787)
const DRIVE_AUTH_REDIRECT = `http://localhost:${DRIVE_AUTH_PORT}/callback`
const DRIVE_SHORTS_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.force-ssl',
]
const DEFAULT_DRIVE_QUERY = 'motivation'
const DEFAULT_TAGS = ['motivation', 'inspiration', 'shorts']
const MAX_IMPORT_LIMIT = 10
const SAFE_TITLE_LENGTH = 95

export type DriveShortsPrivacy = 'private' | 'unlisted' | 'public'

export interface DriveShortsOptions {
  query?: string
  folderId?: string
  fileIds: string[]
  limit: number
  privacy: DriveShortsPrivacy
  publish: boolean
  dryRun: boolean
  license: string
  credit?: string
  titlePrefix?: string
  description?: string
  tags: string[]
  aiDisclosure: boolean
}

export interface DriveVideoCandidate {
  id: string
  name: string
  mimeType: string
  size?: string
  webViewLink?: string
  durationSeconds?: number
  width?: number
  height?: number
  modifiedTime?: string
}

export interface DriveShortsResult {
  candidate: DriveVideoCandidate
  jobId?: string
  jobDir?: string
  videoFile?: string
  rightsManifestFile?: string
  youtubeUrl?: string
  skippedPublishReason?: string
}

function resolveClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET before using Google Drive Shorts import')
  }
  return { clientId, clientSecret }
}

function resolveRefreshToken(): string {
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || process.env.YOUTUBE_REFRESH_TOKEN
  if (!refreshToken?.trim()) {
    throw new Error('Set GOOGLE_DRIVE_REFRESH_TOKEN or YOUTUBE_REFRESH_TOKEN (run: npm run pipeline -- drive-auth)')
  }
  return refreshToken.trim()
}

function buildAuthorizedDriveClient(): drive_v3.Drive {
  const { clientId, clientSecret } = resolveClientCredentials()
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, DRIVE_AUTH_REDIRECT)
  oauth2.setCredentials({ refresh_token: resolveRefreshToken() })
  return google.drive({ version: 'v3', auth: oauth2 })
}

function sanitizeFileName(value: string): string {
  const sanitized = value
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return sanitized || 'drive-short'
}

function titleCaseFromFileName(value: string): string {
  const stem = value.replace(/\.[^.]+$/, '')
  const spaced = stem.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!spaced) return 'Motivation Short'
  return spaced.replace(/\b\w/g, (char) => char.toUpperCase())
}

function escapeDriveQueryLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function buildDriveVideoSearchQuery(input: { query?: string; folderId?: string }): string {
  const clauses = ["mimeType contains 'video/'", 'trashed = false']
  const term = (input.query || DEFAULT_DRIVE_QUERY).trim()
  if (term) {
    const escaped = escapeDriveQueryLiteral(term)
    clauses.push(`(name contains '${escaped}' or fullText contains '${escaped}')`)
  }
  if (input.folderId?.trim()) {
    clauses.push(`'${escapeDriveQueryLiteral(input.folderId.trim())}' in parents`)
  }
  return clauses.join(' and ')
}

function toCandidate(file: drive_v3.Schema$File): DriveVideoCandidate {
  const metadata = file.videoMediaMetadata
  const durationSeconds = metadata?.durationMillis
    ? Math.max(1, Math.round(Number(metadata.durationMillis) / 1000))
    : undefined

  return {
    id: file.id || '',
    name: file.name || 'Untitled Drive video',
    mimeType: file.mimeType || 'video/mp4',
    size: file.size || undefined,
    webViewLink: file.webViewLink || undefined,
    durationSeconds,
    width: metadata?.width ? Number(metadata.width) : undefined,
    height: metadata?.height ? Number(metadata.height) : undefined,
    modifiedTime: file.modifiedTime || undefined,
  }
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit < 1) return 1
  return Math.min(Math.floor(limit), MAX_IMPORT_LIMIT)
}

async function listDriveVideoCandidates(options: DriveShortsOptions): Promise<DriveVideoCandidate[]> {
  const drive = buildAuthorizedDriveClient()
  const fields = 'files(id,name,mimeType,size,webViewLink,modifiedTime,videoMediaMetadata)'

  if (options.fileIds.length > 0) {
    const candidates: DriveVideoCandidate[] = []
    for (const fileId of options.fileIds.slice(0, normalizeLimit(options.limit))) {
      const response = await drive.files.get({
        fileId,
        fields: 'id,name,mimeType,size,webViewLink,modifiedTime,videoMediaMetadata',
        supportsAllDrives: true,
      })
      const candidate = toCandidate(response.data)
      if (!candidate.id) throw new Error(`Drive file ${fileId} did not return an id`)
      if (!candidate.mimeType.startsWith('video/')) {
        throw new Error(`Drive file ${candidate.name} is ${candidate.mimeType}, not a video`)
      }
      candidates.push(candidate)
    }
    return candidates
  }

  const response = await drive.files.list({
    q: buildDriveVideoSearchQuery(options),
    pageSize: normalizeLimit(options.limit),
    orderBy: 'modifiedTime desc',
    fields,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  return (response.data.files || [])
    .map(toCandidate)
    .filter((candidate) => candidate.id && candidate.mimeType.startsWith('video/'))
}

async function downloadDriveVideo(candidate: DriveVideoCandidate, outFile: string): Promise<void> {
  const drive = buildAuthorizedDriveClient()
  const response = await drive.files.get(
    { fileId: candidate.id, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  )

  await fs.promises.mkdir(path.dirname(outFile), { recursive: true })
  await pipeline(response.data as Readable, fs.createWriteStream(outFile))
}

function buildImportedContent(candidate: DriveVideoCandidate, options: DriveShortsOptions): PipelineJob['content'] {
  const baseTitle = titleCaseFromFileName(candidate.name)
  const title = `${options.titlePrefix ? `${options.titlePrefix.trim()} ` : ''}${baseTitle}`.slice(
    0,
    SAFE_TITLE_LENGTH
  )
  const durationSeconds = candidate.durationSeconds || 60
  const hashtags = ['#Shorts', '#Motivation']
  const description =
    options.description?.trim() ||
    [
      'A short motivation clip for daily momentum.',
      '',
      hashtags.join(' '),
    ].join('\n')

  return {
    script: {
      title,
      duration: durationSeconds / 60,
      content: `Imported Google Drive video: ${candidate.name}`,
      sections: [
        {
          time: '0:00',
          speaker: 'Source video',
          text: `Imported source clip ${candidate.name}`,
        },
      ],
    },
    scenes: [
      {
        id: 1,
        title,
        start_time: '0:00',
        end_time: formatContentTimestamp(durationSeconds),
        duration: durationSeconds,
        visual_description: `Imported Google Drive source video: ${candidate.name}`,
        on_screen_text: title,
        narration: '',
      },
    ],
    capcut_steps: ['Imported directly from Google Drive as a YouTube Short source clip.'],
    seo: {
      title,
      description,
      tags: options.tags,
      keywords: options.tags,
      hashtags,
      thumbnail_tips: 'Use a high-contrast frame with 2-4 words of motivational text.',
      pinned_comment: 'What is one goal you are committing to today?',
    },
    thumbnail: {
      text: title.slice(0, 40),
      image_prompt: `Motivational thumbnail for ${title}`,
      emotion: 'inspired',
      design_description: 'High contrast vertical motivational short thumbnail.',
      color_palette: ['black', 'white', 'gold'],
      text_suggestions: [title.slice(0, 40)],
      layout_tips: 'Keep text large and mobile-readable.',
      accessibility_notes: 'Use strong contrast and avoid dense text.',
    },
  }
}

function buildRightsRecord(
  candidate: DriveVideoCandidate,
  videoFile: string,
  options: DriveShortsOptions
): RightsRecord {
  return {
    assetId: `drive-video-${candidate.id}`,
    file: videoFile,
    type: 'video',
    provider: 'google-drive',
    license: options.license,
    sourceUrl: candidate.webViewLink,
    credit: options.credit,
    generatedByAI: options.aiDisclosure,
    retrievedAt: new Date().toISOString(),
  }
}

async function createImportedDriveJob(
  candidate: DriveVideoCandidate,
  options: DriveShortsOptions
): Promise<{ job: PipelineJob; manifest: RightsManifest }> {
  const durationSeconds = candidate.durationSeconds || 60
  const job = await createJob({
    topic: `Imported Drive Short: ${candidate.name}`,
    platform: 'youtube',
    durationMinutes: durationSeconds / 60,
    tone: 'motivational',
    aspectRatio: '9:16',
    privacy: options.privacy,
    autoApprove: true,
    publishAfterRender: options.publish,
  })

  const extension = path.extname(candidate.name) || '.mp4'
  const videoFile = await jobPath(job.id, 'render', `${sanitizeFileName(candidate.name)}${extension}`)
  await downloadDriveVideo(candidate, videoFile)

  job.content = buildImportedContent(candidate, options)
  job.render = {
    videoFile,
    durationSeconds,
    width: candidate.width || 1080,
    height: candidate.height || 1920,
  }
  job.rightsRecords = [buildRightsRecord(candidate, videoFile, options)].map((record) => ({
    ...record,
    file: relativeToJob(job.id, record.file),
  }))
  job.status = 'rendered'

  const manifestFile = await jobPath(job.id, 'rights-manifest.json')
  const manifest = await writeRightsManifest(job, manifestFile)
  job.rights = {
    manifestFile,
    assetCount: manifest.assets.length,
    aiDisclosure: manifest.aiDisclosure,
  }
  await saveJob(job)
  return { job, manifest }
}

export async function publishDriveShortsFromGoogleDrive(options: DriveShortsOptions): Promise<DriveShortsResult[]> {
  const candidates = await listDriveVideoCandidates({ ...options, limit: normalizeLimit(options.limit) })
  if (options.dryRun) {
    return candidates.map((candidate) => ({ candidate }))
  }

  const results: DriveShortsResult[] = []
  for (const candidate of candidates) {
    const { job, manifest } = await createImportedDriveJob(candidate, options)
    const result: DriveShortsResult = {
      candidate,
      jobId: job.id,
      jobDir: jobDir(job.id),
      videoFile: job.render!.videoFile,
      rightsManifestFile: job.rights!.manifestFile,
    }

    if (options.publish) {
      if (isPublishConfigured()) {
        job.publish = await publishToYouTube({ job, manifest, privacy: options.privacy })
        job.status = 'published'
        await saveJob(job)
        result.youtubeUrl = job.publish.url
      } else {
        result.skippedPublishReason =
          'YouTube credentials are not configured. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and a refresh token.'
      }
    }

    results.push(result)
  }
  return results
}

export async function runDriveShortsAuthFlow(): Promise<void> {
  const { clientId, clientSecret } = resolveClientCredentials()
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, DRIVE_AUTH_REDIRECT)
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: DRIVE_SHORTS_SCOPES,
  })

  console.log('\nOpen this URL in your browser and authorize Drive read + YouTube upload:\n')
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

  console.log('\nSuccess! Add this refresh token to .env for both Drive import and YouTube publish:\n')
  console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`)
  console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}\n`)
}

export function buildDriveShortsOptions(flags: Record<string, string | boolean>): DriveShortsOptions {
  const privacy = String(flags.privacy || 'private')
  if (!['private', 'unlisted', 'public'].includes(privacy)) {
    throw new Error(`Invalid --privacy "${privacy}" (use private | unlisted | public)`)
  }

  const tags =
    typeof flags.tags === 'string'
      ? flags.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      : DEFAULT_TAGS

  const fileIds =
    typeof flags.fileId === 'string'
      ? flags.fileId
          .split(',')
          .map((fileId) => fileId.trim())
          .filter(Boolean)
      : []

  return {
    query: typeof flags.query === 'string' ? flags.query : DEFAULT_DRIVE_QUERY,
    folderId: typeof flags.folderId === 'string' ? flags.folderId : undefined,
    fileIds,
    limit: normalizeLimit(Number(flags.limit || 1)),
    privacy: privacy as DriveShortsPrivacy,
    publish: Boolean(flags.publish),
    dryRun: Boolean(flags.dryRun),
    license:
      typeof flags.license === 'string'
        ? flags.license
        : 'User-provided Google Drive asset; uploader is responsible for reuse rights',
    credit: typeof flags.credit === 'string' ? flags.credit : undefined,
    titlePrefix: typeof flags.titlePrefix === 'string' ? flags.titlePrefix : undefined,
    description: typeof flags.description === 'string' ? flags.description : undefined,
    tags,
    aiDisclosure: Boolean(flags.aiDisclosure),
  }
}
