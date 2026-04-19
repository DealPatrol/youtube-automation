import test from 'node:test'
import assert from 'node:assert/strict'

test('GET /api/status reports configured integration groups', async () => {
  const originalEnv = { ...process.env }

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
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
    assert.equal(payload.env.nextPublicSupabaseUrl, true)
    assert.equal(payload.env.nextPublicSupabaseAnonKey, true)
    assert.equal(payload.env.openaiApiKey, true)
    assert.equal(payload.env.videoAssemblyUrl, true)
    assert.equal(payload.env.youtubeOAuth, true)
  } finally {
    process.env = originalEnv
  }
})
