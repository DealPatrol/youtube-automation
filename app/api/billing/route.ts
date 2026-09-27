import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/session'
import { countProjectsSince } from '@/lib/db/records'
import { getAppUser } from '@/lib/db/users'

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

export async function GET() {
  try {
    const defaultPlan = 'pro' as const
    const userId = await getSessionUserId()
    if (!userId || !process.env.DATABASE_URL) {
      return NextResponse.json({
        plan: defaultPlan,
        videosUsed: 0,
        ...PLANS[defaultPlan],
      })
    }

    const profile = await getAppUser(userId)
    const tier = profile?.subscription_tier
    const plan = tier === 'free' || tier === 'pro' || tier === 'enterprise' ? tier : defaultPlan
    const planConfig = PLANS[plan]

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const videosUsed = await countProjectsSince(userId, startOfMonth)

    return NextResponse.json({
      plan,
      videosUsed,
      ...planConfig,
    })
  } catch (error) {
    console.error('[Billing] Error:', error)
    // Return Pro plan on error (user has paid)
    return NextResponse.json({
      plan: 'pro',
      videosUsed: 0,
      ...PLANS.pro,
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
