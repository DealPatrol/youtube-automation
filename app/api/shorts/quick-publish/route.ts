import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import {
  buildShortsOptimization,
  SHORTS_MAX_DURATION_SECONDS,
} from '@/lib/video/shorts-optimizer'
import {
  buildContentPrompt,
  buildContentResponseFormat,
  createGenerationPlan,
  normalizeGeneratedContent,
} from '@/lib/content/generation'

export const runtime = 'nodejs'
export const maxDuration = 300

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  if (!openaiKey) {
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
    user_id,
    renderMode = 'images',
    autoUpload = false,
  } = body

  if (!topic?.trim()) {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const userId = user_id || 'anonymous-user'
  const baseUrl = new URL(request.url).origin
  const plan = createGenerationPlan({
    platform: 'youtube',
    durationMinutes: Math.min(durationSeconds, SHORTS_MAX_DURATION_SECONDS) / 60,
    verticalSceneSeconds: 8,
  })

  // ── Step 1: create project + result records ──────────────────────────────
  const { data: projectData, error: projectError } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      title: topic,
      topic,
      description: `YouTube Shorts: ${topic}`,
      video_length_minutes: 1,
      youtube_clip_duration: plan.averageSceneSeconds,
      tiktok_clip_duration: 0,
      tone,
      platform: 'youtube',
    })
    .select('id')
    .single()

  if (projectError) {
    return NextResponse.json({ error: `Failed to create project: ${projectError.message}` }, { status: 500 })
  }

  const projectId = projectData.id

  const { data: resultData, error: resultError } = await supabase
    .from('results')
    .insert({
      project_id: projectId,
      user_id: userId,
      processing_status: 'processing',
    })
    .select('id')
    .single()

  if (resultError) {
    return NextResponse.json({ error: `Failed to create result: ${resultError.message}` }, { status: 500 })
  }

  const resultId = resultData.id
  console.log('[shorts/quick-publish] project:', projectId, 'result:', resultId)

  try {
    // ── Step 2: generate script via OpenAI ────────────────────────────────
    const prompt = buildContentPrompt({
      topic,
      description: 'Create this as a native YouTube Short with an immediate hook and mobile-safe text.',
      tone,
      plan,
    })

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
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'OpenAI request failed'
      throw new Error(msg)
    }

    const outputText =
      response.output_text ??
      response.output
        ?.map((item: any) => item.content?.map((part: any) => part.text || '').join(''))
        .join('') ??
      ''

    let parsedContent: unknown
    try {
      parsedContent = JSON.parse(outputText.trim())
    } catch {
      throw new Error('Failed to parse generated content as JSON')
    }
    const generatedContent = normalizeGeneratedContent(parsedContent, plan)

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

    await supabase
      .from('results')
      .update({
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
      })
      .eq('id', resultId)

    // ── Step 4: render (generate assets per scene) ───────────────────────
    const renderResponse = await fetch(`${baseUrl}/api/render-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId, accessToken }),
      })
      if (uploadResponse.ok) {
        youtubeResult = await uploadResponse.json()
      } else {
        console.warn('[shorts/quick-publish] YouTube upload step failed')
      }
    }

    await supabase
      .from('results')
      .update({ processing_status: 'completed' })
      .eq('id', resultId)

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

    await supabase
      .from('results')
      .update({ processing_status: 'error', error_message: errorMessage })
      .eq('id', resultId)

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
