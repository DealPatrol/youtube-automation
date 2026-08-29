import { execFile } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'

import type { GeneratedContent } from '@/lib/content/generation'
import { ensureFfmpegAvailable, probeMediaDuration, resolveFfmpegPath } from '@/lib/video/ffmpeg'
import { SHORTS_HEIGHT, SHORTS_MAX_DURATION_SECONDS, SHORTS_WIDTH } from '@/lib/video/shorts-optimizer'

import { downloadDriveFile, getDriveVideo, searchDriveVideos, type DriveVideoFile } from './drive'
import { createJob, jobPath, loadJob, relativeToJob, saveJob } from './job-store'
import { writeRightsManifest } from './rights'
import { publishJob } from './run'
import type { PipelineJob, RightsRecord } from './types'

const execFileAsync = promisify(execFile)

export interface DriveShortJobOptions {
  fileId?: string
  query?: string
  folderId?: string
  title?: string
  description?: string
  tags?: string[]
  startSeconds?: number
  maxSeconds?: number
  privacy?: 'private' | 'unlisted' | 'public'
  publishAfterRender?: boolean
  rightsConfirmed?: boolean
  rightsOwner?: string
  license?: string
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]{2,5}$/i, '')
}

function cleanTitle(value: string): string {
  const title = value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return (title || 'Motivation Short').slice(0, 100)
}

