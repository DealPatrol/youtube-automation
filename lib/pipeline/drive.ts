import { execFile } from 'child_process'
import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import { pipeline } from 'stream/promises'
import { promisify } from 'util'

import { google } from 'googleapis'

import type { GeneratedContent } from '@/lib/content/generation'
import { formatContentTimestamp } from '@/lib/content/generation'
import { ensureFfmpegAvailable, probeMediaDuration, resolveFfmpegPath } from '@/lib/video/ffmpeg'
import { buildVideoFilter, resolveVideoFormat } from '@/lib/video/format'

import { createJob, jobPath, loadJob, relativeToJob, saveJob } from './job-store'
import { writeRightsManifest } from './rights'
import type { PipelineJob, RightsRecord } from './types'

const execFileAsync = promisify(execFile)
const DRIVE_AUTH_PORT = Number(process.env.DRIVE_AUTH_PORT || process.env.PIPELINE_AUTH_PORT || 8787)
const DRIVE_AUTH_REDIRECT = `http://localhost:${DRIVE_AUTH_PORT}/callback`
const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const SHORTS_MAX_SECONDS = 60

export interface DriveVideoCandidate {
  id: string
  name: string
  mimeType: string
  size?: string
  createdTime?: string
  modifiedTime?: string
  webViewLink?: string
  durationMillis?: string
}

export interface DriveShortsOptions {
  query: string
  maxResults: number
  privacy: 'private' | 'unlisted' | 'public'
  rightsConfirmed: boolean
  license?: string
  credit?: string
}

interface RawDriveVideoFile {
  id?: string | null
  name?: string | null
  mimeType?: string | null
  size?: string | null
  createdTime?: string | null
  modifiedTime?: string | null
  webViewLink?: string | null
  videoMediaMetadata?: {
    durationMillis?: string | null
  } | null
}

function resolveDriveCredentials(): { clientId: string; clientSecret: string } {
  const clientId =
    process.env.DRIVE_CLIENT_ID || process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID
  const clientSecret =
    process.env.DRIVE_CLIENT_SECRET ||
    process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    process.env.YOUTUBE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Set DRIVE_CLIENT_ID and DRIVE_CLIENT_SECRET (or GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET) to read Drive')
  }

  return { clientId, clientSecret }
}

function buildDriveClient() {
  const { clientId, clientSecret } = resolveDriveCredentials()
  const refreshToken =
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN || process.env.DRIVE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN

  if (!refreshToken) {
    throw new Error('Set GOOGLE_DRIVE_REFRESH_TOKEN in .env (run: npm run pipeline -- drive-auth)')
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, DRIVE_AUTH_REDIRECT)
  oauth2.setCredentials({ refresh_token: refreshToken })
  return google.drive({ version: 'v3', auth: oauth2 })
}

export function isDriveConfigured(): boolean {
  return Boolean(
    (process.env.DRIVE_CLIENT_ID || process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID) &&
      (process.env.DRIVE_CLIENT_SECRET ||
        process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
        process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
        process.env.YOUTUBE_CLIENT_SECRET) &&
      (process.env.GOOGLE_DRIVE_REFRESH_TOKEN || process.env.DRIVE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN)
  )
}

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function buildDriveVideoSearchQuery(query: string): string {
  const terms = query
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 6)

  const filters = ["trashed = false", "mimeType contains 'video/'"]
  if (terms.length > 0) {
    filters.push(`(${terms.map((term) => `name contains '${escapeDriveQuery(term)}'`).join(' or ')})`)
  }

  return filters.join(' and ')
}

export async function runDriveAuthFlow(): Promise<void> {
  const { clientId, clientSecret } = resolveDriveCredentials()
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, DRIVE_AUTH_REDIRECT)
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [DRIVE_READONLY_SCOPE],
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

export async function searchDriveVideos(query: string, maxResults: number): Promise<DriveVideoCandidate[]> {
  const drive = buildDriveClient()
  const response = await drive.files.list({
    q: buildDriveVideoSearchQuery(query),
    pageSize: Math.min(Math.max(maxResults, 1), 100),
    fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,videoMediaMetadata)',
    orderBy: 'modifiedTime desc',
  })

  const files = (response.data.files || []) as RawDriveVideoFile[]

  return files
    .filter(
      (file): file is RawDriveVideoFile & { id: string; name: string; mimeType: string } =>
        Boolean(file.id && file.name && file.mimeType)
    )
    .map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size || undefined,
      createdTime: file.createdTime || undefined,
      modifiedTime: file.modifiedTime || undefined,
      webViewLink: file.webViewLink || undefined,
      durationMillis: file.videoMediaMetadata?.durationMillis || undefined,
    }))
}

