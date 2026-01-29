'use client';

import { useState, useEffect, useCallback } from 'react'

interface VideoJob {
  id: string
  result_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  current_step?: string
  error_message?: string
  video_url?: string
}

interface UseVideoRenderOptions {
  apiUrl?: string
  pollInterval?: number
}

export function useVideoRender(options: UseVideoRenderOptions = {}) {
  const {
    apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    pollInterval = 5000,
  } = options

  const [job, setJob] = useState<VideoJob | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  // Poll job status
  useEffect(() => {
    if (!isPolling || !job?.id) return

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${apiUrl}/api/videos/${job.result_id}/status`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch job status')
        }

        const updatedJob = await response.json()
        setJob(updatedJob)

        // Stop polling if completed or failed
        if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
          setIsPolling(false)
        }
      } catch (err) {
        console.error('[useVideoRender] Error polling status:', err)
      }
    }, pollInterval)

    return () => clearInterval(interval)
  }, [isPolling, job?.id, job?.result_id, apiUrl, pollInterval])

  const renderVideo = useCallback(
    async (resultId: string) => {
      setLoading(true)
      setError(null)

      try {
        // Fetch result data (scenes, script, etc.)
        const resultResponse = await fetch(`${apiUrl}/api/videos/${resultId}`)
        
        if (!resultResponse.ok) {
          throw new Error('Failed to fetch result data')
        }

        const resultData = await resultResponse.json()

        // Trigger video rendering
        const renderResponse = await fetch(`${apiUrl}/api/videos/render`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            result_id: resultId,
            scenes: resultData.scenes,
            script: resultData.script,
            seo: resultData.seo,
          }),
        })

        if (!renderResponse.ok) {
          throw new Error('Failed to start rendering')
        }

        const newJob = await renderResponse.json()
        setJob(newJob)
        setIsPolling(true)

        return newJob
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMsg)
        console.error('[useVideoRender] Error:', err)
        return null
      } finally {
        setLoading(false)
      }
    },
    [apiUrl]
  )

  const checkStatus = useCallback(
    async (resultId: string) => {
      try {
        const response = await fetch(`${apiUrl}/api/videos/${resultId}/status`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch status')
        }

        const statusJob = await response.json()
        setJob(statusJob)

        return statusJob
      } catch (err) {
        console.error('[useVideoRender] Error checking status:', err)
        return null
      }
    },
    [apiUrl]
  )

  const cancelRender = useCallback(
    async (jobId: string) => {
      try {
        const response = await fetch(`${apiUrl}/api/videos/${jobId}/cancel`, {
          method: 'POST',
        })

        if (!response.ok) {
          throw new Error('Failed to cancel job')
        }

        setIsPolling(false)
        setJob(null)

        return true
      } catch (err) {
        console.error('[useVideoRender] Error canceling job:', err)
        return false
      }
    },
    [apiUrl]
  )

  return {
    job,
    loading,
    error,
    isPolling,
    renderVideo,
    checkStatus,
    cancelRender,
  }
}
