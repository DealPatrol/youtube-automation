'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Plus, Search, Clock, CheckCircle2, AlertCircle } from 'lucide-react'

interface Project {
  id: string
  title: string
  platform: string
  status: 'completed' | 'processing'
  date: string
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([
    {
      id: '1',
      title: 'How to Learn Python',
      platform: 'YouTube',
      status: 'completed',
      date: '2 days ago',
    },
    {
      id: '2',
      title: 'Web Development Basics',
      platform: 'TikTok',
      status: 'processing',
      date: '1 hour ago',
    },
    {
      id: '3',
      title: 'AI for Beginners',
      platform: 'YouTube',
      status: 'completed',
      date: '5 days ago',
    },
  ])

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-12">
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
            <p className="text-3xl font-bold">{projects.length}</p>
          </Card>
          <Card className="border-border bg-card p-6">
            <p className="text-sm text-muted-foreground mb-2">This Month</p>
            <p className="text-3xl font-bold">{projects.filter(p => p.date.includes('ago')).length}</p>
          </Card>
          <Card className="border-border bg-card p-6">
            <p className="text-sm text-muted-foreground mb-2">Processing</p>
            <p className="text-3xl font-bold">{projects.filter(p => p.status === 'processing').length}</p>
          </Card>
        </div>

        {/* Recent Projects */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Recent Videos</h2>
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
                      {project.date}
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
        </div>
      </div>
    </main>
  )
}
