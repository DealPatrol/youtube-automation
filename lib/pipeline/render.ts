import { execFile } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'

import { ensureFfmpegAvailable, probeMediaDuration, resolveFfmpegPath } from '@/lib/video/ffmpeg'
import { resolveVideoFormat, type VideoFormat } from '@/lib/video/format'
import type { GeneratedScene } from '@/lib/content/generation'
import type { SceneAssetState } from './types'

const execFileAsync = promisify(execFile)
const FPS = 30

/**
 * Stage 6 — FFmpeg render. Turns per-scene photos + narration audio into the
 * final video: Ken Burns motion on each photo, on-screen text overlays,
 * concatenated and encoded once at the end.
 */

function escapeSubtitleFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

function sanitizeSubtitleText(text: string): string {
  return text.replace(/\r?\n/g, ' ').replace(/-->/g, '→').trim()
}

function formatSrtTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const ms = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 1000)
  const pad = (value: number, length: number) => value.toString().padStart(length, '0')
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(ms, 3)}`
}

/** Slow push-in on a still photo so scenes don't feel static. */
function buildKenBurnsFilter(format: VideoFormat, durationSeconds: number): string {
  const frames = Math.max(1, Math.round(FPS * durationSeconds))
  // Upscale before zoompan to avoid integer-rounding jitter
  const overscanW = Math.round((format.width * 1.3) / 2) * 2
  const overscanH = Math.round((format.height * 1.3) / 2) * 2
  return [
    `scale=${overscanW}:${overscanH}:force_original_aspect_ratio=increase`,
    `crop=${overscanW}:${overscanH}`,
    `zoompan=z='min(1+0.10*on/${frames},1.10)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${frames}:s=${format.width}x${format.height}:fps=${FPS}`,
    'format=yuv420p',
  ].join(',')
}

async function renderSceneSegment(options: {
  scene: GeneratedScene
  asset: SceneAssetState
  format: VideoFormat
  workDir: string
}): Promise<string> {
  const { scene, asset, format, workDir } = options
  if (!asset.imageFile || !fs.existsSync(asset.imageFile)) {
    throw new Error(`Scene ${scene.id} is missing its image asset`)
  }

  const duration = asset.audioDuration && asset.audioDuration > 0 ? asset.audioDuration : scene.duration
  const outputPath = path.join(workDir, `segment_${scene.id}.mp4`)

  let videoFilter = buildKenBurnsFilter(format, duration)

  if (scene.on_screen_text?.trim()) {
    const overlayPath = path.join(workDir, `overlay_${scene.id}.srt`)
    await fs.promises.writeFile(
      overlayPath,
      `1\n${formatSrtTimestamp(0)} --> ${formatSrtTimestamp(duration)}\n${sanitizeSubtitleText(
        scene.on_screen_text
      )}\n`
    )
    const fontSize = format.aspectRatio === '9:16' ? 44 : 40
    const margin = format.aspectRatio === '9:16' ? 150 : 100
    videoFilter += `,subtitles=filename='${escapeSubtitleFilterPath(
      overlayPath
    )}':force_style='FontSize=${fontSize},PrimaryColour=&H00FFFFFF,BackColour=&H99000000,BorderStyle=3,Outline=1,Shadow=0,Alignment=2,MarginV=${margin}'`
  }

  const args: string[] = ['-y', '-i', asset.imageFile]

  if (asset.audioFile && fs.existsSync(asset.audioFile)) {
    args.push('-i', asset.audioFile)
  } else {
    args.push(
      '-f',
      'lavfi',
      '-t',
      String(duration),
      '-i',
      'anullsrc=channel_layout=stereo:sample_rate=44100'
    )
  }

  args.push(
    '-vf',
    videoFilter,
    '-r',
    String(FPS),
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-c:a',
    'aac',
    '-ar',
    '44100',
    '-shortest',
    outputPath
  )

  await execFileAsync(resolveFfmpegPath(), args, { maxBuffer: 1024 * 1024 * 50 })
  return outputPath
}

export async function renderVideo(options: {
  scenes: GeneratedScene[]
  sceneAssets: SceneAssetState[]
  aspectRatio: '16:9' | '9:16'
  workDir: string
  outFile: string
}): Promise<{ videoFile: string; durationSeconds: number; width: number; height: number }> {
  const { scenes, sceneAssets, aspectRatio, workDir, outFile } = options
  await ensureFfmpegAvailable()
  await fs.promises.mkdir(workDir, { recursive: true })

  const format = resolveVideoFormat(aspectRatio)
  const assetsByScene = new Map(sceneAssets.map((asset) => [asset.sceneId, asset]))

  const segmentPaths: string[] = []
  for (const scene of scenes) {
    const asset = assetsByScene.get(scene.id)
    if (!asset) throw new Error(`No assets recorded for scene ${scene.id}`)
    console.log(`[render] Scene ${scene.id}/${scenes.length}: ${scene.title}`)
    segmentPaths.push(await renderSceneSegment({ scene, asset, format, workDir }))
  }

  const concatPath = path.join(workDir, 'concat.txt')
  await fs.promises.writeFile(
    concatPath,
    segmentPaths.map((segment) => `file '${segment.replace(/'/g, "'\\''")}'`).join('\n')
  )

  await execFileAsync(
    resolveFfmpegPath(),
    [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatPath,
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-c:a',
      'aac',
      '-pix_fmt',
      'yuv420p',
      '-r',
      String(FPS),
      '-movflags',
      '+faststart',
      outFile,
    ],
    { maxBuffer: 1024 * 1024 * 50 }
  )

  const durationSeconds = await probeMediaDuration(outFile)
  return { videoFile: outFile, durationSeconds, width: format.width, height: format.height }
}

/** Produce a 1280x720 JPEG thumbnail from the chosen source image. */
export async function renderThumbnail(sourceImage: string, outFile: string): Promise<string> {
  await execFileAsync(
    resolveFfmpegPath(),
    [
      '-y',
      '-i',
      sourceImage,
      '-vf',
      'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720',
      '-frames:v',
      '1',
      '-q:v',
      '2',
      outFile,
    ],
    { maxBuffer: 1024 * 1024 * 10 }
  )
  return outFile
}
