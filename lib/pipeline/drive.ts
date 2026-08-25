import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import { pipeline } from 'stream/promises'

import { google } from 'googleapis'

import type { GeneratedContent } from '@/lib/content/generation'

import { createJob, jobDir, jobPath, relativeToJob, saveJob } from './job-store'
import { writeRightsManifest } from './rights'
import { isPublishConfigured, publishToYouTube } from './youtube'
import type { PipelineConfig, PipelineJob, RightsRecord, RightsManifest } from './types'

const DRIVE_AUTH_PORT = Number(process.env.PIPELINE_DRIVE_AUTH_PORT || 8788)
const DRIVE_AUTH_REDIRECT = `http://localhost:${DRIVE_AUTH_PORT}/callback`
const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const DRIVE_VIDEO_LICENSE = 'User-confirmed ownership or publication rights'
const DRIVE_PENDING_LICENSE = ''

export interface DriveVideoFile {
  id: string
  name: string
  mimeType: string
  size?: string
  webViewLink?: string
  modifiedTime?: string
  durationMillis?: string
  width?: number
  height?: number
}

export interface DriveShortsOptions {
  query: string
  max: number
  folderId?: string
  privacy: PipelineConfig['privacy']
  publish: boolean
  rightsConfirmed: boolean
}

export function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function buildDriveVideoQuery(options: { query: string; folderId?: string }): string {
  const clauses = ["mimeType contains 'video/'", 'trashed = false']
  const trimmedQuery = options.query.trim()
  if (trimmedQuery) {
    const escaped = escapeDriveQueryValue(trimmedQuery)
    clauses.push(`(name contains '${escaped}' or fullText contains '${escaped}')`)
  }
  if (options.folderId?.trim()) {
    clauses.push(`'${escapeDriveQueryValue(options.folderId.trim())}' in parents`)
  }
  return clauses.join(' and ')
}

export function sanitizeDriveFileName(name: string): string {
  const parsed = path.parse(name)
  const base = (parsed.name || 'drive-video').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  const ext = parsed.ext && parsed.ext.length <= 8 ? parsed.ext.toLowerCase() : '.mp4'
  return `${base || 'drive-video'}${ext || '.mp4'}`
}

function titleFromFileName(name: string): string {
  const title = path.parse(name).name.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return title ? title.slice(0, 90) : 'Motivational Short'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function durationSeconds(file: DriveVideoFile): number {
  const millis = Number(file.durationMillis || 0)
  if (Number.isFinite(millis) && millis > 0) return Math.max(1, Math.round(millis / 1000))
  return 60
}

function buildImportedVideoContent(file: DriveVideoFile): GeneratedContent {
  const title = titleFromFileName(file.name)
  const seconds = durationSeconds(file)
  const end = seconds < 60 ? `0:${seconds.toString().padStart(2, '0')}` : `${Math.floor(seconds / 60)}:${(seconds % 60)
    .toString()
    .padStart(2, '0')}`

  return {
    script: {
      title,
      duration: seconds / 60,
      content: `Imported motivational video "${title}" from Google Drive for YouTube Shorts review.`,
      sections: [{ time: '0:00', speaker: 'Original video', text: title }],
    },
    scenes: [
      {
        id: 1,
        title,
        start_time: '0:00',
        end_time: end,
        duration: seconds,
        visual_description: 'Original Google Drive video asset.',
        on_screen_text: title,
        narration: 'Original video audio.',
      },
    ],
    capcut_steps: ['Review the imported vertical clip, captions, and audio before publishing.'],
    seo: {
      title: `${title} #Shorts`.slice(0, 100),
      description:
        'Motivational short imported from Google Drive. Review the clip, title, and description before making it public.',
      tags: ['motivation', 'motivational video', 'self improvement', 'mindset', 'shorts'],
      keywords: ['motivation', 'self improvement', 'mindset', 'discipline'],
      hashtags: ['#motivation', '#shorts', '#mindset'],
      thumbnail_tips: 'Use a clear high-contrast frame with one concise motivational phrase.',
      pinned_comment: 'What is one goal you are staying disciplined for today?',
    },
    thumbnail: {
      text: 'Keep Going',
      image_prompt: 'High contrast motivational vertical video thumbnail',
      emotion: 'determined',
      design_description: 'Use a bold readable frame from the source video with minimal overlay text.',
      color_palette: ['#111827', '#f59e0b', '#ffffff'],
      text_suggestions: ['Keep Going', 'No Excuses', 'Start Today'],
      layout_tips: 'Keep the subject centered and text in the upper third for Shorts feeds.',
      accessibility_notes: 'Ensure overlay text has strong contrast and remains readable on mobile.',
    },
  }
}

function resolveClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret =
    process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Set GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET or reuse YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET')
  }
  return { clientId, clientSecret }
}

