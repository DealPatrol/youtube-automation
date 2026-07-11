import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildVideoFilter,
  inferVideoAspectRatio,
  resolveVideoFormat,
} from '@/lib/video/format'
import { optimizeScenesForShorts } from '@/lib/video/shorts-optimizer'

test('infers vertical output for one-minute projects', () => {
  assert.equal(inferVideoAspectRatio(undefined, 1), '9:16')
  assert.equal(inferVideoAspectRatio(undefined, 10), '16:9')
  assert.equal(inferVideoAspectRatio('16:9', 1), '16:9')
  assert.equal(inferVideoAspectRatio(undefined, 3, 'tiktok'), '9:16')
  assert.equal(inferVideoAspectRatio(undefined, 3, 'instagram'), '9:16')
})

test('builds correctly sized FFmpeg filters for shorts and long videos', () => {
  const shortsFilter = buildVideoFilter(resolveVideoFormat('9:16'))
  const longFilter = buildVideoFilter(resolveVideoFormat('16:9'))

  assert.match(shortsFilter, /scale=1080:1920/)
  assert.match(shortsFilter, /crop=1080:1920/)
  assert.match(longFilter, /scale=1920:1080/)
  assert.match(longFilter, /crop=1920:1080/)
})

test('handles an empty generated Shorts scene list', () => {
  assert.deepEqual(optimizeScenesForShorts([], 60), [])
})
