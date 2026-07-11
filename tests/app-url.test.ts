import test from 'node:test'
import assert from 'node:assert/strict'

import { getPublicAppUrl } from '@/lib/config/app-url'

const ORIGINAL_ENV = { ...process.env }

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

test('prefers an explicit public app URL', () => {
  process.env.NEXTAUTH_URL = 'https://videos.example.com/'
  process.env.RENDER_EXTERNAL_URL = 'https://fallback.onrender.com'
  assert.equal(getPublicAppUrl(), 'https://videos.example.com')
})

test('uses the automatic Render URL when deployed there', () => {
  delete process.env.NEXTAUTH_URL
  process.env.RENDER_EXTERNAL_URL = 'https://youtube-automation.onrender.com'
  assert.equal(getPublicAppUrl(), 'https://youtube-automation.onrender.com')
})

test('normalizes a Vercel hostname and supports local fallback', () => {
  delete process.env.NEXTAUTH_URL
  delete process.env.RENDER_EXTERNAL_URL
  process.env.VERCEL_URL = 'preview.vercel.app'
  assert.equal(getPublicAppUrl(), 'https://preview.vercel.app')

  delete process.env.VERCEL_URL
  assert.equal(getPublicAppUrl(), 'http://localhost:3000')
})
