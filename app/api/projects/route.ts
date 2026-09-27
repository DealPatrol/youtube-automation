import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/session'
import { listProjectsForUser, listScheduledProjects } from '@/lib/db/records'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const status = new URL(request.url).searchParams.get('status')
  const projects = status === 'scheduled'
    ? await listScheduledProjects(userId)
    : await listProjectsForUser(userId, 10)

  return NextResponse.json({ projects })
}
