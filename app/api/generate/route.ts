import { NextResponse } from 'next/server'
import { cache, getRedis } from '@/lib/redis'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let supabase: any = null
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey)
  } catch (error) {
    console.warn('[API] Failed to initialize Supabase:', error)
  }
} else {
  console.warn('[API] Supabase credentials not configured')
}

export async function POST(request: Request) {
  console.log('[API] Generate request received')
  
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    )
  }

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

  // Check Redis configuration before proceeding
  const redisClient = getRedis()
  if (!redisClient) {
    console.error('[API] Redis not configured - KV_REST_API_URL and KV_REST_API_TOKEN required')
    return NextResponse.json(
      { error: 'Redis not configured. Please add KV_REST_API_URL and KV_REST_API_TOKEN to your environment variables.' },
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
    user_id?: string
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
    platform,
    user_id 
  } = body

  console.log('[API] Request params:', { topic, video_length_minutes, tone, platform })

  if (!topic || !video_length_minutes || !tone || !platform) {
    console.error('[API] Missing required fields')
    return NextResponse.json(
      { error: 'Missing required fields: topic, video_length_minutes, tone, platform' },
      { status: 400 }
    )
  }

  const userId = user_id || 'anonymous-user'
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  let projectId = ''
  let resultId = ''

  try {
      // Create project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          title: topic,
          topic,
          description,
          video_length_minutes,
          youtube_clip_duration,
          tiktok_clip_duration,
          tone,
          platform,
        })
        .select('id')
        .single()

      if (projectError) throw projectError
      projectId = projectData.id
      console.log('[API] Project created:', projectId)

      // Create result record
      const { data: resultData, error: resultError } = await supabase
        .from('results')
        .insert({
          project_id: projectId,
          user_id: userId,
          processing_status: 'processing',
        })
        .select('id')
        .single()

      if (resultError) throw resultError
      resultId = resultData.id
      console.log('[API] Result created:', resultId)

      // Call OpenAI API to generate content
      const totalSeconds = video_length_minutes * 60
      const numScenes = Math.max(Math.floor(totalSeconds / 10), 10) // ~10 seconds per scene, minimum 10 scenes
      
      console.log('[API] Job ID:', jobId)
      
      await cache.set(`job:${jobId}:status`, 'processing')
      await cache.set(`job:${jobId}:progress`, 'Generating script with AI...')

      const systemPrompt = `You are an expert YouTube video creator. Generate ONLY valid JSON (no markdown, no code blocks, no explanations).

CRITICAL: Create exactly ${numScenes} scenes for this ${video_length_minutes}-minute (${totalSeconds} seconds) video. Each scene should be 8-12 seconds long.

Return this exact JSON structure for a ${video_length_minutes}-minute ${tone} ${platform} video about the given topic:

{
  "script": {
    "title": "Compelling video title (under 60 chars)",
    "duration": ${video_length_minutes},
    "content": "2-3 sentence hook and overview of the entire video",
    "full_narration": "Complete word-for-word voiceover script covering all ${totalSeconds} seconds. Write the ENTIRE narration that will be spoken throughout the video. This should be ${Math.floor(totalSeconds * 2.5)} to ${Math.floor(totalSeconds * 3)} words (approximately 150-180 words per minute of video).",
    "sections": [
      {"time": "0:00", "speaker": "Narrator", "text": "Opening hook to grab attention"},
      {"time": "0:30", "speaker": "Narrator", "text": "What viewers will learn"},
      {"time": "1:00", "speaker": "Narrator", "text": "First main point with details"},
      {"time": "${Math.floor(video_length_minutes / 2)}:00", "speaker": "Narrator", "text": "Second main point with examples"},
      {"time": "${Math.floor(video_length_minutes * 0.75)}:00", "speaker": "Narrator", "text": "Third main point or deeper dive"},
      {"time": "${video_length_minutes - 1}:00", "speaker": "Narrator", "text": "Call to action and closing"}
    ]
  },
  "scenes": [
    Generate EXACTLY ${numScenes} scenes. Each scene MUST have:
    - Unique id (1 to ${numScenes})
    - Descriptive title
    - start_time and end_time (covering the full ${totalSeconds} seconds)
    - Detailed visual_description (for AI image/video generation)
    - on_screen_text (key message or text overlay)
    - narration (word-for-word voiceover text for THIS specific scene, 8-12 seconds worth of dialogue)
  ],
  "capcut_steps": ["Step-by-step editing guide"],
  "seo": {
    "title": "SEO-optimized title",
    "description": "SEO-optimized description",
    "tags": ["relevant", "tags"]
  },
  "thumbnail": {
    "description": "Thumbnail design description"
  }
}`

      const userPrompt = `Create a ${video_length_minutes}-minute ${tone} tone ${platform} video about: "${topic}"${description ? `\nContext: ${description}` : ''}`

      console.log('[API] Calling OpenAI API with model gpt-4o-mini')
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
          max_tokens: 8000,
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
        let jsonStr = jsonMatch ? jsonMatch[1] : content
        
        // Try to parse as-is first
        try {
          generatedContent = JSON.parse(jsonStr)
        } catch (firstAttemptError) {
          // If parsing fails, try to fix common JSON truncation issues
          console.log('[API] First parse attempt failed, attempting recovery...')
          
          // Count braces to see if JSON is incomplete
          const openBraces = (jsonStr.match(/{/g) || []).length
          const closeBraces = (jsonStr.match(/}/g) || []).length
          
          if (openBraces > closeBraces) {
            // Add missing closing braces
            jsonStr += '}'.repeat(openBraces - closeBraces)
            console.log('[API] Added missing closing braces')
          }
          
          // Try parsing again
          try {
            generatedContent = JSON.parse(jsonStr)
          } catch (secondAttemptError) {
            // Last resort: extract just the valid JSON we can find
            console.log('[API] Recovery parsing failed, extracting valid JSON...')
            const validJsonMatch = jsonStr.match(/\{[\s\S]*\}/)
            if (validJsonMatch) {
              try {
                generatedContent = JSON.parse(validJsonMatch[0])
              } catch {
                throw firstAttemptError
              }
            } else {
              throw firstAttemptError
            }
          }
        }
      } catch (parseError) {
        console.error('[API] JSON parse error:', parseError)
        console.error('[API] Raw content length:', content.length)
        console.error('[API] Raw content preview:', content.substring(0, 500))
        throw new Error('Failed to parse generated content as JSON. The response may be incomplete.')
      }

      // Save to cache
      await cache.set(`job:${jobId}:status`, 'completed')
      await cache.set(`job:${jobId}:progress`, 'Complete!')
      await cache.set(`job:${jobId}:data`, JSON.stringify(generatedContent))

      // Update result with generated content
      const { error: updateError } = await supabase
        .from('results')
        .update({
          script: generatedContent.script,
          scenes: generatedContent.scenes || [],
          capcut_steps: generatedContent.capcut_steps || [],
          seo: generatedContent.seo,
          thumbnail: generatedContent.thumbnail,
          processing_status: 'completed',
        })
        .eq('id', resultId)

      if (updateError) {
        console.error('[API] Database update error (non-blocking):', updateError)
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
