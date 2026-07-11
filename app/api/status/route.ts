import { NextResponse } from 'next/server'
import * as fs from 'fs'

import { getRuntimeStatusEnv } from '@/lib/config/runtime-status'
import { resolveFfmpegPath } from '@/lib/video/ffmpeg'

export const runtime = 'nodejs'

export async function GET() {
  const ffmpegPath = resolveFfmpegPath()
  const localFfmpegAvailable = ffmpegPath !== 'ffmpeg' ? fs.existsSync(ffmpegPath) : false
  return NextResponse.json({ env: getRuntimeStatusEnv(process.env, localFfmpegAvailable) })
}
