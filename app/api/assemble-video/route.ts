import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export const runtime = 'nodejs'

const execFileAsync = promisify(execFile)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || 'videos'
const backgroundMusicUrl = process.env.BACKGROUND_MUSIC_URL
const backgroundMusicPath = process.env.BACKGROUND_MUSIC_PATH
const backgroundMusicVolume = Number(process.env.BACKGROUND_MUSIC_VOLUME ?? 0.2)
const brandingLogoUrl = process.env.BRANDING_LOGO_URL
const brandingLogoPath = process.env.BRANDING_LOGO_PATH
const brandingLogoScale = Number(process.env.BRANDING_LOGO_SCALE ?? 0.12)
const brandingLogoOpacity = Number(process.env.BRANDING_LOGO_OPACITY ?? 0.85)
const brandingLogoPosition = process.env.BRANDING_LOGO_POSITION || 'top-right'
const brandingLogoPadding = Number(process.env.BRANDING_LOGO_PADDING ?? 24)
const videoAssemblyUrl = process.env.VIDEO_ASSEMBLY_URL
const fastApiUrl = process.env.FASTAPI_URL

interface AssembleVideoRequest {
  resultId: string
}

interface SceneAsset {
  id: number
  title?: string
  start_time?: string
  end_time?: string
  duration?: number
  image_url?: string
  video_url?: string
  audio_url?: string
  on_screen_text?: string
  narration?: string
}

function parseTimestamp(value?: string): number | null {
  if (!value) return null
  const parts = value.split(':').map((part) => Number(part))
  if (parts.some((part) => Number.isNaN(part))) return null
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

function resolveDuration(scene: SceneAsset, fallback: number): number {
  if (typeof scene.duration === 'number' && scene.duration > 0) {
    return Math.max(1, Math.round(scene.duration))
  }
  const start = parseTimestamp(scene.start_time)
  const end = parseTimestamp(scene.end_time)
  if (start !== null && end !== null && end > start) {
    return Math.max(1, Math.round(end - start))
  }
  return Math.max(1, Math.round(fallback))
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
}

async function ensureDir(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true })
}

async function writeDataUrlToFile(dataUrl: string, outputPath: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    throw new Error('Invalid data URL')
  }
  const buffer = Buffer.from(match[2], 'base64')
  await fs.promises.writeFile(outputPath, buffer)
}

async function downloadToFile(sourceUrl: string, outputPath: string) {
  if (sourceUrl.startsWith('data:')) {
    await writeDataUrlToFile(sourceUrl, outputPath)
    return
  }
  const response = await fetch(sourceUrl)
  if (!response.ok) {
    throw new Error(`Failed to download asset: ${sourceUrl}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  await fs.promises.writeFile(outputPath, buffer)
}

async function copyLocalFile(sourcePath: string, outputPath: string) {
  await fs.promises.copyFile(sourcePath, outputPath)
}

async function resolveOptionalAsset(options: {
  url?: string
  localPath?: string
  workDir: string
  prefix: string
  extension: string
}): Promise<string | null> {
  const { url, localPath, workDir, prefix, extension } = options

  if (url) {
    const targetPath = path.join(workDir, `${prefix}.${extension}`)
    await downloadToFile(url, targetPath)
    return targetPath
  }

  if (localPath) {
    const resolvedPath = path.isAbsolute(localPath)
      ? localPath
      : path.join(process.cwd(), localPath)
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Asset not found: ${resolvedPath}`)
    }
    const targetPath = path.join(workDir, `${prefix}.${extension}`)
    await copyLocalFile(resolvedPath, targetPath)
    return targetPath
  }

  return null
}

