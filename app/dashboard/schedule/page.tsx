'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Video,
  Plus,
  Trash2,
  Edit,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'

interface ScheduledVideo {
  id: string
  title: string
  scheduled_for: string
  status: string
  result_id?: string
}

export default function SchedulePage() {
  const { user, loading: authLoading } = useAuth()
  const [scheduledVideos, setScheduledVideos] = useState<ScheduledVideo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && user) loadScheduledVideos()
  }, [user, authLoading])

  async function loadScheduledVideos() {
    try {
      const response = await fetch('/api/projects?status=scheduled')
      if (!response.ok) throw new Error('Failed to load scheduled videos')
      const payload = await response.json()
      setScheduledVideos(
        (payload.projects || []).map((project: {
          id: string
          title: string
          scheduled_for: string
          status: string
          results?: Array<{ id: string; created_at?: string }>
        }) => ({
          id: project.id,
          title: project.title,
          scheduled_for: project.scheduled_for,
          status: project.status,
          result_id: [...(project.results || [])].sort(
            (a, b) =>
              new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          )[0]?.id,
        }))
      )
    } catch (error) {
      console.error('Failed to load scheduled videos:', error)
    } finally {
      setLoading(false)
    }
  }

  async function cancelSchedule(videoId: string) {
    try {
      const response = await fetch(`/api/projects/${videoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft', scheduled_for: null }),
      })
      if (!response.ok) throw new Error('Failed to cancel schedule')

      setScheduledVideos((prev) => prev.filter((v) => v.id !== videoId))
    } catch (error) {
      console.error('Failed to cancel schedule:', error)
    }
  }

  function formatScheduleDate(dateString: string) {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
    }
  }

  // Group videos by date
  const groupedVideos = scheduledVideos.reduce(
    (acc, video) => {
      const dateKey = new Date(video.scheduled_for).toDateString()
      if (!acc[dateKey]) {
        acc[dateKey] = []
      }
      acc[dateKey].push(video)
      return acc
    },
    {} as Record<string, ScheduledVideo[]>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Schedule</h1>
                <p className="text-muted-foreground text-sm">
                  Manage your video upload schedule
                </p>
              </div>
            </div>
            <Link href="/">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Video
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Schedule Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{scheduledVideos.length}</p>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <Clock className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">YouTube</p>
                  <p className="text-sm text-muted-foreground">Publishing destination</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-500/10">
                  <Video className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{scheduledVideos.length > 0 ? 'Ready' : 'Idle'}</p>
                  <p className="text-sm text-muted-foreground">Schedule status</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scheduled Videos */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Uploads</CardTitle>
            <CardDescription>
              Videos scheduled for automatic upload to YouTube
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : scheduledVideos.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No videos scheduled</p>
                <Link href="/">
                  <Button variant="outline" className="bg-transparent">
                    Create a video to schedule
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedVideos).map(([dateKey, videos]) => (
                  <div key={dateKey}>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      {new Date(dateKey).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </h3>
                    <div className="space-y-2">
                      {videos.map((video) => {
                        const { date, time } = formatScheduleDate(video.scheduled_for)
                        return (
                          <div
                            key={video.id}
                            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-card/50 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <div className="p-2 rounded-lg bg-muted">
                                <Clock className="w-5 h-5 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium">{video.title}</p>
                                <p className="text-sm text-muted-foreground">
                                  {time}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">Scheduled</Badge>
                              <Link href={video.result_id ? `/results/${video.result_id}` : '/'}>
                                <Button variant="ghost" size="sm">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => cancelSchedule(video.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
