import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    // Fetch result data
    const { data: result, error: dbError } = await supabase
      .from('results')
      .select('*')
      .eq('id', projectId)
      .single()

    if (dbError || !result) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Transform to editor format
    const editorData = {
      id: result.id,
      title: result.seo?.title || 'Untitled Video',
      videoUrl: result.video_url || null,
      scenes: (result.scenes || []).map((scene: any, index: number) => ({
        id: scene.id || index + 1,
        image: scene.image_url || '',
        text: scene.on_screen_text || '',
        duration: 3,
        title: scene.title || `Scene ${index + 1}`,
        description: scene.visual_description || '',
      })),
      metadata: {
        projectId: result.id,
        createdAt: result.created_at,
        status: result.processing_status,
      },
    }

    return NextResponse.json(editorData)
  } catch (error) {
    console.error('[API] Load project error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load project' },
      { status: 500 }
    )
  }
}
