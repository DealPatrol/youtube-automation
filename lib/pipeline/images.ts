import { execFile } from 'child_process'
import * as fs from 'fs'
import { promisify } from 'util'

import { resolveFfmpegPath } from '@/lib/video/ffmpeg'
import type { VideoAspectRatio } from '@/lib/video/format'
import { resolveVideoFormat } from '@/lib/video/format'
import type { RightsRecord } from './types'

const execFileAsync = promisify(execFile)

/**
 * Stage 3 — PHOTOS. One image per scene plus a thumbnail.
 * Provider order: fal.ai FLUX generation → Pexels stock → locally rendered title card.
 * Every image produces a RightsRecord for the rights manifest.
 */

export interface ImageResult {
  file: string
  rights: RightsRecord
}

const FAL_IMAGE_SIZES: Record<VideoAspectRatio, string> = {
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
}

async function downloadToFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`)
  await fs.promises.writeFile(outputPath, Buffer.from(await response.arrayBuffer()))
}

async function generateWithFal(
  prompt: string,
  aspectRatio: VideoAspectRatio,
  outFile: string,
  assetId: string
): Promise<ImageResult | null> {
  const falKey = process.env.FAL_KEY?.trim()
  if (!falKey) return null
  try {
    const model = process.env.FAL_IMAGE_MODEL || 'fal-ai/flux/dev'
    const fullPrompt = `${prompt}, cinematic photograph, high quality, professional video production`
    const response = await fetch(`https://fal.run/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        image_size: FAL_IMAGE_SIZES[aspectRatio],
        num_images: 1,
      }),
    })
    if (!response.ok) {
      console.warn('[images] fal.ai generation failed:', response.status, await response.text())
      return null
    }
    const data = await response.json()
    const imageUrl = data?.images?.[0]?.url
    if (!imageUrl) return null
    await downloadToFile(imageUrl, outFile)
    return {
      file: outFile,
      rights: {
        assetId,
        file: outFile,
        type: 'image',
        provider: model,
        license: 'AI-generated image (fal.ai commercial terms)',
        licenseUrl: 'https://fal.ai/terms',
        sourceUrl: imageUrl,
        prompt: fullPrompt,
        model,
        generatedByAI: true,
        retrievedAt: new Date().toISOString(),
      },
    }
  } catch (error) {
    console.warn('[images] fal.ai generation error:', error instanceof Error ? error.message : error)
    return null
  }
}

const OPENAI_IMAGE_SIZES: Record<VideoAspectRatio, string> = {
  '16:9': '1536x1024',
  '9:16': '1024x1536',
}

async function generateWithOpenAI(
  prompt: string,
  aspectRatio: VideoAspectRatio,
  outFile: string,
  assetId: string
): Promise<ImageResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'
  const fullPrompt = `${prompt}. Cinematic photograph, high quality, professional video production still. No text or captions in the image.`
  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt: fullPrompt,
        size: OPENAI_IMAGE_SIZES[aspectRatio],
        n: 1,
        ...(model.startsWith('dall-e') ? { response_format: 'b64_json' } : {}),
      }),
    })
    if (!response.ok) {
      console.warn('[images] OpenAI image generation failed:', response.status, (await response.text()).slice(0, 300))
      return null
    }
    const data = await response.json()
    const first = data?.data?.[0]
    if (first?.b64_json) {
      await fs.promises.writeFile(outFile, Buffer.from(first.b64_json, 'base64'))
    } else if (first?.url) {
      await downloadToFile(first.url, outFile)
    } else {
      return null
    }
    return {
      file: outFile,
      rights: {
        assetId,
        file: outFile,
        type: 'image',
        provider: `openai-images/${model}`,
        license: 'AI-generated image (OpenAI usage terms)',
        licenseUrl: 'https://openai.com/policies/terms-of-use/',
        prompt: fullPrompt,
        model,
        generatedByAI: true,
        retrievedAt: new Date().toISOString(),
      },
    }
  } catch (error) {
    console.warn('[images] OpenAI image generation error:', error instanceof Error ? error.message : error)
    return null
  }
}

/** Reduce a visual description to a short stock-photo search query. */
export function buildStockQuery(visualDescription: string): string {
  return visualDescription
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 6)
    .join(' ')
    .trim()
}

