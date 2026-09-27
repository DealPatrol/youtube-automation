import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import {
  buildContentPrompt,
  buildContentResponseFormat,
  buildFallbackGeneratedContent,
  createGenerationPlan,
  normalizeGeneratedContent,
  type GeneratedContent,
} from '@/lib/content/generation'
import { getSessionUserId } from '@/lib/auth/session'
import { insertProject, insertResult, updateResult } from '@/lib/db/records'

export const runtime = 'nodejs'
export const maxDuration = 60

async function generateContent(input: {
  topic: string
  description?: string
  tone: string
  plan: ReturnType<typeof createGenerationPlan>
}): Promise<GeneratedContent> {
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  if (!openaiKey) {
    console.warn('[API] OPENAI_API_KEY missing; using local fallback content')
    return buildFallbackGeneratedContent(input.topic, input.plan)
  }

  if (!openaiKey.startsWith('sk-')) {
    throw new Error('Invalid OpenAI API key format. API key should start with "sk-"')
  }

  const prompt = buildContentPrompt({
    topic: input.topic,
    description: input.description,
    tone: input.tone,
    plan: input.plan,
  })
  const client = new OpenAI({ apiKey: openaiKey })
  let response
  try {
    response = await client.responses.create({
      model: process.env.OPENAI_CONTENT_MODEL || 'gpt-4o-mini',
      input: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.7,
      max_output_tokens: 12000,
      text: { format: buildContentResponseFormat(input.plan.sceneCount) },
    })
  } catch (error: unknown) {
    const errorPayload = (error as { error?: { code?: string; message?: string }; message?: string })?.error ?? error
    const payload = errorPayload as { code?: string; message?: string }
    console.error('[API] OpenAI generation failed:', payload?.code || payload?.message)
    if (payload?.code === 'invalid_api_key') {
      throw new Error('Invalid OpenAI API key. Check the configured OPENAI_API_KEY.')
    }
    throw new Error(payload?.message || 'OpenAI content generation failed')
  }

  const outputText = response.output_text?.trim()
  if (!outputText) {
    throw new Error('OpenAI returned an empty production package')
  }

  let parsedContent: unknown
  try {
    parsedContent = JSON.parse(outputText)
  } catch {
    throw new Error('OpenAI returned malformed structured content')
  }
  return normalizeGeneratedContent(parsedContent, input.plan)
}

export async function POST(request: Request) {
  let resultId = ''
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'Database is not configured. Set DATABASE_URL.' },
        { status: 500 }
      )
    }

    const userId = await getSessionUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }

    const {
      topic,
      description,
      video_length_minutes,
      youtube_clip_duration = 0,
      tiktok_clip_duration = 15,
      tone,
      platform,
    } = await request.json()

    if (!topic || !video_length_minutes || !tone || !platform) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const projectId = await insertProject({
      userId,
      title: topic,
      topic,
      description,
      videoLengthMinutes: video_length_minutes,
      youtubeClipDuration: youtube_clip_duration,
      tiktokClipDuration: tiktok_clip_duration,
      tone,
      platform,
    })
    resultId = await insertResult(projectId, userId)

    const plan = createGenerationPlan({
      platform,
      durationMinutes: video_length_minutes,
      youtubeSceneSeconds: youtube_clip_duration,
      verticalSceneSeconds: tiktok_clip_duration,
    })
    const generatedContent = await generateContent({ topic, description, tone, plan })

    await updateResult(resultId, {
      script: generatedContent.script,
      scenes: generatedContent.scenes || [],
      capcut_steps: generatedContent.capcut_steps || [],
      seo: generatedContent.seo,
      thumbnail: generatedContent.thumbnail,
      processing_status: 'completed',
    }, userId)

    return NextResponse.json({ projectId, resultId })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[API] Generation error:', errorMessage)
    if (resultId) {
      try {
        await updateResult(resultId, {
          processing_status: 'error',
          error_message: errorMessage,
        })
      } catch (updateError) {
        console.error('[API] Failed to update error status:', updateError)
      }
    }
    const status = errorMessage === 'Invalid request' ? 400 : 500
    return NextResponse.json({ error: errorMessage }, { status })
  }
}