export function formatDriveCandidate(candidate: DriveVideoCandidate): string {
  const duration = candidate.durationMillis ? `${Math.round(Number(candidate.durationMillis) / 1000)}s` : 'unknown duration'
  const sizeMb = candidate.size ? `${(Number(candidate.size) / 1024 / 1024).toFixed(1)} MB` : 'unknown size'
  return `${candidate.name}  (${duration}, ${sizeMb})  ${candidate.webViewLink || candidate.id}`
}

function safeFilename(name: string): string {
  const normalized = name
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'drive-video'
}

function extensionFor(candidate: DriveVideoCandidate): string {
  const existing = path.extname(candidate.name).toLowerCase()
  if (existing && existing.length <= 6) return existing

  switch (candidate.mimeType) {
    case 'video/mp4':
      return '.mp4'
    case 'video/quicktime':
      return '.mov'
    case 'video/webm':
      return '.webm'
    case 'video/x-msvideo':
      return '.avi'
    default:
      return '.mp4'
  }
}

async function downloadDriveVideo(candidate: DriveVideoCandidate, outFile: string): Promise<void> {
  const drive = buildDriveClient()
  const response = await drive.files.get({ fileId: candidate.id, alt: 'media' }, { responseType: 'stream' })
  await pipeline(response.data as NodeJS.ReadableStream, fs.createWriteStream(outFile))
}

async function transcodeDriveVideoToShort(inputFile: string, outFile: string): Promise<NonNullable<PipelineJob['render']>> {
  await ensureFfmpegAvailable()
  const format = resolveVideoFormat('9:16')

  await execFileAsync(
    resolveFfmpegPath(),
    [
      '-y',
      '-i',
      inputFile,
      '-t',
      String(SHORTS_MAX_SECONDS),
      '-map',
      '0:v:0',
      '-map',
      '0:a?',
      '-vf',
      buildVideoFilter(format),
      '-r',
      '30',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-c:a',
      'aac',
      '-ar',
      '44100',
      '-movflags',
      '+faststart',
      outFile,
    ],
    { maxBuffer: 1024 * 1024 * 50 }
  )

  return {
    videoFile: outFile,
    durationSeconds: await probeMediaDuration(outFile),
    width: format.width,
    height: format.height,
  }
}

function readableTitleFromFilename(name: string): string {
  const words = name
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!words) return 'Motivation Short'

  return words
    .split(' ')
    .map((word) => (word.length <= 3 && word === word.toUpperCase() ? word : `${word[0]?.toUpperCase() || ''}${word.slice(1)}`))
    .join(' ')
}

export function buildDriveShortsContent(candidate: DriveVideoCandidate, durationSeconds: number): GeneratedContent {
  const title = readableTitleFromFilename(candidate.name)
  const duration = Math.min(Math.max(Math.round(durationSeconds), 1), SHORTS_MAX_SECONDS)
  const end = formatContentTimestamp(duration)

  return {
    script: {
      title,
      duration,
      content: `Imported motivation short from Google Drive: ${candidate.name}`,
      sections: [{ time: `0:00-${end}`, speaker: 'source-video', text: 'Use the original source-video audio and visuals.' }],
    },
    scenes: [
      {
        id: 1,
        title: 'Google Drive source clip',
        start_time: '0:00',
        end_time: end,
        duration,
        visual_description: 'Original source video imported from Google Drive and cropped to vertical Shorts format.',
        on_screen_text: '',
        narration: 'Original source-video audio.',
      },
    ],
    capcut_steps: [
      'Review the imported clip for ownership, quality, and brand fit.',
      'Confirm rights before publishing.',
      'Publish privately first, then update to public after a final channel review.',
    ],
    seo: {
      title: title.length > 90 ? `${title.slice(0, 87).trim()}...` : title,
      description: `Motivation short prepared from a Google Drive source clip.\n\n#Shorts #Motivation #Inspiration`,
      tags: ['motivation', 'inspiration', 'shorts', 'mindset', 'self improvement'],
      keywords: ['motivation', 'inspiration', 'shorts'],
      hashtags: ['#Shorts', '#Motivation', '#Inspiration'],
      thumbnail_tips: 'Choose a clear frame with strong contrast and readable subject focus.',
      pinned_comment: 'What goal are you working toward today?',
    },
    thumbnail: {
      text: 'Keep Going',
      image_prompt: 'Use a high-contrast frame from the original motivation clip.',
      emotion: 'determined',
      design_description: 'Simple bold typography over the strongest source-video frame.',
      color_palette: ['black', 'white', 'gold'],
      text_suggestions: ['Keep Going', 'No Excuses', 'Start Today'],
      layout_tips: 'Keep text in the lower third and away from Shorts UI controls.',
      accessibility_notes: 'Use large, high-contrast text if adding captions or overlays.',
    },
  }
}