async function createSceneSegment(options: {
  scene: SceneAsset
  duration: number
  outputPath: string
  workDir: string
}) {
  const { scene, duration, outputPath, workDir } = options
  const hasVideo = Boolean(scene.video_url)
  const hasImage = Boolean(scene.image_url)
  if (!hasVideo && !hasImage) {
    throw new Error(`Scene ${scene.id} has no video or image asset`)
  }

  const assetPath = path.join(workDir, `scene_${scene.id}.${hasVideo ? 'mp4' : 'jpg'}`)
  await downloadToFile(hasVideo ? (scene.video_url as string) : (scene.image_url as string), assetPath)

  let audioPath: string | null = null
  if (scene.audio_url) {
    audioPath = path.join(workDir, `scene_${scene.id}.mp3`)
    await downloadToFile(scene.audio_url, audioPath)
  }

  const videoFilterBase = [
    'scale=1920:1080:force_original_aspect_ratio=decrease',
    'pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
    'format=yuv420p',
  ]

  if (scene.on_screen_text && scene.on_screen_text.trim().length > 0) {
    const safeText = escapeDrawtext(scene.on_screen_text.trim())
    videoFilterBase.push(
      `drawtext=text='${safeText}':fontsize=64:fontcolor=white:box=1:boxcolor=black@0.55:x=(w-text_w)/2:y=h-140:line_spacing=8`
    )
  }

  const videoFilter = videoFilterBase.join(',')

  const args: string[] = ['-y']

  if (hasVideo) {
    args.push('-stream_loop', '-1', '-i', assetPath, '-t', String(duration))
  } else {
    args.push('-loop', '1', '-t', String(duration), '-i', assetPath)
  }

  if (audioPath) {
    args.push('-i', audioPath)
  } else {
    args.push('-f', 'lavfi', '-t', String(duration), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100')
  }

  args.push(
    '-vf',
    videoFilter,
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-c:a',
    'aac',
    '-shortest',
    outputPath
  )

  await execFileAsync('ffmpeg', args, { maxBuffer: 1024 * 1024 * 10 })
}

async function concatSegments(segmentPaths: string[], outputPath: string, workDir: string) {
  const concatPath = path.join(workDir, 'concat.txt')
  const contents = segmentPaths.map((segment) => `file '${segment}'`).join('\n')
  await fs.promises.writeFile(concatPath, contents)

  const args = [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatPath,
    '-c:v',
    'libx264',
    '-c:a',
    'aac',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '30',
    outputPath,
  ]

  await execFileAsync('ffmpeg', args, { maxBuffer: 1024 * 1024 * 10 })
}

async function mixBackgroundMusic(options: {
  inputPath: string
  musicPath: string
  outputPath: string
  volume: number
}) {
  const safeVolume = Number.isFinite(options.volume)
    ? Math.min(Math.max(options.volume, 0), 1)
    : 0.2

  const args = [
    '-y',
    '-i',
    options.inputPath,
    '-stream_loop',
    '-1',
    '-i',
    options.musicPath,
    '-filter_complex',
    `[1:a]volume=${safeVolume}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=3[a]`,
    '-map',
    '0:v',
    '-map',
    '[a]',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-shortest',
    options.outputPath,
  ]

  await execFileAsync('ffmpeg', args, { maxBuffer: 1024 * 1024 * 10 })
}

async function applyBrandingOverlay(options: {
  inputPath: string
  logoPath: string
  outputPath: string
  opacity: number
  scale: number
  position: string
  padding: number
}) {
  const width = Math.round(1920 * Math.min(Math.max(options.scale, 0.05), 0.5))
  const alpha = Math.min(Math.max(options.opacity, 0.1), 1)
  const padding = Math.max(0, Math.round(options.padding))

  let x = `main_w-overlay_w-${padding}`
  let y = `${padding}`

  if (options.position === 'top-left') {
    x = `${padding}`
    y = `${padding}`
  } else if (options.position === 'bottom-left') {
    x = `${padding}`
    y = `main_h-overlay_h-${padding}`
  } else if (options.position === 'bottom-right') {
    x = `main_w-overlay_w-${padding}`
    y = `main_h-overlay_h-${padding}`
  }

  const args = [
    '-y',
    '-i',
    options.inputPath,
    '-i',
    options.logoPath,
    '-filter_complex',
    `[1:v]format=rgba,scale=${width}:-1,colorchannelmixer=aa=${alpha}[logo];[0:v][logo]overlay=${x}:${y}`,
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-c:a',
    'copy',
    options.outputPath,
  ]

  await execFileAsync('ffmpeg', args, { maxBuffer: 1024 * 1024 * 10 })
}

function formatTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const milliseconds = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 1000)
  const pad = (value: number, length: number) => value.toString().padStart(length, '0')
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(milliseconds, 3)}`
}

function createVttFromScenes(scenes: SceneAsset[], defaultDuration: number): string | null {
  let cursor = 0
  const cues: string[] = []

  for (const scene of scenes) {
    const duration = resolveDuration(scene, defaultDuration)
    const text = scene.narration || scene.on_screen_text || scene.title || ''
    if (!text.trim()) {
      cursor += duration
      continue
    }
    const start = formatTimestamp(cursor)
    const end = formatTimestamp(cursor + duration)
    cues.push(`${start} --> ${end}\n${text.trim()}`)
    cursor += duration
  }

  if (cues.length === 0) {
    return null
  }

  return `WEBVTT\n\n${cues.join('\n\n')}\n`
}

async function ensureFfmpegAvailable() {
  try {
    await execFileAsync('ffmpeg', ['-version'], { maxBuffer: 1024 * 1024 })
  } catch (error) {
    throw new Error('FFmpeg is not installed or not available in PATH')
  }
}

function resolveAssemblyEndpoint(): string | null {
  if (videoAssemblyUrl) {
    return videoAssemblyUrl
  }
  if (fastApiUrl) {
    return `${fastApiUrl.replace(/\/$/, '')}/api/assemble-video`
  }
  return null
}

export async function POST(request: Request) {
  let resultId: string | undefined
  let tempDir: string | null = null
  try {
    const body: AssembleVideoRequest = await request.json()
    resultId = body.resultId

    if (!resultId) {
      return NextResponse.json({ error: 'Missing resultId' }, { status: 400 })
    }

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('[API] Starting video assembly for result:', resultId)

    const { data: result, error: fetchError } = await supabase
      .from('results')
      .select('*, project_id')
      .eq('id', resultId)
      .single()

    if (fetchError || !result) {
      console.error('[API] Failed to fetch result:', fetchError)
      return NextResponse.json({ error: 'Result not found' }, { status: 404 })
    }

    const scenes: SceneAsset[] = result.scenes || []
    if (scenes.length === 0) {
      return NextResponse.json({ error: 'No scenes to assemble' }, { status: 400 })
    }

    const { data: project } = await supabase
      .from('projects')
      .select('clip_duration_seconds')
      .eq('id', result.project_id)
      .single()

    const defaultDuration = project?.clip_duration_seconds || 5

    await supabase
      .from('results')
      .update({ processing_status: 'assembling' })
      .eq('id', resultId)

    const assemblyEndpoint = resolveAssemblyEndpoint()
    if (assemblyEndpoint) {
      console.log('[API] Offloading assembly to:', assemblyEndpoint)
      const response = await fetch(assemblyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resultId,
          projectId: result.project_id,
          scenes,
          script: result.script,
          defaultDuration,
          options: {
            backgroundMusicUrl,
            brandingLogoUrl,
            brandingLogoPosition,
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Assembly backend error: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      const assembledVideoUrl = data.videoUrl
      const subtitleUrl = data.subtitleUrl ?? null

      if (!assembledVideoUrl) {
        throw new Error('Assembly backend did not return videoUrl')
      }

      const { error: updateError } = await supabase
        .from('results')
        .update({
          video_url: assembledVideoUrl,
          processing_status: 'completed',
        })
        .eq('id', resultId)

      if (updateError) {
        console.error('[API] Failed to update result:', updateError)
        throw updateError
      }

      return NextResponse.json({
        success: true,
        message: 'Video assembled successfully',
        videoUrl: assembledVideoUrl,
        subtitleUrl,
        resultId,
      })
    }

    await ensureFfmpegAvailable()

    tempDir = path.join(os.tmpdir(), `video-assembly-${resultId}-${Date.now()}`)
    await ensureDir(tempDir)

    console.log('[API] Assembling video from scenes...')
    console.log('[API] Scenes have:', {
      withVideo: scenes.filter((scene) => scene.video_url).length,
      withImage: scenes.filter((scene) => scene.image_url).length,
      withAudio: scenes.filter((scene) => scene.audio_url).length,
    })

    const segmentPaths: string[] = []

    for (const scene of scenes) {
      const duration = resolveDuration(scene, defaultDuration)
      const segmentPath = path.join(tempDir, `segment_${scene.id}.mp4`)
      await createSceneSegment({ scene, duration, outputPath: segmentPath, workDir: tempDir })
      segmentPaths.push(segmentPath)
    }

    const outputPath = path.join(tempDir, `assembled_${resultId}.mp4`)
    await concatSegments(segmentPaths, outputPath, tempDir)

    let finalOutputPath = outputPath

    const musicAssetPath = await resolveOptionalAsset({
      url: backgroundMusicUrl,
      localPath: backgroundMusicPath,
      workDir: tempDir,
      prefix: 'background_music',
      extension: 'mp3',
    })

    if (musicAssetPath) {
      const mixedPath = path.join(tempDir, `assembled_${resultId}_music.mp4`)
      await mixBackgroundMusic({
        inputPath: finalOutputPath,
        musicPath: musicAssetPath,
        outputPath: mixedPath,
        volume: backgroundMusicVolume,
      })
      finalOutputPath = mixedPath
    }

    const brandingAssetPath = await resolveOptionalAsset({
      url: brandingLogoUrl,
      localPath: brandingLogoPath,
      workDir: tempDir,
      prefix: 'branding_logo',
      extension: 'png',
    })

    if (brandingAssetPath) {
      const brandedPath = path.join(tempDir, `assembled_${resultId}_branded.mp4`)
      await applyBrandingOverlay({
        inputPath: finalOutputPath,
        logoPath: brandingAssetPath,
        outputPath: brandedPath,
        opacity: brandingLogoOpacity,
        scale: brandingLogoScale,
        position: brandingLogoPosition,
        padding: brandingLogoPadding,
      })
      finalOutputPath = brandedPath
    }

    let subtitleUrl: string | null = null
    const captions = createVttFromScenes(scenes, defaultDuration)
    if (captions) {
      const subtitlePath = path.join(tempDir, `captions_${resultId}.vtt`)
      await fs.promises.writeFile(subtitlePath, captions)
      const subtitleStoragePath = `results/${resultId}/captions-${Date.now()}.vtt`
      const { error: subtitleUploadError } = await supabase.storage
        .from(storageBucket)
        .upload(subtitleStoragePath, await fs.promises.readFile(subtitlePath), {
          contentType: 'text/vtt',
          upsert: true,
        })
      if (!subtitleUploadError) {
        const { data: subtitlePublicUrl } = supabase.storage
          .from(storageBucket)
          .getPublicUrl(subtitleStoragePath)
        subtitleUrl = subtitlePublicUrl.publicUrl
      }
    }

    await supabase
      .from('results')
      .update({ processing_status: 'uploading' })
      .eq('id', resultId)

    const fileBuffer = await fs.promises.readFile(finalOutputPath)
    const storagePath = `results/${resultId}/final-${Date.now()}.mp4`
    const { error: uploadError } = await supabase.storage.from(storageBucket).upload(storagePath, fileBuffer, {
      contentType: 'video/mp4',
      upsert: true,
    })

    if (uploadError) {
      throw new Error(`Failed to upload video: ${uploadError.message}`)
    }

    const { data: publicUrlData } = supabase.storage.from(storageBucket).getPublicUrl(storagePath)
    const assembledVideoUrl = publicUrlData.publicUrl

    const { error: updateError } = await supabase
      .from('results')
      .update({
        video_url: assembledVideoUrl,
        processing_status: 'completed',
      })
      .eq('id', resultId)

    if (updateError) {
      console.error('[API] Failed to update result:', updateError)
      throw updateError
    }

    console.log('[API] Video assembly complete')

    return NextResponse.json({
      success: true,
      message: 'Video assembled successfully',
      videoUrl: assembledVideoUrl,
      subtitleUrl,
      resultId,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[API] Video assembly error:', errorMessage)

    if (resultId && supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      await supabase
        .from('results')
        .update({
          processing_status: 'error',
          error_message: errorMessage,
        })
        .eq('id', resultId)
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  } finally {
    if (tempDir && fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    }
  }
}
