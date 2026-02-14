'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Loader2, Sparkles, Zap, TrendingUp } from 'lucide-react'
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
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-glow opacity-20 blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-4 py-20">
          <div className="text-center space-y-6">
            <div className="inline-block">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                <Sparkles className="w-4 h-4" />
                AI-Powered Video Creation
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Your Video Script in 30 Seconds
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              From idea to production-ready outline. Scripts, scenes, SEO, thumbnails – everything you need to create viral content.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button size="lg" className="text-base" onClick={() => document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth' })}>
                Start Creating
              </Button>
              <Button size="lg" variant="outline" className="text-base bg-transparent">
                See Examples
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Generator Form */}
      <section id="generator" className="max-w-3xl mx-auto px-4 py-12">
        <Card className="glass-effect border border-primary/20 shadow-xl">
          <CardHeader className="space-y-2">
            <CardTitle className="text-3xl">Create Your Video</CardTitle>
            <CardDescription>
              Tell us about your video and we'll generate everything you need
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-secondary/10 text-secondary rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="topic" className="text-sm font-bold block">
                  What's Your Video About?
                </label>
                <Input
                  id="topic"
                  type="text"
                  placeholder="e.g., 'How to build a SaaS in 30 days'"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={loading}
                  required
                  minLength={5}
                  className="text-base"
                />
                <p className="text-xs text-muted-foreground">
                  Be specific and creative – the more details, the better the content
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-bold block">
                  More Details (Optional)
                </label>
                <textarea
                  id="description"
                  placeholder="Your target audience, vibe, specific points to include..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed resize-none text-base"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="length" className="text-sm font-bold block">
                    Total Length
                  </label>
                  <select
                    id="length"
                    value={videoLength}
                    onChange={(e) => setVideoLength(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed text-base"
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
                  <label htmlFor="platform" className="text-sm font-bold block">
                    Platform
                  </label>
                  <select
                    id="platform"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed text-base"
                  >
                    <option value="youtube">YouTube</option>
                    <option value="tiktok">TikTok</option>
                    <option value="instagram">Instagram Reels</option>
                    <option value="twitch">Twitch</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="youtube-clip-duration" className="text-sm font-bold block">
                    YouTube Clip Duration
                  </label>
                  <select
                    id="youtube-clip-duration"
                    value={youtubeClipDuration}
                    onChange={(e) => setYoutubeClipDuration(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed text-base"
                  >
                    <option value="0">Auto (Default)</option>
                    <option value="5">5 seconds</option>
                    <option value="10">10 seconds</option>
                    <option value="15">15 seconds</option>
                    <option value="30">30 seconds</option>
                    <option value="45">45 seconds</option>
                    <option value="60">60 seconds</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    0 = Auto scene length based on content
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="tiktok-clip-duration" className="text-sm font-bold block">
                    TikTok Clip Duration
                  </label>
                  <select
                    id="tiktok-clip-duration"
                    value={tiktokClipDuration}
                    onChange={(e) => setTiktokClipDuration(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed text-base"
                  >
                    <option value="0">Auto (Default)</option>
                    <option value="5">5 seconds</option>
                    <option value="10">10 seconds</option>
                    <option value="15">15 seconds</option>
                    <option value="30">30 seconds</option>
                    <option value="45">45 seconds</option>
                    <option value="60">60 seconds</option>
                    <option value="90">90 seconds</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    TikTok optimal: 15-90 sec
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="tone" className="text-sm font-bold block">
                    Vibe
                  </label>
                  <select
                    id="tone"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed text-base"
                  >
                    <option value="neutral">Neutral</option>
                    <option value="investigative">Investigative</option>
                    <option value="dramatic">Dramatic</option>
                    <option value="humorous">Humorous</option>
                    <option value="educational">Educational</option>
                  </select>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full text-base font-bold h-12"
                disabled={loading || !topic.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Cooking up magic...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-5 w-5" />
                    Generate Video
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Unique Features */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-black text-center mb-12 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
          Features No One Else Has
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1: AI Trend Analysis */}
          <Card className="glass-effect border border-accent/30 group hover:shadow-lg transition-all hover:scale-105">
            <CardHeader>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-accent/20">
                  <TrendingUp className="w-6 h-6 text-accent" />
                </div>
              </div>
              <CardTitle>Trending Audio Hooks</CardTitle>
              <CardDescription>
                Scripts powered by current trending sounds on TikTok & YouTube
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Our AI analyzes real-time trending audio and automatically structures your script around proven hooks that creators are using RIGHT NOW. Get those viral moments.
            </CardContent>
          </Card>

          {/* Feature 2: B-Roll Assistant */}
          <Card className="glass-effect border border-primary/30 group hover:shadow-lg transition-all hover:scale-105">
            <CardHeader>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
              </div>
              <CardTitle>Auto B-Roll Finder</CardTitle>
              <CardDescription>
                Free stock footage recommendations tailored to each scene
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Stop wasting time searching for B-roll. We generate a curated list of free stock footage sources and specific keywords for every scene in your video. Just copy-paste into Pexels or Unsplash.
            </CardContent>
          </Card>

          {/* Feature 3: Thumbnail A/B Testing */}
          <Card className="glass-effect border border-secondary/30 group hover:shadow-lg transition-all hover:scale-105">
            <CardHeader>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-secondary/20">
                  <Zap className="w-6 h-6 text-secondary" />
                </div>
              </div>
              <CardTitle>Multi-Thumbnail Generator</CardTitle>
              <CardDescription>
                Get 3 different thumbnail concepts with CTR predictions
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              We generate 3 unique thumbnail design options optimized for different niches, plus predicted click-through rates based on current YouTube trends. Pick the winner before you even film.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Social Proof */}
      <section className="max-w-5xl mx-auto px-4 py-16 border-t border-border">
        <div className="grid grid-cols-3 gap-8 text-center">
          <div>
            <p className="text-3xl font-black text-primary">500+</p>
            <p className="text-muted-foreground">Videos Created</p>
          </div>
          <div>
            <p className="text-3xl font-black text-accent">2.5M+</p>
            <p className="text-muted-foreground">Total Views</p>
          </div>
          <div>
            <p className="text-3xl font-black text-secondary">4.9★</p>
            <p className="text-muted-foreground">Creator Rating</p>
          </div>
        </div>
      </section>
    </div>
  )
}
