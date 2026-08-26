import * as fs from 'fs'

import type { PipelineJob, RightsManifest, RightsRecord } from './types'

/**
 * Stage 7a — rights manifest. A machine-readable record of every asset in the
 * final video: where it came from, under what license, and whether it was
 * AI-generated. Publishing is gated on this manifest existing.
 */

export function buildAttributionText(records: RightsRecord[]): string {
  const lines: string[] = []

  const credited = records.filter((record) => record.credit)
  for (const record of credited) {
    lines.push(`${record.credit}${record.sourceUrl ? ` — ${record.sourceUrl}` : ''}`)
  }

  const aiProviders = Array.from(
    new Set(
      records
        .filter((record) => record.generatedByAI)
        .map((record) => record.provider)
    )
  )
  if (aiProviders.length > 0) {
    lines.push(`Contains AI-generated media (${aiProviders.join(', ')}).`)
  }

  if (records.some((record) => record.provider === 'google-drive')) {
    lines.push('Includes owner-provided Google Drive media used with confirmed publication rights.')
  }

  return lines.join('\n')
}

export function buildRightsManifest(job: PipelineJob): RightsManifest {
  if (!job.content) throw new Error('Cannot build rights manifest before content stage')
  if (!job.render) throw new Error('Cannot build rights manifest before render stage')

  const assets = job.rightsRecords
  return {
    jobId: job.id,
    createdAt: new Date().toISOString(),
    video: {
      title: job.content.seo.title,
      durationSeconds: job.render.durationSeconds,
    },
    assets,
    attributionText: buildAttributionText(assets),
    aiDisclosure: assets.some((record) => record.generatedByAI),
  }
}

export async function writeRightsManifest(job: PipelineJob, outFile: string): Promise<RightsManifest> {
  const manifest = buildRightsManifest(job)
  await fs.promises.writeFile(outFile, JSON.stringify(manifest, null, 2))
  return manifest
}

/** Refuse to publish anything whose assets aren't fully accounted for. */
export function assertPublishable(manifest: RightsManifest): void {
  if (manifest.assets.length === 0) {
    throw new Error('Rights manifest has no assets — refusing to publish')
  }
  const unlicensed = manifest.assets.filter((asset) => !asset.license?.trim())
  if (unlicensed.length > 0) {
    throw new Error(
      `Rights manifest has ${unlicensed.length} asset(s) without license info: ${unlicensed
        .map((asset) => asset.assetId)
        .join(', ')}`
    )
  }
  const unconfirmedDriveAssets = manifest.assets.filter(
    (asset) => asset.provider === 'google-drive' && !asset.publicationRightsConfirmed
  )
  if (unconfirmedDriveAssets.length > 0) {
    throw new Error(
      `Google Drive asset rights must be confirmed before publishing: ${unconfirmedDriveAssets
        .map((asset) => asset.assetId)
        .join(', ')}. Run: npm run pipeline -- confirm-rights ${manifest.jobId}`
    )
  }
}
