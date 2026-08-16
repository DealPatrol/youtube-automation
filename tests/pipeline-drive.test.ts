import test from 'node:test'
import assert from 'node:assert/strict'

import {
  assertDriveShortsPublishAllowed,
  buildDriveShortMetadata,
  buildDriveVideoQuery,
} from '@/lib/pipeline/drive'

test('builds a Drive video search query for motivation files in a folder', () => {
  const query = buildDriveVideoQuery({
    query: "morning motivation",
    folderId: "folder'one",
  })

  assert.match(query, /mimeType contains 'video\/'/)
  assert.match(query, /trashed = false/)
  assert.match(query, /name contains 'morning motivation'/)
  assert.match(query, /'folder\\'one' in parents/)
})

test('builds safe YouTube metadata for Drive motivation shorts', () => {
  const metadata = buildDriveShortMetadata('Daily Wins!.mp4')

  assert.equal(metadata.title, 'Daily Wins | Motivation')
  assert.ok(metadata.description.includes('#motivation'))
  assert.ok(metadata.tags.includes('shorts'))
})

test('Drive Shorts publish requires explicit rights confirmation', () => {
  assert.doesNotThrow(() =>
    assertDriveShortsPublishAllowed({
      publish: false,
      rightsConfirmed: false,
      privacy: 'private',
    })
  )

  assert.throws(
    () =>
      assertDriveShortsPublishAllowed({
        publish: true,
        rightsConfirmed: false,
        privacy: 'private',
      }),
    /rights-confirmed/
  )

  assert.doesNotThrow(() =>
    assertDriveShortsPublishAllowed({
      publish: true,
      rightsConfirmed: true,
      privacy: 'private',
    })
  )
})
