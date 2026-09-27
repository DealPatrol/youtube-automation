import assert from 'node:assert/strict'
import test from 'node:test'

test('strategy queries can load without a database connection', async () => {
  const previousUrl = process.env.DATABASE_URL
  delete process.env.DATABASE_URL

  try {
    const strategyQueries = await import('@/lib/db/strategy-queries')
    assert.equal(typeof strategyQueries.getUserStrategy, 'function')
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousUrl
  }
})
