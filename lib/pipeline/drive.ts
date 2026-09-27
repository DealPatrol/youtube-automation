import { execFile } from 'child_process'
import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import type { Readable } from 'stream'
import { pipeline as streamPipeline } from 'stream/promises'
import { promisify } from 'util'
import { google } from 'googleapis'
import type { drive_v3 } from 'googleapis'

import type { GeneratedContent } from '@/lib/content/generation'
import { resolveFfmpegPath, probeMediaDuration } from '@/lib/video/ffmpeg'
import { resolveVideoFormat } from '@/lib/video/format'
import { createJob, jobDir, jobPath, loadJob, relativeToJob, saveJob } from './job-store'
import { writeRightsManifest } from './rights'
import type { PipelineConfig, PipelineJob, RightsRecord } from './types'

const execFileAsync = promisify(execFile)

const DRIVE_AUTH_PORT = Number(process.env.PIPELINE_AUTH_PORT || 8787)
const DRIVE_AUTH_REDIRECT = `http://localhost:${DRIVE_AUTH_PORT}/callback`
const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
const SHORTS_HASHTAGS = ['#Shorts', '#Motivation', '#Inspiration']
const SELF_PRODUCED_LICENSE = 'Owner-confirmed or licensed for reuse by channel owner'

export interface DriveShortImportOptions {
  query: string
  maxResults: number
  privacy: PipelineConfig['privacy']
  folderId?: string
  publishAfterImport: boolean
  rightsConfirmed: boolean
  trimSeconds: number
}

export interface DriveShortImportResult {
  file: DriveVideoFile
  job: PipelineJob
}

export interface DriveVideoFile {
  id: string
  name: string
  mimeType?: string
  webViewLink?: string
  modifiedTime?: string
  size?: string
}

function resolveDriveClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId =
    process.env.GOOGLE_DRIVE_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.YOUTUBE_CLIENT_ID
  const clientSecret =
    process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    process.env.YOUTUBE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'Set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET (or shared GOOGLE_OAUTH_* values)'
    )
  }

  return { clientId, clientSecret }
}

function buildDriveOAuthClient() {
  const { clientId, clientSecret } = resolveDriveClientCredentials()
  return new google.auth.OAuth2(clientId, clientSecret, DRIVE_AUTH_REDIRECT)
}

function buildAuthorizedDriveClient() {
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim()
  if (!refreshToken) {
    throw new Error('Set GOOGLE_DRIVE_REFRESH_TOKEN in .env (run: npm run pipeline -- drive-auth)')
  }

  const oauth2 = buildDriveOAuthClient()
  oauth2.setCredentials({ refresh_token: refreshToken })
  return google.drive({ version: 'v3', auth: oauth2 })
}

export async function runDriveAuthFlow(): Promise<void> {
  const oauth2 = buildDriveOAuthClient()
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: DRIVE_SCOPES,
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

export function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function buildDriveVideoQuery(query: string, folderId?: string): string {
  const clauses = ["mimeType contains 'video/'", 'trashed = false']
  const trimmed = query.trim()

  if (trimmed) {
    const escaped = escapeDriveQueryValue(trimmed)
    clauses.push(`(name contains '${escaped}' or fullText contains '${escaped}')`)
  }

  if (folderId?.trim()) {
    clauses.push(`'${escapeDriveQueryValue(folderId.trim())}' in parents`)
  }

  return clauses.join(' and ')
}

function sanitizeFileName(value: string): string {
  const safe = value
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return safe || `drive-video-${Date.now()}`
}

function stripExtension(fileName: string): string {
  const ext = path.extname(fileName)
  return (ext ? fileName.slice(0, -ext.length) : fileName).trim()
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

export function buildDriveShortContent(fileName: string, query: string): GeneratedContent {
  const baseTitle = titleCase(stripExtension(fileName)) || 'Motivational Short'
  const title = `${baseTitle} #Shorts`.slice(0, 100).trim()
  const topic = query.trim() || 'motivation'
  const keywords = Array.from(
    new Set(
      topic
        .split(/\s+/)
        .map((word) => word.toLowerCase().replace(/[^a-z0-9]/g, ''))
        .filter(Boolean)
    )
  )

  return {
    script: {
      title,
      duration: 1,
      content: `Imported short-form motivation video from Google Drive: ${baseTitle}.`,
      sections: [{ time: '0:00', speaker: 'Original video', text: baseTitle }],
    },
    scenes: [
      {
        id: 1,
        title: baseTitle,
        start_time: '0:00',
        end_time: '1:00',
        duration: 60,
        visual_description: 'Original Google Drive video reformatted as a vertical YouTube Short.',
        on_screen_text: baseTitle.slice(0, 40),
        narration: baseTitle,
      },
    ],
    capcut_steps: [
      'Review the imported 9:16 file for framing, captions, and audio levels before public release.',
      'Keep the upload private until rights and channel fit are confirmed.',
    ],
    seo: {
      title,
      description: [
        'A short motivational video for daily inspiration.',
        '',
        SHORTS_HASHTAGS.join(' '),
      ].join('\n'),
      tags: ['motivation', 'inspiration', 'motivational video', 'shorts', ...keywords].slice(0, 20),
      keywords: ['motivation', 'inspiration', ...keywords].slice(0, 12),
      hashtags: SHORTS_HASHTAGS,
      thumbnail_tips: 'Choose a clear frame with readable emotional contrast.',
      pinned_comment: 'What is one goal you are committing to today?',
    },
    thumbnail: {
      text: baseTitle.slice(0, 40),
      image_prompt: 'Use a strong frame from the original motivation video.',
      emotion: 'uplifting',
      design_description: 'High contrast, readable mobile-first motivational style.',
      color_palette: ['#111827', '#F59E0B', '#FFFFFF'],
      text_suggestions: ['Keep Going', 'Start Today', 'No Excuses'],
      layout_tips: 'Keep text away from the lower-right Shorts UI controls.',
      accessibility_notes: 'Use high contrast text if creating a custom thumbnail.',
    },
  }
}

function fileExtensionFor(file: DriveVideoFile): string {
  const ext = path.extname(file.name)
  if (ext) return ext

  switch (file.mimeType) {
    case 'video/quicktime':
      return '.mov'
    case 'video/webm':
      return '.webm'
    case 'video/x-matroska':
      return '.mkv'
    default:
      return '.mp4'
  }
}

async function listDriveVideos(options: DriveShortImportOptions): Promise<DriveVideoFile[]> {
  const drive = buildAuthorizedDriveClient()
  const response = await drive.files.list({
    q: buildDriveVideoQuery(options.query, options.folderId),
    pageSize: Math.min(Math.max(options.maxResults, 1), 10),
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,webViewLink,modifiedTime,size)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  return (response.data.files ?? [])
    .filter((file): file is drive_v3.Schema$File & { id: string; name: string } => {
      return Boolean(file.id && file.name)
    })
    .map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType ?? undefined,
      webViewLink: file.webViewLink ?? undefined,
      modifiedTime: file.modifiedTime ?? undefined,
      size: file.size ?? undefined,
    }))
}

