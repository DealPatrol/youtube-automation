import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import { pipeline } from 'stream/promises'

import { google } from 'googleapis'

import { formatContentTimestamp, type GeneratedContent } from '@/lib/content/generation'
import { renderImportedVideoShort, renderVideoThumbnail } from './render'
import { createJob, jobPath, loadJob, relativeToJob, saveJob } from './job-store'
import { writeReviewPage } from './review'
import type { PipelineJob, RightsRecord } from './types'

const AUTH_PORT = Number(process.env.PIPELINE_AUTH_PORT || 8787)
const AUTH_REDIRECT = `http://localhost:${AUTH_PORT}/callback`
const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
const DEFAULT_SHORT_SECONDS = 59

export interface DriveVideoCandidate {
  id: string
  name: string
  mimeType?: string
  size?: string
  modifiedTime?: string
  webViewLink?: string
}

export interface CreateDriveShortsOptions {
  query: string
  maxResults: number
  privacy: 'private' | 'unlisted' | 'public'
  publishAfterRender: boolean
  rightsConfirmed: boolean
  maxDurationSeconds?: number
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
      'Set GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET (or GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET) to read Drive videos'
    )
  }

  return { clientId, clientSecret }
}

function buildDriveClient() {
  const { clientId, clientSecret } = resolveDriveClientCredentials()
  const refreshToken =
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN ||
    process.env.GOOGLE_REFRESH_TOKEN ||
    process.env.YOUTUBE_REFRESH_TOKEN

  if (!refreshToken?.trim()) {
    throw new Error(
      'Set GOOGLE_DRIVE_REFRESH_TOKEN in .env (run: npm run pipeline -- drive-auth)'
    )
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, AUTH_REDIRECT)
  oauth2.setCredentials({ refresh_token: refreshToken.trim() })
  return google.drive({ version: 'v3', auth: oauth2 })
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function buildDriveVideoQuery(query: string): string {
  const clauses = ["mimeType contains 'video/'", 'trashed = false']
  const terms = query
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 6)

  if (terms.length > 0) {
    clauses.push(
      `(${terms
        .map((term) => {
          const escaped = escapeDriveQueryValue(term)
          return `name contains '${escaped}' or fullText contains '${escaped}'`
        })
        .join(' or ')})`
    )
  }

  return clauses.join(' and ')
}

export async function runDriveAuthFlow(): Promise<void> {
  const { clientId, clientSecret } = resolveDriveClientCredentials()
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, AUTH_REDIRECT)
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: DRIVE_SCOPES,
  })

  console.log('\nOpen this URL in your browser and authorize read-only Google Drive access:\n')
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
          ? '<h2>Drive authorized. You can close this tab and return to the terminal.</h2>'
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
  console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}\n`)
}

export async function searchDriveVideos(
  query: string,
  maxResults: number
): Promise<DriveVideoCandidate[]> {
  const drive = buildDriveClient()
  const response = await drive.files.list({
    q: buildDriveVideoQuery(query),
    pageSize: Math.min(Math.max(maxResults, 1), 25),
    orderBy: 'modifiedTime desc',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
  })

  return (response.data.files || [])
    .filter((file): file is DriveVideoCandidate => Boolean(file.id && file.name))
    .map((file) => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType || undefined,
      size: file.size || undefined,
      modifiedTime: file.modifiedTime || undefined,
      webViewLink: file.webViewLink || undefined,
    }))
}

function normalizeTitleFromFileName(name: string): string {
  const withoutExtension = name.replace(/\.[a-z0-9]{2,5}$/i, '')
  return (
    withoutExtension
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Motivation Short'
  )
}

function extensionForDriveVideo(candidate: DriveVideoCandidate): string {
  const ext = path.extname(candidate.name)
  if (ext) return ext.toLowerCase()
  if (candidate.mimeType === 'video/quicktime') return '.mov'
  if (candidate.mimeType === 'video/x-msvideo') return '.avi'
  return '.mp4'
}

export function buildDriveShortContent(input: {
  fileName: string
  durationSeconds: number
}): GeneratedContent {
  const baseTitle = normalizeTitleFromFileName(input.fileName)
  const title = `${baseTitle} #Shorts`.slice(0, 100)
  const duration = Math.max(1, Math.round(input.durationSeconds))

  return {
    script: {
      title,
      duration: duration / 60,
      content: `Imported motivational short from Google Drive: ${baseTitle}`,
      sections: [
        {
          time: '0:00',
          speaker: 'Original audio',
          text: 'Original Google Drive video audio.',
        },
      ],
    },
    scenes: [
      {
        id: 1,
        title: baseTitle,
        start_time: '0:00',
        end_time: formatContentTimestamp(duration),
        duration,
        visual_description: 'Imported Google Drive motivation video cropped for YouTube Shorts.',
        on_screen_text: baseTitle.slice(0, 40),
        narration: 'Original Google Drive video audio.',
      },
    ],
    capcut_steps: [
      'Review the vertical crop for faces and text safety before publishing.',
      'Keep the upload private until title, description, and rights are confirmed.',
    ],
    seo: {
      title,
      description:
        'A short motivational clip from my personal video library.\n\n#Shorts #Motivation #Mindset',
      tags: ['motivation', 'motivational video', 'mindset', 'success', 'shorts'],
      keywords: ['motivation', 'mindset', 'shorts'],
      hashtags: ['#Shorts', '#Motivation', '#Mindset'],
      thumbnail_tips: 'Use a clear face, bold contrast, and a 2-4 word benefit-driven overlay.',
      pinned_comment: 'What mindset shift are you practicing today?',
    },
    thumbnail: {
      text: baseTitle.slice(0, 40),
      image_prompt: 'Use a high-energy frame from the imported motivation video.',
      emotion: 'inspiring',
      design_description: 'A clean motivational Shorts thumbnail using the imported video frame.',
      color_palette: ['#111827', '#F59E0B', '#FFFFFF'],
      text_suggestions: [baseTitle.slice(0, 24), 'Keep Going', 'Rise Up'],
      layout_tips: 'Center the subject and keep text inside the safe area.',
      accessibility_notes: 'High contrast text with no tiny captions.',
    },
  }
}

