import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Verify this is a legitimate cron request
  const authHeader = request.headers.get('authorization')
  
  // Verify Vercel cron secret
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Call the job processor
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/worker/process-jobs`, {
      method: 'GET',
    })

    const data = await response.json()
    
    console.log('[Cron] Job processing trigger completed:', data)

    return NextResponse.json({
      success: true,
      ...data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cron] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
