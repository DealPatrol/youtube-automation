import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import {
  buildContentPrompt,
  buildContentResponseFormat,
  createGenerationPlan,
  normalizeGeneratedContent,
} from '@/lib/content/generation'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          error:
            'Supabase credentials not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.',
        },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const openaiKey = process.env.OPENAI_API_KEY?.trim()
    
    if (!openaiKey) {
      console.error('[API] Missing OPENAI_API_KEY')
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.' },
        { status: 500 }
      )
    }

    if (!openaiKey.startsWith('sk-')) {
      console.error('[API] Invalid OPENAI_API_KEY format - does not start with sk-')
      return NextResponse.json(
        { error: 'Invalid OpenAI API key format. API key should start with "sk-"' },
        { status: 500 }
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
      user_id,
    } = await request.json()

    if (!topic || !video_length_minutes || !tone || !platform) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const userId = user_id || 'anonymous-user'
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

      const plan = createGenerationPlan({
        platform,
        durationMinutes: video_length_minutes,
        youtubeSceneSeconds: youtube_clip_duration,
        verticalSceneSeconds: tiktok_clip_duration,
      })
      const prompt = buildContentPrompt({
        topic,
        description,
        tone,
        plan,
      })

      console.log('[API] Generating structured production package')
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
          text: { format: buildContentResponseFormat(plan.sceneCount) },
        })
      } catch (error: any) {
        const errorPayload = error?.error ?? error
        console.error('[API] OpenAI generation failed:', errorPayload?.code || errorPayload?.message)
        if (errorPayload?.code === 'invalid_api_key') {
          throw new Error('Invalid OpenAI API key. Check the configured OPENAI_API_KEY.')
        }
        throw new Error(errorPayload?.message || 'OpenAI content generation failed')
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
      const generatedContent = normalizeGeneratedContent(parsedContent, plan)

      // Update result with generated content
      if (supabase) {
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

        if (updateError) throw updateError
        console.log('[API] Result updated with generated content')
      } else {
        console.log('[API] Supabase not available, storing in session memory')
        // Demo mode: store in global cache
        if (!globalThis.demoResults) {
          globalThis.demoResults = {}
        }
        globalThis.demoResults[resultId] = {
          id: resultId,
          script: generatedContent.script,
          scenes: generatedContent.scenes || [],
          capcut_steps: generatedContent.capcut_steps || [],
          seo: generatedContent.seo,
          thumbnail: generatedContent.thumbnail,
          processing_status: 'completed',
          project_id: projectId,
        }
      }

      return NextResponse.json({
        projectId,
        resultId,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[API] Generation error:', errorMessage)
      console.error('[API] Full error:', error)

      // Update result status to error
      if (resultId) {
        if (supabase) {
          try {
            await supabase
              .from('results')
              .update({
                processing_status: 'error',
                error_message: errorMessage,
              })
              .eq('id', resultId)
          } catch (updateError) {
            console.error('[API] Failed to update error status:', updateError)
          }
        } else {
          // Demo mode: store error
          if (!globalThis.demoResults) {
            globalThis.demoResults = {}
          }
          globalThis.demoResults[resultId] = {
            processing_status: 'error',
            error_message: errorMessage,
          }
        }
      }

      // Return the actual error message for debugging
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[API] Request error:', error)
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}
