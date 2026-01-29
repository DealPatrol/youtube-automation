import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Plan configurations
const PLANS = {
  free: {
    videosLimit: 5,
    autoPostingEnabled: false,
    multiChannelEnabled: false,
    aiVoiceoverEnabled: false,
    priorityRendering: false,
  },
  pro: {
    videosLimit: 50,
    autoPostingEnabled: true,
    multiChannelEnabled: false,
    aiVoiceoverEnabled: true,
    priorityRendering: true,
  },
  enterprise: {
    videosLimit: 500,
    autoPostingEnabled: true,
    multiChannelEnabled: true,
    aiVoiceoverEnabled: true,
    priorityRendering: true,
  },
}

export async function GET(request: Request) {
  try {
    // In production, get user from session/JWT
    const userId = 'anonymous-user'

    if (!supabaseUrl || !supabaseKey) {
      // Return default free plan if no database
      return NextResponse.json({
        plan: 'free',
        videosUsed: 0,
        ...PLANS.free,
      })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    const plan = (subscription?.plan as keyof typeof PLANS) || 'free'
    const planConfig = PLANS[plan] || PLANS.free

    // Count videos created this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count: videosUsed } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString())

    return NextResponse.json({
      plan,
      videosUsed: videosUsed || 0,
      ...planConfig,
      subscriptionId: subscription?.id,
      renewsAt: subscription?.current_period_end,
    })
  } catch (error) {
    console.error('[Billing] Error:', error)
    // Return free plan on error
    return NextResponse.json({
      plan: 'free',
      videosUsed: 0,
      ...PLANS.free,
    })
  }
}

export async function POST(request: Request) {
  try {
    const { action, planId } = await request.json()

    if (action === 'upgrade') {
      // In production, redirect to Stripe checkout
      const checkoutUrl = `https://checkout.stripe.com/pay/${process.env.STRIPE_PRICE_ID_PRO}`

      return NextResponse.json({
        success: true,
        checkoutUrl,
        message: 'Redirecting to checkout...',
      })
    }

    if (action === 'cancel') {
      // Cancel subscription logic
      return NextResponse.json({
        success: true,
        message: 'Subscription will be cancelled at the end of the billing period',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[Billing] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Billing error' },
      { status: 500 }
    )
  }
}
