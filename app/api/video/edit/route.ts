import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { promisify } from 'util'
import { probeMediaDuration, resolveFfmpegPath } from '@/lib/video/ffmpeg'

export const runtime = 'nodejs'
export const maxDuration = 300

const execFileAsync = promisify(execFile)
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024

function escapeDrawtext(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
}

export async function POST(request: Request) {
  let tempDir: string | null = null
  try {
    const formData = await request.formData()
    const video = formData.get('video')
    if (!(video instanceof File) || !video.type.startsWith('video/')) {
      return NextResponse.json({ error: 'A valid video file is required' }, { status: 400 })
    }
    if (video.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Video exceeds the 250 MB editor limit' }, { status: 413 })
    }

    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'video-edit-'))
    const inputPath = path.join(tempDir, 'input.mp4')
    const outputPath = path.join(tempDir, 'edited.mp4')
    await fs.promises.writeFile(inputPath, Buffer.from(await video.arrayBuffer()))

    const sourceDuration = await probeMediaDuration(inputPath)
    const requestedStart = Number(formData.get('trimStart') || 0)
    const requestedEnd = Number(formData.get('trimEnd') || sourceDuration)
    const trimStart = Number.isFinite(requestedStart)
      ? Math.min(Math.max(requestedStart, 0), sourceDuration)
      : 0
    const trimEnd = Number.isFinite(requestedEnd)
      ? Math.min(Math.max(requestedEnd, trimStart), sourceDuration)
      : sourceDuration
    if (trimEnd - trimStart < 0.1) {
      return NextResponse.json({ error: 'Trim end must be after trim start' }, { status: 400 })
    }

    const overlayText = String(formData.get('overlayText') || '').trim().slice(0, 160)
    const requestedPosition = String(formData.get('textPosition') || 'bottom')
    const y =
      requestedPosition === 'top'
        ? 'h*0.08'
        : requestedPosition === 'center'
          ? '(h-text_h)/2'
          : 'h-text_h-h*0.08'
    const videoFilter = overlayText
      ? `drawtext=text='${escapeDrawtext(overlayText)}':fontsize=h/18:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=18:x=(w-text_w)/2:y=${y}`
      : 'null'

    await execFileAsync(
      resolveFfmpegPath(),
      [
        '-y',
        '-ss',
        String(trimStart),
        '-i',
        inputPath,
        '-t',
        String(trimEnd - trimStart),
        '-vf',
        videoFilter,
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        outputPath,
      ],
      { maxBuffer: 1024 * 1024 * 20 }
    )

    const output = await fs.promises.readFile(outputPath)
    return new NextResponse(new Uint8Array(output), {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="edited-video.mp4"',
        'Content-Length': String(output.byteLength),
      },
    })
  } catch (error) {
    console.error('[Video editor] Processing failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video editing failed' },
      { status: 500 }
    )
  } finally {
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    }
  }
}
