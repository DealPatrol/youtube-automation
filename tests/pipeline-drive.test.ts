import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import {
  buildDriveShortContent,
  buildDriveVideoQuery,
  confirmDriveShortRights,
} from '@/lib/pipeline/drive'
import { createJob, jobPath, saveJob } from '@/lib/pipeline/job-store'
import type { PipelineConfig, RightsRecord } from '@/lib/pipeline/types'

const driveConfig: PipelineConfig = {
  topic: 'motivation',
  platform: 'youtube',
  durationMinutes: 1,
  tone: 'motivational',
  aspectRatio: '9:16',
  privacy: 'private',
  autoApprove: false,
  publishAfterRender: false,
}

test('builds a Drive video query for motivation clips in an optional folder', () => {
  const query = buildDriveVideoQuery("morning motivation's", 'folder-123')

  assert.match(query, /mimeType contains 'video\/'/)
  assert.match(query, /trashed = false/)
  assert.match(query, /name contains 'morning motivation\\'s'/)
  assert.match(query, /'folder-123' in parents/)
})

test('builds Shorts metadata from an imported Drive filename', () => {
  const content = buildDriveShortContent('daily-discipline_clip.mp4', 'motivation discipline')

  assert.equal(content.scenes[0].duration, 60)
  assert.equal(content.seo.hashtags[0], '#Shorts')
  assert.ok(content.seo.tags.includes('motivation'))
  assert.ok(content.seo.tags.includes('discipline'))
  assert.match(content.seo.title, /Daily Discipline Clip/)
})

test('confirming Drive rights writes a publishable manifest', async () => {
  const previousJobsDir = process.env.PIPELINE_JOBS_DIR
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'drive-rights-'))
  process.env.PIPELINE_JOBS_DIR = root

  try {
    const job = await createJob(driveConfig)
    const renderFile = await jobPath(job.id, 'render', 'final.mp4')
    await fs.promises.writeFile(renderFile, 'fake video')

    const record: RightsRecord = {
      assetId: 'drive-video-1',
      file: 'drive/source.mp4',
      type: 'video',
      provider: 'google-drive',
      license: '',
      generatedByAI: false,
      retrievedAt: new Date().toISOString(),
    }

    job.content = buildDriveShortContent('morning motivation.mp4', 'motivation')
    job.render = { videoFile: renderFile, durationSeconds: 30, width: 1080, height: 1920 }
    job.rightsRecords = [record]
    await saveJob(job)

    const updated = await confirmDriveShortRights(job.id)

    assert.equal(updated.rightsRecords[0].license, 'Owner-confirmed or licensed for reuse by channel owner')
    assert.ok(updated.rights?.manifestFile)
    assert.ok(fs.existsSync(updated.rights!.manifestFile))
  } finally {
    if (previousJobsDir === undefined) delete process.env.PIPELINE_JOBS_DIR
    else process.env.PIPELINE_JOBS_DIR = previousJobsDir
    await fs.promises.rm(root, { recursive: true, force: true })
  }
})
