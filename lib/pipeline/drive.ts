import { execFile } from 'child_process'
import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import { Readable } from 'stream'
import { promisify } from 'util'
import { google } from 'googleapis'

import { createJob, jobPath, loadJob, relativeToJob, saveJob } from './job-store'
import { writeReviewPage } from './review'
import { writeRightsManifest } from './rights'
import type { PipelineConfig, PipelineJob, RightsRecord } from './types'
import { formatContentTimestamp, type GeneratedContent } from '@/lib/content/generation'
import { ensureFfmpegAvailable, probeMediaDuration, resolveFfmpegPath } from '@/lib/video/ffmpeg'
import { buildVideoFilter, resolveVideoFormat } from '@/lib/video/format'

const execFileAsync = promisify(execFile)
const DRIVE_AUTH_PORT = Number(process.env.DRIVE_AUTH_PORT || process.env.PIPELINE_AUTH_PORT || 8787)
const DRIVE_AUTH_REDIRECT = `http://localhost:${DRIVE_AUTH_PORT}/callback`
const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
const DEFAULT_QUERY = 'motivation'
const DEFAULT_MAX_SECONDS = 60

type DriveVideoFile = {
  id: string
  name: string
  mimeType?: string | null
  webViewLink?: string | null
  modifiedTime?: string | null
}

function resolveDriveClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET in .env to import Drive videos')
  }
  return { clientId, clientSecret }
}

function buildDriveOauthClient() {
  const { clientId, clientSecret } = resolveDriveClientCredentials()
  return new google.auth.OAuth2(clientId, clientSecret, DRIVE_AUTH_REDIRECT)
}

function buildAuthorizedDriveClient() {
  const refreshToken = process.env.DRIVE_REFRESH_TOKEN?.trim()
  if (!refreshToken) {
    throw new Error('Set DRIVE_REFRESH_TOKEN in .env (run: npm run pipeline -- drive-auth)')
  }
  const oauth2 = buildDriveOauthClient()
  oauth2.setCredentials({ refresh_token: refreshToken })
  return google.drive({ version: 'v3', auth: oauth2 })
}

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 120) || 'drive-video'
}

function titleFromFilename(fileName: string): string {
  return path
    .parse(fileName)
    .name
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildDriveVideoContent(title: string, durationSeconds: number): GeneratedContent {
  const safeTitle = title || 'Motivation Short'
  const description = [
    `${safeTitle}`,
    '',
    'Motivational short imported from the channel owner’s Google Drive library.',
  ].join('\n')

  return {
    script: {
      title: safeTitle,
      duration: Math.round((durationSeconds / 60) * 100) / 100,
      content: `Owner-provided motivation video: ${safeTitle}`,
      sections: [{ time: '0:00', speaker: 'Original audio', text: safeTitle }],
    },
    scenes: [
      {
        id: 1,
        title: safeTitle,
        start_time: '0:00',
        end_time: formatContentTimestamp(durationSeconds),
        duration: durationSeconds,
        visual_description: 'Owner-provided motivation video imported from Google Drive.',
        on_screen_text: safeTitle.slice(0, 40),
        narration: 'Original video audio.',
      },
    ],
    capcut_steps: [
      'Review the imported clip end-to-end.',
      'Confirm the channel owns or has permission to publish the media.',
      'Publish as a private YouTube Short first, then manually review before making it public.',
    ],
    seo: {
      title: safeTitle.slice(0, 100),
      description,
      tags: ['motivation', 'motivational video', 'shorts', 'mindset', 'inspiration'],
      keywords: ['motivation', 'shorts', 'mindset', 'inspiration'],
      hashtags: ['#motivation', '#shorts', '#mindset'],
      thumbnail_tips: 'Use the strongest frame from the clip with short, high-contrast text.',
      pinned_comment: 'What is one goal you are working toward today?',
    },
    thumbnail: {
      text: 'Keep Going',
      image_prompt: 'A bold, cinematic motivation thumbnail based on the imported clip.',
      emotion: 'determined',
      design_description: 'High-contrast motivational thumbnail with a clear focal point.',
      color_palette: ['#111827', '#f59e0b', '#ffffff'],
      text_suggestions: ['Keep Going', 'No Excuses', 'Start Today'],
      layout_tips: 'Keep text large and centered for mobile viewing.',
      accessibility_notes: 'Use strong contrast and avoid small text.',
    },
  }
}

function createDriveRightsRecord(options: {
  file: DriveVideoFile
  renderFile: string
  confirmed: boolean
}): RightsRecord {
  const { file, renderFile, confirmed } = options
  return {
    assetId: `drive-video-${file.id}`,
    file: renderFile,
    type: 'video',
    provider: 'google-drive',
    license: confirmed ? 'User-confirmed owned/licensed media' : 'RIGHTS_CONFIRMATION_REQUIRED',
    sourceUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
    credit: confirmed ? 'Owner-provided video' : undefined,
    generatedByAI: false,
    publicationRightsConfirmed: confirmed,
    retrievedAt: new Date().toISOString(),
  }
}

async function downloadDriveFile(file: DriveVideoFile, outFile: string): Promise<void> {
  const drive = buildAuthorizedDriveClient()
  const response = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'stream' })
  const body = response.data
  if (!(body instanceof Readable)) {
    throw new Error(`Drive download for ${file.name} did not return a readable stream`)
  }

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(outFile)
    body.on('error', reject)
    output.on('error', reject)
    output.on('finish', resolve)
    body.pipe(output)
  })
}

