'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

interface ScheduledVideo {
  id: string
  title: string
  scheduled_for: string
  status: string
}

export default function SchedulePage() {
  const [scheduledVideos, setScheduledVideos] = useState<ScheduledVideo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadScheduledVideos()
  }, [])

  async function loadScheduledVideos() {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('projects')
          .select('id, title, scheduled_for, status')
          .eq('status', 'scheduled')
          .order('scheduled_for', { ascending: true })

        if (error) throw error
        setScheduledVideos(data || [])
      }
    } catch (error) {
      console.error('Failed to load scheduled videos:', error)
    } finally {
      setLoading(false)
    }
  }

  async function cancelSchedule(videoId: string) {
    if (!supabase) return

    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'draft', scheduled_for: null })
        .eq('id', videoId)

      if (error) throw error

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
                  <p className="text-2xl font-bold">Every 6h</p>
                  <p className="text-sm text-muted-foreground">Upload Frequency</p>
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
                  <p className="text-2xl font-bold">Auto</p>
                  <p className="text-sm text-muted-foreground">Posting Enabled</p>
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
                              <Link href={`/results/${video.id}`}>
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
