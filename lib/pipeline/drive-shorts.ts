import * as fs from 'fs'
import * as path from 'path'
import { pipeline as streamPipeline } from 'stream/promises'

import { google } from 'googleapis'

import { jobsRoot } from './job-store'
import { buildGoogleOAuth2Client, isPublishConfigured, publishVideoFileToYouTube } from './youtube'

export interface DriveShortCandidate {
  id: string
  name: string
  mimeType?: string | null
  size?: string | null
  modifiedTime?: string | null
  webViewLink?: string | null
}

export interface DriveShortsOptions {
  query: string
  folderId?: string
  maxResults: number
  privacy: 'private' | 'unlisted' | 'public'
  publish: boolean
  rightsConfirmed: boolean
  license: string
  containsSyntheticMedia: boolean
  titlePrefix?: string
}

export interface DriveShortPublishResult {
  candidate: DriveShortCandidate
  localFile: string
  manifestFile: string
  youtube?: Awaited<ReturnType<typeof publishVideoFileToYouTube>>
}

function escapeDriveQueryLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function buildDriveVideoQuery(options: {
  query?: string
  folderId?: string
}): string {
  const clauses = ['trashed = false', "mimeType contains 'video/'"]
  const folderId = options.folderId?.trim()
  if (folderId) clauses.push(`'${escapeDriveQueryLiteral(folderId)}' in parents`)

  const query = options.query?.trim()
  if (query) {
    const escaped = escapeDriveQueryLiteral(query)
    clauses.push(`(name contains '${escaped}' or fullText contains '${escaped}')`)
  }

  return clauses.join(' and ')
}

function driveClient() {
  return google.drive({ version: 'v3', auth: buildGoogleOAuth2Client() })
}

function safeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned || 'drive-short.mp4'
}

function titleFromFileName(candidate: DriveShortCandidate, titlePrefix?: string): string {
  const base = candidate.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
  const title = base.length > 0 ? base : 'Motivation Short'
  return titlePrefix ? `${titlePrefix} ${title}`.trim() : title
}

function bytesLabel(size?: string | null): string {
  const bytes = Number(size || 0)
  if (!Number.isFinite(bytes) || bytes <= 0) return 'unknown size'
  const mb = bytes / 1024 / 1024
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`
}

export async function listDriveShortCandidates(options: {
  query: string
  folderId?: string
  maxResults: number
}): Promise<DriveShortCandidate[]> {
  const drive = driveClient()
  const response = await drive.files.list({
    q: buildDriveVideoQuery(options),
    pageSize: Math.min(Math.max(options.maxResults, 1), 25),
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  return (response.data.files ?? []).map((file) => ({
    id: file.id ?? '',
    name: file.name ?? 'untitled-video.mp4',
    mimeType: file.mimeType,
    size: file.size,
    modifiedTime: file.modifiedTime,
    webViewLink: file.webViewLink,
  })).filter((file) => file.id.length > 0)
}

async function downloadDriveFile(candidate: DriveShortCandidate, outFile: string): Promise<void> {
  const drive = driveClient()
  await fs.promises.mkdir(path.dirname(outFile), { recursive: true })
  const response = await drive.files.get(
    { fileId: candidate.id, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  )
  await streamPipeline(
    response.data as unknown as NodeJS.ReadableStream,
    fs.createWriteStream(outFile)
  )
}

async function writeRightsManifest(options: {
  candidate: DriveShortCandidate
  localFile: string
  manifestFile: string
  license: string
  rightsConfirmed: boolean
  containsSyntheticMedia: boolean
}): Promise<void> {
  const manifest = {
    createdAt: new Date().toISOString(),
    source: 'google-drive',
    rightsConfirmed: options.rightsConfirmed,
    license: options.license,
    containsSyntheticMedia: options.containsSyntheticMedia,
    asset: {
      driveFileId: options.candidate.id,
      name: options.candidate.name,
      mimeType: options.candidate.mimeType,
      size: options.candidate.size,
      modifiedTime: options.candidate.modifiedTime,
      webViewLink: options.candidate.webViewLink,
      localFile: options.localFile,
    },
  }
  await fs.promises.writeFile(options.manifestFile, JSON.stringify(manifest, null, 2))
}

export async function runDriveShorts(options: DriveShortsOptions): Promise<DriveShortPublishResult[]> {
  if (!options.query.trim() && !options.folderId?.trim()) {
    throw new Error('Provide --query, --folder, or both to select Google Drive videos')
  }

  const candidates = await listDriveShortCandidates({
    query: options.query,
    folderId: options.folderId,
    maxResults: options.maxResults,
  })

  if (candidates.length === 0) {
    console.log('[drive-shorts] No matching Google Drive videos found.')
    return []
  }

  console.log(`\n[drive-shorts] Found ${candidates.length} candidate video(s):`)
  for (const candidate of candidates) {
    console.log(
      `  - ${candidate.name} (${bytesLabel(candidate.size)}, modified ${candidate.modifiedTime || 'unknown'})`
    )
  }

  if (!options.publish) {
    console.log('\n[drive-shorts] Dry run only. Add --publish --rights-confirmed to download and upload.')
    return candidates.map((candidate) => ({
      candidate,
      localFile: '',
      manifestFile: '',
    }))
  }

  if (!options.rightsConfirmed) {
    throw new Error('Publishing Drive videos requires --rights-confirmed')
  }
  if (!isPublishConfigured()) {
    throw new Error('Set YouTube OAuth env and run `npm run pipeline -- drive-auth` before publishing')
  }

  const runId = `${new Date().toISOString().slice(0, 10)}-${Date.now()}`
  const outDir = path.join(jobsRoot(), '..', 'drive-shorts', runId)
  await fs.promises.mkdir(outDir, { recursive: true })

  const results: DriveShortPublishResult[] = []
  for (const candidate of candidates) {
    const localFile = path.join(outDir, safeFileName(candidate.name))
    const manifestFile = path.join(outDir, `${safeFileName(candidate.name)}.rights.json`)
    console.log(`\n[drive-shorts] Downloading ${candidate.name} ...`)
    await downloadDriveFile(candidate, localFile)
    await writeRightsManifest({
      candidate,
      localFile,
      manifestFile,
      license: options.license,
      rightsConfirmed: options.rightsConfirmed,
      containsSyntheticMedia: options.containsSyntheticMedia,
    })

    const title = titleFromFileName(candidate, options.titlePrefix)
    const description = [
      'Motivational short uploaded from channel-owned Google Drive media.',
      '',
      `Rights: ${options.license}`,
      candidate.webViewLink ? `Source archive: ${candidate.webViewLink}` : '',
    ].filter(Boolean).join('\n')

    const youtube = await publishVideoFileToYouTube({
      videoFile: localFile,
      title,
      description,
      tags: ['motivation', 'shorts', 'mindset'],
      privacy: options.privacy,
      containsSyntheticMedia: options.containsSyntheticMedia,
    })
    results.push({ candidate, localFile, manifestFile, youtube })
  }

  return results
}
