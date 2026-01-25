'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, Copy, Download, ArrowLeft, Upload, ExternalLink } from 'lucide-react'
import ScriptTab from '@/components/tabs/ScriptTab'
import ScenesTab from '@/components/tabs/ScenesTab'
import CapCutTab from '@/components/tabs/CapCutTab'
import SEOTab from '@/components/tabs/SEOTab'
import ThumbnailTab from '@/components/tabs/ThumbnailTab'
import Link from 'next/link'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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
}

export default function ResultsPage() {
  const params = useParams()
  const resultId = params.id as string
  const [result, setResult] = useState<ResultData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null)

  useEffect(() => {
    loadResult()
  }, [resultId])

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

  async function uploadToYouTube() {
    if (!result?.seo) {
      alert('SEO data not available')
      return
    }

    setUploading(true)

    try {
      // Step 1: Redirect to YouTube OAuth
      const clientId = process.env.NEXT_PUBLIC_YOUTUBE_CLIENT_ID
      if (!clientId) {
        alert('YouTube API not configured. Contact support.')
        setUploading(false)
        return
      }

      const redirectUri = `${window.location.origin}/api/auth/youtube/callback`
      const scope = 'https://www.googleapis.com/auth/youtube.upload'
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`

      // Store the video data in sessionStorage for use after OAuth
      sessionStorage.setItem('youtubeVideoData', JSON.stringify({
        title: result.seo.title,
        description: result.seo.description,
        tags: result.seo.tags,
      }))

      window.location.href = authUrl
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start YouTube upload')
      setUploading(false)
    }
  }

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

  if (result.processing_status === 'error') {
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
            <CardHeader>
              <CardTitle className="text-destructive">Generation Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{result.error_message || 'An error occurred during generation'}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Generator
            </Button>
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h1 className="text-3xl font-bold">Your Generated Content</h1>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(result)}
                className="bg-transparent"
              >
                <Copy className="w-4 h-4 mr-2" />
                {copied ? 'Copied!' : 'Copy All'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadJSON}
                className="bg-transparent"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button
                size="sm"
                onClick={uploadToYouTube}
                disabled={uploading}
                className="bg-secondary hover:bg-secondary/90"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload to YouTube'}
              </Button>
              {uploadedVideoId && (
                <a href={`https://youtube.com/watch?v=${uploadedVideoId}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View on YouTube
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <Tabs defaultValue="script" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="script">Script</TabsTrigger>
            <TabsTrigger value="scenes">Scenes</TabsTrigger>
            <TabsTrigger value="capcut">CapCut</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
            <TabsTrigger value="thumbnail">Thumbnail</TabsTrigger>
          </TabsList>

          <TabsContent value="script" className="mt-6 space-y-4">
            {result.script ? (
              <ScriptTab script={result.script} />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">No script data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="scenes" className="mt-6 space-y-4">
            {result.scenes && result.scenes.length > 0 ? (
              <ScenesTab scenes={result.scenes} />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">No scene data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="capcut" className="mt-6 space-y-4">
            {result.capcut_steps && result.capcut_steps.length > 0 ? (
              <CapCutTab steps={result.capcut_steps} />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">No CapCut instructions available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="seo" className="mt-6 space-y-4">
            {result.seo ? (
              <SEOTab seo={result.seo} />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">No SEO data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="thumbnail" className="mt-6 space-y-4">
            {result.thumbnail ? (
              <ThumbnailTab thumbnail={result.thumbnail} />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">No thumbnail suggestions available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