async function downloadDriveVideo(file: DriveVideoFile, outFile: string): Promise<void> {
  const drive = buildAuthorizedDriveClient()
  const response = await drive.files.get(
    { fileId: file.id, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  )

  await streamPipeline(response.data as Readable, fs.createWriteStream(outFile))
}

async function renderVerticalShort(sourceFile: string, outFile: string, trimSeconds: number): Promise<void> {
  await fs.promises.mkdir(path.dirname(outFile), { recursive: true })
  await execFileAsync(
    resolveFfmpegPath(),
    [
      '-y',
      '-i',
      sourceFile,
      '-t',
      String(Math.min(Math.max(trimSeconds, 15), 60)),
      '-vf',
      'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      outFile,
    ],
    { maxBuffer: 1024 * 1024 * 20 }
  )
}

function buildDriveRightsRecord(input: {
  job: PipelineJob
  sourceFile: string
  driveFile: DriveVideoFile
  rightsConfirmed: boolean
}): RightsRecord {
  return {
    assetId: `drive-video-${input.driveFile.id}`,
    file: relativeToJob(input.job.id, input.sourceFile),
    type: 'video',
    provider: 'google-drive',
    license: input.rightsConfirmed ? SELF_PRODUCED_LICENSE : '',
    sourceUrl: input.driveFile.webViewLink,
    credit: input.rightsConfirmed ? 'Original video provided by channel owner' : undefined,
    generatedByAI: false,
    retrievedAt: new Date().toISOString(),
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function writeDriveReviewPage(job: PipelineJob, driveFile: DriveVideoFile): Promise<string> {
  const reviewFile = await jobPath(job.id, 'review.html')
  const source = job.render?.videoFile
    ? path.relative(path.dirname(reviewFile), job.render.videoFile)
    : ''
  const rightsCommand = `npm run pipeline -- confirm-rights ${job.id}`
  const publishCommand = `npm run pipeline -- publish ${job.id} --privacy ${job.config.privacy}`

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Review imported Short: ${escapeHtml(job.content?.seo.title || job.id)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 860px; margin: 2rem auto; padding: 0 1rem; background: #101014; color: #e8e8ee; }
  h1 { font-size: 1.5rem; } h2 { font-size: 1.1rem; margin-top: 2rem; border-bottom: 1px solid #333; padding-bottom: .4rem; }
  video { width: min(360px, 100%); max-height: 80vh; border-radius: 14px; background: #000; }
  code, pre { background: #1a1a22; padding: .2rem .45rem; border-radius: 4px; font-size: .9rem; }
  pre { padding: .8rem; overflow-x: auto; }
  .meta { color: #9a9aa8; font-size: .9rem; }
  .warn { background: #3a2614; border-left: 4px solid #f59e0b; padding: .8rem 1rem; border-radius: 6px; }
</style>
</head>
<body>
  <h1>${escapeHtml(job.content?.seo.title || driveFile.name)}</h1>
  <p class="meta">Imported from Google Drive file ${escapeHtml(driveFile.name)} · Job ${escapeHtml(job.id)}</p>
  <video controls src="${escapeHtml(source)}"></video>

  <h2>SEO draft</h2>
  <p><strong>${escapeHtml(job.content?.seo.title || '')}</strong></p>
  <p>${escapeHtml(job.content?.seo.description || '')}</p>

  <h2>Rights gate</h2>
  <div class="warn">
    Confirm you own this video or have permission to upload it before publishing.
    Publishing will fail until rights are confirmed.
  </div>
  <pre>${escapeHtml(rightsCommand)}
${escapeHtml(publishCommand)}</pre>
</body>
</html>`

  await fs.promises.writeFile(reviewFile, html)
  return reviewFile
}

async function createImportedDriveShortJob(
  driveFile: DriveVideoFile,
  options: DriveShortImportOptions
): Promise<PipelineJob> {
  const config: PipelineConfig = {
    topic: stripExtension(driveFile.name),
    platform: 'youtube',
    durationMinutes: 1,
    tone: 'motivational',
    aspectRatio: '9:16',
    privacy: options.privacy,
    autoApprove: false,
    publishAfterRender: options.publishAfterImport,
  }
  const job = await createJob(config)
  const sourceFile = await jobPath(
    job.id,
    'drive',
    sanitizeFileName(`${stripExtension(driveFile.name)}${fileExtensionFor(driveFile)}`)
  )
  const renderFile = await jobPath(job.id, 'render', 'final.mp4')

  console.log(`[drive] Downloading ${driveFile.name} ...`)
  await downloadDriveVideo(driveFile, sourceFile)
  console.log('[drive] Formatting as a 9:16 YouTube Short ...')
  await renderVerticalShort(sourceFile, renderFile, options.trimSeconds)

  const durationSeconds = await probeMediaDuration(renderFile)
  const format = resolveVideoFormat('9:16')
  job.trends = {
    candidates: [],
    selected: {
      source: 'manual',
      topic: options.query || 'motivation',
      score: 100,
      detail: `Imported from Google Drive file: ${driveFile.name}`,
      url: driveFile.webViewLink,
    },
  }
  job.content = buildDriveShortContent(driveFile.name, options.query)
  job.render = {
    videoFile: renderFile,
    durationSeconds,
    width: format.width,
    height: format.height,
  }
  job.rightsRecords = [
    buildDriveRightsRecord({
      job,
      sourceFile,
      driveFile,
      rightsConfirmed: options.rightsConfirmed,
    }),
  ]
  job.rights = undefined
  job.status = 'rendered'
  job.approval = { reviewFile: await writeDriveReviewPage(job, driveFile) }
  await saveJob(job)

  if (options.rightsConfirmed) {
    job.rights = {
      manifestFile: await jobPath(job.id, 'rights-manifest.json'),
      assetCount: job.rightsRecords.length,
      aiDisclosure: false,
    }
    await writeRightsManifest(job, job.rights.manifestFile)
    await saveJob(job)
  }

  console.log(`[drive] Created imported Short job ${job.id}`)
  console.log(`[drive] Review: ${path.join(jobDir(job.id), 'review.html')}`)
  if (!options.rightsConfirmed) {
    console.log(`[drive] Confirm rights with: npm run pipeline -- confirm-rights ${job.id}`)
  }

  return job
}

export async function importDriveShorts(
  options: DriveShortImportOptions
): Promise<DriveShortImportResult[]> {
  const files = await listDriveVideos(options)
  if (files.length === 0) {
    console.log(`[drive] No matching Drive videos found for "${options.query}"`)
    return []
  }

  const results: DriveShortImportResult[] = []
  for (const file of files) {
    const job = await createImportedDriveShortJob(file, options)
    results.push({ file, job })
  }

  return results
}

export async function confirmDriveShortRights(jobId: string): Promise<PipelineJob> {
  const job = await loadJob(jobId)
  let updated = false
  job.rightsRecords = job.rightsRecords.map((record) => {
    if (record.provider !== 'google-drive') return record
    updated = true
    return {
      ...record,
      license: SELF_PRODUCED_LICENSE,
      credit: record.credit || 'Original video provided by channel owner',
    }
  })

  if (!updated) {
    throw new Error(`Job ${jobId} does not contain a Google Drive video rights record`)
  }

  if (!job.render) {
    throw new Error(`Job ${jobId} does not have a rendered Drive Short`)
  }

  const manifestFile = await jobPath(job.id, 'rights-manifest.json')
  const manifest = await writeRightsManifest(job, manifestFile)
  job.rights = {
    manifestFile,
    assetCount: manifest.assets.length,
    aiDisclosure: manifest.aiDisclosure,
  }
  await saveJob(job)
  console.log(`[drive] Rights confirmed for ${job.id}: ${manifestFile}`)
  return job
}
