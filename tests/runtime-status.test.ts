import test from 'node:test'
import assert from 'node:assert/strict'

import { getRuntimeStatusEnv } from '@/lib/config/runtime-status'

test('getRuntimeStatusEnv reports required and optional integrations', () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    SUPABASE_STORAGE_BUCKET: 'videos',
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
    nextPublicSupabaseUrl: true,
    nextPublicSupabaseAnonKey: true,
    supabaseServiceRoleKey: true,
    supabaseStorageBucket: true,
    openaiApiKey: true,
    falKey: true,
    videoAssemblyUrl: true,
    youtubeOAuth: true,
    xCredentials: true,
  })
})

test('getRuntimeStatusEnv treats missing values as false', () => {
  assert.deepEqual(getRuntimeStatusEnv({}), {
    nextPublicSupabaseUrl: false,
    nextPublicSupabaseAnonKey: false,
    supabaseServiceRoleKey: false,
    supabaseStorageBucket: false,
    openaiApiKey: false,
    falKey: false,
    videoAssemblyUrl: false,
    youtubeOAuth: false,
    xCredentials: false,
  })
})
