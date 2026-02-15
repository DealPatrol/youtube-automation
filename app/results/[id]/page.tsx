'use client'

import { use, useState } from 'react'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { useAuth } from '@/lib/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, Copy, Download, ArrowLeft, Upload, ExternalLink, Film, Zap, Loader2 } from 'lucide-react'
import ScriptTab from '@/components/tabs/ScriptTab'
import ScenesTab from '@/components/tabs/ScenesTab'
import CapCutTab from '@/components/tabs/CapCutTab'
import SEOTab from '@/components/tabs/SEOTab'
import ThumbnailTab from '@/components/tabs/ThumbnailTab'
import { useVideoRender } from '@/app/hooks/use-video-render'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Copy, Download, ArrowLeft } from 'lucide-react'

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [copied, setCopied] = useState(false)

  const videoData = {
    id,
    topic: 'How to Learn Python Programming',
    platform: 'YouTube',
    status: 'completed',
    script: `# Video Script: How to Learn Python Programming

## INTRO (0:00-0:15)
"Hey everyone! If you want to learn Python but don't know where to start, you're in the right place. In this video, I'm breaking down the best way to learn Python from zero to hero."

## SECTION 1: Why Python? (0:15-1:00)
"First, let's talk about why Python is so popular. Python is easy to read, has a massive community, and you can build anything with it - web apps, data science, AI, automation."

## SECTION 2: Setup (1:00-2:00)
"To get started, you'll need to install Python from python.org, then get a code editor. I recommend VS Code because it's free and powerful."

## SECTION 3: Fundamentals (2:00-4:00)
"Let's start with the basics: variables, data types, and functions. These are the building blocks of every program you'll write."

## OUTRO (9:45-10:00)
"Thanks for watching! If you found this helpful, smash that subscribe button. What's your favorite Python feature? Let me know in the comments!"`,
    seoData: {
      title: 'How to Learn Python Programming - Complete Beginner Guide',
      description: 'Learn Python from scratch with this comprehensive beginner-friendly guide. Perfect for anyone wanting to start coding.',
      tags: ['python', 'programming', 'tutorial', 'beginner', 'coding', 'learn to code'],
    },
    scenes: [
      {
        number: 1,
        title: 'Intro - Hook & Welcome',
        duration: '0:00-0:15',
        description: 'Engaging intro with eye contact to camera, energetic delivery',
      },
      {
        number: 2,
        title: 'Why Python',
        duration: '0:15-1:00',
        description: 'Show Python logo, mention use cases with B-roll',
      },
      {
        number: 3,
        title: 'Setup Instructions',
        duration: '1:00-2:00',
        description: 'Screen recording of installation process',
      },
      {
        number: 4,
        title: 'Code Along',
        duration: '2:00-9:45',
        description: 'Screen recording with code examples and explanations',
      },
      {
        number: 5,
        title: 'Outro',
        duration: '9:45-10:00',
        description: 'Call to action - subscribe, comment, like',
      },
    ],
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

interface ResultData {
  id: string
  script: any
  scenes: any
  capcut_steps: any
  seo: any
  thumbnail: any
  processing_status: string
  error_message: string | null
  project_id: string
  video_url?: string
}

export default function ResultsPage() {
  const params = useParams()
  const router = useRouter()
  const resultId = params.id as string
  const { user, loading: authLoading } = useAuth()
  const [result, setResult] = useState<ResultData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)
  const [renderStatus, setRenderStatus] = useState('')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [renderLoading, setRenderLoading] = useState(false)
  const [renderError, setRenderError] = useState('')
  const [job, setJob] = useState<any | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
      return
    }
    if (user) {
      loadResult()
    }
  }, [resultId, user, authLoading, router])

  async function loadResult() {
    if (!supabase) {
      setError('Supabase not configured')
      setLoading(false)
      return
    }

    try {
      const { data, error: dbError } = await supabase
        .from('results')
        .select('*')
        .eq('id', resultId)
        .single()

      if (dbError) {
        setError('Result not found')
        return
      }

      setResult({
        id: data.id,
        ...data,
      } as ResultData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results')
    } finally {
      setLoading(false)
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(text, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  function downloadJSON() {
    if (!result) return
    const json = JSON.stringify({
      script: result.script,
      scenes: result.scenes,
      capcut_steps: result.capcut_steps,
      seo: result.seo,
      thumbnail: result.thumbnail,
    }, null, 2)

    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `video-content-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function downloadVideoPackage() {
    if (!result) return
    
    setRendering(true)
    setRenderStatus('Creating project file...')
    
    try {
      const response = await fetch('/api/download-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to create project file')
      }
      
      // Download the JSON file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `video-project-${resultId}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      setRenderStatus('Project file downloaded! Import into video editor or use with Python script.')
    } catch (err) {
      console.error('[v0] Download error:', err)
      setRenderStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setRendering(false)
    }
  }

  async function renderVideo(mode: 'images' | 'videos' = 'images') {
    if (!result) return
    
    setRendering(true)
    setRenderStatus(mode === 'videos' ? 'Starting AI video generation (this takes 5-10 min)...' : 'Starting image generation (fast)...')
    
    try {
      // Step 1: Generate scenes (images/videos + audio)
      const renderResponse = await fetch('/api/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId, mode }),
      })
      
      if (!renderResponse.ok) {
        const errorData = await renderResponse.json()
        throw new Error(errorData.error || 'Failed to render scenes')
      }
      
      await renderResponse.json()
      setRenderStatus('Scenes generated! Now assembling final video...')
      
      // Step 2: Assemble final video from all scenes
      const assembleResponse = await fetch('/api/assemble-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId }),
      })
      
      if (!assembleResponse.ok) {
        const assembleError = await assembleResponse.json()
        throw new Error(assembleError.error || 'Failed to assemble video')
      }
      
      const assembleData = await assembleResponse.json()
      
      setRenderStatus('Video assembled! Generating thumbnail...')
      
      // Step 3: Generate thumbnail
      if (result.thumbnail) {
        const thumbResponse = await fetch('/api/generate-thumbnail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: result.thumbnail.text,
            imagePrompt: result.thumbnail.image_prompt,
            emotion: result.thumbnail.emotion,
          }),
        })
        
        if (thumbResponse.ok) {
          setRenderStatus('Complete! Video and thumbnail ready for YouTube.')
        }
      }
      
      setVideoUrl(assembleData.videoUrl)
      
      // Reload result to get updated data
      await loadResult()
    } catch (err) {
      console.error('[v0] Render error:', err)
      setRenderStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setRendering(false)
    }
  }

  async function uploadToYouTube() {
    if (!result || !result.seo) {
      alert('SEO data not available')
      return
    }

    setUploading(true)
    setRenderStatus('Uploading to YouTube...')

    try {
      // Check if authenticated with YouTube
      const params = new URLSearchParams({
        resultId,
        title: result.seo.title || 'Untitled Video',
        description: result.seo.description || '',
        tags: result.seo.tags?.join(',') || '',
      })

      // Fetch video file if available
      let videoFile: File | null = null
      if (result.video_url) {
        try {
          const videoResponse = await fetch(result.video_url)
          if (videoResponse.ok) {
            const blob = await videoResponse.blob()
            videoFile = new File([blob], 'video.mp4', { type: 'video/mp4' })
          }
        } catch (fetchErr) {
          console.log('[v0] Could not fetch video file, proceeding without it')
        }
      }

      // If no video file, authenticate first
      if (!videoFile) {
        const authUrl = `/api/auth/youtube?resultId=${resultId}`
        window.location.href = authUrl
        return
      }

      // Create FormData for multipart upload
      const formData = new FormData()
      formData.append('video', videoFile)

      const response = await fetch(`/api/youtube/direct-upload?${params.toString()}`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 401) {
          const authUrl = `/api/auth/youtube?resultId=${resultId}`
          window.location.href = authUrl
          return
        }
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      setUploadedVideoId(data.videoId)
      setRenderStatus(`✓ Video uploaded! View it here: ${data.url}`)
      await loadResult()
    } catch (err) {
      setRenderStatus(`Upload error: ${err instanceof Error ? err.message : 'Unknown error'}`)
      console.error('[v0] Upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  async function startVideoRender() {
    setRendering(true)
    setRenderStatus('Starting video rendering...')

    try {
      const response = await fetch('/api/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId }),
      })

      if (!response.ok) {
        throw new Error('Failed to render video')
      }

      const data = await response.json()
      setRenderStatus(`${data.message}. Estimated time: ${data.estimatedTime}`)
    } catch (err) {
      setRenderStatus(`Render error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setRendering(false)
    }
  }

  const renderVideoFunction = startVideoRender; // Declare the renderVideo variable

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) return null

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Generator
            </Button>
          </Link>
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-2 pt-6">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <span>{error || 'Content not found'}</span>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (result.processing_status === 'processing') {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <div className="animate-pulse">
                <p className="text-lg font-semibold mb-2">Generating your content...</p>
                <p className="text-muted-foreground">This may take a minute. Please wait.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Back Button */}
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        {/* Header */}
        <div className="mb-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">{videoData.topic}</h1>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-secondary/20 text-secondary text-sm font-medium">
                  {videoData.platform}
                </span>
                <span className="text-sm text-muted-foreground">ID: {videoData.id}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                Edit
              </Button>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          {/* Script Section */}
          <Card className="border-border bg-card p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Video Script</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(videoData.script)}
              >
                <Copy className="w-4 h-4 mr-2" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="bg-input rounded-lg p-6 whitespace-pre-wrap font-mono text-sm leading-relaxed overflow-auto max-h-96">
              {videoData.script}
            </div>
          </Card>

          {/* Scenes */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Scene Breakdown</h2>
            <div className="space-y-4">
              {videoData.scenes.map((scene) => (
                <Card key={scene.number} className="border-border bg-card p-6 hover:border-accent/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold px-2 py-1 rounded-full bg-secondary/20 text-secondary">
                          Scene {scene.number}
                        </span>
                        <span className="text-xs text-muted-foreground">{scene.duration}</span>
                      </div>
                      <h3 className="text-lg font-semibold mb-1">{scene.title}</h3>
                      <p className="text-muted-foreground">{scene.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* SEO Data */}
          <div>
            <h2 className="text-2xl font-bold mb-6">SEO Optimization</h2>
            <Card className="border-border bg-card p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-2">Title</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={videoData.seoData.title}
                    readOnly
                    className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(videoData.seoData.title)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Description</label>
                <div className="flex gap-2">
                  <textarea
                    value={videoData.seoData.description}
                    readOnly
                    className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground resize-none"
                    rows={3}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(videoData.seoData.description)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {videoData.seoData.tags.map((tag, idx) => (
                    <span key={idx} className="px-3 py-1 rounded-full bg-accent/20 text-accent text-sm font-medium">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
