import test from 'node:test'
import assert from 'node:assert/strict'

test('GET /api/status reports configured integration groups', async () => {
  const originalEnv = { ...process.env }

  process.env.DATABASE_URL = 'postgresql://localhost/video_db'
  process.env.BETTER_AUTH_SECRET = 'secret'
  process.env.BLOB_READ_WRITE_TOKEN = 'blob-token'
  process.env.OPENAI_API_KEY = 'sk-test'
  process.env.FASTAPI_URL = 'http://localhost:8000'
  process.env.YOUTUBE_CLIENT_ID = 'youtube-client-id'
  process.env.YOUTUBE_CLIENT_SECRET = 'youtube-client-secret'
  process.env.NEXTAUTH_URL = 'https://example.com'

  try {
    const { GET } = await import('@/app/api/status/route')
    const response = await GET()
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.env.databaseUrl, true)
    assert.equal(payload.env.betterAuthSecret, true)
    assert.equal(payload.env.blobToken, true)
    assert.equal(payload.env.openaiApiKey, true)
    assert.equal(payload.env.videoAssemblyUrl, true)
    assert.equal(payload.env.youtubeOAuth, true)
  } finally {
    process.env = originalEnv
  }
})
