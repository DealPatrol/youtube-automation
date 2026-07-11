import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildVoiceDirection,
  createGenerationPlan,
  normalizeGeneratedContent,
} from '@/lib/content/generation'

test('uses platform-aware scene plans without forcing ten scenes', () => {
  const shortPlan = createGenerationPlan({
    platform: 'tiktok',
    durationMinutes: 0.5,
    verticalSceneSeconds: 8,
  })
  assert.equal(shortPlan.vertical, true)
  assert.equal(shortPlan.sceneCount, 4)
  assert.equal(shortPlan.totalSeconds, 30)

  const longPlan = createGenerationPlan({
    platform: 'youtube',
    durationMinutes: 10,
    youtubeSceneSeconds: 30,
  })
  assert.equal(longPlan.vertical, false)
  assert.equal(longPlan.sceneCount, 20)
})

test('normalizes scene IDs and timing to the requested total duration', () => {
  const plan = createGenerationPlan({
    platform: 'youtube',
    durationMinutes: 0.5,
    verticalSceneSeconds: 15,
  })
  const scene = (id: number) => ({
    id,
    title: `Scene ${id}`,
    start_time: '9:99',
    end_time: '9:99',
    visual_description: 'A specific visual that supports the narration',
    on_screen_text: 'Key point',
    narration: 'A concise narration with enough useful detail for this scene.',
  })
  const normalized = normalizeGeneratedContent(
    {
      script: { title: 'Title', duration: 1, content: 'Overview', sections: [] },
      scenes: [scene(8), scene(9)],
      capcut_steps: ['Match cuts to narration'],
      seo: {
        title: 'Useful title',
        description: 'Useful description',
        tags: ['video'],
        keywords: ['useful'],
        hashtags: ['Shorts'],
        thumbnail_tips: 'Use contrast',
        pinned_comment: 'What would you try?',
      },
      thumbnail: {
        text: 'WATCH THIS',
        image_prompt: 'A high contrast subject',
        emotion: 'curiosity',
        design_description: 'One focal subject',
        color_palette: ['#000000', '#ffffff'],
        text_suggestions: ['WATCH THIS'],
        layout_tips: 'Keep the face clear',
        accessibility_notes: 'Use high contrast',
      },
    },
    plan
  )

  assert.deepEqual(normalized.scenes.map(({ id }) => id), [1, 2])
  assert.equal(normalized.scenes[0].start_time, '0:00')
  assert.equal(normalized.scenes[1].end_time, '0:30')
  assert.equal(normalized.script.sections[0].text, normalized.scenes[0].narration)
  assert.deepEqual(normalized.seo.hashtags, ['#Shorts'])
})

test('builds tone and platform aware voice direction', () => {
  assert.match(buildVoiceDirection('dramatic', 'youtube'), /controlled intensity/)
  assert.match(buildVoiceDirection('educational', 'tiktok'), /short-form pacing/)
})
