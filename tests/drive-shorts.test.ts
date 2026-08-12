import test from 'node:test'
import assert from 'node:assert/strict'

import { buildDriveShortsOptions, buildDriveVideoSearchQuery } from '@/lib/pipeline/drive-shorts'

test('builds a safe Drive video search query with escaped literals', () => {
  const query = buildDriveVideoSearchQuery({
    query: "motivation's best",
    folderId: "folder'1",
  })

  assert.match(query, /mimeType contains 'video\/'/)
  assert.match(query, /trashed = false/)
  assert.match(query, /name contains 'motivation\\'s best'/)
  assert.match(query, /'folder\\'1' in parents/)
})

test('normalizes Drive Shorts CLI options with safe defaults', () => {
  const options = buildDriveShortsOptions({
    fileId: 'one, two ,,',
    limit: '99',
    publish: true,
    tags: 'motivation, shorts,focus',
  })

  assert.deepEqual(options.fileIds, ['one', 'two'])
  assert.equal(options.limit, 10)
  assert.equal(options.privacy, 'private')
  assert.equal(options.publish, true)
  assert.equal(options.dryRun, false)
  assert.deepEqual(options.tags, ['motivation', 'shorts', 'focus'])
})

test('rejects invalid Drive Shorts privacy values', () => {
  assert.throws(() => buildDriveShortsOptions({ privacy: 'friends' }), /Invalid --privacy/)
})
