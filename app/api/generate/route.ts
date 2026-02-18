import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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
    
    console.log('[API] OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY)
    console.log('[API] OPENAI_API_KEY trimmed:', !!openaiKey)
    console.log('[API] OPENAI_API_KEY length:', openaiKey?.length)
    console.log('[API] OPENAI_API_KEY first 10 chars:', openaiKey?.substring(0, 10))

    if (!openaiKey) {
      console.error('[API] Missing OPENAI_API_KEY')
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.' },
        { status: 500 }
      )
    }

    if (!openaiKey.startsWith('sk-')) {
      console.error('[API] Invalid OPENAI_API_KEY format - does not start with sk-', `Got: ${openaiKey.substring(0, 20)}`)
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

      // Call OpenAI API to generate content
      const totalSeconds = video_length_minutes * 60
      const requestedSceneSeconds =
        platform === 'tiktok' && tiktok_clip_duration > 0
          ? tiktok_clip_duration
          : youtube_clip_duration > 0
            ? youtube_clip_duration
            : 10
      let numScenes = Math.max(Math.floor(totalSeconds / requestedSceneSeconds), 10)
      const maxScenes = 30
      if (numScenes > maxScenes) {
        numScenes = maxScenes
      }
      const avgSceneSeconds = Math.max(Math.round(totalSeconds / numScenes), 8)

      const systemPrompt = `You are an expert YouTube video creator. Generate ONLY valid JSON (no markdown, no code blocks, no explanations).

CRITICAL: Create exactly ${numScenes} scenes for this ${video_length_minutes}-minute (${totalSeconds} seconds) video. Each scene should be about ${avgSceneSeconds} seconds long.

Return this exact JSON structure for a ${video_length_minutes}-minute ${tone} ${platform} video about the given topic:

{
  "script": {
    "title": "Compelling video title (under 60 chars)",
    "duration": ${video_length_minutes},
    "content": "2-3 sentence hook and overview of the entire video",
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
    - narration (word-for-word voiceover text for THIS specific scene, about ${avgSceneSeconds} seconds worth of dialogue)
    
    Example for first 3 scenes of ${numScenes} total:
    {"id": 1, "title": "Opening Hook", "start_time": "0:00", "end_time": "0:10", "visual_description": "Dynamic opening visual", "on_screen_text": "Hook text"},
    {"id": 2, "title": "Introduction", "start_time": "0:10", "end_time": "0:20", "visual_description": "Topic introduction visual", "on_screen_text": "Intro text"},
    {"id": 3, "title": "First Point", "start_time": "0:20", "end_time": "0:30", "visual_description": "First main point visual", "on_screen_text": "Point 1"}
    ... continue until scene ${numScenes} ends at ${totalSeconds} seconds
  ],
  "capcut_steps": ["Step 1: Import and organize footage", "Step 2: Arrange timeline and trim clips", "Step 3: Add text overlays and graphics", "Step 4: Mix audio and add music", "Step 5: Export at optimal settings"],
  "seo": {
    "title": "SEO optimized title with main keyword",
    "description": "2-3 sentence description explaining what viewers will learn",
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
  },
  "thumbnail": {
    "text": "Bold text (2-4 words max) for the thumbnail",
    "image_prompt": "Description of image concept that grabs attention",
    "emotion": "The primary emotion this thumbnail should evoke"
  }
}`

      const userPrompt = `Create a ${video_length_minutes}-minute (${totalSeconds} seconds total) ${tone} tone ${platform} video outline for: "${topic}"${description ? `\n\nAdditional context: ${description}` : ''}

CRITICAL REQUIREMENTS:
- Generate EXACTLY ${numScenes} scenes
- Each scene should be about ${avgSceneSeconds} seconds long
- Scenes must cover the full ${totalSeconds} seconds (start at 0:00, end at ${video_length_minutes}:00)
- Every scene must have detailed visual_description for AI generation

Remember: Return ONLY the JSON object, no markdown code blocks or explanations.`

      console.log('[API] Calling OpenAI API with model gpt-4o-mini')
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 6000,
        }),
      })

      if (!openaiResponse.ok) {
        const error = await openaiResponse.json()
        console.error('[API] OpenAI error response:', JSON.stringify(error, null, 2))
        
        if (error.error?.code === 'invalid_api_key') {
          throw new Error('Invalid OpenAI API key. Please check your API key in the Vars section and ensure it starts with "sk-".')
        }
        
        throw new Error(error.error?.message || 'OpenAI API request failed')
      }

      const openaiData = await openaiResponse.json()
      let content = openaiData.choices[0].message.content.trim()
      console.log('[API] Received OpenAI response, parsing...')

      // Parse the JSON response (repair if needed)
      let generatedContent
      try {
        const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
        let jsonStr = jsonMatch ? jsonMatch[1] : content

        try {
          generatedContent = JSON.parse(jsonStr)
        } catch (firstAttemptError) {
          console.log('[API] First parse attempt failed, attempting recovery...')

          const openBraces = (jsonStr.match(/{/g) || []).length
          const closeBraces = (jsonStr.match(/}/g) || []).length

          if (openBraces > closeBraces) {
            jsonStr += '}'.repeat(openBraces - closeBraces)
            console.log('[API] Added missing closing braces')
          }

          const validJsonMatch = jsonStr.match(/\{[\s\S]*\}/)
          if (validJsonMatch) {
            jsonStr = validJsonMatch[0]
          }

          generatedContent = JSON.parse(jsonStr)
        }
      } catch (parseError) {
        console.error('[API] JSON parse error:', parseError)
        console.error('[API] Raw content:', content)
        console.log('[API] Attempting JSON repair with OpenAI...')

        const repairResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content:
                  'You fix malformed JSON. Return ONLY a valid JSON object that matches the original schema.',
              },
              {
                role: 'user',
                content: `Fix this JSON and return valid JSON only:\n${content}`,
              },
            ],
            temperature: 0,
            max_tokens: 4000,
            response_format: { type: 'json_object' },
          }),
        })

        if (!repairResponse.ok) {
          const repairError = await repairResponse.text()
          console.error('[API] JSON repair failed:', repairError)
          throw new Error('Failed to parse generated content as JSON')
        }

        const repairData = await repairResponse.json()
        const repairedContent = repairData.choices?.[0]?.message?.content?.trim()
        if (!repairedContent) {
          throw new Error('Failed to parse generated content as JSON')
        }
        generatedContent = JSON.parse(repairedContent)
      }

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
