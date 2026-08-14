import test from 'node:test'
import assert from 'node:assert/strict'

import { buildDriveVideoQuery } from '@/lib/pipeline/drive-shorts'

test('builds a Drive query for video files matching motivation content', () => {
  const query = buildDriveVideoQuery({ query: 'motivation', folderId: 'folder-123' })

  assert.ok(query.includes('trashed = false'))
  assert.ok(query.includes("mimeType contains 'video/'"))
  assert.ok(query.includes("'folder-123' in parents"))
  assert.ok(query.includes("name contains 'motivation'"))
  assert.ok(query.includes("fullText contains 'motivation'"))
})

test('escapes Drive query literals', () => {
  const query = buildDriveVideoQuery({ query: "creator's clips", folderId: "abc'123" })

  assert.ok(query.includes("'abc\\'123' in parents"))
  assert.ok(query.includes("creator\\'s clips"))
})
