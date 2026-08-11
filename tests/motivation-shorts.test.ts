import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildMotivationShortsPlan,
  buildNewChannelGrowthChecklist,
} from '@/lib/pipeline/motivation-shorts'

test('builds a private motivation Shorts plan from Drive video metadata', () => {
  const plan = buildMotivationShortsPlan(
    [
      {
        id: 'drive-1',
        name: 'morning_discipline.mp4',
        mimeType: 'video/mp4',
        durationSeconds: 42,
        rightsOwner: 'Original channel footage',
        webViewLink: 'https://drive.google.com/file/d/drive-1/view',
        topicTags: ['Discipline', 'Morning Routine'],
      },
    ],
    {
      channelName: 'Daily Motivation',
      startDate: '2026-08-12',
      privacy: 'private',
      videosPerWeek: 5,
    }
  )

  assert.equal(plan.channelName, 'Daily Motivation')
  assert.equal(plan.cadence, '5 Shorts per week')
  assert.equal(plan.items[0].publishDate, '2026-08-12')
  assert.equal(plan.items[0].privacy, 'private')
  assert.equal(plan.items[0].eligibleForShorts, true)
  assert.equal(plan.items[0].recommendedUse, 'publish_short')
  assert.deepEqual(plan.items[0].reviewFlags, [])
  assert.ok(plan.items[0].title.includes('#Shorts'))
  assert.ok(plan.items[0].description.includes('Original channel footage'))
  assert.ok(plan.items[0].hashtags.includes('#motivation'))
})

test('flags Drive videos that need rights review or clipping', () => {
  const plan = buildMotivationShortsPlan(
    [
      {
        id: 'drive-2',
        name: 'long keynote.mov',
        mimeType: 'video/quicktime',
        durationSeconds: 420,
      },
      {
        id: 'drive-3',
        name: 'notes.txt',
        mimeType: 'text/plain',
        canUse: false,
      },
    ],
    { startDate: '2026-08-12' }
  )

  assert.equal(plan.items[0].eligibleForShorts, false)
  assert.equal(plan.items[0].recommendedUse, 'clip_or_review')
  assert.ok(plan.items[0].reviewFlags.some((flag) => flag.includes('license')))
  assert.ok(plan.items[0].reviewFlags.some((flag) => flag.includes('3 minutes')))

  assert.equal(plan.items[1].recommendedUse, 'skip')
  assert.ok(plan.items[1].reviewFlags.some((flag) => flag.includes('not a video')))
  assert.ok(plan.items[1].reviewFlags.some((flag) => flag.includes('Rights')))
})

test('new channel growth checklist avoids reciprocal engagement tactics', () => {
  const checklist = buildNewChannelGrowthChecklist('motivation').join('\n')

  assert.match(checklist, /Reply thoughtfully/)
  assert.match(checklist, /Do not run sub-for-sub/)
})
