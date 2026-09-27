import { NextResponse } from 'next/server'
import { getPublicAppUrl } from '@/lib/config/app-url'
import { listDueScheduledProjects, updateProject } from '@/lib/db/records'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not set' }, { status: 500 })
  }

  const youtubeAccessToken = process.env.YOUTUBE_ACCESS_TOKEN?.trim()
  if (!youtubeAccessToken) {
    return NextResponse.json({ error: 'Missing YouTube access token' }, { status: 500 })
  }

  try {
    console.log('[Cron] Starting auto-upload job...')

    const scheduledVideos = await listDueScheduledProjects<{
      id: string
      results?: Array<{ id: string; video_url?: string | null }>
    }>()

    if (scheduledVideos.length === 0) {
      console.log('[Cron] No scheduled videos to upload')
      return NextResponse.json({ success: true, message: 'No videos to upload', uploaded: 0 })
    }

    console.log(`[Cron] Found ${scheduledVideos.length} videos to upload`)

    const uploadResults = []

    for (const video of scheduledVideos) {
      try {
        const result = video.results?.[0]
        if (!result) {
          console.log(`[Cron] No result found for project ${video.id}, skipping`)
          continue
        }

        const videoUrl = result.video_url
        if (!videoUrl) {
          console.log(`[Cron] No video URL for project ${video.id}, skipping`)
          continue
        }

        const uploadUrl = new URL('/api/youtube/upload', getPublicAppUrl())
        uploadUrl.searchParams.set('resultId', result.id)
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${youtubeAccessToken}`,
            'x-cron-secret': process.env.CRON_SECRET || '',
          },
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error(errorData.error || 'YouTube upload failed')
        }

        const uploadData = await uploadResponse.json()

        const updated = await updateProject(video.id, {
          status: 'published',
          youtube_video_id: uploadData.videoId,
        })
        if (!updated) throw new Error('Failed to mark project published')

        console.log(`[Cron] Successfully uploaded video ${video.id} to YouTube: ${uploadData.videoId}`)

        uploadResults.push({
          projectId: video.id,
          youtubeVideoId: uploadData.videoId,
          status: 'success',
        })
      } catch (uploadError) {
        console.error(`[Cron] Failed to upload video ${video.id}:`, uploadError)

        await updateProject(video.id, { status: 'failed' })

        uploadResults.push({
          projectId: video.id,
          status: 'failed',
          error: uploadError instanceof Error ? uploadError.message : 'Upload failed',
        })
      }
    }

    const successCount = uploadResults.filter((item) => item.status === 'success').length
    console.log(`[Cron] Auto-upload complete: ${successCount}/${uploadResults.length} successful`)

    return NextResponse.json({
      success: true,
      message: `Auto upload executed: ${successCount} videos uploaded`,
      results: uploadResults,
    })
  } catch (error) {
    console.error('[Cron] Auto-upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Auto-upload failed' },
      { status: 500 }
    )
  }
}
