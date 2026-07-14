import OpenAI from 'openai'

import {
  buildContentPrompt,
  buildContentResponseFormat,
  createGenerationPlan,
  normalizeGeneratedContent,
  type GeneratedContent,
  type GenerationPlan,
} from '@/lib/content/generation'
import type { PipelineConfig } from './types'

/**
 * Stage 2 — hook, script, shot list, title, SEO, and thumbnail concept.
 * Reuses the same structured-output production package the dashboard uses.
 */
export async function generateContentPackage(
  topic: string,
  config: PipelineConfig,
  trendAngle?: string
): Promise<{ content: GeneratedContent; plan: GenerationPlan }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for script generation. Add it to .env')
  }

  const plan = createGenerationPlan({
    platform: config.platform,
    durationMinutes: config.durationMinutes,
    youtubeSceneSeconds: config.aspectRatio === '9:16' ? 8 : 15,
    verticalSceneSeconds: 8,
  })

  const description = trendAngle
    ? `This topic is trending right now (${trendAngle}). Write an original take — do not copy or summarize any existing video or post. Visuals will be still photos with subtle motion, so every visual_description must describe a single strong photograph.`
    : 'Visuals will be still photos with subtle motion, so every visual_description must describe a single strong photograph.'

  const prompt = buildContentPrompt({ topic, description, tone: config.tone, plan })
  const client = new OpenAI({ apiKey })
  const model = process.env.OPENAI_CONTENT_MODEL || 'gpt-4o-mini'

  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await client.responses.create({
      model,
      input: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.7,
      max_output_tokens: 12000,
      text: { format: buildContentResponseFormat(plan.sceneCount) },
    })

    const outputText = response.output_text?.trim()
    if (!outputText) {
      lastError = new Error('OpenAI returned an empty production package')
      continue
    }

    try {
      const content = normalizeGeneratedContent(JSON.parse(outputText), plan)
      return { content, plan }
    } catch (error) {
      lastError = error
      console.warn(
        `[content] Generated package failed validation (attempt ${attempt}/2):`,
        error instanceof Error ? error.message : error
      )
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Content generation failed')
}

/** The hook is the first scene's narration — the opening line of the video. */
export function extractHook(content: GeneratedContent): string {
  return content.scenes[0]?.narration || content.script.title
}
