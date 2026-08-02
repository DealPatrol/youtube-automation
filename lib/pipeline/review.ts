import * as fs from 'fs'
import * as path from 'path'

import type { PipelineJob } from './types'

/**
 * Stage 5 — human approval screen. A self-contained HTML storyboard written
 * into the job directory: hook, per-scene photo + narration audio, shot list,
 * title/SEO, thumbnail concept, and the exact commands to approve or reject.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function writeReviewPage(job: PipelineJob, outFile: string): Promise<string> {
  const content = job.content
  if (!content) throw new Error('Cannot build review page before content stage')
  const dir = path.dirname(outFile)

  const rel = (absolute?: string) => (absolute ? path.relative(dir, absolute) : '')

  const sceneRows = content.scenes
    .map((scene) => {
      const asset = job.sceneAssets?.find((item) => item.sceneId === scene.id)
      const image = asset?.imageFile
        ? `<img src="${escapeHtml(rel(asset.imageFile))}" alt="Scene ${scene.id}">`
        : '<div class="missing">no image</div>'
      const audio = asset?.audioFile
        ? `<audio controls src="${escapeHtml(rel(asset.audioFile))}"></audio>
           <div class="meta">${(asset.audioDuration ?? 0).toFixed(1)}s narration</div>`
        : '<div class="missing">no audio</div>'
      return `
      <tr>
        <td class="num">${scene.id}<div class="meta">${escapeHtml(scene.start_time)}–${escapeHtml(scene.end_time)}</div></td>
        <td class="img">${image}</td>
        <td>
          <strong>${escapeHtml(scene.title)}</strong>
          <p>${escapeHtml(scene.narration)}</p>
          <div class="meta">Shot: ${escapeHtml(scene.visual_description)}</div>
          <div class="meta">On-screen: “${escapeHtml(scene.on_screen_text)}”</div>
          ${audio}
        </td>
      </tr>`
    })
    .join('\n')

  const thumbnail = job.thumbnailFile
    ? `<img class="thumb" src="${escapeHtml(rel(job.thumbnailFile))}" alt="thumbnail">`
    : '<div class="missing">thumbnail not generated</div>'

  const trend = job.trends
    ? `<p class="meta">Trend source: ${escapeHtml(job.trends.selected.source)} — ${escapeHtml(
        job.trends.selected.topic
      )}${job.trends.selected.detail ? ` (${escapeHtml(job.trends.selected.detail)})` : ''}</p>`
    : ''

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Review: ${escapeHtml(content.seo.title)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 1000px; margin: 2rem auto; padding: 0 1rem; background: #101014; color: #e8e8ee; }
  h1 { font-size: 1.5rem; } h2 { font-size: 1.1rem; margin-top: 2rem; border-bottom: 1px solid #333; padding-bottom: .4rem; }
  .hook { background: #1d2436; border-left: 4px solid #5b8def; padding: .8rem 1rem; border-radius: 6px; font-size: 1.1rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  td { border-top: 1px solid #2a2a33; padding: .8rem .5rem; vertical-align: top; }
  td.num { width: 3rem; font-weight: 700; }
  td.img { width: 220px; } td.img img { width: 200px; border-radius: 6px; }
  .thumb { max-width: 320px; border-radius: 8px; }
  .meta { color: #9a9aa8; font-size: .85rem; margin-top: .3rem; }
  .missing { color: #e07a5f; font-size: .85rem; }
  audio { width: 100%; margin-top: .4rem; }
  code, pre { background: #1a1a22; padding: .2rem .45rem; border-radius: 4px; font-size: .9rem; }
  pre { padding: .8rem; overflow-x: auto; }
  .pill { display: inline-block; background: #26263a; border-radius: 999px; padding: .15rem .7rem; margin: .15rem; font-size: .85rem; }
  .approve { background: #14351f; border-left: 4px solid #4caf7d; padding: .8rem 1rem; border-radius: 6px; }
</style>
</head>
<body>
  <h1>${escapeHtml(content.seo.title)}</h1>
  <p class="meta">Job ${escapeHtml(job.id)} · ${escapeHtml(job.config.platform)} · ${escapeHtml(
    job.config.aspectRatio
  )} · ${content.scenes.length} scenes</p>
  ${trend}

  <h2>Hook (first 3 seconds)</h2>
  <div class="hook">${escapeHtml(content.scenes[0]?.narration || '')}</div>

  <h2>Storyboard</h2>
  <table>${sceneRows}</table>

  <h2>Title &amp; SEO</h2>
  <p><strong>${escapeHtml(content.seo.title)}</strong></p>
  <p>${escapeHtml(content.seo.description)}</p>
  <div>${content.seo.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join('')}</div>
  <p class="meta">Pinned comment: ${escapeHtml(content.seo.pinned_comment)}</p>

  <h2>Thumbnail</h2>
  ${thumbnail}
  <p><strong>Overlay text:</strong> ${escapeHtml(content.thumbnail.text)}</p>
  <p class="meta">${escapeHtml(content.thumbnail.design_description)}</p>

  <h2>Approve or reject</h2>
  <div class="approve">
    <pre>npm run pipeline -- approve ${escapeHtml(job.id)}
npm run pipeline -- reject ${escapeHtml(job.id)} --reason "what to change"</pre>
    Approving renders the video, writes the rights manifest, and (if configured) publishes to YouTube.
  </div>
</body>
</html>`

  await fs.promises.writeFile(outFile, html)
  return outFile
}
