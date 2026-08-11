import type { PipelineConfig } from './types'

export interface DriveVideoCandidate {
  id?: string
  name?: string
  fileName?: string
  title?: string
  description?: string
  mimeType?: string
  durationSeconds?: number
  webViewLink?: string
  license?: string
  rightsOwner?: string
  canUse?: boolean
  topicTags?: string[]
}

export interface MotivationShortsPlanOptions {
  channelName?: string
  videosPerWeek?: number
  startDate?: string
  privacy?: PipelineConfig['privacy']
}

export interface MotivationShortsPlanItem {
  sourceId?: string
  sourceTitle: string
  publishDate: string
  title: string
  description: string
  tags: string[]
  hashtags: string[]
  privacy: PipelineConfig['privacy']
  eligibleForShorts: boolean
  recommendedUse: 'publish_short' | 'clip_or_review' | 'skip'
  reviewFlags: string[]
}

export interface MotivationShortsPlan {
  channelName: string
  cadence: string
  safeGrowthChecklist: string[]
  items: MotivationShortsPlanItem[]
}

const DEFAULT_HASHTAGS = ['#motivation', '#shorts', '#mindset']
const DEFAULT_TAGS = ['motivation', 'mindset', 'discipline', 'self improvement', 'youtube shorts']
const SHORTS_MAX_SECONDS = 180

function normalizeSourceTitle(video: DriveVideoCandidate): string {
  const raw = video.title || video.name || video.fileName || video.id || 'Motivation clip'
  return raw
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 3)).trim()}...`
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function buildPublishDate(start: Date, index: number, videosPerWeek: number): string {
  const safeCadence = Math.max(1, Math.min(14, videosPerWeek))
  const daysOffset = Math.floor((index * 7) / safeCadence)
  const publishDate = new Date(start)
  publishDate.setUTCDate(start.getUTCDate() + daysOffset)
  return formatDate(publishDate)
}

function buildReviewFlags(video: DriveVideoCandidate): string[] {
  const flags: string[] = []
  if (video.canUse === false) flags.push('Rights are marked unavailable')
  if (!video.license && !video.rightsOwner) {
    flags.push('Add license or rights-owner note before publishing')
  }
  if (video.mimeType && !video.mimeType.startsWith('video/')) {
    flags.push(`Source is not a video file (${video.mimeType})`)
  }
  if (video.durationSeconds !== undefined && video.durationSeconds > SHORTS_MAX_SECONDS) {
    flags.push('Clip to 3 minutes or less for YouTube Shorts eligibility')
  }
  if (video.durationSeconds !== undefined && video.durationSeconds < 5) {
    flags.push('Source is very short; verify it has enough context')
  }
  return flags
}

function buildShortsTitle(sourceTitle: string): string {
  const cleaned = sourceTitle.replace(/\b(motivation|motivational|shorts?)\b/gi, '').trim()
  const base = cleaned.length > 0 ? cleaned : sourceTitle
  return truncate(`${base} in 30 Seconds #Shorts`, 100)
}

function buildShortsDescription(options: {
  sourceTitle: string
  channelName: string
  sourceUrl?: string
  rightsOwner?: string
  hashtags: string[]
}): string {
  const lines = [
    `${options.sourceTitle} -- a quick motivation reset from ${options.channelName}.`,
    'Use this as a reminder to take the next small action today.',
  ]

  if (options.rightsOwner) lines.push(`Source/rights: ${options.rightsOwner}.`)
  if (options.sourceUrl) lines.push(`Reference: ${options.sourceUrl}`)
  lines.push(options.hashtags.join(' '))
  return lines.join('\n\n')
}

export function buildNewChannelGrowthChecklist(niche = 'motivation'): string[] {
  return [
    `Publish consistent ${niche} Shorts at a sustainable cadence before scaling volume.`,
    'Reply thoughtfully to authentic comments and pin the most useful viewer prompt.',
    'Use clear titles, captions, and descriptions so YouTube understands the audience.',
    'Do not run sub-for-sub, reciprocal subscription, or automated engagement loops.',
    'Review retention, swipe-away rate, and returning viewers before changing topics.',
  ]
}

export function buildMotivationShortsPlan(
  videos: DriveVideoCandidate[],
  options: MotivationShortsPlanOptions = {}
): MotivationShortsPlan {
  const channelName = options.channelName || 'Motivation Channel'
  const videosPerWeek = Math.max(1, Math.min(14, options.videosPerWeek || 5))
  const start = options.startDate ? new Date(`${options.startDate}T00:00:00.000Z`) : new Date()
  if (Number.isNaN(start.getTime())) {
    throw new Error(`Invalid startDate "${options.startDate}"`)
  }
  const privacy = options.privacy || 'private'

  const items = videos.map((video, index): MotivationShortsPlanItem => {
    const sourceTitle = normalizeSourceTitle(video)
    const sourceTags = (video.topicTags || []).map((tag) => tag.toLowerCase().trim()).filter(Boolean)
    const tags = Array.from(new Set([...sourceTags, ...DEFAULT_TAGS])).slice(0, 10)
    const hashtags = Array.from(
      new Set([
        ...DEFAULT_HASHTAGS,
        ...sourceTags
          .slice(0, 2)
          .map((tag) => `#${tag.replace(/[^a-z0-9]/gi, '')}`)
          .filter((tag) => tag.length > 1),
      ])
    ).slice(0, 5)
    const reviewFlags = buildReviewFlags(video)
    const eligibleForShorts =
      !reviewFlags.some((flag) => flag.includes('not a video') || flag.includes('Rights are marked unavailable')) &&
      (video.durationSeconds === undefined || video.durationSeconds <= SHORTS_MAX_SECONDS)
    const recommendedUse = eligibleForShorts
      ? 'publish_short'
      : video.canUse === false || video.mimeType?.startsWith('video/') === false
        ? 'skip'
        : 'clip_or_review'

    return {
      sourceId: video.id,
      sourceTitle,
      publishDate: buildPublishDate(start, index, videosPerWeek),
      title: buildShortsTitle(sourceTitle),
      description: buildShortsDescription({
        sourceTitle,
        channelName,
        sourceUrl: video.webViewLink,
        rightsOwner: video.rightsOwner,
        hashtags,
      }),
      tags,
      hashtags,
      privacy,
      eligibleForShorts,
      recommendedUse,
      reviewFlags,
    }
  })

  return {
    channelName,
    cadence: `${videosPerWeek} Shorts per week`,
    safeGrowthChecklist: buildNewChannelGrowthChecklist('motivation'),
    items,
  }
}
