'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import {
  AlertCircle,
  Plus,
  Video,
  Calendar,
  TrendingUp,
  Zap,
  Clock,
  CheckCircle,
  Youtube,
  Settings,
  CreditCard,
  BarChart3,
  Upload,
  PlayCircle,
  PauseCircle,
} from 'lucide-react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

interface Project {
  id: string
  title: string
  topic: string
  created_at: string
  status: 'draft' | 'rendering' | 'scheduled' | 'published'
  scheduled_for?: string
  video_url?: string
  views?: number
}

interface UserStats {
  videosCreated: number
  videosPublished: number
  totalViews: number
  scheduledVideos: number
}

interface PlanLimits {
  plan: 'free' | 'pro' | 'enterprise'
  videosUsed: number
  videosLimit: number
  autoPostingEnabled: boolean
  multiChannelEnabled: boolean
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<UserStats>({
    videosCreated: 0,
    videosPublished: 0,
    totalViews: 0,
    scheduledVideos: 0,
  })
  const [planLimits, setPlanLimits] = useState<PlanLimits>({
    plan: 'free',
    videosUsed: 0,
    videosLimit: 5,
    autoPostingEnabled: false,
    multiChannelEnabled: false,
  })
  const [autoPostingActive, setAutoPostingActive] = useState(false)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    try {
      // Load projects from Supabase
      if (supabase) {
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10)

        if (projectsError) throw projectsError

        setProjects(
          projectsData?.map((p) => ({
            id: p.id,
            title: p.title || p.topic,
            topic: p.topic,
            created_at: p.created_at,
            status: p.status || 'draft',
            scheduled_for: p.scheduled_for,
            video_url: p.video_url,
            views: p.views || 0,
          })) || []
        )

        // Calculate stats
        const created = projectsData?.length || 0
        const published = projectsData?.filter((p) => p.status === 'published').length || 0
        const scheduled = projectsData?.filter((p) => p.status === 'scheduled').length || 0
        const views = projectsData?.reduce((sum, p) => sum + (p.views || 0), 0) || 0

        setStats({
          videosCreated: created,
          videosPublished: published,
          totalViews: views,
          scheduledVideos: scheduled,
        })
      }

      // Load plan limits
      const billingRes = await fetch('/api/billing')
      if (billingRes.ok) {
        const billingData = await billingRes.json()
        setPlanLimits(billingData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  async function toggleAutoPosting() {
    setAutoPostingActive(!autoPostingActive)
    // In production, this would update user preferences in the database
  }

  function getStatusBadge(status: Project['status']) {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'outline'; icon: any }> = {
      draft: { variant: 'outline', icon: Clock },
      rendering: { variant: 'secondary', icon: Zap },
      scheduled: { variant: 'default', icon: Calendar },
      published: { variant: 'default', icon: CheckCircle },
    }
    const { variant, icon: Icon } = variants[status] || variants.draft
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  function formatDate(dateString: string) {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return 'Unknown'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground mt-1">Manage your YouTube automation</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/settings">
                <Button variant="outline" size="sm" className="bg-transparent">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </Link>
              <Link href="/">
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  New Video
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <Card className="border-destructive/50 bg-destructive/5 mb-6">
            <CardContent className="flex items-center gap-2 pt-6">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Videos Created</p>
                  <p className="text-3xl font-bold">{stats.videosCreated}</p>
                </div>
                <div className="p-3 rounded-full bg-primary/10">
                  <Video className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Published</p>
                  <p className="text-3xl font-bold">{stats.videosPublished}</p>
                </div>
                <div className="p-3 rounded-full bg-green-500/10">
                  <Youtube className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Views</p>
                  <p className="text-3xl font-bold">
                    {stats.totalViews.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-blue-500/10">
                  <TrendingUp className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="text-3xl font-bold">{stats.scheduledVideos}</p>
                </div>
                <div className="p-3 rounded-full bg-orange-500/10">
                  <Calendar className="w-6 h-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Projects */}
          <div className="lg:col-span-2 space-y-6">
            {/* Auto Posting Card */}
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-primary/20">
                      {autoPostingActive ? (
                        <PlayCircle className="w-6 h-6 text-primary" />
                      ) : (
                        <PauseCircle className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold">Auto Posting</h3>
                      <p className="text-sm text-muted-foreground">
                        Automatically upload videos to YouTube on schedule
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={autoPostingActive}
                    onCheckedChange={toggleAutoPosting}
                    disabled={planLimits.plan === 'free'}
                  />
                </div>
                {planLimits.plan === 'free' && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Upgrade to Pro to enable auto posting
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Projects List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Recent Videos</h2>
                <Link href="/dashboard/videos">
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="pt-6">
                        <Skeleton className="h-20 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="pt-12 pb-12 text-center">
                    <Video className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">No videos yet</p>
                    <Link href="/">
                      <Button>Create Your First Video</Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <Link key={project.id} href={`/results/${project.id}`}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium truncate">
                                  {project.title}
                                </h3>
                                {getStatusBadge(project.status)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(project.created_at)}
                                {project.views ? ` • ${project.views.toLocaleString()} views` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              {project.status === 'draft' && (
                                <Button size="sm" variant="outline" className="bg-transparent">
                                  <Upload className="w-4 h-4 mr-1" />
                                  Render
                                </Button>
                              )}
                              {project.status === 'rendering' && (
                                <div className="flex items-center gap-2">
                                  <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />
                                  <span className="text-sm">Rendering...</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Usage Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Usage</CardTitle>
                <CardDescription>
                  {planLimits.plan.charAt(0).toUpperCase() + planLimits.plan.slice(1)} Plan
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Videos this month</span>
                    <span className="font-medium">
                      {planLimits.videosUsed} / {planLimits.videosLimit}
                    </span>
                  </div>
                  <Progress
                    value={(planLimits.videosUsed / planLimits.videosLimit) * 100}
                    className="h-2"
                  />
                </div>

                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Auto Posting</span>
                    {planLimits.autoPostingEnabled ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <span className="text-muted-foreground">Pro</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Multi-Channel</span>
                    {planLimits.multiChannelEnabled ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <span className="text-muted-foreground">Enterprise</span>
                    )}
                  </div>
                </div>

                {planLimits.plan === 'free' && (
                  <Link href="/pricing" className="block">
                    <Button className="w-full mt-2">
                      <CreditCard className="w-4 h-4 mr-2" />
                      Upgrade to Pro
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/" className="block">
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Video
                  </Button>
                </Link>
                <Link href="/dashboard/schedule" className="block">
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule Videos
                  </Button>
                </Link>
                <Link href="/dashboard/analytics" className="block">
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    View Analytics
                  </Button>
                </Link>
                <Link href="/dashboard/channels" className="block">
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <Youtube className="w-4 h-4 mr-2" />
                    Manage Channels
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
