import { getAuth } from '@/lib/auth/server'

export const runtime = 'nodejs'

async function handle(request: Request) {
  return getAuth().handler(request)
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE }
