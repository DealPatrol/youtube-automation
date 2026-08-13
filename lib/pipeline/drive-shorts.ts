import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import type { Readable } from 'stream'
import { pipeline as streamPipeline } from 'stream/promises'

import { google } from 'googleapis'
import type { drive_v3 } from 'googleapis'

import type { GeneratedContent } from '@/lib/content/generation'
import { createJob, jobPath, relativeToJob, saveJob } from './job-store'
import { writeRightsManifest } from './rights'
import type { PipelineJob, RightsRecord } from './types'
import { isPublishConfigured, publishToYouTube } from './youtube'

type CliFlags = Record<string, string | boolean>

export interface DriveVideoCandidate {
  id: string
  name: string
  mimeType?: string
  sizeBytes?: number
  webViewLink?: string
  modifiedTime?: string
  durationSeconds?: number
  width?: number
  height?: number
}

interface DriveShortsOptions {
  query: string
  folderId?: string
  limit: number
  privacy: PipelineJob['config']['privacy']
  publish: boolean
  maxSeconds: number
  requireVertical: boolean
  license: string
}

const DRIVE_AUTH_PORT = Number(process.env.DRIVE_AUTH_PORT || process.env.PIPELINE_AUTH_PORT || 8787)
const DRIVE_AUTH_REDIRECT = `http://localhost:${DRIVE_AUTH_PORT}/callback`
const DRIVE_AUTH_SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

function resolveGoogleClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId =
    process.env.GOOGLE_DRIVE_CLIENT_ID ||
    process.env.YOUTUBE_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret =
    process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
    process.env.YOUTUBE_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'Set GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET or reuse YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET'
    )
  }

  return { clientId, clientSecret }
}

function buildDriveOAuthClient() {
  const { clientId, clientSecret } = resolveGoogleClientCredentials()
  return new google.auth.OAuth2(clientId, clientSecret, DRIVE_AUTH_REDIRECT)
}

function buildAuthorizedDriveClient(): drive_v3.Drive {
  const refreshToken =
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN ||
    process.env.GOOGLE_REFRESH_TOKEN ||
    process.env.YOUTUBE_REFRESH_TOKEN

  if (!refreshToken?.trim()) {
    throw new Error('Set GOOGLE_DRIVE_REFRESH_TOKEN in .env (run: npm run pipeline -- drive-auth)')
  }

  const oauth2 = buildDriveOAuthClient()
  oauth2.setCredentials({ refresh_token: refreshToken.trim() })
  return google.drive({ version: 'v3', auth: oauth2 })
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function buildDriveVideoQuery(options: { query?: string; folderId?: string }): string {
  const clauses = ["mimeType contains 'video/'", 'trashed = false']
  const query = options.query?.trim()
  const folderId = options.folderId?.trim()

  if (query) clauses.push(`name contains '${escapeDriveQueryValue(query)}'`)
  if (folderId) clauses.push(`'${escapeDriveQueryValue(folderId)}' in parents`)

  return clauses.join(' and ')
}

function numberFromDrive(value: string | number | null | undefined): number | undefined {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function mapDriveFile(file: drive_v3.Schema$File): DriveVideoCandidate | null {
  if (!file.id || !file.name) return null
  const durationMillis = numberFromDrive(file.videoMediaMetadata?.durationMillis)

  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType || undefined,
    sizeBytes: numberFromDrive(file.size),
    webViewLink: file.webViewLink || undefined,
    modifiedTime: file.modifiedTime || undefined,
    durationSeconds: durationMillis ? Math.round(durationMillis / 1000) : undefined,
    width: numberFromDrive(file.videoMediaMetadata?.width),
    height: numberFromDrive(file.videoMediaMetadata?.height),
  }
}

async function discoverDriveVideos(options: DriveShortsOptions): Promise<DriveVideoCandidate[]> {
  const drive = buildAuthorizedDriveClient()
  const response = await drive.files.list({
    q: buildDriveVideoQuery({ query: options.query, folderId: options.folderId }),
    pageSize: Math.min(Math.max(options.limit * 3, options.limit), 100),
    orderBy: 'modifiedTime desc',
    fields:
      'files(id,name,mimeType,size,webViewLink,modifiedTime,videoMediaMetadata(durationMillis,width,height))',
    spaces: 'drive',
  })

  return (response.data.files || [])
    .map(mapDriveFile)
    .filter((candidate): candidate is DriveVideoCandidate => Boolean(candidate))
}

function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || 'drive-video.mp4'
}

