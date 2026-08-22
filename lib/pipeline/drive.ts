import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import { pipeline } from 'stream/promises'
import { google } from 'googleapis'
import type { drive_v3 } from 'googleapis'

import type { GeneratedContent } from '@/lib/content/generation'
import { createJob, jobPath, loadJob, relativeToJob, saveJob } from './job-store'
import { writeRightsManifest } from './rights'
import type { PipelineConfig, PipelineJob, RightsRecord } from './types'

const DRIVE_AUTH_PORT = Number(process.env.PIPELINE_DRIVE_AUTH_PORT || process.env.PIPELINE_AUTH_PORT || 8787)
const DRIVE_AUTH_REDIRECT = `http://localhost:${DRIVE_AUTH_PORT}/callback`
const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

export interface DriveShortImportOptions {
  query: string
  maxResults: number
  maxDurationSeconds: number
  privacy: PipelineConfig['privacy']
  publishAfterImport: boolean
  rightsConfirmed: boolean
}

export interface DriveShortImportResult {
  jobs: PipelineJob[]
  skipped: Array<{ id?: string; name?: string; reason: string }>
}

function resolveDriveCredentials(): { clientId: string; clientSecret: string } {
  const clientId =
    process.env.GOOGLE_DRIVE_CLIENT_ID ||
    process.env.YOUTUBE_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret =
    process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
    process.env.YOUTUBE_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET in .env to import Drive videos')
  }
  return { clientId, clientSecret }
}

function buildDriveClient() {
  const { clientId, clientSecret } = resolveDriveCredentials()
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim()
  if (!refreshToken) {
    throw new Error('Set GOOGLE_DRIVE_REFRESH_TOKEN in .env (run: npm run pipeline -- drive-auth)')
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, DRIVE_AUTH_REDIRECT)
  oauth2.setCredentials({ refresh_token: refreshToken })
  return google.drive({ version: 'v3', auth: oauth2 })
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function buildDriveVideoSearchQuery(query: string): string {
  const terms = query
    .trim()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 5)

  const base = "mimeType contains 'video/' and trashed = false"
  if (terms.length === 0) return base

  const termFilter = terms
    .map((term) => {
      const escaped = escapeDriveQueryValue(term)
      return `(name contains '${escaped}' or fullText contains '${escaped}')`
    })
    .join(' and ')

  return `${base} and ${termFilter}`
}

export async function runDriveAuthFlow(): Promise<void> {
  const { clientId, clientSecret } = resolveDriveCredentials()
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, DRIVE_AUTH_REDIRECT)
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

function cleanTitle(fileName: string): string {
  const base = path.basename(fileName, path.extname(fileName))
  return base
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90)
}

function safeFileName(fileName: string): string {
  const parsed = path.parse(fileName)
  const name = parsed.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'drive-video'
  const ext = parsed.ext || '.mp4'
  return `${name}${ext}`
}

function buildImportedContent(file: drive_v3.Schema$File, durationSeconds: number): GeneratedContent {
  const title = cleanTitle(file.name || 'Motivation Short') || 'Motivation Short'
  const description = file.description?.trim()

  return {
    script: {
      title,
      duration: durationSeconds / 60,
      content: description || `Imported motivation video from Google Drive: ${title}`,
      sections: [
        {
          time: '0:00',
          speaker: 'Original video',
          text: description || title,
        },
      ],
    },
    scenes: [
      {
        id: 1,
        title,
        start_time: '0:00',
        end_time: `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, '0')}`,
        duration: durationSeconds,
        visual_description: 'Imported source video from Google Drive',
        on_screen_text: title.slice(0, 40),
        narration: description || title,
      },
    ],
    capcut_steps: [],
    seo: {
      title: `${title} #Shorts`.slice(0, 100),
      description:
        description ||
        'A short motivational video imported from the channel owner Google Drive library.',
      tags: ['motivation', 'motivational video', 'shorts', 'self improvement'],
      keywords: ['motivation', 'shorts', 'self improvement'],
      hashtags: ['#motivation', '#shorts', '#selfimprovement'],
      thumbnail_tips: 'Use the source video frame or upload a custom channel thumbnail after publishing.',
      pinned_comment: 'What goal are you working toward today?',
    },
    thumbnail: {
      text: title.slice(0, 40),
      image_prompt: 'Use a high-energy still frame from the imported motivation video.',
      emotion: 'motivated',
      design_description: 'Source-video thumbnail placeholder.',
      color_palette: ['#111827', '#f59e0b', '#ffffff'],
      text_suggestions: [title.slice(0, 40)],
      layout_tips: 'Keep text large and mobile-safe.',
      accessibility_notes: 'Use high contrast text if a custom thumbnail is added.',
    },
  }
}

