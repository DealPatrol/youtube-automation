export type ContentPlatform = 'youtube' | 'tiktok' | 'instagram' | 'twitch'

export interface GenerationPlan {
  platform: ContentPlatform
  totalSeconds: number
  sceneCount: number
  averageSceneSeconds: number
  vertical: boolean
  shortForm: boolean
}

export interface GeneratedScene {
  id: number
  title: string
  start_time: string
  end_time: string
  duration: number
  visual_description: string
  on_screen_text: string
  narration: string
}

export interface GeneratedContent {
  script: {
    title: string
    duration: number
    content: string
    sections: Array<{ time: string; speaker: string; text: string }>
  }
  scenes: GeneratedScene[]
  capcut_steps: string[]
  seo: {
    title: string
    description: string
    tags: string[]
    keywords: string[]
    hashtags: string[]
    thumbnail_tips: string
    pinned_comment: string
  }
  thumbnail: {
    text: string
    image_prompt: string
    emotion: string
    design_description: string
    color_palette: string[]
    text_suggestions: string[]
    layout_tips: string
    accessibility_notes: string
  }
}

const SUPPORTED_PLATFORMS = new Set<ContentPlatform>([
  'youtube',
  'tiktok',
  'instagram',
  'twitch',
])

function asPositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function resolveContentPlatform(value: unknown): ContentPlatform {
  const normalized = String(value || '').toLowerCase() as ContentPlatform
  return SUPPORTED_PLATFORMS.has(normalized) ? normalized : 'youtube'
}

export function createGenerationPlan(input: {
  platform: unknown
  durationMinutes: unknown
  youtubeSceneSeconds?: unknown
  verticalSceneSeconds?: unknown
}): GenerationPlan {
  const platform = resolveContentPlatform(input.platform)
  const durationMinutes = Math.min(Math.max(asPositiveNumber(input.durationMinutes, 1), 0.25), 120)
  const totalSeconds = Math.max(15, Math.round(durationMinutes * 60))
  const vertical = platform === 'tiktok' || platform === 'instagram' || totalSeconds <= 60
  const requestedSceneSeconds = vertical
    ? asPositiveNumber(input.verticalSceneSeconds, 8)
    : asPositiveNumber(input.youtubeSceneSeconds, 15)
  const maxScenes = vertical ? 20 : 24
  const sceneCount = Math.min(maxScenes, Math.max(1, Math.ceil(totalSeconds / requestedSceneSeconds)))

  return {
    platform,
    totalSeconds,
    sceneCount,
    averageSceneSeconds: Math.max(1, Math.round(totalSeconds / sceneCount)),
    vertical,
    shortForm: totalSeconds <= 90,
  }
}

