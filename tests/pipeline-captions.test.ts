import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildCues,
  buildSrt,
  buildVtt,
  cuesForScene,
  formatSrtTime,
  formatVttTime,
} from '@/lib/pipeline/captions'

test('splits a scene narration into cues covering the full measured duration', () => {
  const narration = Array.from({ length: 21 }, (_, i) => `word${i + 1}`).join(' ')
  const cues = cuesForScene({ narration, duration: 7 }, 0)

  assert.equal(cues.length, 3)
  assert.equal(cues[0].start, 0)
  assert.ok(Math.abs(cues[2].end - 7) < 0.001)
  // Cues are contiguous
  assert.ok(Math.abs(cues[0].end - cues[1].start) < 0.001)
})

test('offsets cues of later scenes by preceding scene durations', () => {
  const cues = buildCues([
    { narration: 'one two three', duration: 3 },
    { narration: 'four five six', duration: 3 },
  ])
  assert.equal(cues.length, 2)
  assert.equal(cues[1].start, 3)
  assert.equal(cues[1].end, 6)
})

test('skips empty narrations without breaking the timeline', () => {
  const cues = buildCues([
    { narration: '   ', duration: 4 },
    { narration: 'hello world', duration: 2 },
  ])
  assert.equal(cues.length, 1)
  assert.equal(cues[0].start, 4)
})

test('formats SRT and VTT timestamps correctly', () => {
  assert.equal(formatSrtTime(3661.5), '01:01:01,500')
  assert.equal(formatVttTime(3661.5), '01:01:01.500')
  assert.equal(formatSrtTime(0), '00:00:00,000')
})

test('renders valid SRT and VTT documents', () => {
  const cues = [{ start: 0, end: 1.2, text: 'hello there' }]
  const srt = buildSrt(cues)
  assert.ok(srt.startsWith('1\n00:00:00,000 --> 00:00:01,200\nhello there'))
  const vtt = buildVtt(cues)
  assert.ok(vtt.startsWith('WEBVTT\n\n00:00:00.000 --> 00:00:01.200\nhello there'))
})
