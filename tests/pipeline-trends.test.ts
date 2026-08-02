import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeScores, selectTopic } from '@/lib/pipeline/trends'
import { buildStockQuery } from '@/lib/pipeline/images'

test('normalizes raw source scores to a 0-100 scale', () => {
  const normalized = normalizeScores([
    { source: 'youtube', topic: 'A', score: 2_000_000 },
    { source: 'youtube', topic: 'B', score: 500_000 },
  ])
  assert.equal(normalized[0].score, 100)
  assert.equal(normalized[1].score, 25)
})

test('selects the highest-scored usable topic and skips unusable ones', () => {
  const selected = selectTopic([
    { source: 'x', topic: 'ai', score: 100 }, // too short to be a topic
    { source: 'google-trends', topic: 'how solar panels got cheap', score: 90 },
  ])
  assert.equal(selected.topic, 'how solar panels got cheap')
})

test('builds compact stock photo queries from visual descriptions', () => {
  const query = buildStockQuery(
    'A wide, cinematic shot of a sunlit home-office desk with dual monitors!'
  )
  assert.ok(query.split(' ').length <= 6)
  assert.ok(query.toLowerCase().includes('cinematic'))
  assert.ok(!query.includes('!'))
})
