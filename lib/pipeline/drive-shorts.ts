import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import { pipeline as streamPipeline } from 'stream/promises'

import { google } from 'googleapis'

import { isPublishConfigured, publishToYouTube } from './youtube'
import { createJob, jobPath, relativeToJob, saveJob } from './job-store'
import { writeRightsManifest } from './rights'
import type { GeneratedContent } from '@/lib/content/generation'
import type { PipelineConfig, PipelineJob, RightsManifest, RightsRecord } from './types'

const DRIVE_AUTH_PORT = Number(process.env.DRIVE_AUTH_PORT || process.env.PIPELINE_AUTH_PORT || 8787)
const DRIVE_AUTH_REDIRECT = `http://localhost:${DRIVE_AUTH_PORT}/callback`
const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

export interface DriveShortsOptions {
  query: string
  maxResults: number
  privacy: PipelineConfig['privacy']
  publish: boolean
  rightsConfirmed: boolean
  dryRun: boolean
}

export interface DriveVideoCandidate {
  id: string
  name: string
  mimeType: string
  webViewLink?: string
  size?: string
}

export interface DriveShortImportResult {
  candidate: DriveVideoCandidate
  job?: PipelineJob
  skippedReason?: string
}

function resolveDriveCredentials(): { clientId: string; clientSecret: string } {
  const clientId =
    process.env.DRIVE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret =
    process.env.DRIVE_CLIENT_SECRET ||
    process.env.YOUTUBE_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Set DRIVE_CLIENT_ID and DRIVE_CLIENT_SECRET (or reuse YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET)')
  }
  return { clientId, clientSecret }
}

function buildDriveAuthClient() {
  const { clientId, clientSecret } = resolveDriveCredentials()
  const refreshToken =
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN || process.env.DRIVE_REFRESH_TOKEN || process.env.YOUTUBE_REFRESH_TOKEN
  if (!refreshToken) {
    throw new Error('Set GOOGLE_DRIVE_REFRESH_TOKEN in .env (run: npm run pipeline -- drive-auth)')
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, DRIVE_AUTH_REDIRECT)
  oauth2.setCredentials({ refresh_token: refreshToken })
  return google.drive({ version: 'v3', auth: oauth2 })
}

export function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").trim()
}

export function buildDriveVideoQuery(query: string): string {
  const clauses = ["mimeType contains 'video/'", 'trashed = false']
  const escaped = escapeDriveQueryValue(query)
  if (escaped) clauses.push(`(name contains '${escaped}' or fullText contains '${escaped}')`)
  return clauses.join(' and ')
}

function cleanTitleFromFileName(fileName: string): string {
  const base = path.basename(fileName, path.extname(fileName))
  const words = base
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!words) return 'Daily Motivation'
  return words
    .split(' ')
    .map((word) => (word.length <= 3 ? word : `${word[0].toUpperCase()}${word.slice(1)}`))
    .join(' ')
}

export function buildDriveShortContent(fileName: string): GeneratedContent {
  const cleanTitle = cleanTitleFromFileName(fileName)
  const shortTitle = cleanTitle.toLowerCase().includes('motivation')
    ? `${cleanTitle} #Shorts`
    : `${cleanTitle} Motivation #Shorts`

  return {
    script: {
      title: shortTitle,
      duration: 1,
      content: `Imported motivational short from Google Drive: ${cleanTitle}.`,
      sections: [{ time: '0:00', speaker: 'Original video', text: cleanTitle }],
    },
    scenes: [
      {
        id: 1,
        title: cleanTitle,
        start_time: '0:00',
        end_time: '1:00',
        duration: 60,
        visual_description: 'Original vertical motivation video imported from Google Drive.',
        on_screen_text: cleanTitle.slice(0, 40),
        narration: cleanTitle,
      },
    ],
    capcut_steps: [
      'Review the imported short for 9:16 framing.',
      'Confirm captions, music, and footage rights before publishing.',
    ],
    seo: {
      title: shortTitle.slice(0, 100),
      description: [
        `${cleanTitle} — a short motivational clip for daily momentum.`,
        '',
        'Confirm you own or have permission to publish this video before making it public.',
      ].join('\n'),
      tags: ['motivation', 'motivational video', 'shorts', 'self improvement', 'mindset'],
      keywords: ['motivation', 'shorts', 'self improvement', 'mindset'],
      hashtags: ['#shorts', '#motivation', '#mindset'],
      thumbnail_tips: 'Use a clear frame with readable motivational text.',
      pinned_comment: 'What is one action you are taking today?',
    },
    thumbnail: {
      text: 'Keep Going',
      image_prompt: 'Use the strongest frame from the imported motivation short.',
      emotion: 'inspired',
      design_description: 'High contrast motivational title card.',
      color_palette: ['#111827', '#f97316', '#ffffff'],
      text_suggestions: ['Keep Going', 'No Excuses', 'One More Rep'],
      layout_tips: 'Keep text centered and mobile-safe.',
      accessibility_notes: 'Use large text with strong contrast.',
    },
  }
}

