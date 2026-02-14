import { NextResponse } from 'next/server'
import { cache } from '@/lib/redis'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let supabase: any = null
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey)
}

export async function POST(request: Request) {
  try {
    console.log('[API] Generate request received')
    
    const openaiKey = process.env.OPENAI_API_KEY?.trim()
    
    if (!openaiKey) {
      console.error('[API] Missing OPENAI_API_KEY')
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.' },
        { status: 500 }
      )
    }

    if (!openaiKey.startsWith('sk-')) {
      console.error('[API] Invalid OPENAI_API_KEY format')
      return NextResponse.json(
        { error: 'Invalid OpenAI API key format. API key should start with "sk-"' },
        { status: 500 }
      )
    }

    let body: {
      topic?: string
      description?: string
      video_length_minutes?: number
      youtube_clip_duration?: number
      tiktok_clip_duration?: number
      tone?: string
      platform?: string
    }
    try {
      body = await request.json()
      console.log('[API] Request body parsed successfully')
    } catch (parseError) {
      console.error('[API] Failed to parse request JSON:', parseError)
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const { 
      topic, 
      description, 
      video_length_minutes, 
      youtube_clip_duration = 0, 
      tiktok_clip_duration = 15, 
      tone, 
      platform 
    } = body

    console.log('[API] Request params:', { topic, video_length_minutes, tone, platform })

    if (!topic || !video_length_minutes || !tone || !platform) {
      console.error('[API] Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields: topic, video_length_minutes, tone, platform' },
        { status: 400 }
      )
    }

    const userId = 'anonymous-user'
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    console.log('[API] Job ID:', jobId)

    // Generate video script
    const totalSeconds = video_length_minutes * 60
    const numScenes = Math.max(Math.floor(totalSeconds / 10), 10)
    
    await cache.set(`job:${jobId}:status`, 'processing')
    await cache.set(`job:${jobId}:progress`, 'Generating script with AI...')

    const systemPrompt = `You are an expert YouTube video creator. Generate ONLY valid JSON.

Create exactly ${numScenes} scenes for this ${video_length_minutes}-minute video.

Return JSON with: script (title, duration, content, full_narration, sections), scenes (array of ${numScenes} scenes with id, title, start_time, end_time, visual_description, on_screen_text, narration), capcut_steps, seo, thumbnail.`

    const userPrompt = `Create a ${video_length_minutes}-minute ${tone} tone ${platform} video about: "${topic}"${description ? `\nContext: ${description}` : ''}`

    console.log('[API] Calling OpenAI API...')
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    })

    if (!openaiResponse.ok) {
      const error = await openaiResponse.json()
      console.error('[API] OpenAI error:', error)
      throw new Error(error.error?.message || 'OpenAI API failed')
    }

    const openaiData = await openaiResponse.json()
    let content = openaiData.choices[0].message.content.trim()
    console.log('[API] OpenAI response received')

    let generatedContent
    try {
      const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        generatedContent = JSON.parse(jsonMatch[1])
      } else {
        generatedContent = JSON.parse(content)
      }
    } catch (parseError) {
      console.error('[API] JSON parse error:', parseError)
      throw new Error('Failed to parse OpenAI response as JSON')
    }

    // Save to cache and database
    await cache.set(`job:${jobId}:status`, 'completed')
    await cache.set(`job:${jobId}:progress`, 'Complete!')
    await cache.set(`job:${jobId}:data`, JSON.stringify(generatedContent))

    if (supabase) {
      try {
        await supabase.from('results').insert({
          id: jobId,
          user_id: userId,
          processing_status: 'completed',
          script: generatedContent.script,
          scenes: generatedContent.scenes || [],
          capcut_steps: generatedContent.capcut_steps || [],
          seo: generatedContent.seo,
          thumbnail: generatedContent.thumbnail,
        })
      } catch (dbError) {
        console.error('[API] Database error (non-blocking):', dbError)
      }
    }

    console.log('[API] Job completed:', jobId)

    return NextResponse.json({
      jobId,
      status: 'completed',
      data: generatedContent,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[API] Error:', errorMessage)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
