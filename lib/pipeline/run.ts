import * as path from 'path'

import { discoverTrends, selectTopic } from './trends'
import { extractHook, generateContentPackage } from './content'
import { acquireSceneImage } from './images'
import { synthesizeNarration } from './tts'
import { buildCues, buildSrt, buildVtt } from './captions'
import { writeReviewPage } from './review'
import { renderThumbnail, renderVideo } from './render'
import { writeRightsManifest } from './rights'
import { isPublishConfigured, publishToYouTube } from './youtube'
import { jobDir, jobPath, loadJob, relativeToJob, saveJob } from './job-store'
import type { PipelineJob, RightsRecord } from './types'
import * as fs from 'fs'

/**
 * Pipeline orchestrator. Each stage is idempotent: it checks the job record
 * and skips work already done, so a failed run can be resumed with the same
 * command. The flow pauses at `awaiting_approval` unless autoApprove is set.
 */

function addRightsRecord(job: PipelineJob, record: RightsRecord): void {
  const relative = { ...record, file: relativeToJob(job.id, record.file) }
  const existingIndex = job.rightsRecords.findIndex((item) => item.assetId === record.assetId)
  if (existingIndex >= 0) job.rightsRecords[existingIndex] = relative
  else job.rightsRecords.push(relative)
}

async function stageTrends(job: PipelineJob): Promise<void> {
  if (job.trends) return
  job.status = 'trends'
  await saveJob(job)

  if (job.config.topic) {
    job.trends = {
      candidates: [],
      selected: { source: 'manual', topic: job.config.topic, score: 100 },
    }
    console.log(`[pipeline] Topic (manual): ${job.config.topic}`)
    return
  }

  console.log('[pipeline] Discovering trends from YouTube / Google Trends / X ...')
  const candidates = await discoverTrends()
  const selected = selectTopic(candidates)
  job.trends = { candidates: candidates.slice(0, 20), selected }
  console.log(`[pipeline] Selected topic (${selected.source}): ${selected.topic}`)
}

async function stageContent(job: PipelineJob): Promise<void> {
  if (job.content) return
  job.status = 'content'
  await saveJob(job)

  const topic = job.trends!.selected.topic
  console.log('[pipeline] Generating hook, script, shot list, title, and thumbnail concept ...')
  const { content } = await generateContentPackage(topic, job.config, job.trends!.selected.detail)
  job.content = content
  console.log(`[pipeline] Title: ${content.seo.title}`)
  console.log(`[pipeline] Hook: ${extractHook(content)}`)
  console.log(`[pipeline] ${content.scenes.length} scenes planned`)
}

async function stageAssets(job: PipelineJob): Promise<void> {
  job.status = 'assets'
  await saveJob(job)
  const content = job.content!
  job.sceneAssets = job.sceneAssets || []

  for (const scene of content.scenes) {
    let state = job.sceneAssets.find((asset) => asset.sceneId === scene.id)
    if (!state) {
      state = { sceneId: scene.id }
      job.sceneAssets.push(state)
    }
    if (state.imageFile && fs.existsSync(state.imageFile)) continue

    console.log(`[pipeline] Photo for scene ${scene.id}/${content.scenes.length}: ${scene.title}`)
    const outFile = await jobPath(job.id, 'assets', `scene-${scene.id}.jpg`)
    const result = await acquireSceneImage({
      assetId: `image-scene-${scene.id}`,
      visualDescription: scene.visual_description,
      onScreenText: scene.on_screen_text,
      aspectRatio: job.config.aspectRatio,
      outFile,
      sceneIndex: scene.id,
    })
    state.imageFile = result.file
    addRightsRecord(job, result.rights)
    await saveJob(job)
  }

  if (!job.thumbnailFile || !fs.existsSync(job.thumbnailFile)) {
    console.log('[pipeline] Generating thumbnail image ...')
    const rawFile = await jobPath(job.id, 'assets', 'thumbnail-source.jpg')
    const result = await acquireSceneImage({
      assetId: 'thumbnail',
      visualDescription: content.thumbnail.image_prompt,
      onScreenText: content.thumbnail.text,
      aspectRatio: '16:9',
      outFile: rawFile,
      sceneIndex: 0,
    })
    const thumbFile = await jobPath(job.id, 'assets', 'thumbnail.jpg')
    job.thumbnailFile = await renderThumbnail(result.file, thumbFile)
    addRightsRecord(job, { ...result.rights, type: 'thumbnail', file: job.thumbnailFile })
    await saveJob(job)
  }
}

async function stageNarration(job: PipelineJob): Promise<void> {
  job.status = 'narration'
  await saveJob(job)
  const content = job.content!

  for (const scene of content.scenes) {
    const state = job.sceneAssets!.find((asset) => asset.sceneId === scene.id)!
    if (state.audioFile && fs.existsSync(state.audioFile) && state.audioDuration) continue

    console.log(`[pipeline] Narration for scene ${scene.id}/${content.scenes.length}`)
    const outFile = await jobPath(job.id, 'audio', `scene-${scene.id}.mp3`)
    const result = await synthesizeNarration({
      assetId: `audio-scene-${scene.id}`,
      narration: scene.narration,
      tone: job.config.tone,
      platform: job.config.platform,
      outFile,
    })
    state.audioFile = result.file
    state.audioDuration = result.duration
    addRightsRecord(job, result.rights)
    await saveJob(job)
  }

  console.log('[pipeline] Building SRT/VTT captions from measured narration timing ...')
  const cues = buildCues(
    content.scenes.map((scene) => {
      const state = job.sceneAssets!.find((asset) => asset.sceneId === scene.id)!
      return { narration: scene.narration, duration: state.audioDuration || scene.duration }
    })
  )
  const srtFile = await jobPath(job.id, 'captions', 'captions.srt')
  const vttFile = await jobPath(job.id, 'captions', 'captions.vtt')
  await fs.promises.writeFile(srtFile, buildSrt(cues))
  await fs.promises.writeFile(vttFile, buildVtt(cues))
  job.captions = { srtFile, vttFile }
  await saveJob(job)
}