function buildOAuthClient() {
  const { clientId, clientSecret } = resolveClientCredentials()
  return new google.auth.OAuth2(clientId, clientSecret, DRIVE_AUTH_REDIRECT)
}

function buildDriveClient() {
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || process.env.YOUTUBE_REFRESH_TOKEN
  if (!refreshToken?.trim()) {
    throw new Error('Set GOOGLE_DRIVE_REFRESH_TOKEN in .env (run: npm run pipeline -- drive-auth)')
  }
  const oauth2 = buildOAuthClient()
  oauth2.setCredentials({ refresh_token: refreshToken.trim() })
  return google.drive({ version: 'v3', auth: oauth2 })
}

export async function runDriveAuthFlow(): Promise<void> {
  const oauth2 = buildOAuthClient()
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

export async function searchDriveVideos(options: { query: string; max: number; folderId?: string }): Promise<DriveVideoFile[]> {
  const drive = buildDriveClient()
  const response = await drive.files.list({
    q: buildDriveVideoQuery(options),
    pageSize: Math.min(Math.max(options.max, 1), 25),
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,size,webViewLink,modifiedTime,videoMediaMetadata)',
  })

  return (response.data.files || [])
    .filter((file): file is NonNullable<typeof file> & { id: string; name: string; mimeType: string } =>
      Boolean(file.id && file.name && file.mimeType?.startsWith('video/'))
    )
    .map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size || undefined,
      webViewLink: file.webViewLink || undefined,
      modifiedTime: file.modifiedTime || undefined,
      durationMillis: file.videoMediaMetadata?.durationMillis || undefined,
      width: file.videoMediaMetadata?.width || undefined,
      height: file.videoMediaMetadata?.height || undefined,
    }))
}

async function downloadDriveVideo(file: DriveVideoFile, outFile: string): Promise<void> {
  const drive = buildDriveClient()
  const response = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'stream' })
  await fs.promises.mkdir(path.dirname(outFile), { recursive: true })
  await pipeline(response.data as NodeJS.ReadableStream, fs.createWriteStream(outFile))
}

function buildDriveRightsRecord(job: PipelineJob, file: DriveVideoFile, videoFile: string, rightsConfirmed: boolean): RightsRecord {
  return {
    assetId: 'google-drive-video',
    file: relativeToJob(job.id, videoFile),
    type: 'video',
    provider: 'google-drive',
    license: rightsConfirmed ? DRIVE_VIDEO_LICENSE : DRIVE_PENDING_LICENSE,
    sourceUrl: file.webViewLink,
    credit: rightsConfirmed ? 'Source video supplied from your Google Drive' : undefined,
    generatedByAI: false,
    retrievedAt: new Date().toISOString(),
  }
}

