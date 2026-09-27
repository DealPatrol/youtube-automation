import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/session'
import { getResultForUser } from '@/lib/db/records'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    const result = await getResultForUser<{
      id: string
      seo?: { title?: string }
      video_url?: string | null
      scenes?: Array<{
        id?: number
        image_url?: string
        on_screen_text?: string
        title?: string
        visual_description?: string
      }>
      created_at?: string
      processing_status?: string
    }>(projectId, userId)

    if (!result) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const editorData = {
      id: result.id,
      title: result.seo?.title || 'Untitled Video',
      videoUrl: result.video_url || null,
      scenes: (result.scenes || []).map((scene, index: number) => ({
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