async function stageReview(job: PipelineJob): Promise<void> {
  const reviewFile = await jobPath(job.id, 'review.html')
  await writeReviewPage(job, reviewFile)
  job.approval = { ...(job.approval || {}), reviewFile }
  job.status = 'awaiting_approval'
  await saveJob(job)
  console.log('\n[pipeline] ── HUMAN APPROVAL REQUIRED ──')
  console.log(`[pipeline] Review screen: ${reviewFile}`)
  console.log(`[pipeline] Approve with: npm run pipeline -- approve ${job.id}`)
  console.log(`[pipeline] Reject with:  npm run pipeline -- reject ${job.id} --reason "..."`)
}

async function stageRender(job: PipelineJob): Promise<void> {
  if (job.render && fs.existsSync(job.render.videoFile)) return
  job.status = 'rendering'
  await saveJob(job)

  console.log('[pipeline] Rendering video with FFmpeg ...')
  const outFile = await jobPath(job.id, 'render', 'final.mp4')
  const workDir = path.join(jobDir(job.id), 'render', 'work')
  job.render = await renderVideo({
    scenes: job.content!.scenes,
    sceneAssets: job.sceneAssets!,
    aspectRatio: job.config.aspectRatio,
    workDir,
    outFile,
  })
  job.status = 'rendered'
  await saveJob(job)
  console.log(
    `[pipeline] Rendered ${job.render.durationSeconds.toFixed(1)}s ${job.render.width}x${job.render.height} → ${outFile}`
  )
}

async function stageRights(job: PipelineJob): Promise<void> {
  const manifestFile = await jobPath(job.id, 'rights-manifest.json')
  const manifest = await writeRightsManifest(job, manifestFile)
  job.rights = {
    manifestFile,
    assetCount: manifest.assets.length,
    aiDisclosure: manifest.aiDisclosure,
  }
  await saveJob(job)
  console.log(
    `[pipeline] Rights manifest written (${manifest.assets.length} assets, AI disclosure: ${manifest.aiDisclosure}) → ${manifestFile}`
  )
}

async function stagePublish(job: PipelineJob): Promise<void> {
  if (job.publish) return
  if (!job.config.publishAfterRender) {
    console.log('\n[pipeline] Publish not requested for this job (create with --publish, or run:')
    console.log(`[pipeline]   npm run pipeline -- publish ${job.id}`)
    return
  }
  if (!isPublishConfigured()) {
    console.log('\n[pipeline] YouTube credentials not configured — skipping publish.')
    console.log('[pipeline] Set YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET, run `npm run pipeline -- auth`,')
    console.log(`[pipeline] then publish with: npm run pipeline -- publish ${job.id}`)
    return
  }
  job.status = 'publishing'
  await saveJob(job)

  const manifestRaw = await fs.promises.readFile(job.rights!.manifestFile, 'utf8')
  job.publish = await publishToYouTube({
    job,
    manifest: JSON.parse(manifestRaw),
    privacy: job.config.privacy,
  })
  job.status = 'published'
  await saveJob(job)
  console.log(`\n[pipeline] Published: ${job.publish.url} (${job.publish.privacy})`)
}

/** Run stages 1-5: everything up to the approval gate. */
export async function runUntilApproval(job: PipelineJob): Promise<PipelineJob> {
  try {
    await stageTrends(job)
    await stageContent(job)
    await stageAssets(job)
    await stageNarration(job)
    await stageReview(job)
    if (job.config.autoApprove) {
      console.log('[pipeline] --auto set: skipping approval gate')
      return approveAndFinish(job.id)
    }
    return job
  } catch (error) {
    job.status = 'error'
    job.error = error instanceof Error ? error.message : String(error)
    await saveJob(job)
    throw error
  }
}

/** Run stages 6-7: render, rights manifest, publish. */
export async function approveAndFinish(jobId: string): Promise<PipelineJob> {
  const job = await loadJob(jobId)
  if (job.status === 'rejected') {
    throw new Error(`Job ${jobId} was rejected${job.approval?.reason ? `: ${job.approval.reason}` : ''}`)
  }
  job.approval = { ...(job.approval || { reviewFile: '' }), approvedAt: new Date().toISOString() }
  job.status = 'approved'
  job.error = undefined
  await saveJob(job)

  try {
    await stageRender(job)
    await stageRights(job)
    await stagePublish(job)
    return job
  } catch (error) {
    job.status = 'error'
    job.error = error instanceof Error ? error.message : String(error)
    await saveJob(job)
    throw error
  }
}

export async function rejectJob(jobId: string, reason?: string): Promise<PipelineJob> {
  const job = await loadJob(jobId)
  job.status = 'rejected'
  job.approval = {
    ...(job.approval || { reviewFile: '' }),
    rejectedAt: new Date().toISOString(),
    reason,
  }
  return saveJob(job)
}

/** Publish an already-rendered job (used when creds were added after render). */
export async function publishJob(
  jobId: string,
  privacy?: 'private' | 'unlisted' | 'public'
): Promise<PipelineJob> {
  const job = await loadJob(jobId)
  if (!job.render) throw new Error(`Job ${jobId} has not been rendered yet — approve it first`)
  if (!job.rights) await stageRights(job)
  if (privacy) job.config.privacy = privacy
  job.config.publishAfterRender = true
  job.publish = undefined
  await stagePublish(job)
  return job
}