function uniqueList(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function formatTimestamp(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.round(totalSeconds % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildDriveShortMetadata(input: {
  fileName: string
  title?: string
  description?: string
  tags?: string[]
  durationSeconds: number
}): GeneratedContent {
  const title = cleanTitle(input.title || stripExtension(input.fileName))
  const tags = uniqueList([...(input.tags || []), 'motivation', 'self improvement', 'shorts'])
  const hashtags = ['#Shorts', '#Motivation', '#SelfImprovement']
  const description =
    input.description?.trim() ||
    `${title}\n\nA short motivational clip for daily focus and momentum.\n\n${hashtags.join(' ')}`

  return {
    script: {
      title,
      duration: input.durationSeconds / 60,
      content: description,
      sections: [{ time: '0:00', speaker: 'Original audio', text: 'Imported Google Drive clip.' }],
    },
    scenes: [
      {
        id: 1,
        title,
        start_time: '0:00',
        end_time: formatTimestamp(input.durationSeconds),
        duration: input.durationSeconds,
        visual_description: 'Imported Google Drive video optimized for YouTube Shorts.',
        on_screen_text: 'Keep Going',
        narration: 'Original audio from the imported Drive video is preserved.',
      },
    ],
    capcut_steps: [
      'Review the imported clip for rights, likeness, music, and brand fit.',
      'Confirm the 9:16 Shorts crop keeps the main subject visible.',
      'Publish privately first, then review in YouTube Studio before changing visibility.',
    ],
    seo: {
      title,
      description,
      tags,
      keywords: uniqueList(['motivation', 'daily motivation', 'self improvement', ...tags]).slice(0, 12),
      hashtags,
      thumbnail_tips: 'Use a clear frame with readable, high-contrast motivational text.',
      pinned_comment: 'What is one thing you are doing today to move forward?',
    },
    thumbnail: {
      text: 'Keep Going',
      image_prompt: 'A determined person taking one more step toward a bright horizon.',
      emotion: 'determined',
      design_description: 'High-contrast motivational thumbnail with a focused subject and minimal text.',
      color_palette: ['#111827', '#F59E0B', '#FFFFFF'],
      text_suggestions: ['Keep Going', 'No Excuses', 'Start Today'],
      layout_tips: 'Keep the subject centered for Shorts and leave room for title-safe text.',
      accessibility_notes: 'Use large text and avoid relying on color alone for emphasis.',
    },
  }
}

export function buildDriveRightsRecord(input: {
  jobId: string
  file: string
  driveFile: DriveVideoFile
  rightsConfirmed?: boolean
  rightsOwner?: string
  license?: string
}): RightsRecord {
  const rightsStatement =
    input.license?.trim() ||
    'User confirmed they own this Google Drive video or have permission to publish it.'
  return {
    assetId: `drive-video-${input.driveFile.id}`,
    file: relativeToJob(input.jobId, input.file),
    type: 'video',
    provider: 'google-drive',
    license: input.rightsConfirmed ? rightsStatement : '',
    sourceUrl: input.driveFile.webViewLink,
    credit: input.rightsOwner?.trim() ? `Video courtesy of ${input.rightsOwner.trim()}` : undefined,
    generatedByAI: false,
    retrievedAt: new Date().toISOString(),
  }
}

export async function renderDriveVideoAsShort(options: {
  inputFile: string
  outFile: string
  startSeconds?: number
  maxSeconds?: number
}): Promise<{ videoFile: string; durationSeconds: number; width: number; height: number }> {
  await ensureFfmpegAvailable()
  await fs.promises.mkdir(path.dirname(options.outFile), { recursive: true })

  const maxSeconds = Math.min(
    Math.max(options.maxSeconds || SHORTS_MAX_DURATION_SECONDS, 1),
    SHORTS_MAX_DURATION_SECONDS
  )
  const startSeconds = Math.max(options.startSeconds || 0, 0)

  const args = [
    '-y',
    ...(startSeconds > 0 ? ['-ss', String(startSeconds)] : []),
    '-i',
    options.inputFile,
    '-t',
    String(maxSeconds),
    '-vf',
    `scale=${SHORTS_WIDTH}:${SHORTS_HEIGHT}:force_original_aspect_ratio=increase,crop=${SHORTS_WIDTH}:${SHORTS_HEIGHT},format=yuv420p`,
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
    options.outFile,
  ]

  await execFileAsync(resolveFfmpegPath(), args, { maxBuffer: 1024 * 1024 * 50 })
  const durationSeconds = Math.min(await probeMediaDuration(options.outFile), SHORTS_MAX_DURATION_SECONDS)
  return { videoFile: options.outFile, durationSeconds, width: SHORTS_WIDTH, height: SHORTS_HEIGHT }
}

async function resolveDriveFile(options: DriveShortJobOptions): Promise<DriveVideoFile> {
  if (options.fileId) return getDriveVideo(options.fileId)
  const files = await searchDriveVideos({
    query: options.query || 'motivation',
    folderId: options.folderId,
    max: 1,
  })
  const file = files[0]
  if (!file) {
    throw new Error(
      `No Drive videos found for query "${options.query || 'motivation'}"${
        options.folderId ? ` in folder ${options.folderId}` : ''
      }`
    )
  }
  return file
}

export async function writeDriveImportReviewPage(job: PipelineJob, outFile: string): Promise<string> {
  if (!job.content || !job.render || job.source?.type !== 'google-drive') {
    throw new Error('Cannot build Drive review page before import is complete')
  }
  const dir = path.dirname(outFile)
  const rel = (absolute?: string) => (absolute ? path.relative(dir, absolute) : '')
  const videoPath = rel(job.render.videoFile)
  const originalPath = rel(job.source.originalFile)
  const title = escapeHtml(job.content.seo.title)
  const rightsConfirmed = Boolean(job.source.rightsConfirmedAt)
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Review Drive Short: ${title}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; background: #101014; color: #e8e8ee; }
  h1 { font-size: 1.5rem; } h2 { font-size: 1.1rem; margin-top: 2rem; border-bottom: 1px solid #333; padding-bottom: .4rem; }
  video { width: min(360px, 100%); border-radius: 12px; background: #000; }
  code, pre { background: #1a1a22; padding: .2rem .45rem; border-radius: 4px; font-size: .9rem; }
  pre { padding: .8rem; overflow-x: auto; }
  .meta { color: #9a9aa8; font-size: .9rem; }
  .warn { background: #3b2416; border-left: 4px solid #f59e0b; padding: .8rem 1rem; border-radius: 6px; }
  .ok { background: #14351f; border-left: 4px solid #4caf7d; padding: .8rem 1rem; border-radius: 6px; }
</style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">Job ${job.id} · Google Drive import · 9:16 · ${job.render.durationSeconds.toFixed(1)}s · ${job.config.privacy}</p>
  <video controls src="${escapeHtml(videoPath)}"></video>
  <h2>Source</h2>
  <p><strong>${escapeHtml(job.source.fileName)}</strong></p>
  <p class="meta">Original file: ${escapeHtml(originalPath)}</p>
  ${job.source.webViewLink ? `<p><a href="${escapeHtml(job.source.webViewLink)}">Open source file in Drive</a></p>` : ''}
  <h2>Rights checklist</h2>
  <div class="${rightsConfirmed ? 'ok' : 'warn'}">
    ${
      rightsConfirmed
        ? `Rights confirmed: ${escapeHtml(job.source.rightsStatement || 'owner/permission attested')}`
        : `Before publishing, confirm you own this clip or have permission for the video, music, voices, likenesses, and any third-party footage.`
    }
  </div>
  <pre>npm run pipeline -- confirm-rights ${escapeHtml(job.id)}
npm run pipeline -- approve ${escapeHtml(job.id)}
npm run pipeline -- publish ${escapeHtml(job.id)} --privacy private</pre>
  <h2>Title &amp; SEO</h2>
  <p><strong>${escapeHtml(job.content.seo.title)}</strong></p>
  <p>${escapeHtml(job.content.seo.description)}</p>
</body>
</html>`
  await fs.promises.writeFile(outFile, html)
  return outFile
}

export async function createDriveShortJob(options: DriveShortJobOptions): Promise<PipelineJob> {
  const driveFile = await resolveDriveFile(options)
  const job = await createJob({
    topic: options.title || stripExtension(driveFile.name),
    platform: 'youtube',
    durationMinutes: 1,
    tone: 'motivational',
    aspectRatio: '9:16',
    privacy: options.privacy || 'private',
    autoApprove: false,
    publishAfterRender: Boolean(options.publishAfterRender),
  })

  try {
    job.status = 'imported'
    await saveJob(job)

    const originalFile = await jobPath(job.id, 'source', driveFile.name)
    console.log(`[drive] Downloading "${driveFile.name}" ...`)
    await downloadDriveFile(driveFile.id, originalFile)

    const outFile = await jobPath(job.id, 'render', 'final.mp4')
    console.log('[drive] Optimizing Drive video as a 9:16 YouTube Short ...')
    job.render = await renderDriveVideoAsShort({
      inputFile: originalFile,
      outFile,
      startSeconds: options.startSeconds,
      maxSeconds: options.maxSeconds,
    })
    job.content = buildDriveShortMetadata({
      fileName: driveFile.name,
      title: options.title,
      description: options.description,
      tags: options.tags,
      durationSeconds: job.render.durationSeconds,
    })
    job.source = {
      type: 'google-drive',
      fileId: driveFile.id,
      fileName: driveFile.name,
      mimeType: driveFile.mimeType,
      webViewLink: driveFile.webViewLink,
      originalFile,
      optimizedFile: outFile,
      importedAt: new Date().toISOString(),
    }
    job.rightsRecords = [
      buildDriveRightsRecord({
        jobId: job.id,
        file: originalFile,
        driveFile,
        rightsConfirmed: options.rightsConfirmed,
        rightsOwner: options.rightsOwner,
        license: options.license,
      }),
    ]

    if (options.rightsConfirmed) {
      job.source.rightsConfirmedAt = new Date().toISOString()
      job.source.rightsStatement =
        options.license?.trim() ||
        'User confirmed they own this Google Drive video or have permission to publish it.'
    }

    const reviewFile = await jobPath(job.id, 'review.html')
    job.approval = { reviewFile }
    job.status = 'awaiting_approval'
    await writeDriveImportReviewPage(job, reviewFile)
    await saveJob(job)

    if (options.publishAfterRender && options.rightsConfirmed) {
      job.approval.approvedAt = new Date().toISOString()
      await saveJob(job)
      await writeRightsManifest(job, await jobPath(job.id, 'rights-manifest.json'))
      return publishJob(job.id, job.config.privacy)
    }

    return job
  } catch (error) {
    job.status = 'error'
    job.error = error instanceof Error ? error.message : String(error)
    await saveJob(job)
    throw error
  }
}

export async function confirmDriveJobRights(
  jobId: string,
  options: { rightsOwner?: string; license?: string } = {}
): Promise<PipelineJob> {
  const job = await loadJob(jobId)
  if (job.source?.type !== 'google-drive') {
    throw new Error(`Job ${jobId} is not a Google Drive import`)
  }
  const rightsStatement =
    options.license?.trim() ||
    'User confirmed they own this Google Drive video or have permission to publish it.'
  const confirmedAt = new Date().toISOString()
  job.source.rightsConfirmedAt = confirmedAt
  job.source.rightsStatement = rightsStatement
  job.rightsRecords = job.rightsRecords.map((record) =>
    record.provider === 'google-drive'
      ? {
          ...record,
          license: rightsStatement,
          credit: options.rightsOwner?.trim() ? `Video courtesy of ${options.rightsOwner.trim()}` : record.credit,
        }
      : record
  )
  job.rights = undefined
  if (job.approval?.reviewFile) {
    await writeDriveImportReviewPage(job, job.approval.reviewFile)
  }
  return saveJob(job)
}
