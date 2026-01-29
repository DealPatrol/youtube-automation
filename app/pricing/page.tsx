'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Zap, Building2, ArrowLeft } from 'lucide-react'

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for trying out the platform',
    features: [
      '5 videos per month',
      'Basic AI script generation',
      'Scene breakdown',
      'SEO optimization',
      'Thumbnail suggestions',
      'Manual YouTube upload',
    ],
    limitations: [
      'No auto-posting',
      'No priority rendering',
      'No AI voiceover',
    ],
    cta: 'Get Started',
    popular: false,
    priceId: null,
  },
  {
    name: 'Pro',
    price: '$29',
    period: 'per month',
    description: 'For serious content creators',
    features: [
      '50 videos per month',
      'Advanced AI script generation',
      'Auto-posting to YouTube',
      'Priority video rendering',
      'AI voiceover generation',
      'Subtitle generation',
      'Advanced analytics',
      'Email support',
    ],
    limitations: [],
    cta: 'Upgrade to Pro',
    popular: true,
    priceId: 'price_pro_monthly',
  },
  {
    name: 'Enterprise',
    price: '$99',
    period: 'per month',
    description: 'For agencies and teams',
    features: [
      '500 videos per month',
      'Everything in Pro',
      'Multi-channel support',
      'Team collaboration',
      'Custom branding',
      'API access',
      'Dedicated account manager',
      'Priority support',
      'Custom integrations',
    ],
    limitations: [],
    cta: 'Contact Sales',
    popular: false,
    priceId: 'price_enterprise_monthly',
  },
]

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleUpgrade(planName: string, priceId: string | null) {
    if (!priceId) {
      window.location.href = '/'
      return
    }

    if (planName === 'Enterprise') {
      window.location.href = 'mailto:sales@youtubeai.com'
      return
    }

    setLoading(planName)

    try {
      const response = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upgrade', planId: priceId }),
      })

      const data = await response.json()

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    } catch (error) {
      console.error('Upgrade error:', error)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-black mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start free and scale as you grow. No hidden fees, cancel anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative ${
                plan.popular
                  ? 'border-primary shadow-lg scale-105'
                  : 'border-border'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 p-3 rounded-full bg-muted w-fit">
                  {plan.name === 'Free' && <Zap className="w-6 h-6" />}
                  {plan.name === 'Pro' && <Zap className="w-6 h-6 text-primary" />}
                  {plan.name === 'Enterprise' && <Building2 className="w-6 h-6" />}
                </div>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Price */}
                <div className="text-center">
                  <span className="text-4xl font-black">{plan.price}</span>
                  <span className="text-muted-foreground">/{plan.period}</span>
                </div>

                {/* CTA Button */}
                <Button
                  className={`w-full ${plan.popular ? '' : 'bg-transparent'}`}
                  variant={plan.popular ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => handleUpgrade(plan.name, plan.priceId)}
                  disabled={loading === plan.name}
                >
                  {loading === plan.name ? 'Processing...' : plan.cta}
                </Button>

                {/* Features */}
                <div className="space-y-3">
                  <p className="text-sm font-medium">What's included:</p>
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Limitations */}
                {plan.limitations.length > 0 && (
                  <div className="pt-4 border-t border-border space-y-2">
                    {plan.limitations.map((limitation) => (
                      <p key={limitation} className="text-sm text-muted-foreground">
                        {limitation}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-24">
          <h2 className="text-3xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div>
              <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
              <p className="text-muted-foreground text-sm">
                Yes, you can cancel your subscription at any time. Your access will continue until the end of your billing period.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-muted-foreground text-sm">
                We accept all major credit cards, debit cards, and PayPal through our secure Stripe checkout.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Do unused videos roll over?</h3>
              <p className="text-muted-foreground text-sm">
                No, video credits reset each month. We recommend upgrading if you consistently need more videos.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Is there a free trial for Pro?</h3>
              <p className="text-muted-foreground text-sm">
                Yes! Start with our Free plan to try all features, then upgrade when you're ready for more videos and auto-posting.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
