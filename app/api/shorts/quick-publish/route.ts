import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import {
  buildShortsPromptParams,
  buildShortsOptimization,
  SHORTS_MAX_DURATION_SECONDS,
} from '@/lib/video/shorts-optimizer'

export const runtime = 'nodejs'

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
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

  // ── Step 1: create project + result records ──────────────────────────────
  const { data: projectData, error: projectError } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      title: topic,
      topic,
      description: `YouTube Shorts: ${topic}`,
      video_length_minutes: 1,
      youtube_clip_duration: durationSeconds,
      tiktok_clip_duration: 0,
      tone,
      platform: 'youtube',
      clip_duration_seconds: Math.floor(durationSeconds / 4),
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
    const { numScenes, avgSceneSeconds, totalSeconds, systemAddendum } = buildShortsPromptParams(
      topic,
      tone,
      durationSeconds
    )

    const client = new OpenAI({ apiKey: openaiKey })

    const systemPrompt = `You are an expert YouTube Shorts creator. Generate ONLY valid JSON (no markdown, no code blocks).

${systemAddendum}

Return this exact JSON structure:
{
  "script": {
    "title": "Compelling Short title (under 60 chars)",
    "duration": ${Math.round(totalSeconds / 60)},
    "content": "1-2 sentence hook for the Short",
    "sections": [
      {"time": "0:00", "speaker": "Narrator", "text": "Opening hook — stop the scroll"},
      {"time": "0:15", "speaker": "Narrator", "text": "Main value point"},
      {"time": "0:45", "speaker": "Narrator", "text": "CTA — like and follow"}
    ]
  },
  "scenes": [<exactly ${numScenes} scenes, each ~${avgSceneSeconds}s, covering 0 to ${totalSeconds}s>],
  "seo": {
    "title": "SEO title with main keyword + #Shorts",
    "description": "Short description with hashtags",
    "tags": ["Shorts", "YouTubeShorts", "<relevant tags>"]
  },
  "thumbnail": {
    "text": "2-3 bold words",
    "image_prompt": "Vertical portrait image concept",
    "emotion": "curiosity"
  }
}`

    const userPrompt = `Create a ${totalSeconds}-second YouTube Short about: "${topic}"
Tone: ${tone}
Generate EXACTLY ${numScenes} scenes. Return ONLY the JSON object.`

    let response
    try {
      response = await client.responses.create({
        model: 'gpt-4o-mini',
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_output_tokens: 3000,
        text: { format: { type: 'json_object' } },
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

    let generatedContent: any
    try {
      generatedContent = JSON.parse(outputText.trim())
    } catch {
      const match = outputText.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Failed to parse generated content as JSON')
      generatedContent = JSON.parse(match[0])
    }

    // ── Step 3: apply Shorts optimization (9:16, ≤60s) ───────────────────
    const optimization = buildShortsOptimization(
      generatedContent.scenes || [],
      generatedContent.seo || {},
      durationSeconds
    )

    const shortsScenes = optimization.scenes
    const shortsMetadata = optimization.metadata

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
      body: JSON.stringify({ resultId }),
    })

    let assembledVideoUrl: string | null = null
    if (assembleResponse.ok) {
      const assembleData = await assembleResponse.json()
      assembledVideoUrl = assembleData.videoUrl || null
    } else {
      console.warn('[shorts/quick-publish] Assembly step failed — video will be available without final assembly')
    }

    // ── Step 6: upload to YouTube (optional) ────────────────────────────
    let youtubeResult: any = null
    if (autoUpload && accessToken) {
      const uploadUrl = new URL(`${baseUrl}/api/youtube/upload`)
      uploadUrl.searchParams.set('action', 'upload')
      uploadUrl.searchParams.set('resultId', resultId)
      uploadUrl.searchParams.set('accessToken', accessToken)
      const uploadResponse = await fetch(uploadUrl.toString(), { method: 'POST' })
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
