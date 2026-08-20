import test from 'node:test'
import assert from 'node:assert/strict'

import { buildDriveShortContent, buildDriveVideoQuery, escapeDriveQueryValue } from '@/lib/pipeline/drive-shorts'

test('builds a Drive video query scoped to non-trashed videos', () => {
  const query = buildDriveVideoQuery('morning motivation')

  assert.match(query, /mimeType contains 'video\/'/)
  assert.match(query, /trashed = false/)
  assert.match(query, /name contains 'morning motivation'/)
  assert.match(query, /fullText contains 'morning motivation'/)
})

test('escapes Drive query values', () => {
  assert.equal(escapeDriveQueryValue("coach's morning\\routine"), "coach\\'s morning\\\\routine")
})

test('creates YouTube Shorts metadata from Drive file names', () => {
  const content = buildDriveShortContent('daily-discipline-clip.mp4')

  assert.equal(content.scenes[0].duration, 60)
  assert.match(content.seo.title, /Motivation #Shorts$/)
  assert.deepEqual(content.seo.hashtags, ['#shorts', '#motivation', '#mindset'])
  assert.match(content.seo.description, /Confirm you own or have permission/)
})
