import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: Request) {
  try {
    const { resultId } = await request.json()

    if (!resultId) {
      return NextResponse.json({ error: 'Missing resultId' }, { status: 400 })
    }

    console.log('[Package] Creating video package for result:', resultId)

    // Fetch result data
    const { data: result, error: dbError } = await supabase
      .from('results')
      .select('*')
      .eq('id', resultId)
      .single()

    if (dbError || !result) {
      return NextResponse.json({ error: 'Result not found' }, { status: 404 })
    }

    // Create complete project package
    const projectPackage = {
      scenes: result.scenes || [],
      script: result.script || {},
      seo: result.seo || {},
      capcut_steps: result.capcut_steps || [],
      thumbnail: result.thumbnail || {},
      metadata: {
        project_id: result.project_id,
        result_id: resultId,
        created_at: result.created_at,
        title: result.seo?.title || 'Untitled Video',
      }
    }

    // Return JSON file as download
    const jsonContent = JSON.stringify(projectPackage, null, 2)
    
    return new NextResponse(jsonContent, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="video-project-${resultId}.json"`,
      },
    })
  } catch (error) {
    console.error('[Package] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create package' },
      { status: 500 }
    )
  }
}
