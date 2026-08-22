import test from 'node:test'
import assert from 'node:assert/strict'

import { buildDriveVideoSearchQuery } from '@/lib/pipeline/drive'

test('builds a Drive video search query from motivation terms', () => {
  const query = buildDriveVideoSearchQuery('motivation discipline')

  assert.match(query, /mimeType contains 'video\/'/)
  assert.match(query, /trashed = false/)
  assert.match(query, /name contains 'motivation'/)
  assert.match(query, /fullText contains 'discipline'/)
})

test('escapes Drive query terms and falls back to all videos', () => {
  assert.equal(
    buildDriveVideoSearchQuery(''),
    "mimeType contains 'video/' and trashed = false"
  )
  assert.match(buildDriveVideoSearchQuery("owner's clip"), /owner\\'s/)
})
