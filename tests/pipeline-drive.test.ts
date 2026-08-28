import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDriveRightsRecord,
  buildDriveShortsContent,
  buildDriveVideoSearchQuery,
  type DriveVideoCandidate,
} from '@/lib/pipeline/drive'

const candidate: DriveVideoCandidate = {
  id: 'drive-file-1',
  name: 'daily_motivation_clip.mp4',
  mimeType: 'video/mp4',
  size: String(12 * 1024 * 1024),
  webViewLink: 'https://drive.google.com/file/d/drive-file-1/view',
}

test('builds a Drive video search query for motivation clips', () => {
  const query = buildDriveVideoSearchQuery("AI motivation")

  assert.match(query, /trashed = false/)
  assert.match(query, /mimeType contains 'video\/'/)
  assert.match(query, /name contains 'AI'/)
  assert.match(query, /name contains 'motivation'/)
})

test('builds Shorts metadata from a Drive filename', () => {
  const content = buildDriveShortsContent(candidate, 75)

  assert.equal(content.script.duration, 60)
  assert.equal(content.scenes[0]?.end_time, '1:00')
  assert.equal(content.seo.title, 'Daily Motivation Clip')
  assert.deepEqual(content.seo.hashtags, ['#Shorts', '#Motivation', '#Inspiration'])
})

test('creates unconfirmed and confirmed Drive rights records', () => {
  const unconfirmed = buildDriveRightsRecord({
    candidate,
    file: '/tmp/job/assets/source.mp4',
    jobId: 'job',
    rightsConfirmed: false,
  })

  assert.equal(unconfirmed.provider, 'google-drive')
  assert.equal(unconfirmed.license, '')
  assert.equal(unconfirmed.rightsConfirmedAt, undefined)

  const confirmed = buildDriveRightsRecord({
    candidate,
    file: '/tmp/job/assets/source.mp4',
    jobId: 'job',
    rightsConfirmed: true,
    license: 'Owned by channel',
  })

  assert.equal(confirmed.license, 'Owned by channel')
  assert.ok(confirmed.rightsConfirmedAt)
})
