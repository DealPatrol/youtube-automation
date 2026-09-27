import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSessionUserId } from '@/lib/auth/session'
import { insertProject, insertResult, updateResult } from '@/lib/db/records'
import {
  buildShortsOptimization,
  SHORTS_MAX_DURATION_SECONDS,
} from '@/lib/video/shorts-optimizer'
import {
  buildContentPrompt,
  buildContentResponseFormat,
  buildFallbackGeneratedContent,
  createGenerationPlan,
  normalizeGeneratedContent,
} from '@/lib/content/generation'

export const runtime = 'nodejs'
export const maxDuration = 300

interface QuickPublishRequest {
  topic: string
  tone?: string
  durationSeconds?: number
  voice?: string
  voiceProvider?: string
  voiceId?: string
  accessToken?: string
  user_id?: string
  renderMode?: 'images' | 'videos'
  autoUpload?: boolean
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  if (openaiKey && !openaiKey.startsWith('sk-')) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
  }

  let body: QuickPublishRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const {
    topic,
    tone = 'educational',
    durationSeconds = SHORTS_MAX_DURATION_SECONDS,
    voice = 'alloy',
    voiceProvider,
    voiceId,
    accessToken,
    renderMode = 'images',
    autoUpload = false,
  } = body

  if (!topic?.trim()) {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 })
  }

  const baseUrl = new URL(request.url).origin
  const cookie = request.headers.get('cookie')
  const forwardedHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) forwardedHeaders.cookie = cookie
  const plan = createGenerationPlan({
    platform: 'youtube',
    durationMinutes: Math.min(durationSeconds, SHORTS_MAX_DURATION_SECONDS) / 60,
    verticalSceneSeconds: 8,
  })

  // ── Step 1: create project + result records ──────────────────────────────
  let projectId: string
  let resultId: string
  try {
    projectId = await insertProject({
      userId,
      title: topic,
      topic,
      description: `YouTube Shorts: ${topic}`,
      videoLengthMinutes: 1,
      youtubeClipDuration: plan.averageSceneSeconds,
      tiktokClipDuration: 0,
      tone,
      platform: 'youtube',
    })
    resultId = await insertResult(projectId, userId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create project'
    return NextResponse.json({ error: message }, { status: 500 })
  }
  console.log('[shorts/quick-publish] project:', projectId, 'result:', resultId)

  try {
    // ── Step 2: generate script via OpenAI ────────────────────────────────
    const prompt = buildContentPrompt({
      topic,
      description: 'Create this as a native YouTube Short with an immediate hook and mobile-safe text.',
      tone,
      plan,
    })

    let generatedContent
    if (!openaiKey) {
      generatedContent = buildFallbackGeneratedContent(topic, plan)
    } else {
      const client = new OpenAI({ apiKey: openaiKey })
      let response
      try {
        response = await client.responses.create({
          model: 'gpt-4o-mini',
          input: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          temperature: 0.7,
          max_output_tokens: 6000,
          text: { format: buildContentResponseFormat(plan.sceneCount) },
        })
      } catch (err: unknown) {
        const payload = err as { error?: { message?: string }; message?: string }
        const msg = payload.error?.message || payload.message || 'OpenAI request failed'
        throw new Error(msg)
      }

      const outputText =
        response.output_text ??
        response.output
          ?.map((item) => ('content' in item ? item.content?.map((part) => ('text' in part ? part.text || '' : '')).join('') : ''))
          .join('') ??
        ''

      let parsedContent: unknown
      try {
        parsedContent = JSON.parse(outputText.trim())
      } catch {
        throw new Error('Failed to parse generated content as JSON')
      }
      generatedContent = normalizeGeneratedContent(parsedContent, plan)
    }

    // ── Step 3: apply Shorts optimization (9:16, ≤60s) ───────────────────
    const optimization = buildShortsOptimization(
      generatedContent.scenes || [],
      generatedContent.seo || {},
      durationSeconds
    )

    const shortsScenes = optimization.scenes
    const shortsMetadata = optimization.metadata
    if (shortsScenes.length === 0) {
      throw new Error('The generated Short did not contain any scenes')
    }

    await updateResult(resultId, {
      script: generatedContent.script,
      scenes: shortsScenes,
      capcut_steps: generatedContent.capcut_steps || [],
      seo: {
        ...generatedContent.seo,
        title: shortsMetadata.title,
        tags: shortsMetadata.tags,
      },
      thumbnail: generatedContent.thumbnail,
      processing_status: 'rendering',
    }, userId)

    // ── Step 4: render (generate assets per scene) ───────────────────────
    const renderResponse = await fetch(`${baseUrl}/api/render-video`, {
      method: 'POST',
      headers: forwardedHeaders,
      body: JSON.stringify({
        resultId,
        mode: renderMode,
        voice,
        voiceProvider,
        voiceId,
        aspectRatio: '9:16',
      }),
    })

    if (!renderResponse.ok) {
      const errText = await renderResponse.text()
      throw new Error(`Render failed: ${errText}`)
    }

    // ── Step 5: assemble video ───────────────────────────────────────────
    const assembleResponse = await fetch(`${baseUrl}/api/assemble-video`, {
      method: 'POST',
      headers: forwardedHeaders,
      body: JSON.stringify({
        resultId,
        options: { aspectRatio: '9:16' },
      }),
    })

    if (!assembleResponse.ok) {
      const errText = await assembleResponse.text()
      throw new Error(`Assembly failed: ${errText}`)
    }
    const assembleData = await assembleResponse.json()
    const assembledVideoUrl = assembleData.videoUrl || null
    if (!assembledVideoUrl) throw new Error('Assembly completed without a video URL')

    // ── Step 6: upload to YouTube (optional) ────────────────────────────
    let youtubeResult: any = null
    if (autoUpload && accessToken) {
      const uploadParams = new URLSearchParams({ resultId, accessToken })
      const uploadResponse = await fetch(`${baseUrl}/api/youtube/upload?${uploadParams}`, {
        method: 'POST',
        headers: forwardedHeaders,
        body: JSON.stringify({ resultId, accessToken }),
      })
      if (uploadResponse.ok) {
        youtubeResult = await uploadResponse.json()
      } else {
        console.warn('[shorts/quick-publish] YouTube upload step failed')
      }
    }

    await updateResult(resultId, { processing_status: 'completed' }, userId)

    return NextResponse.json({
      success: true,
      projectId,
      resultId,
      durationSeconds: optimization.totalDurationSeconds,
      sceneCount: optimization.sceneCount,
      aspectRatio: optimization.metadata.aspectRatio,
      videoUrl: assembledVideoUrl,
      youtube: youtubeResult,
      metadata: shortsMetadata,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[shorts/quick-publish] error:', errorMessage)

    if (resultId) {
      await updateResult(resultId, { processing_status: 'error', error_message: errorMessage }, userId)
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
