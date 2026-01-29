import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000'

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: Request) {
  try {
    const { resultId } = await request.json()

    if (!resultId) {
      return NextResponse.json(
        { error: 'Missing resultId' },
        { status: 400 }
      )
    }

    console.log('[API] Rendering video for result:', resultId)

    // Fetch result data from Supabase
    const { data: result, error: dbError } = await supabase
      .from('results')
      .select('*')
      .eq('id', resultId)
      .single()

    if (dbError) {
      console.error('[API] Database error:', dbError)
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      )
    }

    if (!result) {
      console.error('[API] Result not found:', resultId)
      return NextResponse.json(
        { error: 'Result not found' },
        { status: 404 }
      )
    }

    console.log('[API] Result found, scenes:', result.scenes?.length || 0)

    const scenes = result.scenes || []
    const script = result.script || {}

    if (scenes.length === 0) {
      console.error('[API] No scenes available')
      return NextResponse.json(
        { error: 'No scenes available for video generation' },
        { status: 400 }
      )
    }

    // Call FastAPI backend to queue video rendering job
    console.log('[API] Calling FastAPI backend at:', fastApiUrl)
    
    try {
      const response = await fetch(`${fastApiUrl}/api/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          result_id: resultId,
          scenes,
          script,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`FastAPI error: ${errorText}`)
      }

      const jobData = await response.json()
      console.log('[API] Job queued:', jobData)

      return NextResponse.json({
        success: true,
        message: 'Video rendering job queued',
        resultId,
        jobId: jobData.job_id,
        status: 'queued',
        estimatedTime: '5-10 minutes',
      })
    } catch (fetchError) {
      console.error('[API] FastAPI not available, using mock response:', fetchError)
      
      // If FastAPI is not running, return a mock response for demo
      return NextResponse.json({
        success: true,
        message: 'Video rendering simulated (FastAPI backend not running)',
        resultId,
        status: 'demo_mode',
        note: 'To enable real video rendering, start the FastAPI backend with: docker-compose up',
      })
    }
  } catch (error) {
    console.error('[API] Video render error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to render video' },
      { status: 500 }
    )
  }
}
