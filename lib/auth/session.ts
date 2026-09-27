import { headers } from 'next/headers'
import { getAuth } from '@/lib/auth/server'

export async function getSessionUserId(): Promise<string | null> {
  try {
    const session = await getAuth().api.getSession({
      headers: await headers(),
    })
    return session?.user?.id ?? null
  } catch (error) {
    console.warn('[auth] Session lookup failed', error instanceof Error ? error.message : error)
    return null
  }
}
