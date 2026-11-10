import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/session'
import { listProjectsForUser, listScheduledProjects } from '@/lib/db/records'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = new URL(request.url).searchParams
  const status = searchParams.get('status')
  const requestedLimit = Number(searchParams.get('limit') || 10)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, Math.floor(requestedLimit)))
    : 10
  const projects = status === 'scheduled'
    ? await listScheduledProjects(userId)
    : await listProjectsForUser(userId, limit)

  return NextResponse.json({ projects })
}
