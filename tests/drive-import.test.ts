import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { buildDriveVideoSearchQuery } from '@/lib/pipeline/drive'
import { buildDriveRightsRecord, buildDriveShortMetadata } from '@/lib/pipeline/drive-import'
import { createJob, jobPath, saveJob } from '@/lib/pipeline/job-store'
import { assertPublishable } from '@/lib/pipeline/rights'
import { publishJob } from '@/lib/pipeline/run'
import type { DriveVideoFile } from '@/lib/pipeline/drive'

const driveFile: DriveVideoFile = {
  id: 'drive-123',
  name: 'daily_motivation.mp4',
  mimeType: 'video/mp4',
  webViewLink: 'https://drive.google.com/file/d/drive-123/view',
}

test('builds a Drive video search query for motivation clips in a folder', () => {
  const query = buildDriveVideoSearchQuery({ query: "today's motivation", folderId: 'folder-123' })
  assert.match(query, /trashed = false/)
  assert.match(query, /mimeType contains 'video\/'/)
  assert.match(query, /name contains 'today\\'s motivation'/)
  assert.match(query, /'folder-123' in parents/)
})

test('builds Shorts metadata for imported Drive motivation videos', () => {
  const metadata = buildDriveShortMetadata({
    fileName: driveFile.name,
    durationSeconds: 42,
    tags: ['mindset'],
  })

  assert.equal(metadata.seo.title, 'daily motivation')
  assert.equal(metadata.scenes[0].end_time, '0:42')
  assert.ok(metadata.seo.tags.includes('mindset'))
  assert.ok(metadata.seo.hashtags.includes('#Shorts'))
})

test('Drive rights records require explicit rights confirmation before publishing', () => {
  const unconfirmed = buildDriveRightsRecord({
    jobId: 'job-1',
    file: '/tmp/job-1/source/daily_motivation.mp4',
    driveFile,
  })
  assert.throws(
    () =>
      assertPublishable({
        jobId: 'job-1',
        createdAt: new Date().toISOString(),
        video: { title: 'Test', durationSeconds: 42 },
        assets: [unconfirmed],
        attributionText: '',
        aiDisclosure: false,
      }),
    /without license info/
  )

  const confirmed = buildDriveRightsRecord({
    jobId: 'job-1',
    file: '/tmp/job-1/source/daily_motivation.mp4',
    driveFile,
    rightsConfirmed: true,
  })
  assert.doesNotThrow(() =>
    assertPublishable({
      jobId: 'job-1',
      createdAt: new Date().toISOString(),
      video: { title: 'Test', durationSeconds: 42 },
      assets: [confirmed],
      attributionText: '',
      aiDisclosure: false,
    })
  )
})

test('publishing a Drive import requires review approval first', async () => {
  const previousJobsDir = process.env.PIPELINE_JOBS_DIR
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'drive-import-test-'))
  process.env.PIPELINE_JOBS_DIR = tmp

  try {
    const job = await createJob({
      topic: 'daily motivation',
      platform: 'youtube',
      durationMinutes: 1,
      tone: 'motivational',
      aspectRatio: '9:16',
      privacy: 'private',
      autoApprove: false,
      publishAfterRender: true,
    })
    const originalFile = await jobPath(job.id, 'source', driveFile.name)
    const optimizedFile = await jobPath(job.id, 'render', 'final.mp4')
    await fs.promises.writeFile(originalFile, 'source')
    await fs.promises.writeFile(optimizedFile, 'rendered')
    job.source = {
      type: 'google-drive',
      fileId: driveFile.id,
      fileName: driveFile.name,
      mimeType: driveFile.mimeType,
      webViewLink: driveFile.webViewLink,
      originalFile,
      optimizedFile,
      importedAt: new Date().toISOString(),
      rightsConfirmedAt: new Date().toISOString(),
    }
    job.content = buildDriveShortMetadata({ fileName: driveFile.name, durationSeconds: 42 })
    job.render = { videoFile: optimizedFile, durationSeconds: 42, width: 1080, height: 1920 }
    job.rightsRecords = [
      buildDriveRightsRecord({
        jobId: job.id,
        file: originalFile,
        driveFile,
        rightsConfirmed: true,
      }),
    ]
    await saveJob(job)

    await assert.rejects(() => publishJob(job.id, 'private'), /reviewed and approved/)
  } finally {
    if (previousJobsDir === undefined) delete process.env.PIPELINE_JOBS_DIR
    else process.env.PIPELINE_JOBS_DIR = previousJobsDir
    await fs.promises.rm(tmp, { recursive: true, force: true })
  }
})
