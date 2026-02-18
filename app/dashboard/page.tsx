'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  Clock,
  BarChart3,
  Calendar,
  Settings,
  TrendingUp,
  Zap,
  CheckCircle,
  CheckCircle2,
  Youtube,
  CreditCard,
  Upload,
  PlayCircle,
  PauseCircle,
  Loader2,
  Search,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

interface Project {
  id: string
  title: string
  platform?: string
  status?: 'completed' | 'processing' | 'draft' | 'published' | 'scheduled'
  date?: string
  topic?: string
  created_at?: string
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
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
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
    plan: 'pro',
    videosUsed: 0,
    videosLimit: 50,
    autoPostingEnabled: true,
    multiChannelEnabled: false,
  })
  const [autoPostingActive, setAutoPostingActive] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
      return
    }
    if (user) {
      loadDashboardData()
    }
  }, [user, authLoading, router])

  async function loadDashboardData() {
    try {
      // Load projects from Supabase
      if (supabase && user) {
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.uid)
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
      completed: { variant: 'default', icon: CheckCircle },
      processing: { variant: 'secondary', icon: Zap },
    }
    const { variant, icon: Icon } = variants[status || 'draft'] || variants.draft
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Draft'}
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Error Alert */}
        {error && (
          <Card className="border-destructive bg-destructive/10 p-4 mb-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <p className="font-medium">{error}</p>
            </div>
          </Card>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Manage and view all your generated videos</p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground h-10">
            <Link href="/">
              <Plus className="w-4 h-4 mr-2" />
              New Video
            </Link>
          </Button>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search videos..."
              className="w-full pl-10 pr-4 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="border-border bg-card p-6">
            <p className="text-sm text-muted-foreground mb-2">Total Videos</p>
            <p className="text-3xl font-bold">{stats.videosCreated}</p>
          </Card>
          <Card className="border-border bg-card p-6">
            <p className="text-sm text-muted-foreground mb-2">Published</p>
            <p className="text-3xl font-bold">{stats.videosPublished}</p>
          </Card>
          <Card className="border-border bg-card p-6">
            <p className="text-sm text-muted-foreground mb-2">Scheduled</p>
            <p className="text-3xl font-bold">{stats.scheduledVideos}</p>
          </Card>
        </div>

        {/* Recent Projects */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Recent Videos</h2>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-border bg-card p-6">
                  <Skeleton className="h-20 w-full" />
                </Card>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <Card className="border-border bg-card p-12 text-center">
              <Video className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No videos yet</h3>
              <p className="text-muted-foreground mb-6">Create your first video to get started</p>
              <Button asChild>
                <Link href="/">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Video
                </Link>
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => (
              <Card key={project.id} className="border-border bg-card p-6 hover:border-accent/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{project.title}</h3>
                      <span className="px-2 py-1 rounded-full bg-secondary/20 text-secondary text-xs font-medium">
                        {project.platform}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {project.created_at ? formatDate(project.created_at) : 'Unknown'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {project.status === 'completed' && (
                      <CheckCircle2 className="w-5 h-5 text-accent" />
                    )}
                    {project.status === 'processing' && (
                      <AlertCircle className="w-5 h-5 text-yellow-500 animate-pulse" />
                    )}
                    <Button variant="outline" asChild>
                      <Link href={`/results/${project.id}`}>View</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          )}
        </div>
      </div>
    </main>
  )
}
