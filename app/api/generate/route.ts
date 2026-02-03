import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: Request) {
  try {
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

    const { topic, description, video_length_minutes, clip_duration_seconds = 5, tone, platform } = await request.json()

    if (!topic || !video_length_minutes || !tone || !platform) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const userId = 'anonymous-user'
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
          clip_duration_seconds,
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
- Each scene should be 8-12 seconds long
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
        console.error('[API] OpenAI error response:', JSON.stringify(error, null, 2))
        
        if (error.error?.code === 'invalid_api_key') {
          throw new Error('Invalid OpenAI API key. Please check your API key in the Vars section and ensure it starts with "sk-".')
        }
        
        throw new Error(error.error?.message || 'OpenAI API request failed')
      }

      const openaiData = await openaiResponse.json()
      let content = openaiData.choices[0].message.content.trim()
      console.log('[API] Received OpenAI response, parsing...')

      // Parse the JSON response
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
        console.error('[API] Raw content:', content)
        throw new Error('Failed to parse generated content as JSON')
      }

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

      if (updateError) throw updateError
      console.log('[API] Result updated with generated content')

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
