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

function formatSrtTimestamp(totalSeconds: number): string {
  const milliseconds = Math.max(0, Math.round(totalSeconds * 1000))
  const hours = Math.floor(milliseconds / 3_600_000)
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000)
  const seconds = Math.floor((milliseconds % 60_000) / 1000)
  const remainder = milliseconds % 1000
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    seconds
  ).padStart(2, '0')},${String(remainder).padStart(3, '0')}`
}

function escapeSubtitleFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
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
    let videoFilter = 'null'
    if (overlayText) {
      const subtitlePath = path.join(tempDir, 'overlay.srt')
      await fs.promises.writeFile(
        subtitlePath,
        `1\n${formatSrtTimestamp(0)} --> ${formatSrtTimestamp(
          trimEnd - trimStart
        )}\n${overlayText.replace(/\r?\n/g, ' ').replace(/-->/g, '→')}\n`
      )
      const alignment =
        requestedPosition === 'top' ? 8 : requestedPosition === 'center' ? 5 : 2
      videoFilter = `subtitles=filename='${escapeSubtitleFilterPath(
        subtitlePath
      )}':force_style='FontSize=28,PrimaryColour=&H00FFFFFF,BackColour=&H99000000,BorderStyle=3,Outline=1,Shadow=0,Alignment=${alignment},MarginV=28'`
    }

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
