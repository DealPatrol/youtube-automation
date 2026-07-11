import { execFile } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export function resolveFfmpegPath(): string {
  const bundledPath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg')
  return fs.existsSync(bundledPath) ? bundledPath : 'ffmpeg'
}

export async function ensureFfmpegAvailable(): Promise<void> {
  try {
    await execFileAsync(resolveFfmpegPath(), ['-version'], { maxBuffer: 1024 * 1024 })
  } catch {
    throw new Error('FFmpeg is not installed or not available in PATH')
  }
}

export async function probeMediaDuration(filePath: string): Promise<number> {
  try {
    const { stderr } = await execFileAsync(
      resolveFfmpegPath(),
      ['-hide_banner', '-i', filePath, '-f', 'null', '-'],
      { maxBuffer: 1024 * 1024 * 10 }
    )
    const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
    if (!match) throw new Error('Duration was not present in FFmpeg output')
    const duration = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Invalid media duration')
    return Math.round(duration * 1000) / 1000
  } catch (error) {
    throw new Error(
      `Could not measure generated media duration: ${
        error instanceof Error ? error.message : 'unknown FFmpeg error'
      }`
    )
  }
}
