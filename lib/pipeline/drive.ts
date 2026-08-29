import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import { pipeline } from 'stream/promises'

import { google } from 'googleapis'

export interface DriveVideoFile {
  id: string
  name: string
  mimeType?: string
  size?: string
  modifiedTime?: string
  webViewLink?: string
}

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

function resolveClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId =
    process.env.GOOGLE_DRIVE_CLIENT_ID ||
    process.env.YOUTUBE_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret =
    process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
    process.env.YOUTUBE_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Set GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET or reuse YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET')
  }
  return { clientId, clientSecret }
}

function authRedirect(): { port: number; url: string } {
  const port = Number(process.env.DRIVE_AUTH_PORT || process.env.PIPELINE_AUTH_PORT || 8787)
  return { port, url: `http://localhost:${port}/callback` }
}

function buildOAuthClient() {
  const { clientId, clientSecret } = resolveClientCredentials()
  const redirect = authRedirect()
  return new google.auth.OAuth2(clientId, clientSecret, redirect.url)
}

export function isDriveConfigured(): boolean {
  return Boolean(
    (process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID) &&
      (process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET) &&
      (process.env.GOOGLE_DRIVE_REFRESH_TOKEN || process.env.DRIVE_REFRESH_TOKEN)
  )
}

export async function runDriveAuthFlow(): Promise<void> {
  const oauth2 = buildOAuthClient()
  const redirect = authRedirect()
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: DRIVE_SCOPES,
  })

  console.log('\nOpen this URL in your browser and authorize read-only Google Drive access:\n')
  console.log(`  ${authUrl}\n`)
  console.log(`Waiting for the OAuth redirect on ${redirect.url} ...`)
  console.log('(Add this exact redirect URI to your Google Cloud OAuth client if it is missing.)\n')

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${redirect.port}`)
      if (url.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }
      const authCode = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        authCode
          ? '<h2>Authorized. You can close this tab and return to the terminal.</h2>'
          : `<h2>Authorization failed: ${error || 'no code returned'}</h2>`
      )
      server.close()
      if (authCode) resolve(authCode)
      else reject(new Error(`OAuth failed: ${error || 'no code returned'}`))
    })
    server.on('error', reject)
    server.listen(redirect.port)
  })

  const { tokens } = await oauth2.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. Remove prior app access at https://myaccount.google.com/permissions and rerun.'
    )
  }

  console.log('\nSuccess! Add this line to your .env:\n')
  console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}\n`)
}

function buildDriveClient() {
  const oauth2 = buildOAuthClient()
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || process.env.DRIVE_REFRESH_TOKEN
  if (!refreshToken) {
    throw new Error('Set GOOGLE_DRIVE_REFRESH_TOKEN in .env (run: npm run pipeline -- drive-auth)')
  }
  oauth2.setCredentials({ refresh_token: refreshToken.trim() })
  return google.drive({ version: 'v3', auth: oauth2 })
}

export function buildDriveVideoSearchQuery(options: { query?: string; folderId?: string }): string {
  const parts = ['trashed = false', "mimeType contains 'video/'"]
  const query = options.query?.trim()
  if (query) {
    parts.push(`name contains '${query.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`)
  }
  const folderId = options.folderId?.trim()
  if (folderId) {
    parts.push(`'${folderId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' in parents`)
  }
  return parts.join(' and ')
}

export async function searchDriveVideos(options: {
  query?: string
  folderId?: string
  max?: number
}): Promise<DriveVideoFile[]> {
  const drive = buildDriveClient()
  const response = await drive.files.list({
    q: buildDriveVideoSearchQuery(options),
    pageSize: Math.min(Math.max(options.max || 10, 1), 50),
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  return (response.data.files || [])
    .filter((file): file is DriveVideoFile => Boolean(file.id && file.name))
    .map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType || undefined,
      size: file.size || undefined,
      modifiedTime: file.modifiedTime || undefined,
      webViewLink: file.webViewLink || undefined,
    }))
}

export async function getDriveVideo(fileId: string): Promise<DriveVideoFile> {
  const drive = buildDriveClient()
  const response = await drive.files.get({
    fileId,
    fields: 'id,name,mimeType,size,modifiedTime,webViewLink',
    supportsAllDrives: true,
  })
  const file = response.data
  if (!file.id || !file.name) throw new Error(`Drive file not found or inaccessible: ${fileId}`)
  if (!file.mimeType?.startsWith('video/')) {
    throw new Error(`Drive file "${file.name}" is not a video (${file.mimeType || 'unknown mime type'})`)
  }
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType || undefined,
    size: file.size || undefined,
    modifiedTime: file.modifiedTime || undefined,
    webViewLink: file.webViewLink || undefined,
  }
}

export async function downloadDriveFile(fileId: string, outFile: string): Promise<void> {
  const drive = buildDriveClient()
  await fs.promises.mkdir(path.dirname(outFile), { recursive: true })
  const response = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  )
  await pipeline(response.data as NodeJS.ReadableStream, fs.createWriteStream(outFile))
}
