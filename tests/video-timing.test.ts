import test from 'node:test'
import assert from 'node:assert/strict'

import { parseTimestamp, resolveDuration } from '@/lib/video/timing'

test('parseTimestamp supports mm:ss and hh:mm:ss inputs', () => {
  assert.equal(parseTimestamp('01:30'), 90)
  assert.equal(parseTimestamp('1:02:03'), 3723)
})

test('parseTimestamp rejects malformed values', () => {
  assert.equal(parseTimestamp(undefined), null)
  assert.equal(parseTimestamp('abc'), null)
  assert.equal(parseTimestamp('1:xx'), null)
})

test('resolveDuration prefers explicit duration, then timestamps, then fallback', () => {
  assert.equal(resolveDuration({ duration: 4.6 }, 10), 5)
  assert.equal(resolveDuration({ start_time: '0:05', end_time: '0:11' }, 10), 6)
  assert.equal(resolveDuration({ start_time: '0:10', end_time: '0:05' }, 7.2), 7)
})