function titleFromFileName(name: string): string {
  const parsed = path.parse(name)
  return parsed.name
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function clampTitle(title: string): string {
  return title.length <= 100 ? title : `${title.slice(0, 97).trim()}...`
}

function formatDuration(seconds?: number): string {
  if (!seconds) return 'unknown duration'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`
}

export function buildDriveShortsContent(candidate: DriveVideoCandidate): GeneratedContent {
  const baseTitle = titleFromFileName(candidate.name) || 'Daily Motivation'
  const seoTitle = clampTitle(
    /motivation|motivational/i.test(baseTitle)
      ? `${baseTitle} #Shorts`
      : `Daily Motivation: ${baseTitle} #Shorts`
  )
  const durationSeconds = Math.max(1, candidate.durationSeconds || 60)
  const description = [
    'A short motivational clip for daily focus and momentum.',
    '',
    '#motivation #shorts #mindset',
  ].join('\n')

  return {
    script: {
      title: seoTitle,
      duration: durationSeconds / 60,
      content: `User-provided motivation video from Google Drive: ${baseTitle}`,
      sections: [
        {
          time: '0:00',
          speaker: 'Source video',
          text: baseTitle,
        },
      ],
    },
    scenes: [
      {
        id: 1,
        title: baseTitle,
        start_time: '0:00',
        end_time: formatDuration(durationSeconds),
        duration: durationSeconds,
        visual_description: 'User-provided vertical motivation video from Google Drive',
        on_screen_text: baseTitle,
        narration: baseTitle,
      },
    ],
    capcut_steps: ['Review the staged source clip, confirm it is vertical, then publish as a YouTube Short.'],
    seo: {
      title: seoTitle,
      description,
      tags: ['motivation', 'shorts', 'mindset', 'discipline', 'self improvement'],
      keywords: ['motivation', 'daily motivation', 'mindset', 'discipline'],
      hashtags: ['#motivation', '#shorts', '#mindset'],
      thumbnail_tips: 'Use the strongest frame with readable, high-contrast text.',
      pinned_comment: 'What is one goal you are working toward today?',
    },
    thumbnail: {
      text: 'Daily Motivation',
      image_prompt: 'High-contrast motivational short thumbnail',
      emotion: 'determined',
      design_description: 'Bold text over the most compelling frame from the source clip.',
      color_palette: ['black', 'white', 'yellow'],
      text_suggestions: ['Daily Motivation', 'Keep Going', 'Start Now'],
      layout_tips: 'Keep text large enough for mobile viewing.',
      accessibility_notes: 'Use high contrast and avoid covering faces or captions.',
    },
  }
}

function isShortsFriendly(candidate: DriveVideoCandidate, options: DriveShortsOptions): boolean {
  const duration = candidate.durationSeconds || 0
  if (duration > options.maxSeconds) return false
  if (!options.requireVertical) return true
  if (!candidate.width || !candidate.height) return true
  return candidate.height >= candidate.width
}

async function downloadDriveVideo(
  drive: drive_v3.Drive,
  candidate: DriveVideoCandidate,
  outFile: string
): Promise<void> {
  const response = await drive.files.get(
    { fileId: candidate.id, alt: 'media' },
    { responseType: 'stream' }
  )
  await streamPipeline(response.data as Readable, fs.createWriteStream(outFile))
}

async function createDriveShortsJob(
  candidate: DriveVideoCandidate,
  options: DriveShortsOptions
): Promise<PipelineJob> {
  const durationSeconds = Math.max(1, candidate.durationSeconds || 60)
  const job = await createJob({
    topic: titleFromFileName(candidate.name) || 'Daily Motivation',
    platform: 'youtube',
    durationMinutes: durationSeconds / 60,
    tone: 'motivational',
    aspectRatio: '9:16',
    privacy: options.privacy,
    autoApprove: true,
    publishAfterRender: options.publish,
  })

  const drive = buildAuthorizedDriveClient()
  const sourceFile = await jobPath(job.id, 'source', safeFileName(candidate.name))
  console.log(`[drive-shorts] Downloading "${candidate.name}" -> ${sourceFile}`)
  await downloadDriveVideo(drive, candidate, sourceFile)

  job.status = 'rendered'
  job.trends = {
    candidates: [],
    selected: {
      source: 'manual',
      topic: job.config.topic || 'Daily Motivation',
      score: 100,
      detail: 'Google Drive source video',
      url: candidate.webViewLink,
    },
  }
  job.content = buildDriveShortsContent(candidate)
  job.render = {
    videoFile: sourceFile,
    durationSeconds,
    width: candidate.width || 1080,
    height: candidate.height || 1920,
  }

  const rightsRecord: RightsRecord = {
    assetId: `drive-video-${candidate.id}`,
    file: relativeToJob(job.id, sourceFile),
    type: 'video',
    provider: 'google-drive',
    license: options.license,
    generatedByAI: false,
    retrievedAt: new Date().toISOString(),
  }
  job.rightsRecords = [rightsRecord]

  const manifestFile = await jobPath(job.id, 'rights-manifest.json')
  const manifest = await writeRightsManifest(job, manifestFile)
  job.rights = {
    manifestFile,
    assetCount: manifest.assets.length,
    aiDisclosure: manifest.aiDisclosure,
  }
  await saveJob(job)

  if (!options.publish) return job

  if (!isPublishConfigured()) {
    console.log('[drive-shorts] YouTube credentials not configured — staged but not published.')
    console.log(`[drive-shorts] Publish later with: npm run pipeline -- publish ${job.id} --privacy ${options.privacy}`)
    return job
  }

  job.status = 'publishing'
  await saveJob(job)
  job.publish = await publishToYouTube({ job, manifest, privacy: options.privacy })
  job.status = 'published'
  await saveJob(job)
  return job
}

