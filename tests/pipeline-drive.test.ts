import test from 'node:test'
import assert from 'node:assert/strict'

import { buildDriveVideoQuery, escapeDriveQueryValue, sanitizeDriveFileName } from '@/lib/pipeline/drive'

test('drive query escapes user search text and limits to videos', () => {
  const query = buildDriveVideoQuery({ query: "don't quit", folderId: 'folder-123' })

  assert.ok(query.includes("mimeType contains 'video/'"))
  assert.ok(query.includes('trashed = false'))
  assert.ok(query.includes("name contains 'don\\'t quit'"))
  assert.ok(query.includes("'folder-123' in parents"))
})

test('drive query omits blank search terms', () => {
  assert.equal(buildDriveVideoQuery({ query: '   ' }), "mimeType contains 'video/' and trashed = false")
})

test('drive query value escapes backslashes and apostrophes', () => {
  assert.equal(escapeDriveQueryValue("a\\b'c"), "a\\\\b\\'c")
})

test('drive import file names are safe local paths', () => {
  assert.equal(sanitizeDriveFileName('../Morning Motivation!!.MP4'), 'Morning-Motivation.mp4')
  assert.equal(sanitizeDriveFileName('***'), 'drive-video.mp4')
})