export function formatContentTimestamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`
    : `${minutes}:${remainder.toString().padStart(2, '0')}`
}

function requireText(value: unknown, label: string): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error(`Generated content is missing ${label}`)
  return text
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function normalizeGeneratedContent(value: unknown, plan: GenerationPlan): GeneratedContent {
  if (!value || typeof value !== 'object') {
    throw new Error('The content model returned an invalid response')
  }

  const raw = value as Record<string, any>
  if (!Array.isArray(raw.scenes) || raw.scenes.length !== plan.sceneCount) {
    throw new Error(
      `Expected ${plan.sceneCount} complete scenes but received ${raw.scenes?.length || 0}`
    )
  }

  let cursor = 0
  const baseDuration = Math.floor(plan.totalSeconds / plan.sceneCount)
  const extraSeconds = plan.totalSeconds % plan.sceneCount
  const scenes = raw.scenes.map((scene: Record<string, unknown>, index: number) => {
    const duration = baseDuration + (index < extraSeconds ? 1 : 0)
    const start = cursor
    cursor += duration
    const narration = requireText(scene.narration, `narration for scene ${index + 1}`)
    const words = narration.split(/\s+/).length
    if (words > duration * 4) {
      throw new Error(
        `Scene ${index + 1} narration is too long for its ${duration}-second target`
      )
    }

    return {
      id: index + 1,
      title: requireText(scene.title, `title for scene ${index + 1}`),
      start_time: formatContentTimestamp(start),
      end_time: formatContentTimestamp(cursor),
      duration,
      visual_description: requireText(
        scene.visual_description,
        `visual direction for scene ${index + 1}`
      ),
      on_screen_text: requireText(scene.on_screen_text, `on-screen text for scene ${index + 1}`),
      narration,
    }
  })

  const script = raw.script || {}
  const seo = raw.seo || {}
  const thumbnail = raw.thumbnail || {}
  const hashtags = stringList(seo.hashtags).map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
  const sections = scenes.map((scene) => ({
    time: scene.start_time,
    speaker: 'Narrator',
    text: scene.narration,
  }))

  return {
    script: {
      title: requireText(script.title, 'script title'),
      duration: plan.totalSeconds / 60,
      content: requireText(script.content, 'script overview'),
      sections,
    },
    scenes,
    capcut_steps: stringList(raw.capcut_steps),
    seo: {
      title: requireText(seo.title, 'SEO title').slice(0, 100),
      description: requireText(seo.description, 'SEO description'),
      tags: stringList(seo.tags).slice(0, 20),
      keywords: stringList(seo.keywords).slice(0, 12),
      hashtags: hashtags.slice(0, plan.platform === 'youtube' ? 5 : 8),
      thumbnail_tips: requireText(seo.thumbnail_tips, 'thumbnail guidance'),
      pinned_comment: requireText(seo.pinned_comment, 'pinned comment'),
    },
    thumbnail: {
      text: requireText(thumbnail.text, 'thumbnail text').slice(0, 40),
      image_prompt: requireText(thumbnail.image_prompt, 'thumbnail image prompt'),
      emotion: requireText(thumbnail.emotion, 'thumbnail emotion'),
      design_description: requireText(thumbnail.design_description, 'thumbnail design'),
      color_palette: stringList(thumbnail.color_palette).slice(0, 5),
      text_suggestions: stringList(thumbnail.text_suggestions).slice(0, 4),
      layout_tips: requireText(thumbnail.layout_tips, 'thumbnail layout guidance'),
      accessibility_notes: requireText(
        thumbnail.accessibility_notes,
        'thumbnail accessibility guidance'
      ),
    },
  }
}

export function buildContentPrompt(input: {
  topic: string
  description?: string
  tone: string
  plan: GenerationPlan
}): { system: string; user: string } {
  const { topic, description, tone, plan } = input
  const platformGuidance =
    plan.platform === 'tiktok' || plan.platform === 'instagram'
      ? `Create native vertical short-form storytelling: earn attention in the first 1.5 seconds, use a pattern interrupt every 5-8 seconds, keep on-screen text brief and mobile-safe, and end with a natural loop or specific engagement question.`
      : plan.shortForm
        ? `Create a high-retention vertical YouTube Short: open with the payoff or tension immediately, avoid introductions, deliver one clear promise, and end with a concise CTA or loop.`
        : `Create a high-retention YouTube story: open with a specific curiosity gap, establish stakes quickly, vary pacing, use concrete examples, add open loops between sections, and deliver the promised payoff before a concise CTA.`

  const system = `You are a senior ${plan.platform} producer, factual script editor, and visual director.
Return content that is useful, original, specific, and ready for production. Do not fabricate statistics, quotes, studies, or current events. If the brief does not support a factual claim, use careful wording rather than inventing evidence.

${platformGuidance}

Production rules:
- Create exactly ${plan.sceneCount} scenes covering ${plan.totalSeconds} seconds.
- Target about ${plan.averageSceneSeconds} seconds and ${Math.max(4, Math.round(plan.averageSceneSeconds * 2.35))} spoken words per scene.
- The first scene must contain the strongest hook, not a greeting.
- Each narration must describe or explain what its visual shows; visual direction must be concrete and safe for image/video generation.
- Keep on-screen text under 8 words. Do not repeat the narration verbatim.
- Match a ${tone} tone without becoming exaggerated, deceptive, or repetitive.
- Script sections must reflect scene narration.
- SEO must be platform-specific and readable, not keyword stuffing.
- CapCut steps must reference this project's actual scenes, pacing, captions, sound design, and ${plan.vertical ? '9:16' : '16:9'} export.
- Thumbnail text must be 2-4 words. Color palette values must be valid CSS hex colors.
- Never promise virality or guaranteed results.`

  const user = `Create a ${plan.totalSeconds}-second ${plan.platform} production package about:
