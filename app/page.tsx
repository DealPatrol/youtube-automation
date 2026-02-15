'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Sparkles, Zap, Palette, BookOpen, Music, BarChart3 } from 'lucide-react'

export default function Home() {
  const [videoTopic, setVideoTopic] = useState('')
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
  const [tone, setTone] = useState('neutral')
  const [platform, setPlatform] = useState('youtube')
  const [youtubeClipDuration, setYoutubeClipDuration] = useState('0')
  const [tiktokClipDuration, setTiktokClipDuration] = useState('15')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const router = useRouter()
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
    setLoading(true)
    setError('')
    setProgress('')

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: videoTopic,
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
      if (!response.ok) {
        try {
          const errorData = JSON.parse(text)
          throw new Error(errorData.error || 'Failed to generate video')
        } catch {
          throw new Error('Failed to generate video')
          // Use default error message if JSON parsing fails
          errorMessage = text || errorMessage
        }
      }

      const data = JSON.parse(text)

      if (!data.jobId) {
        throw new Error('No job ID received from server')
      }

      if (data.status === 'completed') {
        setError('')
        setProgress('')
        router.push(`/results/${data.jobId}`)
        return
      }

      let jobStatus = data.status
      let pollCount = 0
      const maxPolls = 300

      while (jobStatus === 'queued' && pollCount < maxPolls) {
        setProgress(`Generating video... (${pollCount}s)`)
        await new Promise(resolve => setTimeout(resolve, 1000))

        const statusResponse = await fetch('/api/job-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: data.jobId }),
        })

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text()
          try {
            const errorData = JSON.parse(errorText)
            throw new Error(errorData.error || 'Failed to check job status')
          } catch {
            throw new Error('Failed to check job status')
          }
        }

        const statusData = await statusResponse.json()
        jobStatus = statusData.status

        if (jobStatus === 'completed') {
          setError('')
          setProgress('')
          router.push(`/results/${data.jobId}`)
          return
        } else if (jobStatus === 'failed') {
          throw new Error(statusData.error || 'Video generation failed')
        }

        pollCount++
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

      if (pollCount >= maxPolls) {
        throw new Error('Video generation timed out.')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setProgress('')
      console.error('Error:', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const features = [
    {
      icon: Sparkles,
      title: 'AI Script Generation',
      description: 'Generate compelling video scripts tailored to your topic and platform',
    },
    {
      icon: Palette,
      title: 'Scene Planning',
      description: 'Get detailed scene breakdowns with visual descriptions and narration',
    },
    {
      icon: Music,
      title: 'Auto Captions',
      description: 'Automatically generate captions optimized for YouTube and social media',
    },
    {
      icon: BookOpen,
      title: 'SEO Optimization',
      description: 'Receive SEO-optimized titles, descriptions, and tags for better reach',
    },
    {
      icon: Zap,
      title: 'Thumbnail Design',
      description: 'Get AI-generated thumbnail concepts with eye-catching text overlays',
    },
    {
      icon: BarChart3,
      title: 'Platform Specific',
      description: 'Optimize for YouTube, TikTok, Instagram and more with one click',
    },
  ]
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative px-6 py-20 md:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h1 className="text-5xl font-bold md:text-6xl tracking-tight mb-4 text-balance">
              Create YouTube Videos with AI
            </h1>
            <p className="text-lg text-muted-foreground md:text-xl mb-8 max-w-3xl mx-auto text-balance">
              Generate scripts, scenes, SEO metadata, and thumbnails for your YouTube videos in seconds. Powered by OpenAI.
            </p>
          </div>

          {/* Quick Form */}
          <Card className="border-border bg-card p-8 max-w-2xl mx-auto mb-20">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Video Topic</label>
                <Input
                  placeholder="e.g., How to learn Python programming"
                  value={videoTopic}
                  onChange={(e) => setVideoTopic(e.target.value)}
                  className="bg-input border-border"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Length (minutes)</label>
                  <select
                    value={videoLength}
                    onChange={(e) => setVideoLength(e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                  >
                    {[5, 10, 15, 20, 30].map((len) => (
                      <option key={len} value={len}>
                        {len} minutes
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                  >
                    <option value="youtube">YouTube</option>
                    <option value="tiktok">TikTok</option>
                    <option value="instagram">Instagram</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
                  >
                    <option value="neutral">Neutral</option>
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="entertaining">Entertaining</option>
                  </select>
                </div>
              </div>

              {progress && (
                <div className="p-3 bg-blue-950 border border-blue-800 rounded-md text-blue-200 text-sm">
                  {progress}
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-950 border border-red-800 rounded-md text-red-200 text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 font-semibold"
              >
                {loading ? 'Generating...' : 'Generate Video Script'}
              </Button>
            </form>
          </Card>

          {/* Features Grid */}
          <div className="mb-20">
            <h2 className="text-3xl font-bold text-center mb-12">Powerful Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {features.map((feature, idx) => {
                const Icon = feature.icon
                return (
                  <Card key={idx} className="border-border bg-card p-6 hover:border-accent/50 transition-colors">
                    <Icon className="w-6 h-6 text-accent mb-4" />
                    <h3 className="font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center py-12 border-y border-border">
            <div>
              <div className="text-4xl font-bold text-accent mb-2">0</div>
              <p className="text-muted-foreground">Videos Generated</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-accent mb-2">&lt;30s</div>
              <p className="text-muted-foreground">Generation Time</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-accent mb-2">100%</div>
              <p className="text-muted-foreground">Free to Use</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
