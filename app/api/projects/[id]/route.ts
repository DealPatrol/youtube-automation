import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/session'
import { updateProject } from '@/lib/db/records'

export const runtime = 'nodejs'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const body = await request.json()
  const updated = await updateProject(id, {
    status: body.status,
    scheduled_for: body.scheduled_for ?? null,
    youtube_video_id: body.youtube_video_id,
    video_url: body.video_url,
    views: body.views,
    title: body.title,
  }, userId)

  if (!updated) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
