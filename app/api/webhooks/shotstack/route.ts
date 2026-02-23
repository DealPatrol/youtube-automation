import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let supabase: any = null
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey)
}

export async function POST(request: Request) {
  try {
    if (!WEBHOOK_SECRET) {
      console.warn('[Webhook] WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    const payload = await request.text()
    const signature = request.headers.get('X-Shotstack-Signature')

    // Verify webhook signature
    const hash = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex')

    if (signature !== hash) {
      console.error('[Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const data = JSON.parse(payload)
    console.log('[Webhook] Received Shotstack callback:', data.id, 'Status:', data.status)

    if (!supabase) {
      console.warn('[Webhook] Supabase not configured, skipping update')
      return NextResponse.json({ success: true, cached: true })
    }

    // Update result with video URL if render completed
    if (data.status === 'completed') {
      const videoUrl = data.output.renderedUrl

      // Find and update the result with this render job ID
      const { error: updateError } = await supabase
        .from('results')
        .update({
          video_url: videoUrl,
          processing_status: 'completed',
          shotstack_render_id: data.id,
        })
        .eq('shotstack_render_id', data.id)

      if (updateError) {
        console.error('[Webhook] Update error:', updateError)
      } else {
        console.log('[Webhook] Result updated with video URL')
      }
    }

    if (data.status === 'failed') {
      const { error: updateError } = await supabase
        .from('results')
        .update({
          processing_status: 'error',
          error_message: data.error || 'Video render failed',
          shotstack_render_id: data.id,
        })
        .eq('shotstack_render_id', data.id)

      if (updateError) {
        console.error('[Webhook] Error update failed:', updateError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Webhook] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
