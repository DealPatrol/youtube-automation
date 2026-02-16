'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart3, Calendar, Maximize, Play, TrendingUp, Users, Eye, Heart } from 'lucide-react'

export default function AnalyticsPage() {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)

  const videos = [
    {
      id: '1',
      title: 'How To Start A Faceless YouTube Channel',
      thumbnail: 'https://via.placeholder.com/200x112?text=Faceless+YouTube',
      uploadedDate: '2 days ago',
      views: 1250,
      likes: 89,
      comments: 23,
      shares: 12,
      avgWatchTime: '4:32',
      clickThroughRate: 3.2,
      status: 'published',
    },
    {
      id: '2',
      title: 'AI Tools That Changed My Life',
      thumbnail: 'https://via.placeholder.com/200x112?text=AI+Tools',
      uploadedDate: 'scheduled for 2 days',
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      avgWatchTime: '0:00',
      clickThroughRate: 0,
      status: 'scheduled',
    },
    {
      id: '3',
      title: 'Top 5 Stock Footage Websites',
      thumbnail: 'https://via.placeholder.com/200x112?text=Stock+Footage',
      uploadedDate: '1 day ago',
      views: 523,
      likes: 34,
      comments: 8,
      shares: 5,
      avgWatchTime: '3:15',
      clickThroughRate: 2.1,
      status: 'published',
    },
  ]

  const totalStats = {
    totalViews: 1773,
    totalLikes: 123,
    totalComments: 31,
    totalShares: 17,
    avgEngagementRate: 2.7,
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">YouTube Analytics</h1>
          <p className="text-muted-foreground">Track performance across all your published videos</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Views</p>
                  <p className="text-3xl font-bold">{totalStats.totalViews.toLocaleString()}</p>
                </div>
                <Eye className="w-8 h-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Likes</p>
                  <p className="text-3xl font-bold">{totalStats.totalLikes}</p>
                </div>
                <Heart className="w-8 h-8 text-destructive opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Comments</p>
                  <p className="text-3xl font-bold">{totalStats.totalComments}</p>
                </div>
                <Play className="w-8 h-8 text-accent opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Shares</p>
                  <p className="text-3xl font-bold">{totalStats.totalShares}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-secondary opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Engagement Rate</p>
                  <p className="text-3xl font-bold">{totalStats.avgEngagementRate}%</p>
                </div>
                <BarChart3 className="w-8 h-8 text-accent opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Videos Table */}
        <Card>
          <CardHeader>
            <CardTitle>Your Videos</CardTitle>
            <CardDescription>Performance metrics for each published video</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedVideo(video.id)}
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    <div className="w-32 h-18 bg-muted rounded-lg overflow-hidden">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg mb-1 truncate">{video.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {video.uploadedDate}
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        <span>{video.views.toLocaleString()} views</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="w-4 h-4" />
                        <span>{video.likes} likes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>{video.comments} comments</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex-shrink-0">
                    <Badge
                      variant={
                        video.status === 'published'
                          ? 'default'
                          : video.status === 'scheduled'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {video.status.charAt(0).toUpperCase() + video.status.slice(1)}
                    </Badge>
                  </div>

                  {/* Stats */}
                  <div className="flex-shrink-0 text-right">
                    <p className="font-semibold">{video.avgWatchTime}</p>
                    <p className="text-xs text-muted-foreground">avg watch time</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Selected Video Details */}
        {selectedVideo && (
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Video Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {videos.map((video) => {
                    if (video.id !== selectedVideo) return null
                    return (
                      <>
                        <div key="views">
                          <p className="text-sm text-muted-foreground mb-1">Views</p>
                          <p className="text-2xl font-bold">{video.views.toLocaleString()}</p>
                        </div>
                        <div key="likes">
                          <p className="text-sm text-muted-foreground mb-1">Likes</p>
                          <p className="text-2xl font-bold">{video.likes}</p>
                        </div>
                        <div key="comments">
                          <p className="text-sm text-muted-foreground mb-1">Comments</p>
                          <p className="text-2xl font-bold">{video.comments}</p>
                        </div>
                        <div key="ctr">
                          <p className="text-sm text-muted-foreground mb-1">CTR</p>
                          <p className="text-2xl font-bold">{video.clickThroughRate}%</p>
                        </div>
                      </>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
