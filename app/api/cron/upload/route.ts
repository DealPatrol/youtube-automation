import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    console.log('[Cron] Starting auto-upload job...')

    // Fetch videos scheduled for upload (status = 'scheduled' and scheduled_for <= now)
    const { data: scheduledVideos, error: fetchError } = await supabase
      .from('projects')
      .select('*, results(*)')
      .eq('status', 'scheduled')
      .lte('scheduled_for', new Date().toISOString())
      .limit(10)

    if (fetchError) throw fetchError

    if (!scheduledVideos || scheduledVideos.length === 0) {
      console.log('[Cron] No scheduled videos to upload')
      return NextResponse.json({ success: true, message: 'No videos to upload', uploaded: 0 })
    }

    console.log(`[Cron] Found ${scheduledVideos.length} videos to upload`)

    const uploadResults = []

    for (const video of scheduledVideos) {
      try {
        // Get the result data for this project
        const result = video.results?.[0]
        if (!result) {
          console.log(`[Cron] No result found for project ${video.id}, skipping`)
          continue
        }

        // Get the video URL
        const videoUrl = result.video_url
        if (!videoUrl) {
          console.log(`[Cron] No video URL for project ${video.id}, skipping`)
          continue
        }

        // Get SEO data
        const seo = result.seo || {}
        const title = seo.title || video.title || video.topic
        const description = seo.description || ''
        const tags = seo.tags || []

        // Upload to YouTube (call our YouTube upload API)
        const uploadResponse = await fetch(
          `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/youtube/upload?resultId=${result.id}&action=upload`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.YOUTUBE_ACCESS_TOKEN || ''}`,
            },
          }
        )

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error(errorData.error || 'YouTube upload failed')
        }

        const uploadData = await uploadResponse.json()

        // Update project status to published
        const { error: updateError } = await supabase
          .from('projects')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            youtube_video_id: uploadData.videoId,
          })
          .eq('id', video.id)

        if (updateError) throw updateError

        console.log(`[Cron] Successfully uploaded video ${video.id} to YouTube: ${uploadData.videoId}`)

        uploadResults.push({
          projectId: video.id,
          youtubeVideoId: uploadData.videoId,
          status: 'success',
        })
      } catch (uploadError) {
        console.error(`[Cron] Failed to upload video ${video.id}:`, uploadError)

        // Mark as failed
        await supabase
          .from('projects')
          .update({
            status: 'failed',
            error_message: uploadError instanceof Error ? uploadError.message : 'Upload failed',
          })
          .eq('id', video.id)

        uploadResults.push({
          projectId: video.id,
          status: 'failed',
          error: uploadError instanceof Error ? uploadError.message : 'Upload failed',
        })
      }
    }

    const successCount = uploadResults.filter((r) => r.status === 'success').length
    console.log(`[Cron] Auto-upload complete: ${successCount}/${uploadResults.length} successful`)

    return NextResponse.json({
      success: true,
      message: `Auto upload executed: ${successCount} videos uploaded`,
      results: uploadResults,
    })
  } catch (error) {
    console.error('[Cron] Auto-upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Auto upload failed' },
      { status: 500 }
    )
  }
}
