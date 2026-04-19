import { NextResponse } from 'next/server'

import { getRuntimeStatusEnv } from '@/lib/config/runtime-status'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ env: getRuntimeStatusEnv() })
}
