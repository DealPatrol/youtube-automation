import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pg', 'better-auth'],
  images: {
    unoptimized: true,
  },
  outputFileTracingIncludes: {
    '/api/assemble-video': ['node_modules/ffmpeg-static/ffmpeg'],
    '/api/generate-audio': ['node_modules/ffmpeg-static/ffmpeg'],
    '/api/video/edit': ['node_modules/ffmpeg-static/ffmpeg'],
  },
  turbopack: {
    root: __dirname,
  },
 
}

export default nextConfig
