import test from 'node:test'
import assert from 'node:assert/strict'

import { assertPublishable, buildAttributionText } from '@/lib/pipeline/rights'
import type { RightsManifest, RightsRecord } from '@/lib/pipeline/types'

function record(overrides: Partial<RightsRecord>): RightsRecord {
  return {
    assetId: 'asset-1',
    file: 'assets/scene-1.jpg',
    type: 'image',
    provider: 'pexels',
    license: 'Pexels License',
    generatedByAI: false,
    retrievedAt: new Date().toISOString(),
    ...overrides,
  }
}

test('attribution text credits stock photographers and discloses AI media', () => {
  const text = buildAttributionText([
    record({ credit: 'Photo by Ada on Pexels', sourceUrl: 'https://pexels.com/p/1' }),
    record({ assetId: 'audio-1', type: 'audio', provider: 'openai-tts', generatedByAI: true }),
    record({ assetId: 'img-2', provider: 'fal-ai/flux/dev', generatedByAI: true }),
  ])
  assert.ok(text.includes('Photo by Ada on Pexels — https://pexels.com/p/1'))
  assert.ok(text.includes('Contains AI-generated media (openai-tts, fal-ai/flux/dev).'))
})

test('attribution text is empty for fully self-produced assets', () => {
  assert.equal(buildAttributionText([record({})]), '')
})

function manifest(assets: RightsRecord[]): RightsManifest {
  return {
    jobId: 'test',
    createdAt: new Date().toISOString(),
    video: { title: 'Test', durationSeconds: 60 },
    assets,
    attributionText: '',
    aiDisclosure: assets.some((asset) => asset.generatedByAI),
  }
}

test('publishing is refused without assets or with unlicensed assets', () => {
  assert.throws(() => assertPublishable(manifest([])), /no assets/)
  assert.throws(
    () => assertPublishable(manifest([record({ license: '  ' })])),
    /without license info/
  )
  assert.doesNotThrow(() => assertPublishable(manifest([record({})])))
})

test('publishing is refused for Google Drive imports without rights confirmation', () => {
  assert.throws(
    () =>
      assertPublishable(
        manifest([
          record({
            assetId: 'drive-1',
            provider: 'google-drive',
            license: 'User-owned media',
          }),
        ])
      ),
    /without rights confirmation/
  )

  assert.doesNotThrow(() =>
    assertPublishable(
      manifest([
        record({
          assetId: 'drive-1',
          provider: 'google-drive',
          license: 'User-owned media',
          rightsConfirmedAt: new Date().toISOString(),
        }),
      ])
    )
  )
})
