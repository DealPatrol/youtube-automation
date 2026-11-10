import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/session'

export type RequireUserResult =
  | { userId: string; response?: undefined }
  | { userId?: undefined; response: NextResponse }

/**
 * Resolve the signed-in Better Auth user for an API route. Routes that spend
 * money on third-party APIs (OpenAI, ElevenLabs, fal.ai) must call this first so
 * anonymous callers cannot consume credits.
 */
export async function requireUser(): Promise<RequireUserResult> {
  const userId = await getSessionUserId()
  if (!userId) {
    return { response: NextResponse.json({ error: 'Sign in required' }, { status: 401 }) }
  }
  return { userId }
}
