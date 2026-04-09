import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export const runtime = 'nodejs'

// Stripe event types we care about
const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
])

/**
 * Verify Stripe webhook signature using the raw request body.
 * Stripe signs each event with a HMAC-SHA256 signature included in the
 * `Stripe-Signature` header.  We replicate the algorithm here to avoid
 * depending on the stripe npm package at the edge.
 */
function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string
): boolean {
  try {
    const parts: Record<string, string> = {}
    for (const part of header.split(',')) {
      const [key, value] = part.split('=')
      parts[key] = value
    }

    const timestamp = parts['t']
    const signature = parts['v1']

    if (!timestamp || !signature) return false

    // Reject events that are more than 5 minutes old to prevent replay attacks
    const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10)
    if (timestampAge > 300) return false

    const signedPayload = `${timestamp}.${payload}`
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  } catch {
    return false
  }
}

function getPlanFromPriceId(priceId: string | undefined): 'free' | 'pro' | 'enterprise' {
  if (!priceId) return 'free'
  const proPriceId = process.env.STRIPE_PRICE_ID_PRO
  const enterprisePriceId = process.env.STRIPE_PRICE_ID_ENTERPRISE
  if (proPriceId && priceId === proPriceId) return 'pro'
  if (enterprisePriceId && priceId === enterprisePriceId) return 'enterprise'
  return 'free'
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const stripeSignature = request.headers.get('stripe-signature')

  // Verify webhook signature when the secret is configured
  if (stripeWebhookSecret) {
    if (!stripeSignature) {
      console.warn('[Webhook] Missing Stripe-Signature header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const valid = verifyStripeSignature(body, stripeSignature, stripeWebhookSecret)
    if (!valid) {
      console.warn('[Webhook] Invalid Stripe signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  } else {
    console.warn('[Webhook] STRIPE_WEBHOOK_SECRET not set – skipping signature verification')
  }

  let event: Record<string, any>
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType: string = event.type

  if (!HANDLED_EVENTS.has(eventType)) {
    // Acknowledge unhandled event types so Stripe stops retrying them
    return NextResponse.json({ received: true })
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Webhook] Supabase credentials not configured')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    switch (eventType) {
      case 'checkout.session.completed': {
        const session = event.data.object as Record<string, any>
        const userId: string | undefined =
          session.metadata?.user_id || session.client_reference_id
        const customerId: string | undefined = session.customer
        const subscriptionId: string | undefined = session.subscription

        if (!userId) {
          console.warn('[Webhook] checkout.session.completed missing user_id in metadata')
          break
        }

        // Persist or update the subscription record
        const sessionPlan = getPlanFromPriceId(
          session.metadata?.price_id || session.items?.data?.[0]?.price?.id
        )
        const { error } = await supabase.from('subscriptions').upsert(
          {
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status: 'active',
            plan: sessionPlan,
            current_period_end: null,
          },
          { onConflict: 'user_id' }
        )

        if (error) {
          console.error('[Webhook] Failed to upsert subscription:', error)
        } else {
          console.log(`[Webhook] Subscription created for user ${userId}`)
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Record<string, any>
        const stripeCustomerId: string = subscription.customer
        const priceId: string | undefined =
          subscription.items?.data?.[0]?.price?.id
        const plan = getPlanFromPriceId(priceId)
        const status: string = subscription.status
        const periodEnd: number | undefined = subscription.current_period_end

        // Resolve the internal user_id via the customer id stored earlier
        const { data: existing } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', stripeCustomerId)
          .single()

        if (!existing?.user_id) {
          console.warn('[Webhook] No subscription row found for customer:', stripeCustomerId)
          break
        }

        const { error } = await supabase
          .from('subscriptions')
          .update({
            stripe_subscription_id: subscription.id,
            status: status === 'active' ? 'active' : 'inactive',
            plan,
            current_period_end: periodEnd
              ? new Date(periodEnd * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', stripeCustomerId)

        if (error) {
          console.error('[Webhook] Failed to update subscription:', error)
        } else {
          console.log(`[Webhook] Subscription updated for customer ${stripeCustomerId}: plan=${plan} status=${status}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Record<string, any>
        const stripeCustomerId: string = subscription.customer

        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
            plan: 'free',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', stripeCustomerId)

        if (error) {
          console.error('[Webhook] Failed to cancel subscription:', error)
        } else {
          console.log(`[Webhook] Subscription cancelled for customer ${stripeCustomerId}`)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Record<string, any>
        const stripeCustomerId: string = invoice.customer

        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', stripeCustomerId)

        if (error) {
          console.error('[Webhook] Failed to mark subscription active after payment:', error)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Record<string, any>
        const stripeCustomerId: string = invoice.customer

        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', stripeCustomerId)

        if (error) {
          console.error('[Webhook] Failed to mark subscription past_due after payment failure:', error)
        } else {
          console.warn(`[Webhook] Payment failed for customer ${stripeCustomerId}`)
        }
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('[Webhook] Error processing event:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Webhook processing error' },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true })
}
