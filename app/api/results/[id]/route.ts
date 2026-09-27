import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/session'
import { getResultWithProject } from '@/lib/db/records'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const result = await getResultWithProject(id, userId)
  if (!result) {
    return NextResponse.json({ error: 'Result not found' }, { status: 404 })
  }

  return NextResponse.json(result)
}
