'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Zap,
  Clock,
  Smartphone,
  Upload,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { SHORTS_MAX_DURATION_SECONDS, SHORTS_MAX_SCENES } from '@/lib/video/shorts-optimizer'

const DURATION_OPTIONS = [15, 30, 45, 60] as const
const TONE_OPTIONS = [
  { value: 'educational', label: 'Educational' },
  { value: 'entertaining', label: 'Entertaining' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'humorous', label: 'Humorous' },
  { value: 'neutral', label: 'Neutral' },
] as const

const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy (neutral)' },
  { value: 'echo', label: 'Echo (male)' },
  { value: 'nova', label: 'Nova (female)' },
  { value: 'shimmer', label: 'Shimmer (female)' },
] as const

interface PublishResult {
  projectId: string
  resultId: string
  durationSeconds: number
  sceneCount: number
  aspectRatio: string
  videoUrl: string | null
  metadata: {
    title: string
    description: string
    tags: string[]
  }
}

type Step = 'idle' | 'generating' | 'rendering' | 'assembling' | 'done' | 'error'

const STEP_LABELS: Record<Step, string> = {
  idle: '',
  generating: 'Writing script...',
  rendering: 'Generating scene assets...',
  assembling: 'Assembling vertical video...',
  done: 'Short ready!',
  error: 'Something went wrong',
}

export default function ShortsGeneratorPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState<string>('educational')
  const [durationSeconds, setDurationSeconds] = useState<number>(SHORTS_MAX_DURATION_SECONDS)
  const [voice, setVoice] = useState('alloy')
  const [renderMode, setRenderMode] = useState<'images' | 'videos'>('images')
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<PublishResult | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [user, authLoading, router])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResult(null)
    setStep('generating')

    try {
      const response = await fetch('/api/shorts/quick-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          tone,
          durationSeconds,
          voice,
          renderMode,
          user_id: user ? ('uid' in user ? user.uid : user.id) : undefined,
          autoUpload: false,
        }),
      })

      const text = await response.text()
      let data: any
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error(`Invalid server response: ${text.substring(0, 200)}`)
      }

      if (!response.ok) {
        throw new Error(data.error || `Server error ${response.status}`)
      }

      setStep('done')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setStep('error')
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

  const isWorking = step === 'generating' || step === 'rendering' || step === 'assembling'

  return (
    <div className="min-h-screen bg-background">
      <div className="page-glow" />
      <main className="relative mx-auto max-w-5xl px-4 pb-20 pt-16">
        {/* Header */}
        <div className="mb-10 space-y-3">
          <Badge className="w-fit bg-primary/10 text-primary hover:bg-primary/20" variant="secondary">
            <Smartphone className="mr-2 h-3.5 w-3.5" />
            YouTube Shorts
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Shorts Generator
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Drop a topic, pick a duration, and get a fully assembled vertical Short — script, visuals,
            voiceover, and SEO — in one click.
          </p>
          <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              9:16 vertical format
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              ≤60 second limit enforced
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Scroll-stopping hook
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Form */}
          <Card className="border-border/60 bg-card/90 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl">Create your Short</CardTitle>
              <CardDescription>
                All settings are pre-optimized for the Shorts algorithm.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerate} className="space-y-5">
                {(step === 'error') && error && (
                  <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Topic */}
                <div className="space-y-1.5">
                  <label htmlFor="topic" className="text-sm font-semibold block">
                    Topic / hook idea
                  </label>
                  <Input
                    id="topic"
                    type="text"
                    placeholder="e.g., 3 habits that double your energy"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    disabled={isWorking}
                    required
                    minLength={5}
                    className="text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    Punchy, specific topics perform best on Shorts.
                  </p>
                </div>

                {/* Duration */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold block">
                    Duration
                    <span className="ml-2 font-normal text-muted-foreground">
                      (max {SHORTS_MAX_DURATION_SECONDS}s)
                    </span>
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {DURATION_OPTIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        disabled={isWorking}
                        onClick={() => setDurationSeconds(d)}
                        className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                          durationSeconds === d
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-border/60 text-muted-foreground hover:border-primary/40'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        {d}s
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Tone */}
                  <div className="space-y-1.5">
                    <label htmlFor="tone" className="text-sm font-semibold block">
                      Tone
                    </label>
                    <select
                      id="tone"
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      disabled={isWorking}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {TONE_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Voice */}
                  <div className="space-y-1.5">
                    <label htmlFor="voice" className="text-sm font-semibold block">
                      Voiceover
                    </label>
                    <select
                      id="voice"
                      value={voice}
                      onChange={(e) => setVoice(e.target.value)}
                      disabled={isWorking}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {VOICE_OPTIONS.map((v) => (
                        <option key={v.value} value={v.value}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Render mode */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold block">Visual style</label>
                  <div className="flex gap-2">
                    {(['images', 'videos'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        disabled={isWorking}
                        onClick={() => setRenderMode(mode)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                          renderMode === mode
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-border/60 text-muted-foreground hover:border-primary/40'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {mode === 'images' ? 'AI Images (fast)' : 'AI Video clips'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Progress indicator */}
                {isWorking && (
                  <div className="flex items-center gap-3 rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                    <span>{STEP_LABELS[step]}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full text-base font-semibold h-12"
                  disabled={isWorking || !topic.trim()}
                >
                  {isWorking ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {STEP_LABELS[step]}
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-5 w-5" />
                      Generate Short
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Right panel */}
          <div className="space-y-5">
            {/* Result card */}
            {step === 'done' && result && (
              <Card className="border-primary/40 bg-primary/5 shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">Short generated!</CardTitle>
                  </div>
                  <CardDescription className="line-clamp-2">{result.metadata.title}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-background/80 p-2">
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="font-semibold">{result.durationSeconds}s</p>
                    </div>
                    <div className="rounded-lg bg-background/80 p-2">
                      <p className="text-xs text-muted-foreground">Scenes</p>
                      <p className="font-semibold">{result.sceneCount}</p>
                    </div>
                    <div className="rounded-lg bg-background/80 p-2">
                      <p className="text-xs text-muted-foreground">Format</p>
                      <p className="font-semibold">{result.aspectRatio}</p>
                    </div>
                  </div>

                  {result.metadata.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {result.metadata.tags.slice(0, 6).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-1">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => router.push(`/results/${result.resultId}`)}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      View full result
                    </Button>
                    {result.videoUrl && (
                      <Button size="sm" variant="outline" className="w-full" asChild>
                        <a href={result.videoUrl} target="_blank" rel="noopener noreferrer">
                          <Upload className="mr-2 h-4 w-4" />
                          Download video
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* What you get */}
            <Card className="border-border/60 bg-muted/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">What you get</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {[
                  `Script optimized for ${durationSeconds}s`,
                  `Up to ${SHORTS_MAX_SCENES} vertical scenes`,
                  'AI voiceover included',
                  'SEO title + hashtags',
                  'Thumbnail concept',
                  'Assembled 9:16 MP4',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Shorts tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="rounded-lg border border-border/60 bg-background px-3 py-2.5">
                  <p className="font-medium text-foreground">Hook in 3 seconds</p>
                  <p>Start with a bold statement or question to stop the scroll.</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background px-3 py-2.5">
                  <p className="font-medium text-foreground">60-second cap</p>
                  <p>Videos over 60s won't appear in the Shorts feed.</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background px-3 py-2.5">
                  <p className="font-medium text-foreground">Vertical first</p>
                  <p>9:16 is enforced automatically — no cropping needed.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
