'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/lib/auth/auth-context'

interface ProjectRow {
  id: string
  title?: string
  topic: string
  platform?: string
  video_length_minutes?: number | string
  status?: string
  created_at: string
  results?: Array<{ id: string; video_url?: string; processing_status?: string; created_at?: string }>
}

function formatLength(minutes: number | string | undefined): string {
  const value = Number(minutes)
  if (!Number.isFinite(value) || value <= 0) return ''
  return value <= 3 ? `${Math.round(value * 60)}s` : `${value} min`
}

export default function AllVideosPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
      return
    }
    if (!user) return
    let active = true
    fetch('/api/projects?limit=100')
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load videos')
        const payload = await response.json()
        if (active) setProjects(payload.projects || [])
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load videos')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user, authLoading, router])

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">All videos</h1>
          </div>
          <Button size="sm" asChild>
            <Link href="/#generator">
              <Plus className="mr-2 h-4 w-4" />
              New video
            </Link>
          </Button>
        </div>

        {loading || authLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No videos yet. Start one from the generator.</p>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const latest = [...(project.results || [])].sort(
                (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
              )[0]
              return (
                <Link key={project.id} href={latest ? `/results/${latest.id}` : '/#generator'}>
                  <Card className="cursor-pointer transition-shadow hover:shadow-md">
                    <CardContent className="flex items-center justify-between gap-4 py-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{project.title || project.topic}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(project.created_at).toLocaleDateString()}
                          {project.platform ? ` · ${project.platform}` : ''}
                          {formatLength(project.video_length_minutes)
                            ? ` · ${formatLength(project.video_length_minutes)}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {latest?.video_url ? <Badge>Video ready</Badge> : null}
                        <Badge variant="outline">{latest?.processing_status || project.status || 'draft'}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
