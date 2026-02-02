'use client'

import React from "react"

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Upload, Scissors, Type, Download, Play, Pause, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function VideoEditor() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [projectData, setProjectData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Edit controls
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(10)
  const [overlayText, setOverlayText] = useState('')
  const [textPosition, setTextPosition] = useState<'top' | 'center' | 'bottom'>('bottom')
  
  // Processing state
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (projectId) {
      loadProject(projectId)
    }
  }, [projectId])

  async function loadProject(id: string) {
    setLoading(true)
    try {
      const response = await fetch(`/api/editor/load-project?projectId=${id}`)
      if (!response.ok) throw new Error('Failed to load project')
      const data = await response.json()
      setProjectData(data)
      console.log('[v0] Loaded project:', data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (projectData?.videoUrl) {
      setVideoUrl(projectData.videoUrl)
    } else if (projectData?.scenes && projectData.scenes.length > 0) {
      const firstScene = projectData.scenes[0]
      if (firstScene.image) {
        setVideoUrl(firstScene.image)
      }
    }
  }, [projectData])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file)
      setVideoUrl(URL.createObjectURL(file))
    }
  }

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const applyEdits = async () => {
    if (!videoFile) return
    
    setProcessing(true)
    setProgress(0)

    try {
      // Create FormData to send video file
      const formData = new FormData()
      formData.append('video', videoFile)
      formData.append('trimStart', trimStart.toString())
      formData.append('trimEnd', trimEnd.toString())
      formData.append('overlayText', overlayText)
      formData.append('textPosition', textPosition)

      const response = await fetch('/api/video/edit', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to process video')
      }

      // Download the processed video
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `edited-${videoFile.name}`
      a.click()
      
      setProgress(100)
    } catch (error) {
      console.error('Edit error:', error)
      alert('Failed to process video')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Video Editor</h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading project...</p>
          </div>
        )}
        
        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {projectData && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{projectData.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {projectData.scenes.length} scenes • Ready to edit
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {projectData.scenes.map((scene: any) => (
                  <div key={scene.id} className="border border-border rounded-lg p-3">
                    <div className="aspect-video bg-muted rounded mb-2 flex items-center justify-center">
                      <Type className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-xs font-medium truncate">{scene.title}</p>
                    <p className="text-xs text-muted-foreground">{scene.duration}s</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Preview */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Video Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!videoUrl ? (
                  <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">
                      {projectData ? 'Loading video...' : 'Upload a video to start editing'}
                    </p>
                    {!projectData && (
                      <Input
                        type="file"
                        accept="video/*"
                        onChange={handleFileUpload}
                        className="max-w-xs mx-auto"
                      />
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                      {videoUrl.endsWith('.mp4') || videoUrl.startsWith('blob:') ? (
                        <video
                          ref={videoRef}
                          src={videoUrl}
                          className="w-full h-full"
                          controls
                          onLoadedMetadata={() => {
                            if (videoRef.current) {
                              const dur = videoRef.current.duration || 0
                              setDuration(dur)
                              setTrimEnd(dur)
                            }
                          }}
                        />
                      ) : (
                        <img
                          src={videoUrl || "/placeholder.svg"}
                          alt="Video preview"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={togglePlayPause}
                        className="bg-transparent"
                      >
                        {isPlaying ? (
                          <Pause className="w-4 h-4 mr-2" />
                        ) : (
                          <Play className="w-4 h-4 mr-2" />
                        )}
                        {isPlaying ? 'Pause' : 'Play'}
                      </Button>
                      <Button size="sm" variant="outline" className="bg-transparent">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Edit Controls */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scissors className="w-5 h-5" />
                  Trim Video
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Start Time: {trimStart.toFixed(1)}s</Label>
                  <Slider
                    value={[trimStart]}
                    onValueChange={(val) => setTrimStart(val[0])}
                    max={duration}
                    step={0.1}
                    disabled={!videoUrl}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>End Time: {trimEnd.toFixed(1)}s</Label>
                  <Slider
                    value={[trimEnd]}
                    onValueChange={(val) => setTrimEnd(val[0])}
                    max={duration}
                    step={0.1}
                    disabled={!videoUrl}
                  />
                </div>

                <p className="text-sm text-muted-foreground">
                  Duration: {(trimEnd - trimStart).toFixed(1)}s
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Type className="w-5 h-5" />
                  Text Overlay
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Overlay Text</Label>
                  <Input
                    value={overlayText}
                    onChange={(e) => setOverlayText(e.target.value)}
                    placeholder="Add text to your video"
                    disabled={!videoUrl}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Text Position</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['top', 'center', 'bottom'] as const).map((pos) => (
                      <Button
                        key={pos}
                        variant={textPosition === pos ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTextPosition(pos)}
                        disabled={!videoUrl}
                      >
                        {pos}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={applyEdits}
              disabled={!videoUrl || processing}
              className="w-full"
              size="lg"
            >
              <Download className="w-4 h-4 mr-2" />
              {processing ? `Processing... ${progress}%` : 'Export Edited Video'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