export function buildDriveRightsRecord(options: {
  candidate: DriveVideoCandidate
  file: string
  jobId: string
  rightsConfirmed: boolean
  license?: string
  credit?: string
}): RightsRecord {
  const confirmedAt = options.rightsConfirmed ? new Date().toISOString() : undefined
  return {
    assetId: `drive-${options.candidate.id}`,
    file: relativeToJob(options.jobId, options.file),
    type: 'video',
    provider: 'google-drive',
    license: options.rightsConfirmed ? options.license || 'User-confirmed owned or properly licensed source media' : '',
    sourceUrl: options.candidate.webViewLink,
    credit: options.credit,
    generatedByAI: false,
    retrievedAt: new Date().toISOString(),
    rightsConfirmedAt: confirmedAt,
  }
}

async function writeDriveReviewPage(job: PipelineJob, outFile: string): Promise<void> {
  const content = job.content
  const driveImport = job.driveImport
  if (!content || !job.render || !driveImport) throw new Error('Cannot write Drive review page before import is rendered')

  const dir = path.dirname(outFile)
  const rel = (absolute?: string) => (absolute ? path.relative(dir, absolute) : '')
  const escapeHtml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const rightsCommand = `npm run pipeline -- confirm-rights ${job.id}`
  const publishCommand = `npm run pipeline -- publish ${job.id} --privacy ${job.config.privacy}`
  const rightsConfirmed = Boolean(driveImport.rightsConfirmedAt)

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Review Drive Short: ${escapeHtml(content.seo.title)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; background: #101014; color: #e8e8ee; }
  video { width: min(360px, 100%); border-radius: 12px; background: #000; display: block; }
  code, pre { background: #1a1a22; padding: .2rem .45rem; border-radius: 4px; font-size: .9rem; }
  pre { padding: .8rem; overflow-x: auto; }
  .card { background: #191922; border: 1px solid #2a2a33; border-radius: 10px; padding: 1rem; margin: 1rem 0; }
  .warning { border-left: 4px solid #e0a63a; }
  .ready { border-left: 4px solid #4caf7d; }
  .meta { color: #a4a4b2; font-size: .9rem; }
</style>
</head>
<body>
  <h1>${escapeHtml(content.seo.title)}</h1>
  <p class="meta">Job ${escapeHtml(job.id)} · YouTube Short · ${job.render.durationSeconds.toFixed(1)}s · 1080x1920</p>
  <video controls src="${escapeHtml(rel(job.render.videoFile))}"></video>

  <div class="card">
    <h2>Source</h2>
    <p><strong>${escapeHtml(driveImport.name)}</strong></p>
    <p class="meta">Drive file ID: ${escapeHtml(driveImport.fileId)}</p>
    ${driveImport.webViewLink ? `<p><a href="${escapeHtml(driveImport.webViewLink)}">Open original in Drive</a></p>` : ''}
  </div>

  <div class="card ${rightsConfirmed ? 'ready' : 'warning'}">
    <h2>${rightsConfirmed ? 'Rights confirmed' : 'Rights confirmation required'}</h2>
    <p>${
      rightsConfirmed
        ? 'This imported source clip has been marked as owned or properly licensed.'
        : 'Publishing is blocked until you confirm you own this clip or have permission to use it on the channel.'
    }</p>
    <pre>${rightsConfirmed ? publishCommand : `${rightsCommand}\n${publishCommand}`}</pre>
  </div>

  <div class="card">
    <h2>Suggested metadata</h2>
    <p>${escapeHtml(content.seo.description)}</p>
    <p>${content.seo.hashtags.map(escapeHtml).join(' ')}</p>
  </div>
</body>
</html>`

  await fs.promises.writeFile(outFile, html)
}

async function finalizeDriveJob(job: PipelineJob): Promise<PipelineJob> {
  const manifestFile = await jobPath(job.id, 'rights-manifest.json')
  const manifest = await writeRightsManifest(job, manifestFile)
  job.rights = {
    manifestFile,
    assetCount: manifest.assets.length,
    aiDisclosure: manifest.aiDisclosure,
  }
  const reviewFile = await jobPath(job.id, 'review.html')
  await writeDriveReviewPage(job, reviewFile)
  job.approval = { ...(job.approval || {}), reviewFile }
  await saveJob(job)
  return job
}

export async function createDriveShortsJobs(options: DriveShortsOptions): Promise<PipelineJob[]> {
  if (!isDriveConfigured()) {
    throw new Error('Google Drive is not configured. Run `npm run pipeline -- drive-auth` after setting OAuth client credentials.')
  }

  const candidates = await searchDriveVideos(options.query, options.maxResults)
  const jobs: PipelineJob[] = []

  for (const candidate of candidates) {
    const title = readableTitleFromFilename(candidate.name)
    const job = await createJob({
      topic: title,
      platform: 'youtube',
      durationMinutes: 1,
      tone: 'motivational',
      aspectRatio: '9:16',
      privacy: options.privacy,
      autoApprove: false,
      publishAfterRender: false,
    })

    const sourceFile = await jobPath(job.id, 'assets', `${safeFilename(candidate.name)}${extensionFor(candidate)}`)
    const outputFile = await jobPath(job.id, 'render', 'final.mp4')

    job.status = 'rendering'
    job.trends = {
      candidates: [],
      selected: {
        source: 'manual',
        topic: title,
        score: 100,
        detail: `Imported from Google Drive search "${options.query}"`,
        url: candidate.webViewLink,
      },
    }
    job.driveImport = {
      fileId: candidate.id,
      name: candidate.name,
      mimeType: candidate.mimeType,
      webViewLink: candidate.webViewLink,
      sourceVideoFile: sourceFile,
      importedAt: new Date().toISOString(),
      rightsConfirmedAt: options.rightsConfirmed ? new Date().toISOString() : undefined,
      rightsLicense: options.rightsConfirmed ? options.license || 'User-confirmed owned or properly licensed source media' : undefined,
    }
    await saveJob(job)

    console.log(`[drive] Downloading ${candidate.name} ...`)
    await downloadDriveVideo(candidate, sourceFile)

    console.log(`[drive] Rendering vertical Short from ${candidate.name} ...`)
    job.render = await transcodeDriveVideoToShort(sourceFile, outputFile)
    job.content = buildDriveShortsContent(candidate, job.render.durationSeconds)
    job.rightsRecords = [
      buildDriveRightsRecord({
        candidate,
        file: sourceFile,
        jobId: job.id,
        rightsConfirmed: options.rightsConfirmed,
        license: options.license,
        credit: options.credit,
      }),
    ]
    job.status = options.rightsConfirmed ? 'rendered' : 'awaiting_approval'
    jobs.push(await finalizeDriveJob(job))
  }

  return jobs
}

export async function confirmDriveImportRights(
  jobId: string,
  options: { license?: string; credit?: string } = {}
): Promise<PipelineJob> {
  const job = await loadJob(jobId)
  if (!job.driveImport) throw new Error(`Job ${jobId} is not a Google Drive import job`)

  const confirmedAt = new Date().toISOString()
  const license = options.license || 'User-confirmed owned or properly licensed source media'

  job.driveImport = {
    ...job.driveImport,
    rightsConfirmedAt: confirmedAt,
    rightsLicense: license,
  }

  job.rightsRecords = job.rightsRecords.map((record) =>
    record.provider === 'google-drive'
      ? {
          ...record,
          license,
          credit: options.credit || record.credit,
          rightsConfirmedAt: confirmedAt,
        }
      : record
  )
  job.status = 'rendered'
  job.error = undefined

  return finalizeDriveJob(job)
}
