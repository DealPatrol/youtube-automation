import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeVideoLengthMinutes } from '@/lib/db/project-length'
import { createGenerationPlan } from '@/lib/content/generation'
import { inferVideoAspectRatio, resolveProjectClipSeconds } from '@/lib/video/format'

test('keeps fractional Shorts lengths instead of rounding them to whole minutes', () => {
  assert.equal(normalizeVideoLengthMinutes(0.25), 0.25)
  assert.equal(normalizeVideoLengthMinutes('0.5'), 0.5)
  assert.equal(normalizeVideoLengthMinutes(1.5), 1.5)
  assert.equal(normalizeVideoLengthMinutes(10), 10)
})

test('rejects invalid or out-of-range video lengths', () => {
  assert.throws(() => normalizeVideoLengthMinutes(0), RangeError)
  assert.throws(() => normalizeVideoLengthMinutes(-1), RangeError)
  assert.throws(() => normalizeVideoLengthMinutes('abc'), RangeError)
  assert.throws(() => normalizeVideoLengthMinutes(0.1), RangeError)
  assert.throws(() => normalizeVideoLengthMinutes(500), RangeError)
})

test('a 15-second YouTube Short plans a vertical 15-second video', () => {
  const plan = createGenerationPlan({ platform: 'youtube', durationMinutes: 0.25, verticalSceneSeconds: 5 })
  assert.equal(plan.totalSeconds, 15)
  assert.equal(plan.vertical, true)
  assert.equal(plan.sceneCount, 3)
  assert.equal(inferVideoAspectRatio(undefined, 0.25, 'youtube'), '9:16')
})

test('aspect ratio accepts NUMERIC values serialized as strings', () => {
  assert.equal(inferVideoAspectRatio(undefined, '0.25', 'youtube'), '9:16')
  assert.equal(inferVideoAspectRatio(undefined, '10.00', 'youtube'), '16:9')
  assert.equal(inferVideoAspectRatio(undefined, null, 'youtube'), '16:9')
})

test('scene clip length uses the vertical setting for Shorts, TikTok, and Reels', () => {
  const base = { youtube_clip_duration: 15, tiktok_clip_duration: 6 }
  assert.equal(resolveProjectClipSeconds({ ...base, platform: 'youtube', video_length_minutes: 0.5 }), 6)
  assert.equal(resolveProjectClipSeconds({ ...base, platform: 'instagram', video_length_minutes: 1.5 }), 6)
  assert.equal(resolveProjectClipSeconds({ ...base, platform: 'tiktok', video_length_minutes: 3 }), 6)
  assert.equal(resolveProjectClipSeconds({ ...base, platform: 'youtube', video_length_minutes: 10 }), 15)
  assert.equal(resolveProjectClipSeconds({ platform: 'youtube', video_length_minutes: 10 }), 5)
})