function driveDurationSeconds(file: drive_v3.Schema$File): number | null {
  const raw = file.videoMediaMetadata?.durationMillis
  const millis = Number(raw)
  if (!Number.isFinite(millis) || millis <= 0) return null
  return Math.max(1, Math.round(millis / 1000))
}

function driveDimension(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildRightsRecord(input: {
  jobId: string
  file: string
  driveFile: drive_v3.Schema$File
  rightsConfirmed: boolean
}): RightsRecord {
  return {
    assetId: `drive-video-${input.driveFile.id}`,
    file: relativeToJob(input.jobId, input.file),
    type: 'video',
    provider: 'google-drive',
    license: input.rightsConfirmed ? 'User-confirmed rights to upload and publish' : '',
    sourceUrl: input.driveFile.webViewLink || undefined,
    credit: 'Source video supplied from Google Drive',
    generatedByAI: false,
    retrievedAt: new Date().toISOString(),
  }
}

async function downloadDriveFile(
  drive: drive_v3.Drive,
  file: drive_v3.Schema$File,
  outFile: string
): Promise<void> {
  if (!file.id) throw new Error('Drive file is missing an id')
  const response = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'stream' })
  await pipeline(response.data as NodeJS.ReadableStream, fs.createWriteStream(outFile))
}