function buildDriveRightsRecord(input: {
  jobId: string
  candidate: DriveVideoCandidate
  sourceFile: string
  rightsConfirmed: boolean
}): RightsRecord {
  return {
    assetId: 'google-drive-source-video',
    file: relativeToJob(input.jobId, input.sourceFile),
    type: 'video',
    provider: 'google-drive',
    license: input.rightsConfirmed
      ? 'User-owned or properly licensed media (confirmed by operator)'
      : 'Pending creator rights confirmation',
    sourceUrl: input.candidate.webViewLink,
    credit: 'User-provided Google Drive video',
    generatedByAI: false,
    requiresRightsConfirmation: true,
    rightsConfirmed: input.rightsConfirmed,
    retrievedAt: new Date().toISOString(),
  }
}

async function downloadDriveVideo(candidate: DriveVideoCandidate, outFile: string): Promise<void> {
  const drive = buildDriveClient()
  const response = await drive.files.get(
    { fileId: candidate.id, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  )
  await fs.promises.mkdir(path.dirname(outFile), { recursive: true })
  await pipeline(response.data as NodeJS.ReadableStream, fs.createWriteStream(outFile))
}

export async function createDriveShortJob(
  candidate: DriveVideoCandidate,
  options: Omit<CreateDriveShortsOptions, 'query' | 'maxResults'>
): Promise<PipelineJob> {
  const maxDurationSeconds = options.maxDurationSeconds || DEFAULT_SHORT_SECONDS
  const job = await createJob({
    platform: 'youtube',
    durationMinutes: maxDurationSeconds / 60,
    tone: 'motivational',
    aspectRatio: '9:16',
    privacy: options.privacy,
    autoApprove: false,
    publishAfterRender: options.publishAfterRender,
  })

  job.source = {
    provider: 'google-drive',
    fileId: candidate.id,
    name: candidate.name,
    mimeType: candidate.mimeType,
    webViewLink: candidate.webViewLink,
    modifiedTime: candidate.modifiedTime,
    importedAt: new Date().toISOString(),
    rightsConfirmed: options.rightsConfirmed,
  }
  job.trends = {
    candidates: [],
    selected: {
      source: 'manual',
      topic: normalizeTitleFromFileName(candidate.name),
      score: 100,
      detail: 'Imported from Google Drive for a motivation Shorts channel',
      url: candidate.webViewLink,
    },
  }
  await saveJob(job)

  job.status = 'assets'
  await saveJob(job)
  const sourceFile = await jobPath(
    job.id,
    'source',
    `google-drive-original${extensionForDriveVideo(candidate)}`
  )
  console.log(`[drive] Downloading ${candidate.name} ...`)
  await downloadDriveVideo(candidate, sourceFile)

  job.status = 'rendering'
  await saveJob(job)
  const outputFile = await jobPath(job.id, 'render', 'final.mp4')
  console.log('[drive] Rendering 9:16 YouTube Short ...')
  job.render = await renderImportedVideoShort({
    sourceFile,
    outFile: outputFile,
    maxDurationSeconds,
  })

  const thumbnailFile = await jobPath(job.id, 'assets', 'thumbnail.jpg')
  job.thumbnailFile = await renderVideoThumbnail(job.render.videoFile, thumbnailFile)
  job.content = buildDriveShortContent({
    fileName: candidate.name,
    durationSeconds: job.render.durationSeconds,
  })
  job.rightsRecords = [
    buildDriveRightsRecord({
      jobId: job.id,
      candidate,
      sourceFile,
      rightsConfirmed: options.rightsConfirmed,
    }),
  ]

  const reviewFile = await jobPath(job.id, 'review.html')
  await writeReviewPage(job, reviewFile)
  job.approval = { reviewFile }
  job.status = 'awaiting_approval'
  await saveJob(job)
  return job
}

export async function createDriveShortJobs(
  options: CreateDriveShortsOptions
): Promise<PipelineJob[]> {
  const candidates = await searchDriveVideos(options.query, options.maxResults)
  if (candidates.length === 0) {
    console.log(`[drive] No Drive videos matched query "${options.query}"`)
    return []
  }

  const jobs: PipelineJob[] = []
  for (const candidate of candidates) {
    jobs.push(
      await createDriveShortJob(candidate, {
        privacy: options.privacy,
        publishAfterRender: options.publishAfterRender,
        rightsConfirmed: options.rightsConfirmed,
        maxDurationSeconds: options.maxDurationSeconds,
      })
    )
  }
  return jobs
}

export async function confirmDriveRights(jobId: string): Promise<PipelineJob> {
  const job = await loadJob(jobId)
  if (job.source?.provider !== 'google-drive') {
    throw new Error(`Job ${jobId} is not a Google Drive import`)
  }

  job.source.rightsConfirmed = true
  job.rightsRecords = job.rightsRecords.map((record) =>
    record.requiresRightsConfirmation
      ? {
          ...record,
          license: 'User-owned or properly licensed media (confirmed by operator)',
          rightsConfirmed: true,
        }
      : record
  )
  job.rights = undefined
  return saveJob(job)
}
