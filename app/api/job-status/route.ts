import { NextResponse } from 'next/server'
import { cache } from '@/lib/redis'

export async function POST(request: Request) {
  try {
    let body: { jobId?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const { jobId } = body

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId required' },
        { status: 400 }
      )
    }

    // Get job status from cache
    const status = await cache.get(`job:${jobId}:status`)
    const progress = await cache.get(`job:${jobId}:progress`)
    const error = await cache.get(`job:${jobId}:error`)
    const data = await cache.get(`job:${jobId}:data`)

    if (!status) {
      return NextResponse.json(
        { 
          jobId,
          status: 'queued',
          progress: 'Job queued...',
          data: null,
        }
      )
    }

    let result = null
    if (data && typeof data === 'string') {
      try {
        result = JSON.parse(data)
      } catch {
        result = null
      }
    }

    return NextResponse.json({
      jobId,
      status: status || 'queued',
      progress: progress || 'Processing...',
      error: error || null,
      data: result,
    })
  } catch (error) {
    console.error('[Job Status] Error:', error)
    return NextResponse.json(
      { error: 'Failed to check job status' },
      { status: 500 }
    )
  }
}
