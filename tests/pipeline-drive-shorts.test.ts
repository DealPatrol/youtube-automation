import test from 'node:test'
import assert from 'node:assert/strict'

import { buildDriveShortsContent, buildDriveVideoQuery } from '@/lib/pipeline/drive-shorts'

test('builds a Drive video query scoped to video files and optional folder', () => {
  const query = buildDriveVideoQuery({
    query: "Bob's motivation",
    folderId: 'folder-123',
  })

  assert.ok(query.includes("mimeType contains 'video/'"))
  assert.ok(query.includes('trashed = false'))
  assert.ok(query.includes("name contains 'Bob\\'s motivation'"))
  assert.ok(query.includes("'folder-123' in parents"))
})

test('builds Shorts metadata from a Drive source video', () => {
  const content = buildDriveShortsContent({
    id: 'drive-file',
    name: 'morning_routine.mp4',
    durationSeconds: 42,
    width: 1080,
    height: 1920,
  })

  assert.equal(content.script.duration, 0.7)
  assert.equal(content.scenes[0].end_time, '42s')
  assert.equal(content.seo.title, 'Daily Motivation: morning routine #Shorts')
  assert.deepEqual(content.seo.hashtags, ['#motivation', '#shorts', '#mindset'])
  assert.ok(content.seo.description.includes('#motivation #shorts #mindset'))
})