async function fetchFromPexels(
  visualDescription: string,
  aspectRatio: VideoAspectRatio,
  outFile: string,
  assetId: string
): Promise<ImageResult | null> {
  const pexelsKey = process.env.PEXELS_API_KEY?.trim()
  if (!pexelsKey) return null
  const query = buildStockQuery(visualDescription)
  if (!query) return null
  try {
    const orientation = aspectRatio === '9:16' ? 'portrait' : 'landscape'
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=${orientation}`,
      { headers: { Authorization: pexelsKey } }
    )
    if (!response.ok) {
      console.warn('[images] Pexels search failed:', response.status)
      return null
    }
    const data = await response.json()
    const photo = data?.photos?.[0]
    const imageUrl = photo?.src?.large2x || photo?.src?.large || photo?.src?.original
    if (!imageUrl) return null
    await downloadToFile(imageUrl, outFile)
    return {
      file: outFile,
      rights: {
        assetId,
        file: outFile,
        type: 'image',
        provider: 'pexels',
        license: 'Pexels License (free commercial use, no attribution required)',
        licenseUrl: 'https://www.pexels.com/license/',
        sourceUrl: photo?.url || imageUrl,
        credit: photo?.photographer ? `Photo by ${photo.photographer} on Pexels` : 'Pexels',
        prompt: query,
        generatedByAI: false,
        retrievedAt: new Date().toISOString(),
      },
    }
  } catch (error) {
    console.warn('[images] Pexels fetch error:', error instanceof Error ? error.message : error)
    return null
  }
}

const CARD_COLORS = ['#16213e', '#1a1a2e', '#0f3460', '#533483', '#2c003e', '#3d1e6d']

function findSystemFont(): string | null {
  const candidates = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
    'C:/Windows/Fonts/arialbd.ttf',
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) || null
}

/**
 * Last-resort visual: a solid color card, with the scene's on-screen text drawn
 * when a usable system font exists. Fully self-produced, so no external rights.
 */
async function renderTitleCard(
  text: string,
  aspectRatio: VideoAspectRatio,
  outFile: string,
  assetId: string,
  colorSeed: number
): Promise<ImageResult> {
  const format = resolveVideoFormat(aspectRatio)
  const color = CARD_COLORS[colorSeed % CARD_COLORS.length]
  const font = findSystemFont()

  const filters: string[] = []
  if (font && text.trim()) {
    const textFile = `${outFile}.txt`
    await fs.promises.writeFile(textFile, text.trim().slice(0, 80))
    filters.push(
      `drawtext=textfile='${textFile.replace(/\\/g, '/').replace(/:/g, '\\:')}':fontfile='${font
        .replace(/\\/g, '/')
        .replace(/:/g, '\\:')}':fontcolor=white:fontsize=${Math.round(format.width / 24)}:x=(w-text_w)/2:y=(h-text_h)/2`
    )
  }

  const args = [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=${color}:s=${format.width}x${format.height}:d=1`,
    ...(filters.length ? ['-vf', filters.join(',')] : []),
    '-frames:v',
    '1',
    outFile,
  ]
  await execFileAsync(resolveFfmpegPath(), args, { maxBuffer: 1024 * 1024 * 10 })

  return {
    file: outFile,
    rights: {
      assetId,
      file: outFile,
      type: 'image',
      provider: 'generated-title-card',
      license: 'Self-produced (owned by channel)',
      generatedByAI: false,
      retrievedAt: new Date().toISOString(),
    },
  }
}

export async function acquireSceneImage(options: {
  assetId: string
  visualDescription: string
  onScreenText: string
  aspectRatio: VideoAspectRatio
  outFile: string
  sceneIndex: number
}): Promise<ImageResult> {
  const { assetId, visualDescription, onScreenText, aspectRatio, outFile, sceneIndex } = options

  const generated = await generateWithFal(visualDescription, aspectRatio, outFile, assetId)
  if (generated) return generated

  const openaiGenerated = await generateWithOpenAI(visualDescription, aspectRatio, outFile, assetId)
  if (openaiGenerated) return openaiGenerated

  const stock = await fetchFromPexels(visualDescription, aspectRatio, outFile, assetId)
  if (stock) return stock

  const pngFile = outFile.replace(/\.[a-z]+$/i, '.png')
  return renderTitleCard(onScreenText || visualDescription, aspectRatio, pngFile, assetId, sceneIndex)
}
