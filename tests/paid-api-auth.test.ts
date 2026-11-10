import test from 'node:test'
import assert from 'node:assert/strict'

// Paid media routes must refuse anonymous callers before touching any
// provider (OpenAI TTS, ElevenLabs, fal.ai). Outside a Next request there is no
// session, so each route should answer 401 without spending anything.
const jsonRequest = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const routes: Array<[string, string, unknown]> = [
  ['@/app/api/generate-image/route', '/api/generate-image', { prompt: 'a test prompt' }],
  ['@/app/api/generate-video/route', '/api/generate-video', { prompt: 'a test prompt' }],
  ['@/app/api/generate-audio/route', '/api/generate-audio', { narration: 'hello there' }],
  ['@/app/api/render-video/route', '/api/render-video', { resultId: 'abc' }],
]

for (const [modulePath, path, body] of routes) {
  test(`POST ${path} requires a signed-in session`, async () => {
    const originalFetch = globalThis.fetch
    let providerCalled = false
    globalThis.fetch = (async () => {
      providerCalled = true
      throw new Error('provider should not be called')
    }) as typeof fetch
    try {
      const { POST } = await import(modulePath)
      const response: Response = await POST(jsonRequest(path, body))
      assert.equal(response.status, 401)
      assert.equal(providerCalled, false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
}
