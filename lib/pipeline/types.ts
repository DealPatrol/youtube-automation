import type { ContentPlatform, GeneratedContent } from '@/lib/content/generation'
import type { VideoAspectRatio } from '@/lib/video/format'

export type PipelineStatus =
  | 'created'
  | 'trends'
  | 'content'
  | 'assets'
  | 'narration'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'rendering'
  | 'rendered'
  | 'publishing'
  | 'published'
  | 'error'

export type TrendSource = 'youtube' | 'google-trends' | 'x' | 'fallback' | 'manual'

export interface TrendCandidate {
  source: TrendSource
  topic: string
  /** Normalized 0-100 heat score used to rank candidates across sources */
  score: number
  detail?: string
  url?: string
}

export interface RightsRecord {
  assetId: string
  /** Path relative to the job directory */
  file: string
  type: 'image' | 'audio' | 'video' | 'thumbnail' | 'captions' | 'music'
  /** Where the asset came from, e.g. 'fal-ai/flux/dev', 'pexels', 'openai-tts' */
  provider: string
  license: string
  licenseUrl?: string
  sourceUrl?: string
  credit?: string
  prompt?: string
  model?: string
  generatedByAI: boolean
  retrievedAt: string
  /** Required for user-provided imports such as Google Drive source videos. */
  rightsConfirmedAt?: string
}

export interface RightsManifest {
  jobId: string
  createdAt: string
  video: { title: string; durationSeconds: number }
  assets: RightsRecord[]
  /** Ready-to-paste attribution block appended to the YouTube description */
  attributionText: string
  /** True when any asset is AI-generated → YouTube altered/synthetic content disclosure */
  aiDisclosure: boolean
}

export interface SceneAssetState {
  sceneId: number
  imageFile?: string
  audioFile?: string
  /** Measured seconds from the rendered narration audio */
  audioDuration?: number
}

export interface PipelineConfig {
  topic?: string
  platform: ContentPlatform
  durationMinutes: number
  tone: string
  aspectRatio: VideoAspectRatio
  privacy: 'private' | 'unlisted' | 'public'
  autoApprove: boolean
  publishAfterRender: boolean
}

export interface PipelineJob {
  id: string
  createdAt: string
  updatedAt: string
  status: PipelineStatus
  error?: string
  config: PipelineConfig
  trends?: { candidates: TrendCandidate[]; selected: TrendCandidate }
  content?: GeneratedContent
  sceneAssets?: SceneAssetState[]
  thumbnailFile?: string
  captions?: { srtFile: string; vttFile: string }
  driveImport?: {
    fileId: string
    name: string
    mimeType: string
    webViewLink?: string
    sourceVideoFile: string
    importedAt: string
    rightsConfirmedAt?: string
    rightsLicense?: string
  }
  rightsRecords: RightsRecord[]
  approval?: { reviewFile: string; approvedAt?: string; rejectedAt?: string; reason?: string }
  render?: { videoFile: string; durationSeconds: number; width: number; height: number }
  rights?: { manifestFile: string; assetCount: number; aiDisclosure: boolean }
  publish?: {
    videoId: string
    url: string
    privacy: string
    publishedAt: string
    captionsUploaded: boolean
    thumbnailSet: boolean
  }
}
