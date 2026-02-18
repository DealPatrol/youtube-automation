'use client'

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
import Link from 'next/link'
import ScriptTab from '@/components/tabs/ScriptTab'
import ScenesTab from '@/components/tabs/ScenesTab'
import CapCutTab from '@/components/tabs/CapCutTab'
import SEOTab from '@/components/tabs/SEOTab'
import ThumbnailTab from '@/components/tabs/ThumbnailTab'

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
      setRenderError(err instanceof Error ? err.message : 'Unknown error')
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
      })

      window.location.href = `/api/youtube-auth?${params.toString()}`
    } catch (err) {
      setRenderStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setUploading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <Skeleton className="h-96 mb-6" />
        </div>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
            <div className="flex gap-3">
              <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-destructive">Error</h3>
                <p className="text-sm text-muted-foreground mt-1">{error || 'Result not found'}</p>
                <Button className="mt-4" asChild>
                  <Link href="/dashboard">Back to Dashboard</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/dashboard" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Link>
            </Button>
            <h1 className="text-4xl font-bold mb-2">Video Results</h1>
            <p className="text-muted-foreground">Your generated video content is ready</p>
          </div>
        </div>

        {renderStatus && (
          <Card className="border-accent/50 bg-accent/10 mb-8">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
                <p className="text-sm">{renderStatus}</p>
              </div>
              {rendering && <Progress className="mt-3" value={45} />}
            </CardContent>
          </Card>
        )}

        {renderError && (
          <Card className="border-destructive/50 bg-destructive/10 mb-8">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{renderError}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Button 
            onClick={() => downloadJSON()} 
            variant="outline"
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            Download JSON
          </Button>
          <Button 
            onClick={() => downloadVideoPackage()} 
            variant="outline"
            className="w-full"
            disabled={rendering}
          >
            <Film className="w-4 h-4 mr-2" />
            Download Package
          </Button>
          <Button 
            onClick={() => renderVideo('images')} 
            className="w-full"
            disabled={rendering}
          >
            <Zap className="w-4 h-4 mr-2" />
            Generate Video
          </Button>
          <Button 
            onClick={uploadToYouTube}
            className="w-full bg-red-600 hover:bg-red-700"
            disabled={uploading || !result.seo}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload to YouTube
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="script" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="script">Script</TabsTrigger>
            <TabsTrigger value="scenes">Scenes</TabsTrigger>
            <TabsTrigger value="capcut">CapCut</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
            <TabsTrigger value="thumbnail">Thumbnail</TabsTrigger>
          </TabsList>

          <TabsContent value="script" className="space-y-4">
            <ScriptTab script={result.script} />
          </TabsContent>

          <TabsContent value="scenes" className="space-y-4">
            <ScenesTab scenes={result.scenes} />
          </TabsContent>

          <TabsContent value="capcut" className="space-y-4">
            <CapCutTab steps={result.capcut_steps} />
          </TabsContent>

          <TabsContent value="seo" className="space-y-4">
            <SEOTab seo={result.seo} />
          </TabsContent>

          <TabsContent value="thumbnail" className="space-y-4">
            <ThumbnailTab thumbnail={result.thumbnail} />
          </TabsContent>
        </Tabs>

        {videoUrl && (
          <Card className="border-accent/50 bg-accent/10 mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5" />
                Generated Video
              </CardTitle>
            </CardHeader>
            <CardContent>
              <video 
                src={videoUrl} 
                controls 
                className="w-full rounded-lg border border-border"
                style={{ maxHeight: '500px' }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