function hasFlag(flags: CliFlags, ...names: string[]): boolean {
  return names.some((name) => flags[name] === true || flags[name] === 'true')
}

function stringFlag(flags: CliFlags, name: string, fallback: string): string {
  const value = flags[name]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function numberFlag(flags: CliFlags, name: string, fallback: number): number {
  const parsed = Number(flags[name])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parsePrivacy(value: string): PipelineJob['config']['privacy'] {
  if (value === 'private' || value === 'unlisted' || value === 'public') return value
  throw new Error(`Invalid --privacy "${value}" (use private | unlisted | public)`)
}

function parseDriveShortsOptions(flags: CliFlags): DriveShortsOptions & { dryRun: boolean } {
  const publish = hasFlag(flags, 'publish')
  const stage = hasFlag(flags, 'stage')
  const dryRun = hasFlag(flags, 'dry-run', 'dryRun') || (!stage && !publish)
  const privacy = parsePrivacy(stringFlag(flags, 'privacy', 'private'))
  const maxSeconds = numberFlag(flags, 'max-seconds', 180)
  const license = stringFlag(flags, 'license', 'User-confirmed owned or licensed content')

  if (dryRun && publish) {
    throw new Error('Use either --dry-run or --publish, not both')
  }
  if (!dryRun && !hasFlag(flags, 'confirm-rights', 'confirmRights')) {
    throw new Error(
      'Refusing to stage Drive videos without --confirm-rights. Only use videos you own or are licensed to upload.'
    )
  }

  return {
    query: stringFlag(flags, 'query', 'motivation'),
    folderId: typeof flags.folder === 'string' ? flags.folder.trim() : undefined,
    limit: Math.min(numberFlag(flags, 'limit', 3), 20),
    privacy,
    publish,
    maxSeconds,
    requireVertical: !hasFlag(flags, 'allow-landscape', 'allowLandscape'),
    license,
    dryRun,
  }
}

function printCandidate(candidate: DriveVideoCandidate): void {
  const dimensions = candidate.width && candidate.height ? `${candidate.width}x${candidate.height}` : 'unknown size'
  console.log(
    `  - ${candidate.name} (${formatDuration(candidate.durationSeconds)}, ${dimensions}, modified ${
      candidate.modifiedTime || 'unknown'
    })`
  )
}

export async function runDriveAuthFlow(): Promise<void> {
  const oauth2 = buildDriveOAuthClient()
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: DRIVE_AUTH_SCOPES,
  })

  console.log('\nOpen this URL in your browser and authorize read-only Google Drive access:\n')
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
  console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}\n`)
}

export async function runDriveShortsFlow(flags: CliFlags): Promise<void> {
  const options = parseDriveShortsOptions(flags)
  const candidates = await discoverDriveVideos(options)
  const usable = candidates.filter((candidate) => isShortsFriendly(candidate, options)).slice(0, options.limit)
  const skipped = candidates.length - usable.length

  console.log(`\n[drive-shorts] Found ${candidates.length} Drive video candidate(s) for "${options.query}".`)
  if (skipped > 0) {
    console.log(
      `[drive-shorts] Skipped ${skipped} candidate(s) due to duration > ${options.maxSeconds}s or landscape orientation.`
    )
  }

  if (usable.length === 0) {
    console.log('[drive-shorts] No Shorts-friendly videos found. Try --allow-landscape or --max-seconds 300.')
    return
  }

  if (options.dryRun) {
    console.log('[drive-shorts] Preview only. Add --stage --confirm-rights to download and stage jobs.')
    for (const candidate of usable) printCandidate(candidate)
    return
  }

  for (const candidate of usable) {
    const job = await createDriveShortsJob(candidate, options)
    console.log(
      `[drive-shorts] ${job.status === 'published' ? 'Published' : 'Staged'} ${job.id}${
        job.publish ? ` -> ${job.publish.url}` : ''
      }`
    )
  }
}
