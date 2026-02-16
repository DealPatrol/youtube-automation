'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Play, Sparkles, TrendingUp, Zap, ArrowRight, Check } from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()
  const { user } = useAuth()

  const handleGetStarted = () => {
    if (user) {
      router.push('/')
    } else {
      router.push('/login')
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 w-full border-b border-border/50 backdrop-blur-md bg-background/80 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold gradient-accent bg-clip-text text-transparent">
            ContentForge
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild className="hidden sm:flex">
              <a href="#features">Features</a>
            </Button>
            <Button variant="ghost" asChild className="hidden sm:flex">
              <a href="#pricing">Pricing</a>
            </Button>
            {user ? (
              <Button onClick={() => router.push('/')}>Launch App</Button>
            ) : (
              <Button onClick={() => router.push('/login')}>Sign In</Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-2 rounded-full border border-accent/50 bg-accent/5">
            <span className="text-sm font-medium text-accent flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Professional AI-powered video creation
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-balance">
            Create Faceless YouTube Videos
            <br />
            <span className="gradient-accent bg-clip-text text-transparent">
              That Actually Convert
            </span>
          </h1>

          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-balance">
            Generate 5-10 minute long-form videos automatically. Discover what's trending, create professional content, and publish directly to YouTube—all in minutes.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button size="lg" onClick={handleGetStarted} className="gap-2">
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline">
              <Play className="w-4 h-4" />
              Watch Demo
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            No credit card required. Start creating in seconds.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-4 bg-card/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything You Need</h2>
            <p className="text-xl text-muted-foreground">
              Powerful tools designed for content creators and businesses
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-xl border border-border/50 bg-card glass-effect hover:border-accent/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Trending Topic Discovery</h3>
              <p className="text-muted-foreground mb-4">
                Real-time insights into what's hot on Twitter, TikTok, and Reddit. Never run out of ideas again.
              </p>
              <div className="flex items-center text-sm text-accent gap-2">
                Live updates <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-xl border border-border/50 bg-card glass-effect hover:border-accent/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold mb-3">AI Script Generation</h3>
              <p className="text-muted-foreground mb-4">
                Automatically generate engaging scripts, scene descriptions, and SEO metadata from any topic.
              </p>
              <div className="flex items-center text-sm text-accent gap-2">
                Powered by OpenAI <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-xl border border-border/50 bg-card glass-effect hover:border-accent/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Professional Video Rendering</h3>
              <p className="text-muted-foreground mb-4">
                Create high-quality 5-10 minute videos with AI voiceovers, stock footage, and dynamic scenes.
              </p>
              <div className="flex items-center text-sm text-accent gap-2">
                HD quality <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* Feature 4 */}
            <div className="p-8 rounded-xl border border-border/50 bg-card glass-effect hover:border-accent/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center mb-4">
                <Play className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-xl font-bold mb-3">YouTube Publishing</h3>
              <p className="text-muted-foreground mb-4">
                Publish directly to YouTube with optimized titles, descriptions, and thumbnails automatically.
              </p>
              <div className="flex items-center text-sm text-accent gap-2">
                One-click upload <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* Feature 5 */}
            <div className="p-8 rounded-xl border border-border/50 bg-card glass-effect hover:border-accent/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Analytics Dashboard</h3>
              <p className="text-muted-foreground mb-4">
                Track performance metrics, views, and engagement for all your published videos in one place.
              </p>
              <div className="flex items-center text-sm text-accent gap-2">
                Real-time stats <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* Feature 6 */}
            <div className="p-8 rounded-xl border border-border/50 bg-card glass-effect hover:border-accent/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold mb-3">Scheduled Publishing</h3>
              <p className="text-muted-foreground mb-4">
                Plan your content calendar and schedule videos to publish at the perfect time for maximum reach.
              </p>
              <div className="flex items-center text-sm text-accent gap-2">
                Auto-publish <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-muted-foreground">
              Choose the plan that works for you
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Starter */}
            <div className="p-8 rounded-xl border border-border/50 bg-card">
              <h3 className="text-xl font-bold mb-2">Starter</h3>
              <p className="text-muted-foreground mb-6">Perfect for trying it out</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">Free</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-accent" />
                  <span>5 videos per month</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-accent" />
                  <span>Basic script generation</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-accent" />
                  <span>Standard rendering</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-accent" />
                  <span>No branding</span>
                </li>
              </ul>
              <Button className="w-full" variant="outline">
                Get Started
              </Button>
            </div>

            {/* Pro */}
            <div className="p-8 rounded-xl border-2 border-primary bg-card glow-accent">
              <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                Most Popular
              </div>
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <p className="text-muted-foreground mb-6">For serious creators</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">$29</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-accent" />
                  <span>Unlimited videos</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-accent" />
                  <span>Advanced AI scripts</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-accent" />
                  <span>Premium voiceovers</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-accent" />
                  <span>Scheduled publishing</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-accent" />
                  <span>Analytics dashboard</span>
                </li>
              </ul>
              <Button className="w-full">Get Started</Button>
            </div>

            {/* Enterprise */}
            <div className="p-8 rounded-xl border border-border/50 bg-card">
              <h3 className="text-xl font-bold mb-2">Enterprise</h3>
              <p className="text-muted-foreground mb-6">For agencies and brands</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">Custom</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-accent" />
                  <span>Everything in Pro</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-accent" />
                  <span>Multi-channel publishing</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-accent" />
                  <span>Custom integrations</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-accent" />
                  <span>Priority support</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-accent" />
                  <span>Dedicated account manager</span>
                </li>
              </ul>
              <Button className="w-full" variant="outline">
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-card/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Create?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of creators and businesses automating their YouTube strategy.
          </p>
          <Button size="lg" onClick={handleGetStarted} className="gap-2">
            Start Creating Now
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          <p>Copyright 2024 ContentForge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
