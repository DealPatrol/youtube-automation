'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle2, Loader2, PlayCircle, Sparkles, Zap, TrendingUp } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'

export default function GeneratorPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [videoLength, setVideoLength] = useState('10')
  const [clipDuration, setClipDuration] = useState('15')
  const [tone, setTone] = useState('neutral')
  const [platform, setPlatform] = useState('youtube')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [youtubeClipDuration, setYoutubeClipDuration] = useState('15')
  const [tiktokClipDuration, setTiktokClipDuration] = useState('15')

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [user, authLoading, router])

  // Pre-fill from URL params (from trending page)
  useEffect(() => {
    const urlTopic = searchParams.get('topic')
    const urlDescription = searchParams.get('description')
    const urlPlatform = searchParams.get('platform')

    if (urlTopic) setTopic(urlTopic)
    if (urlDescription) setDescription(urlDescription)
    if (urlPlatform) setPlatform(urlPlatform)
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic,
          description,
          video_length_minutes: parseInt(videoLength),
          youtube_clip_duration: parseInt(youtubeClipDuration),
          tiktok_clip_duration: parseInt(tiktokClipDuration),
          tone,
          platform,
          user_id: user?.uid,
        }),
      })

      const text = await response.text()
      console.log('[v0] API response status:', response.status)
      console.log('[v0] API response text:', text.substring(0, 500))
      
      if (!response.ok) {
        let errorMessage = `API Error: ${response.status} - ${response.statusText}`
        try {
          const errorData = JSON.parse(text)
          errorMessage = errorData.error || errorMessage
        } catch {
          // Use default error message if JSON parsing fails
          errorMessage = text || errorMessage
        }
        throw new Error(errorMessage)
      }

      let data
      try {
        data = JSON.parse(text)
      } catch (parseErr) {
        console.error('[v0] JSON parse error:', parseErr)
        console.error('[v0] Response text:', text)
        throw new Error(`Invalid response from server: ${text.substring(0, 100)}`)
      }
      
      if (!data.resultId) {
        throw new Error('No result ID received from server')
      }

      // Store result in localStorage as fallback for demo mode
      if (typeof window !== 'undefined') {
        try {
          const demoResults = JSON.parse(localStorage.getItem('demoResults') || '{}')
          demoResults[data.resultId] = data
          localStorage.setItem('demoResults', JSON.stringify(demoResults))
          console.log('[v0] Cached result in localStorage:', data.resultId)
        } catch (storageErr) {
          console.warn('[v0] Failed to cache result:', storageErr)
        }
      }

      router.push(`/results/${data.resultId}`)
    } catch (err) {
      console.error('[v0] Generation error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-background">
      <div className="page-glow" />
      <main className="relative">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-20 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Badge className="w-fit bg-primary/10 text-primary hover:bg-primary/20" variant="secondary">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              AI Production Suite
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
              Create high-performing YouTube videos with an AI studio built for creators.
            </h1>
            <p className="text-lg text-muted-foreground">
              Generate scripts, scenes, SEO, thumbnails, and finished videos in one flow. Launch faster, iterate
              smarter, and keep every asset organized for your team.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <a href="#generator">Start a project</a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#workflow">
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Watch the flow
                </a>
              </Button>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                30s script generation
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Auto scenes + captions
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Ready-to-upload assets
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <Card className="border-border/60 bg-card/80 shadow-xl">
              <CardHeader>
                <CardTitle className="text-lg">Project Command Center</CardTitle>
                <CardDescription>Track every asset from ideation to publish.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-muted-foreground">
                <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3">
                  <p className="font-medium text-foreground">New video: "AI Side Hustles"</p>
                  <p>Script + scenes ready · 12m · YouTube</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3">
                  <p className="font-medium text-foreground">Assets generated</p>
                  <p>Scenes, thumbnail, SEO, captions</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3">
                  <p className="font-medium text-foreground">Next action</p>
                  <p>Assemble + upload to YouTube</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-gradient-to-br from-primary/15 via-transparent to-secondary/10">
              <CardContent className="flex items-center justify-between gap-4 py-6">
                <div>
                  <p className="text-sm text-muted-foreground">Average time to publish</p>
                  <p className="text-2xl font-semibold">45 minutes</p>
                </div>
                <Badge className="bg-foreground text-background">+3.2x faster</Badge>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 pb-12">
          {['Creators', 'Agencies', 'Solo teams', 'Media brands'].map((label) => (
            <div key={label} className="rounded-full border border-border/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {label}
            </div>
          ))}
        </section>

        <section id="generator" className="mx-auto max-w-6xl px-4 pb-20">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-border/60 bg-card/90 shadow-2xl">
              <CardHeader className="space-y-3">
                <CardTitle className="text-2xl md:text-3xl">Start a new project</CardTitle>
                <CardDescription>
                  Give us the brief. We’ll deliver scripts, scenes, SEO, thumbnails, and video assets in one workflow.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label htmlFor="topic" className="text-sm font-semibold block">
                      Video topic
                    </label>
                    <Input
                      id="topic"
                      type="text"
                      placeholder="e.g., How to build a SaaS in 30 days"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      disabled={loading}
                      required
                      minLength={5}
                      className="text-base"
                    />
                    <p className="text-xs text-muted-foreground">
                      Clear, specific topics give the best scripts and scene direction.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="description" className="text-sm font-semibold block">
                      Creative notes (optional)
                    </label>
                    <textarea
                      id="description"
                      placeholder="Target audience, pacing, examples, or key points."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={loading}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="length" className="text-sm font-semibold block">
                        Target length
                      </label>
                      <select
                        id="length"
                        value={videoLength}
                        onChange={(e) => setVideoLength(e.target.value)}
                        disabled={loading}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="5">5 min</option>
                        <option value="8">8 min</option>
                        <option value="10">10 min</option>
                        <option value="12">12 min</option>
                        <option value="15">15 min</option>
                        <option value="20">20 min</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="platform" className="text-sm font-semibold block">
                        Platform focus
                      </label>
                      <select
                        id="platform"
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value)}
                        disabled={loading}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="youtube">YouTube</option>
                        <option value="tiktok">TikTok</option>
                        <option value="instagram">Instagram Reels</option>
                        <option value="twitch">Twitch</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="youtube-clip-duration" className="text-sm font-semibold block">
                        YouTube scene duration
                      </label>
                      <select
                        id="youtube-clip-duration"
                        value={youtubeClipDuration}
                        onChange={(e) => setYoutubeClipDuration(e.target.value)}
                        disabled={loading}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="0">Auto</option>
                        <option value="5">5 seconds</option>
                        <option value="10">10 seconds</option>
                        <option value="15">15 seconds</option>
                        <option value="30">30 seconds</option>
                        <option value="45">45 seconds</option>
                        <option value="60">60 seconds</option>
                      </select>
                      <p className="text-xs text-muted-foreground">Auto aligns scene timing with narration.</p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="tiktok-clip-duration" className="text-sm font-semibold block">
                        TikTok clip duration
                      </label>
                      <select
                        id="tiktok-clip-duration"
                        value={tiktokClipDuration}
                        onChange={(e) => setTiktokClipDuration(e.target.value)}
                        disabled={loading}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="0">Auto</option>
                        <option value="5">5 seconds</option>
                        <option value="10">10 seconds</option>
                        <option value="15">15 seconds</option>
                        <option value="30">30 seconds</option>
                        <option value="45">45 seconds</option>
                        <option value="60">60 seconds</option>
                        <option value="90">90 seconds</option>
                      </select>
                      <p className="text-xs text-muted-foreground">TikTok sweet spot: 15-90 sec.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="tone" className="text-sm font-semibold block">
                      Tone
                    </label>
                    <select
                      id="tone"
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      disabled={loading}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="neutral">Neutral</option>
                      <option value="investigative">Investigative</option>
                      <option value="dramatic">Dramatic</option>
                      <option value="humorous">Humorous</option>
                      <option value="educational">Educational</option>
                    </select>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full text-base font-semibold h-12"
                    disabled={loading || !topic.trim()}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Creating project...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-5 w-5" />
                        Generate video assets
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-border/60 bg-muted/40">
                <CardHeader>
                  <CardTitle className="text-lg">What you get</CardTitle>
                  <CardDescription>Delivered in minutes, ready to publish.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {[
                    'Full script + voiceover plan',
                    'Scene list with visuals + overlays',
                    'SEO-ready title, tags, description',
                    'Thumbnail concepts + prompts',
                    'Exportable video package',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {item}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-lg">Team-ready workflow</CardTitle>
                  <CardDescription>Keep everything organized for editors.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm text-muted-foreground">
                  <div className="rounded-lg border border-border/60 bg-background px-4 py-3">
                    <p className="font-medium text-foreground">Creative brief</p>
                    <p>Outline, tone, and target audience in one place.</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background px-4 py-3">
                    <p className="font-medium text-foreground">Visual references</p>
                    <p>AI-selected assets and B-roll recommendations.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 pb-20">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-primary">Features</p>
              <h2 className="text-3xl font-semibold">Everything you need to publish faster</h2>
            </div>
            <Button variant="outline" asChild>
              <a href="#generator">Start now</a>
            </Button>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: 'Trend-aligned hooks',
                description: 'Scripts tuned to current YouTube patterns and watch-time behavior.',
                icon: <TrendingUp className="h-5 w-5 text-primary" />,
              },
              {
                title: 'Scene-by-scene guidance',
                description: 'Visual descriptions, overlays, and pacing built into every scene.',
                icon: <Sparkles className="h-5 w-5 text-primary" />,
              },
              {
                title: 'SEO & thumbnails',
                description: 'Titles, tags, descriptions, and thumbnail concepts ready to test.',
                icon: <Zap className="h-5 w-5 text-primary" />,
              },
            ].map((feature) => (
              <Card key={feature.title} className="border-border/60 bg-card/80">
                <CardHeader>
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    {feature.icon}
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-6xl px-4 pb-20">
          <div className="mb-8">
            <p className="text-sm font-semibold text-primary">Workflow</p>
            <h2 className="text-3xl font-semibold">From idea to publish in four steps</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-4">
            {[
              ['Brief', 'Provide a topic, tone, and target length.'],
              ['Generate', 'AI writes scripts, scenes, and SEO assets.'],
              ['Assemble', 'Instantly create visuals + voiceover assets.'],
              ['Publish', 'Export, upload, or schedule on YouTube.'],
            ].map(([title, body], index) => (
              <Card key={title} className="border-border/60 bg-muted/40">
                <CardHeader>
                  <Badge className="w-fit bg-primary/10 text-primary">Step {index + 1}</Badge>
                  <CardTitle className="text-lg">{title}</CardTitle>
                  <CardDescription>{body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-4 pb-24">
          <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-primary">Pricing</p>
              <h2 className="text-3xl font-semibold">Built for creators ready to scale</h2>
              <p className="text-muted-foreground">
                Start free and upgrade when you want automated rendering, scheduling, and team workflows.
              </p>
            </div>
            <Card className="border-border/60 bg-card/90 shadow-xl">
              <CardHeader>
                <CardTitle>Creator Pro</CardTitle>
                <CardDescription>Everything for daily publishing.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-4xl font-semibold">$39<span className="text-lg text-muted-foreground">/mo</span></div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {['Unlimited scripts', 'Video assembly + captions', 'Thumbnail concepts', 'SEO optimization'].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button className="w-full" asChild>
                  <a href="#generator">Start free trial</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  )
}