async function transcodeToShort(sourceFile: string, outFile: string, maxSeconds: number): Promise<void> {
  await ensureFfmpegAvailable()
  const format = resolveVideoFormat('9:16')
  await execFileAsync(
    resolveFfmpegPath(),
    [
      '-y',
      '-hide_banner',
      '-i',
      sourceFile,
      '-t',
      String(maxSeconds),
      '-vf',
      buildVideoFilter(format),
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
    { maxBuffer: 1024 * 1024 * 10 }
  )
}

async function listDriveVideos(query = DEFAULT_QUERY, maxResults = 3): Promise<DriveVideoFile[]> {
  const drive = buildAuthorizedDriveClient()
  const clauses = ["mimeType contains 'video/'", 'trashed = false']
  const trimmed = query.trim()
  if (trimmed) {
    const escaped = escapeDriveQuery(trimmed)
    clauses.push(`(name contains '${escaped}' or fullText contains '${escaped}')`)
  }

  const response = await drive.files.list({
    q: clauses.join(' and '),
    pageSize: Math.min(Math.max(maxResults, 1), 20),
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,webViewLink,modifiedTime)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  return (response.data.files || [])
    .filter((file): file is DriveVideoFile => Boolean(file.id && file.name))
    .map((file) => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType,
      webViewLink: file.webViewLink,
      modifiedTime: file.modifiedTime,
    }))
}

export async function runDriveAuthFlow(): Promise<void> {
  const oauth2 = buildDriveOauthClient()
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
          ? '<h2>Drive authorized. You can close this tab and return to the terminal.</h2>'
          : `<h2>Drive authorization failed: ${error || 'no code returned'}</h2>`
      )
      server.close()
      if (authCode) resolve(authCode)
      else reject(new Error(`Drive OAuth failed: ${error || 'no code returned'}`))
    })
    server.on('error', reject)
    server.listen(DRIVE_AUTH_PORT)
  })

  const { tokens } = await oauth2.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a Drive refresh token. Remove prior app access at https://myaccount.google.com/permissions and rerun.'
    )
  }

  console.log('\nSuccess! Add this line to your .env:\n')
  console.log(`DRIVE_REFRESH_TOKEN=${tokens.refresh_token}\n`)
}

export async function importDriveShorts(options: {
  query?: string
  maxResults?: number
  maxSeconds?: number
  privacy?: PipelineConfig['privacy']
  rightsConfirmed?: boolean
  publish?: boolean
}): Promise<PipelineJob[]> {
  const query = options.query || DEFAULT_QUERY
  const files = await listDriveVideos(query, options.maxResults || 3)
  const jobs: PipelineJob[] = []
  const maxSeconds = Math.min(Math.max(options.maxSeconds || DEFAULT_MAX_SECONDS, 15), 180)

  if (files.length === 0) {
    console.log(`[drive] No Drive videos matched query "${query}"`)
    return jobs
  }

  for (const file of files) {
    const title = titleFromFilename(file.name) || 'Motivation Short'
    const config: PipelineConfig = {
      topic: title,
      platform: 'youtube',
      durationMinutes: maxSeconds / 60,
      tone: 'motivational',
      aspectRatio: '9:16',
      privacy: options.privacy || 'private',
      autoApprove: false,
      publishAfterRender: Boolean(options.publish),
    }
    const job = await createJob(config)
    const sourceFile = await jobPath(job.id, 'drive', sanitizeFilename(file.name))
    const renderFile = await jobPath(job.id, 'render', 'final.mp4')

    console.log(`[drive] Downloading ${file.name} → ${sourceFile}`)
    await downloadDriveFile(file, sourceFile)
    console.log(`[drive] Transcoding ${file.name} as a 9:16 Short (${maxSeconds}s max)`)
    await transcodeToShort(sourceFile, renderFile, maxSeconds)

    const durationSeconds = await probeMediaDuration(renderFile)
    job.trends = {
      candidates: [],
      selected: {
        source: 'manual',
        topic: title,
        score: 100,
        detail: `Imported from Google Drive${file.modifiedTime ? `, modified ${file.modifiedTime}` : ''}`,
        url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
      },
    }
    job.content = buildDriveVideoContent(title, durationSeconds)
    job.render = {
      videoFile: renderFile,
      durationSeconds,
      width: 1080,
      height: 1920,
    }
    job.rightsRecords = [
      createDriveRightsRecord({
        file,
        renderFile: relativeToJob(job.id, renderFile),
        confirmed: Boolean(options.rightsConfirmed),
      }),
    ]
    const reviewFile = await jobPath(job.id, 'review.html')
    await writeReviewPage(job, reviewFile)
    job.approval = { reviewFile }
    job.status = 'awaiting_approval'
    await saveJob(job)
    jobs.push(job)

    console.log(`[drive] Created review job ${job.id}: ${reviewFile}`)
  }

  return jobs
}

export async function confirmDriveRights(jobId: string): Promise<PipelineJob> {
  const job = await loadJob(jobId)
  let changed = false

  job.rightsRecords = job.rightsRecords.map((record) => {
    if (record.provider !== 'google-drive') return record
    changed = true
    return {
      ...record,
      license: 'User-confirmed owned/licensed media',
      credit: record.credit || 'Owner-provided video',
      publicationRightsConfirmed: true,
    }
  })

  if (!changed) {
    throw new Error(`Job ${jobId} has no Google Drive rights records to confirm`)
  }

  if (job.render) {
    const manifestFile = await jobPath(job.id, 'rights-manifest.json')
    const manifest = await writeRightsManifest(job, manifestFile)
    job.rights = {
      manifestFile,
      assetCount: manifest.assets.length,
      aiDisclosure: manifest.aiDisclosure,
    }
  }

  await saveJob(job)
  console.log(`[drive] Publication rights confirmed for ${job.id}`)
  return job
}