function buildDriveRightsRecord(input: {
  jobId: string
  file: string
  candidate: DriveVideoCandidate
  rightsConfirmed: boolean
}): RightsRecord {
  return {
    assetId: `drive-video-${input.candidate.id}`,
    file: relativeToJob(input.jobId, input.file),
    type: 'video',
    provider: 'google-drive',
    license: input.rightsConfirmed
      ? 'User-provided Google Drive video; rights confirmed by channel owner'
      : 'User-provided Google Drive video; rights not confirmed for publishing',
    sourceUrl: input.candidate.webViewLink,
    credit: 'User-provided source video',
    generatedByAI: false,
    retrievedAt: new Date().toISOString(),
  }
}

function safeFileName(name: string): string {
  const ext = path.extname(name) || '.mp4'
  const base = path.basename(name, path.extname(name)).replace(/[^a-zA-Z0-9_-]+/g, '-')
  return `${base || 'drive-short'}${ext}`
}

async function writeDriveReview(job: PipelineJob, candidate: DriveVideoCandidate): Promise<string> {
  const reviewFile = await jobPath(job.id, 'drive-review.md')
  await fs.promises.writeFile(
    reviewFile,
    [
      `# Drive Short Review: ${job.content?.seo.title}`,
      '',
      `- Source file: ${candidate.name}`,
      candidate.webViewLink ? `- Drive link: ${candidate.webViewLink}` : undefined,
      `- Local video: ${job.render?.videoFile}`,
      `- Privacy default: ${job.config.privacy}`,
      '',
      'Before publishing:',
      '- Confirm you own the video or have permission to upload it.',
      '- Confirm music and any visible people/brands are cleared for YouTube.',
      '- Preview the file as a YouTube Short and edit metadata if needed.',
    ]
      .filter(Boolean)
      .join('\n')
  )
  return reviewFile
}

async function createDriveShortJob(input: {
  candidate: DriveVideoCandidate
  privacy: PipelineConfig['privacy']
  publish: boolean
  rightsConfirmed: boolean
}): Promise<{ job: PipelineJob; manifest: RightsManifest }> {
  const job = await createJob({
    topic: cleanTitleFromFileName(input.candidate.name),
    platform: 'youtube',
    durationMinutes: 1,
    tone: 'motivational',
    aspectRatio: '9:16',
    privacy: input.privacy,
    autoApprove: false,
    publishAfterRender: input.publish,
  })
  const videoFile = await downloadDriveVideo(input.candidate, job.id)

  job.status = 'rendered'
  job.trends = {
    candidates: [],
    selected: { source: 'manual', topic: job.config.topic || 'motivation', score: 100 },
  }
  job.content = buildDriveShortContent(input.candidate.name)
  job.render = { videoFile, durationSeconds: 60, width: 1080, height: 1920 }
  job.rightsRecords = [
    buildDriveRightsRecord({
      jobId: job.id,
      file: videoFile,
      candidate: input.candidate,
      rightsConfirmed: input.rightsConfirmed,
    }),
  ]
  job.approval = { reviewFile: await writeDriveReview(job, input.candidate) }

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

async function downloadDriveVideo(candidate: DriveVideoCandidate, jobId: string): Promise<string> {
  const drive = buildDriveAuthClient()
  const outFile = await jobPath(jobId, 'drive', safeFileName(candidate.name))
  const response = await drive.files.get({ fileId: candidate.id, alt: 'media' }, { responseType: 'stream' })
  await streamPipeline(response.data as NodeJS.ReadableStream, fs.createWriteStream(outFile))
  return outFile
}

export async function listDriveVideoCandidates(
  query: string,
  maxResults: number
): Promise<DriveVideoCandidate[]> {
  const drive = buildDriveAuthClient()
  const response = await drive.files.list({
    q: buildDriveVideoQuery(query),
    pageSize: Math.min(Math.max(maxResults, 1), 50),
    fields: 'files(id,name,mimeType,webViewLink,size)',
    orderBy: 'modifiedTime desc',
  })

  return (response.data.files ?? [])
    .filter((file): file is DriveVideoCandidate => Boolean(file.id && file.name && file.mimeType))
    .map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      webViewLink: file.webViewLink,
      size: file.size,
    }))
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

export async function importDriveShorts(options: DriveShortsOptions): Promise<DriveShortImportResult[]> {
  if (options.publish && !options.rightsConfirmed) {
    throw new Error('Refusing to publish Drive videos without --rights-confirmed')
  }

  const candidates = await listDriveVideoCandidates(options.query, options.maxResults)
  const results: DriveShortImportResult[] = []

  for (const candidate of candidates) {
    console.log(`[drive-shorts] ${candidate.name}${options.dryRun ? ' (dry run)' : ''}`)
    if (options.dryRun) {
      results.push({ candidate, skippedReason: 'dry-run' })
      continue
    }

    const { job, manifest } = await createDriveShortJob({
      candidate,
      privacy: options.privacy,
      publish: options.publish,
      rightsConfirmed: options.rightsConfirmed,
    })

    if (options.publish) {
      if (!isPublishConfigured()) {
        console.log('[drive-shorts] YouTube credentials not configured — imported locally but skipped publish.')
      } else {
        job.publish = await publishToYouTube({ job, manifest, privacy: options.privacy })
        job.status = 'published'
        await saveJob(job)
        console.log(`[drive-shorts] Published: ${job.publish.url} (${job.publish.privacy})`)
      }
    }

    results.push({ candidate, job })
  }

  if (results.length === 0) {
    console.log(`[drive-shorts] No Drive videos matched "${options.query}".`)
  }

  return results
}
