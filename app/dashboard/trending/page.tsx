'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  TrendingUp, 
  Hash, 
  MessageCircle, 
  Repeat2, 
  Heart, 
  ArrowUpRight,
  RefreshCw,
  Sparkles,
  Clock
} from 'lucide-react'

interface TrendingTopic {
  id: string
  name: string
  category: string
  description: string
  tweetCount: number
  engagement: {
    retweets: number
    likes: number
    replies: number
  }
  hashtags: string[]
  topTweet: string
  timestamp: string
  url: string
}

export default function TrendingPage() {
  const router = useRouter()
  const [trends, setTrends] = useState<TrendingTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [refreshing, setRefreshing] = useState(false)

  const categories = [
    { id: 'all', label: 'All Topics' },
    { id: 'news', label: 'News' },
    { id: 'technology', label: 'Technology' },
    { id: 'entertainment', label: 'Entertainment' },
    { id: 'sports', label: 'Sports' },
    { id: 'business', label: 'Business' },
  ]

  const fetchTrends = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/x-trends?category=${selectedCategory}&limit=20`)
      const data = await response.json()
      
      if (data.success) {
        setTrends(data.trends)
      }
    } catch (error) {
      console.error('[Trending] Error fetching trends:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchTrends()
  }, [selectedCategory])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchTrends()
  }

  const handleCreateVideo = (trend: TrendingTopic) => {
    // Navigate to home with pre-filled topic
    const params = new URLSearchParams({
      topic: trend.name,
      description: trend.description,
      platform: 'youtube'
    })
    router.push(`/?${params.toString()}`)
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getTimeAgo = (timestamp: string): string => {
    const diff = Date.now() - new Date(timestamp).getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return 'Just now'
    if (hours === 1) return '1 hour ago'
    return `${hours} hours ago`
  }

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      news: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
      technology: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
      entertainment: 'bg-pink-500/10 text-pink-700 dark:text-pink-400',
      sports: 'bg-green-500/10 text-green-700 dark:text-green-400',
      business: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
      politics: 'bg-red-500/10 text-red-700 dark:text-red-400',
    }
    return colors[category] || 'bg-muted'
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">
                Trending on X
              </h1>
              <p className="text-muted-foreground text-lg">
                Discover trending topics to create viral video content
              </p>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              className="bg-transparent gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                size="sm"
                className={selectedCategory === cat.id ? '' : 'bg-transparent'}
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Trending List */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-6 w-2/3 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6" />
              </Card>
            ))}
          </div>
        ) : trends.length === 0 ? (
          <Card className="p-12 text-center">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No trends found</h3>
            <p className="text-muted-foreground">Try selecting a different category</p>
          </Card>
        ) : (
          <div className="space-y-px">
            {trends.map((trend, index) => (
              <Card 
                key={trend.id} 
                className="p-6 hover:bg-muted/50 transition-colors border-l-4 border-l-transparent hover:border-l-primary group"
              >
                <div className="flex items-start gap-6">
                  {/* Rank */}
                  <div className="flex-shrink-0 w-12 text-center">
                    <div className="text-3xl font-bold text-muted-foreground/30 group-hover:text-primary/50 transition-colors">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Category & Time */}
                    <div className="flex items-center gap-3 mb-3">
                      <Badge className={getCategoryColor(trend.category)}>
                        {trend.category}
                      </Badge>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        {getTimeAgo(trend.timestamp)}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                      {trend.name}
                    </h3>

                    {/* Description */}
                    <p className="text-muted-foreground leading-relaxed mb-4">
                      {trend.description}
                    </p>

                    {/* Top Tweet */}
                    <div className="bg-muted/50 border-l-2 border-primary/20 pl-4 py-3 mb-4 rounded-r">
                      <p className="text-sm text-foreground/80 italic">
                        "{trend.topTweet}"
                      </p>
                    </div>

                    {/* Hashtags */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {trend.hashtags.map((tag) => (
                        <Badge key={tag} variant="outline" className="gap-1 text-xs">
                          <Hash className="w-3 h-3" />
                          {tag.replace('#', '')}
                        </Badge>
                      ))}
                    </div>

                    {/* Engagement Metrics */}
                    <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        <span className="font-medium">{formatNumber(trend.tweetCount)}</span>
                        <span>posts</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Repeat2 className="w-4 h-4" />
                        <span className="font-medium">{formatNumber(trend.engagement.retweets)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4" />
                        <span className="font-medium">{formatNumber(trend.engagement.likes)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" />
                        <span className="font-medium">{formatNumber(trend.engagement.replies)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex-shrink-0 flex flex-col gap-2">
                    <Button
                      onClick={() => handleCreateVideo(trend)}
                      className="gap-2 bg-primary hover:bg-primary/90"
                    >
                      <Sparkles className="w-4 h-4" />
                      Create Video
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 bg-transparent"
                      onClick={() => window.open(trend.url, '_blank')}
                    >
                      View on X
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
