import { NextResponse } from 'next/server'
import { cache } from '@/lib/redis'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const openaiKey = process.env.OPENAI_API_KEY?.trim()

let supabase: any = null

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey)
}

async function processGenerateJob(jobId: string, jobData: any) {
  try {
    console.log(`[Worker] Processing job ${jobId}`)
    
    const { topic, description, video_length_minutes, tone, platform } = jobData

    // Update job status to processing
    await cache.set(`job:${jobId}:status`, 'processing')
    await cache.set(`job:${jobId}:progress`, 'Analyzing topic...')

    const totalSeconds = video_length_minutes * 60
    const numScenes = Math.max(Math.floor(totalSeconds / 10), 10)

    // Call OpenAI to generate script
    await cache.set(`job:${jobId}:progress`, 'Generating script with AI...')
    
    const systemPrompt = `You are an expert YouTube video creator. Generate ONLY valid JSON (no markdown, no code blocks, no explanations).

CRITICAL: Create exactly ${numScenes} scenes for this ${video_length_minutes}-minute (${totalSeconds} seconds) video. Each scene should be 8-12 seconds long.

Return this exact JSON structure:

{
  "script": {
    "title": "Compelling video title (under 60 chars)",
    "duration": ${video_length_minutes},
    "content": "2-3 sentence hook and overview",
    "full_narration": "Complete word-for-word voiceover script covering all ${totalSeconds} seconds",
    "sections": []
  },
  "scenes": [
    "Generate EXACTLY ${numScenes} scenes with id, title, start_time, end_time, visual_description, on_screen_text, and narration"
  ],
  "capcut_steps": [],
  "seo": {
    "title": "SEO optimized title",
    "description": "Description",
    "tags": ["tag1", "tag2"]
  },
  "thumbnail": {
    "text": "Bold text",
    "image_prompt": "Description",
    "emotion": "Emotion"
  }
}`

    const userPrompt = `Create a ${video_length_minutes}-minute ${tone} tone ${platform} video about: "${topic}"${description ? `\n\nContext: ${description}` : ''}`

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
      throw new Error(error.error?.message || 'OpenAI API failed')
    }

    const openaiData = await openaiResponse.json()
    let content = openaiData.choices[0].message.content.trim()

    let generatedContent
    try {
      const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        generatedContent = JSON.parse(jsonMatch[1])
      } else {
        generatedContent = JSON.parse(content)
      }
    } catch (parseError) {
      throw new Error('Failed to parse OpenAI response as JSON')
    }

    // Save to Supabase if available
    if (supabase) {
      await cache.set(`job:${jobId}:progress`, 'Saving to database...')
      
      const { data: resultData } = await supabase
        .from('results')
        .insert({
          id: jobId,
          user_id: 'anonymous-user',
          processing_status: 'completed',
          script: generatedContent.script,
          scenes: generatedContent.scenes || [],
          capcut_steps: generatedContent.capcut_steps || [],
          seo: generatedContent.seo,
          thumbnail: generatedContent.thumbnail,
        })
        .select('id')
        .single()
    }

    // Generate captions if YouTube and captions enabled
    if (jobData.platform === 'youtube') {
      await cache.set(`job:${jobId}:progress`, 'Generating captions...')
      
      // For now, we'll store caption generation as a task for later
      // In production, this would wait for audio generation first
      await cache.set(`job:${jobId}:captionsPending`, 'true')
      console.log(`[Worker] Caption generation pending for job ${jobId}`)
    }

    // Mark job as completed
    await cache.set(`job:${jobId}:status`, 'completed')
    await cache.set(`job:${jobId}:progress`, 'Complete!')
    await cache.set(`job:${jobId}:data`, JSON.stringify(generatedContent))
    
    // Remove from job queue
    await cache.zrem('job_queue', jobId)

    console.log(`[Worker] Job ${jobId} completed successfully`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Worker] Job ${jobId} failed:`, errorMessage)
    
    await cache.set(`job:${jobId}:status`, 'failed')
    await cache.set(`job:${jobId}:error`, errorMessage)
    
    // Remove from job queue even on failure
    await cache.zrem('job_queue', jobId)
  }
}

export async function POST(request: Request) {
  try {
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      )
    }

    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return NextResponse.json(
        { error: 'Redis not configured' },
        { status: 500 }
      )
    }

    // Get pending job IDs from the sorted set queue
    const jobIds = await cache.zrange('job_queue', 0, 9) // Get up to 10 jobs
    
    if (!jobIds || jobIds.length === 0) {
      return NextResponse.json({
        processed: 0,
        message: 'No jobs in queue',
      })
    }

    // Fetch the actual job data for those IDs
    const jobKeys = jobIds.map(id => `job:${id}`)
    const jobs = await cache.mget<any>(jobKeys)
    
    if (!jobs || jobs.length === 0) {
      return NextResponse.json({
        processed: 0,
        message: 'No jobs in queue',
      })
    }

    let processed = 0
    for (const job of jobs) {
      if (!job || job.status !== 'queued') continue
      
      const jobId = job.id
      if (job.type === 'generate_video') {
        await processGenerateJob(jobId, job)
        processed++
      }
    }

    return NextResponse.json({
      processed,
      status: 'completed',
    })
  } catch (error) {
    console.error('[Worker] Fatal error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Auto-process jobs via cron or manual trigger
export async function GET(request: Request) {
  try {
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Scan for queued jobs and process them
    const processed = 0
    console.log('[Worker] GET called to process jobs')
    
    return NextResponse.json({
      processed,
      timestamp: new Date().toISOString(),
      message: 'Worker is ready to process jobs',
    })
  } catch (error) {
    console.error('[Worker] GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
