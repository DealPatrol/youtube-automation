import test from 'node:test'
import assert from 'node:assert/strict'

import { getRuntimeStatusEnv } from '@/lib/config/runtime-status'

test('getRuntimeStatusEnv reports required and optional integrations', () => {
  const env = {
    DATABASE_URL: 'postgresql://localhost/video_db',
    BETTER_AUTH_SECRET: 'secret',
    BLOB_READ_WRITE_TOKEN: 'blob-token',
    OPENAI_API_KEY: 'sk-test',
    FAL_KEY: 'fal-test',
    FASTAPI_URL: 'http://localhost:8000',
    YOUTUBE_CLIENT_ID: 'youtube-client-id',
    YOUTUBE_CLIENT_SECRET: 'youtube-client-secret',
    NEXTAUTH_URL: 'https://example.com',
    X_CONSUMER_KEY: 'consumer-key',
    X_CONSUMER_SECRET: 'consumer-secret',
    X_ACCESS_TOKEN: 'access-token',
    X_ACCESS_TOKEN_SECRET: 'access-token-secret',
  }

  assert.deepEqual(getRuntimeStatusEnv(env), {
    databaseUrl: true,
    betterAuthSecret: true,
    blobToken: true,
    openaiApiKey: true,
    falKey: true,
    videoAssemblyUrl: true,
    youtubeOAuth: true,
    xCredentials: true,
  })
})

test('getRuntimeStatusEnv treats missing values as false', () => {
  assert.deepEqual(getRuntimeStatusEnv({}), {
    databaseUrl: false,
    betterAuthSecret: false,
    blobToken: false,
    openaiApiKey: false,
    falKey: false,
    videoAssemblyUrl: false,
    youtubeOAuth: false,
    xCredentials: false,
  })
})

test('getRuntimeStatusEnv recognizes bundled local FFmpeg assembly', () => {
  assert.equal(getRuntimeStatusEnv({}, true).videoAssemblyUrl, true)
})
