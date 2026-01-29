'use client'

import React from "react"

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Upload, Scissors, Type, Download, Play, Pause } from 'lucide-react'
import Link from 'next/link'

export default function VideoEditor() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  
  // Edit controls
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(10)
  const [overlayText, setOverlayText] = useState('')
  const [textPosition, setTextPosition] = useState<'top' | 'center' | 'bottom'>('bottom')
  
  // Processing state
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.addEventListener('loadedmetadata', () => {
        const dur = videoRef.current?.duration || 0
        setDuration(dur)
        setTrimEnd(dur)
      })
    }
  }, [videoUrl])

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
                    <p className="text-muted-foreground mb-4">Upload a video to start editing</p>
                    <Input
                      type="file"
                      accept="video/*"
                      onChange={handleFileUpload}
                      className="max-w-xs mx-auto"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative bg-black rounded-lg overflow-hidden">
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        className="w-full"
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-center gap-4">
                      <Button onClick={togglePlayPause} size="lg">
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Timeline</Label>
                      <div className="text-xs text-muted-foreground flex justify-between">
                        <span>{trimStart.toFixed(1)}s</span>
                        <span>{trimEnd.toFixed(1)}s</span>
                      </div>
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
