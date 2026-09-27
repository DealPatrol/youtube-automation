import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/session'
import { getResultForUser } from '@/lib/db/records'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { resultId } = await request.json()

    if (!resultId) {
      return NextResponse.json({ error: 'Missing resultId' }, { status: 400 })
    }

    const result = await getResultForUser<{
      scenes?: unknown
      script?: unknown
      seo?: { title?: string }
      capcut_steps?: unknown
      thumbnail?: unknown
      project_id?: string
      created_at?: string
    }>(resultId, userId)

    if (!result) {
      return NextResponse.json({ error: 'Result not found' }, { status: 404 })
    }

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