async function writeDriveReviewPage(job: PipelineJob, file: DriveVideoFile, reviewFile: string): Promise<string> {
  const content = job.content
  const render = job.render
  if (!content || !render) throw new Error('Cannot build Drive review page before import completes')
  const relativeVideo = path.relative(path.dirname(reviewFile), render.videoFile)
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Review Drive Short: ${escapeHtml(content.seo.title)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 820px; margin: 2rem auto; padding: 0 1rem; background: #101014; color: #e8e8ee; }
  video { width: min(360px, 100%); border-radius: 12px; background: #000; }
  code, pre { background: #1a1a22; padding: .2rem .45rem; border-radius: 4px; font-size: .9rem; }
  pre { padding: .8rem; overflow-x: auto; }
  .card { background: #181822; border: 1px solid #30303a; border-radius: 12px; padding: 1rem; margin: 1rem 0; }
  .meta { color: #9a9aa8; font-size: .9rem; }
  .warn { border-left: 4px solid #f59e0b; }
</style>
</head>
<body>
  <h1>${escapeHtml(content.seo.title)}</h1>
  <p class="meta">Imported from Google Drive file: ${escapeHtml(file.name)}</p>
  <video controls src="${escapeHtml(relativeVideo)}"></video>
  <div class="card">
    <h2>Draft metadata</h2>
    <p>${escapeHtml(content.seo.description)}</p>
    <p>${escapeHtml(content.seo.hashtags.join(' '))}</p>
  </div>
  <div class="card warn">
    <h2>Rights confirmation required</h2>
    <p>Only continue if you own this video or have permission to publish it on YouTube.</p>
    <pre>npm run pipeline -- confirm-rights ${escapeHtml(job.id)}
npm run pipeline -- publish ${escapeHtml(job.id)} --privacy private</pre>
  </div>
</body>
</html>`
  await fs.promises.writeFile(reviewFile, html)
  return reviewFile
}

export async function importDriveVideo(file: DriveVideoFile, options: DriveShortsOptions): Promise<PipelineJob> {
  const job = await createJob({
    topic: titleFromFileName(file.name),
    platform: 'youtube',
    durationMinutes: Math.max(0.25, durationSeconds(file) / 60),
    tone: 'motivational',
    aspectRatio: '9:16',
    privacy: options.privacy,
    autoApprove: false,
    publishAfterRender: options.publish,
  })

  const videoFile = await jobPath(job.id, 'source', sanitizeDriveFileName(file.name))
  console.log(`[drive] Downloading "${file.name}" ...`)
  await downloadDriveVideo(file, videoFile)

  const seconds = durationSeconds(file)
  job.trends = {
    candidates: [],
    selected: {
      source: 'manual',
      topic: titleFromFileName(file.name),
      score: 100,
      detail: 'Google Drive import',
      url: file.webViewLink,
    },
  }
  job.content = buildImportedVideoContent(file)
  job.render = {
    videoFile,
    durationSeconds: seconds,
    width: file.width || 1080,
    height: file.height || 1920,
  }
  job.rightsRecords = [buildDriveRightsRecord(job, file, videoFile, options.rightsConfirmed)]
  job.source = {
    provider: 'google-drive',
    fileId: file.id,
    fileName: file.name,
    mimeType: file.mimeType,
    webViewLink: file.webViewLink,
  }
  const reviewFile = await jobPath(job.id, 'review.html')
  job.approval = { reviewFile: await writeDriveReviewPage(job, file, reviewFile) }
  job.status = options.rightsConfirmed ? 'rendered' : 'awaiting_approval'

  if (options.rightsConfirmed) {
    job.approval.approvedAt = new Date().toISOString()
    const manifestFile = await jobPath(job.id, 'rights-manifest.json')
    const manifest = await writeRightsManifest(job, manifestFile)
    job.rights = {
      manifestFile,
      assetCount: manifest.assets.length,
      aiDisclosure: manifest.aiDisclosure,
    }
  }

  await saveJob(job)

  if (options.publish) {
    if (!options.rightsConfirmed) {
      console.log(`[drive] Created review job ${job.id}; publish skipped until rights are confirmed.`)
      return job
    }
    if (!isPublishConfigured()) {
      console.log(`[drive] Created publish-ready job ${job.id}; YouTube credentials are not configured.`)
      return job
    }
    const manifestRaw = await fs.promises.readFile(job.rights!.manifestFile, 'utf8')
    job.status = 'publishing'
    await saveJob(job)
    job.publish = await publishToYouTube({
      job,
      manifest: JSON.parse(manifestRaw) as RightsManifest,
      privacy: options.privacy,
    })
    job.status = 'published'
    await saveJob(job)
  }

  return job
}

export async function importDriveShorts(options: DriveShortsOptions): Promise<PipelineJob[]> {
  if (options.publish && !options.rightsConfirmed) {
    console.log('[drive] --publish was requested, but publishing requires --rights-confirmed. Importing for review only.')
  }
  const files = await searchDriveVideos(options)
  if (files.length === 0) {
    console.log(`[drive] No matching Drive videos found for query "${options.query}".`)
    return []
  }

  const jobs: PipelineJob[] = []
  for (const file of files) {
    const job = await importDriveVideo(file, {
      ...options,
      publish: options.publish && options.rightsConfirmed,
    })
    jobs.push(job)
    console.log(`[drive] Job ${job.id}: ${path.relative(process.cwd(), path.join(jobDir(job.id), 'review.html'))}`)
  }
  return jobs
}

export async function confirmDriveRights(job: PipelineJob): Promise<PipelineJob> {
  if (job.source?.provider !== 'google-drive') {
    throw new Error(`Job ${job.id} is not a Google Drive import`)
  }
  if (!job.render) {
    throw new Error(`Job ${job.id} has no imported video`)
  }
  job.rightsRecords = job.rightsRecords.map((record) =>
    record.provider === 'google-drive'
      ? {
          ...record,
          license: DRIVE_VIDEO_LICENSE,
          credit: record.credit || 'Source video supplied from your Google Drive',
        }
      : record
  )
  job.approval = {
    ...(job.approval || { reviewFile: path.join(jobDir(job.id), 'review.html') }),
    approvedAt: new Date().toISOString(),
  }
  job.status = 'rendered'
  const manifestFile = await jobPath(job.id, 'rights-manifest.json')
  const manifest = await writeRightsManifest(job, manifestFile)
  job.rights = {
    manifestFile,
    assetCount: manifest.assets.length,
    aiDisclosure: manifest.aiDisclosure,
  }
  return saveJob(job)
}
