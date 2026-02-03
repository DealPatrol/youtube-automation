'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { 
  ArrowLeft, 
  Youtube, 
  Plus, 
  Trash2, 
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Settings,
  ExternalLink
} from 'lucide-react'

interface Channel {
  id: string
  name: string
  platform: 'youtube' | 'tiktok' | 'instagram'
  connected: boolean
  autoPost: boolean
  subscriberCount?: number
  lastUpload?: string
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    loadChannels()
  }, [])

  async function loadChannels() {
    setLoading(true)
    try {
      // In production, fetch from API
      // For now, show empty state or mock data
      setChannels([])
    } catch (error) {
      console.error('Failed to load channels:', error)
    } finally {
      setLoading(false)
    }
  }

  async function connectYouTube() {
    setConnecting(true)
    try {
      // Redirect to YouTube OAuth
      window.location.href = '/api/auth/youtube'
    } catch (error) {
      console.error('Failed to connect YouTube:', error)
      setConnecting(false)
    }
  }

  async function disconnectChannel(channelId: string) {
    if (!confirm('Are you sure you want to disconnect this channel?')) return
    
    setChannels(channels.filter(c => c.id !== channelId))
  }

  async function toggleAutoPost(channelId: string, enabled: boolean) {
    setChannels(channels.map(c => 
      c.id === channelId ? { ...c, autoPost: enabled } : c
    ))
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'youtube':
        return <Youtube className="w-5 h-5 text-red-500" />
      default:
        return <Youtube className="w-5 h-5" />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard">
            <Button variant="outline" size="icon" className="bg-transparent">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Manage Channels</h1>
            <p className="text-muted-foreground">Connect and manage your social media channels</p>
          </div>
        </div>

        {/* Connect New Channel */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Connect a Channel
            </CardTitle>
            <CardDescription>
              Link your social media accounts to enable direct video uploads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="h-20 flex flex-col gap-2 bg-transparent hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-950"
                onClick={connectYouTube}
                disabled={connecting}
              >
                <Youtube className="w-8 h-8 text-red-500" />
                <span>{connecting ? 'Connecting...' : 'YouTube'}</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex flex-col gap-2 bg-transparent opacity-50 cursor-not-allowed"
                disabled
              >
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
                <span>TikTok (Soon)</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex flex-col gap-2 bg-transparent opacity-50 cursor-not-allowed"
                disabled
              >
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
                </svg>
                <span>Instagram (Soon)</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Connected Channels */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Connected Channels</CardTitle>
                <CardDescription>
                  {channels.length === 0 
                    ? 'No channels connected yet' 
                    : `${channels.length} channel${channels.length > 1 ? 's' : ''} connected`}
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadChannels}
                className="bg-transparent"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : channels.length === 0 ? (
              <div className="text-center py-12">
                <Youtube className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No channels connected</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect a YouTube channel to start uploading videos directly
                </p>
                <Button onClick={connectYouTube} disabled={connecting}>
                  <Youtube className="w-4 h-4 mr-2" />
                  Connect YouTube
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {channels.map((channel) => (
                  <div 
                    key={channel.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      {getPlatformIcon(channel.platform)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{channel.name}</span>
                          {channel.connected ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Disconnected
                            </Badge>
                          )}
                        </div>
                        {channel.subscriberCount && (
                          <span className="text-sm text-muted-foreground">
                            {channel.subscriberCount.toLocaleString()} subscribers
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`autopost-${channel.id}`} className="text-sm">
                          Auto-post
                        </Label>
                        <Switch
                          id={`autopost-${channel.id}`}
                          checked={channel.autoPost}
                          onCheckedChange={(checked) => toggleAutoPost(channel.id, checked)}
                        />
                      </div>
                      <Button 
                        variant="outline" 
                        size="icon"
                        className="bg-transparent text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => disconnectChannel(channel.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Channel Settings Help
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-1">Auto-post</h4>
              <p className="text-sm text-muted-foreground">
                When enabled, generated videos will automatically be uploaded to this channel after rendering.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">YouTube Setup</h4>
              <p className="text-sm text-muted-foreground">
                Make sure you have YouTube API credentials configured. Videos are uploaded as unlisted by default.
              </p>
            </div>
            <div className="pt-2">
              <a 
                href="https://console.cloud.google.com/apis/credentials" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                Manage YouTube API credentials
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
