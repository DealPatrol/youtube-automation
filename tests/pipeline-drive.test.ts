import test from 'node:test'
import assert from 'node:assert/strict'

import { buildDriveShortContent, buildDriveVideoQuery } from '@/lib/pipeline/drive'

test('builds a Drive video search query from motivation terms', () => {
  const query = buildDriveVideoQuery("motivation owner's clip")

  assert.match(query, /mimeType contains 'video\/'/)
  assert.match(query, /trashed = false/)
  assert.match(query, /name contains 'motivation'/)
  assert.match(query, /fullText contains 'owner\\'s'/)
})

test('builds Shorts metadata for imported Drive video', () => {
  const content = buildDriveShortContent({
    fileName: 'morning_motivation_clip.mp4',
    durationSeconds: 42.4,
  })

  assert.equal(content.scenes.length, 1)
  assert.equal(content.scenes[0].end_time, '0:42')
  assert.ok(content.seo.title.includes('#Shorts'))
  assert.deepEqual(content.seo.hashtags, ['#Shorts', '#Motivation', '#Mindset'])
})