async function writeImportedReviewPage(job: PipelineJob, file: drive_v3.Schema$File): Promise<string> {
  const reviewFile = await jobPath(job.id, 'review.html')
  const videoFile = job.render?.videoFile || ''
  const relVideo = videoFile ? path.relative(path.dirname(reviewFile), videoFile) : ''
  const title = job.content?.seo.title || file.name || 'Imported Short'
  const needsRightsConfirmation = job.rightsRecords.some((record) => record.provider === 'google-drive' && !record.license)
  const sourceLink = file.webViewLink
    ? `<a href="${escapeHtml(file.webViewLink)}">${escapeHtml(file.webViewLink)}</a>`
    : 'Google Drive'
  const publishCommands = needsRightsConfirmation
    ? `npm run pipeline -- confirm-rights ${job.id}
npm run pipeline -- publish ${job.id} --privacy private`
    : `npm run pipeline -- publish ${job.id} --privacy private`

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Review imported Short: ${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; background: #101014; color: #e8e8ee; }
  video { width: 100%; max-height: 75vh; background: #000; border-radius: 12px; }
  code, pre { background: #1a1a22; padding: .2rem .45rem; border-radius: 4px; }
  pre { padding: .8rem; overflow-x: auto; }
  .meta { color: #9a9aa8; font-size: .9rem; }
  .warn { background: #3a2812; border-left: 4px solid #f59e0b; padding: .8rem 1rem; border-radius: 6px; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">Imported from ${sourceLink}</p>
  <video controls src="${escapeHtml(relVideo)}"></video>
  <h2>Publish</h2>
  <p class="warn">Publishing requires that you own or have permission to upload this Drive video.</p>
  <pre>${escapeHtml(publishCommands)}</pre>
</body>
</html>`

  await fs.promises.writeFile(reviewFile, html)
  return reviewFile
}

export async function confirmDriveImportRights(jobId: string): Promise<PipelineJob> {
  const job = await loadJob(jobId)
  let changed = false
  job.rightsRecords = job.rightsRecords.map((record) => {
    if (record.provider !== 'google-drive' || record.license.trim()) return record
    changed = true
    return { ...record, license: 'User-confirmed rights to upload and publish' }
  })

  if (!changed) {
    throw new Error(`Job ${jobId} has no unconfirmed Google Drive rights records`)
  }
  if (!job.content || !job.render) {
    throw new Error(`Job ${jobId} is not an imported rendered video job`)
  }

  const manifestFile = job.rights?.manifestFile || (await jobPath(job.id, 'rights-manifest.json'))
  const manifest = await writeRightsManifest(job, manifestFile)
  job.rights = {
    manifestFile,
    assetCount: manifest.assets.length,
    aiDisclosure: manifest.aiDisclosure,
  }
  await saveJob(job)
  return job
}

export async function importDriveShorts(options: DriveShortImportOptions): Promise<DriveShortImportResult> {
  const drive = buildDriveClient()
  const response = await drive.files.list({
    q: buildDriveVideoSearchQuery(options.query),
    pageSize: Math.min(Math.max(options.maxResults, 1), 20),
    fields: 'files(id,name,mimeType,description,webViewLink,videoMediaMetadata,modifiedTime)',
    orderBy: 'modifiedTime desc',
  })

  const result: DriveShortImportResult = { jobs: [], skipped: [] }

  for (const file of response.data.files || []) {
    if (!file.id || !file.name) {
      result.skipped.push({ id: file.id || undefined, name: file.name || undefined, reason: 'Missing Drive id or name' })
      continue
    }

    const durationSeconds = driveDurationSeconds(file)
    if (durationSeconds !== null && durationSeconds > options.maxDurationSeconds) {
      result.skipped.push({
        id: file.id,
        name: file.name,
        reason: `Duration ${durationSeconds}s exceeds Shorts limit ${options.maxDurationSeconds}s`,
      })
      continue
    }

    const job = await createJob({
      topic: options.query,
      platform: 'youtube',
      durationMinutes: (durationSeconds || 60) / 60,
      tone: 'motivational',
      aspectRatio: '9:16',
      privacy: options.privacy,
      autoApprove: false,
      publishAfterRender: options.publishAfterImport && options.rightsConfirmed,
    })

    const importedFile = await jobPath(job.id, 'imports', safeFileName(file.name))
    await downloadDriveFile(drive, file, importedFile)

    const finalDurationSeconds = durationSeconds || 60
    job.status = 'rendered'
    job.trends = {
      candidates: [],
      selected: {
        source: 'manual',
        topic: options.query,
        score: 100,
        detail: `Imported from Google Drive: ${file.name}`,
        url: file.webViewLink || undefined,
      },
    }
    job.content = buildImportedContent(file, finalDurationSeconds)
    job.render = {
      videoFile: importedFile,
      durationSeconds: finalDurationSeconds,
      width: driveDimension(file.videoMediaMetadata?.width, 1080),
      height: driveDimension(file.videoMediaMetadata?.height, 1920),
    }
    job.rightsRecords = [
      buildRightsRecord({
        jobId: job.id,
        file: importedFile,
        driveFile: file,
        rightsConfirmed: options.rightsConfirmed,
      }),
    ]
    const reviewFile = await writeImportedReviewPage(job, file)
    job.approval = { reviewFile }

    const manifestFile = await jobPath(job.id, 'rights-manifest.json')
    const manifest = await writeRightsManifest(job, manifestFile)
    job.rights = {
      manifestFile,
      assetCount: manifest.assets.length,
      aiDisclosure: manifest.aiDisclosure,
    }

    await saveJob(job)
    result.jobs.push(job)
  }

  return result
}