"${topic.trim()}"

${description?.trim() ? `Audience and creative context:\n${description.trim()}\n` : ''}
Tone: ${tone}
Output exactly ${plan.sceneCount} complete scenes.`

  return { system, user }
}

const stringArraySchema = {
  type: 'array',
  items: { type: 'string' },
} as const

export function buildContentResponseFormat(sceneCount: number) {
  return {
    type: 'json_schema' as const,
    name: 'video_production_package',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        script: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            duration: { type: 'number' },
            content: { type: 'string' },
            sections: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  time: { type: 'string' },
                  speaker: { type: 'string' },
                  text: { type: 'string' },
                },
                required: ['time', 'speaker', 'text'],
              },
            },
          },
          required: ['title', 'duration', 'content', 'sections'],
        },
        scenes: {
          type: 'array',
          minItems: sceneCount,
          maxItems: sceneCount,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'integer' },
              title: { type: 'string' },
              start_time: { type: 'string' },
              end_time: { type: 'string' },
              visual_description: { type: 'string' },
              on_screen_text: { type: 'string' },
              narration: { type: 'string' },
            },
            required: [
              'id',
              'title',
              'start_time',
              'end_time',
              'visual_description',
              'on_screen_text',
              'narration',
            ],
          },
        },
        capcut_steps: stringArraySchema,
        seo: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            tags: stringArraySchema,
            keywords: stringArraySchema,
            hashtags: stringArraySchema,
            thumbnail_tips: { type: 'string' },
            pinned_comment: { type: 'string' },
          },
          required: [
            'title',
            'description',
            'tags',
            'keywords',
            'hashtags',
            'thumbnail_tips',
            'pinned_comment',
          ],
        },
        thumbnail: {
          type: 'object',
          additionalProperties: false,
          properties: {
            text: { type: 'string' },
            image_prompt: { type: 'string' },
            emotion: { type: 'string' },
            design_description: { type: 'string' },
            color_palette: stringArraySchema,
            text_suggestions: stringArraySchema,
            layout_tips: { type: 'string' },
            accessibility_notes: { type: 'string' },
          },
          required: [
            'text',
            'image_prompt',
            'emotion',
            'design_description',
            'color_palette',
            'text_suggestions',
            'layout_tips',
            'accessibility_notes',
          ],
        },
      },
      required: ['script', 'scenes', 'capcut_steps', 'seo', 'thumbnail'],
    },
  }
}

export function buildVoiceDirection(tone: unknown, platform: unknown): string {
  const safeTone = String(tone || 'neutral').toLowerCase()
  const platformName = resolveContentPlatform(platform)
  const toneDirections: Record<string, string> = {
    investigative: 'Sound curious, credible, and measured. Emphasize evidence and key reveals.',
    dramatic: 'Build controlled intensity and suspense without sounding theatrical or sensational.',
    humorous: 'Use warm, conversational comic timing. Keep jokes natural and never force laughter.',
    educational: 'Sound clear, confident, approachable, and genuinely interested in helping.',
    energetic: 'Sound upbeat and urgent with crisp delivery, while keeping every word intelligible.',
    authoritative: 'Sound calm, expert, precise, and trustworthy rather than salesy.',
    empathetic: 'Sound warm, supportive, patient, and emotionally attentive.',
    conversational: 'Sound relaxed and spontaneous, like speaking directly to one viewer.',
    neutral: 'Sound natural, confident, conversational, and human.',
  }
  const pacing =
    platformName === 'tiktok' || platformName === 'instagram'
      ? 'Use energetic short-form pacing, crisp pauses, and a strong opening line.'
      : 'Use varied pacing, brief pauses between ideas, and emphasis on the key takeaway.'
  return `${toneDirections[safeTone] || toneDirections.neutral} ${pacing}`
}
