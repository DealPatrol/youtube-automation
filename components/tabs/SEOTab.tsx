'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Copy, Check } from 'lucide-react'

interface SEOData {
  title?: string
  description?: string
  tags?: string[]
  keywords?: string[]
  hashtags?: string[]
  thumbnail_tips?: string
  pinned_comment?: string
}

interface SEOTabProps {
  seo: SEOData
}

export default function SEOTab({ seo }: SEOTabProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const title = seo.title || ''
  const description = seo.description || ''
  const tags = seo.tags || []
  const hashtags = seo.hashtags || []
  const pinnedComment = seo.pinned_comment || ''

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SEO & Metadata</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Optimize your video for discovery
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Title */}
        {title && (
          <div>
            <label className="text-sm font-medium">Video Title</label>
            <div className="flex gap-2 mt-2">
              <div className="flex-1 p-3 rounded-lg border border-border bg-card/50 break-words">
                <p className="text-sm">{title}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(title, 'title')}
                className="bg-transparent flex-shrink-0"
              >
                {copied === 'title' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Character count: {title.length}/60
            </p>
          </div>
        )}

        {/* Description */}
        {description && (
          <div>
            <label className="text-sm font-medium">Video Description</label>
            <div className="flex gap-2 mt-2">
              <div className="flex-1 p-3 rounded-lg border border-border bg-card/50 break-words">
                <p className="text-sm whitespace-pre-wrap">{description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(description, 'description')}
                className="bg-transparent flex-shrink-0"
              >
                {copied === 'description' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Character count: {description.length}/5000
            </p>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div>
            <label className="text-sm font-medium">Tags</label>
            <div className="flex gap-2 mt-2">
              <div className="flex-1 p-3 rounded-lg border border-border bg-card/50 break-words">
                <p className="text-sm">{tags.join(', ')}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(tags.join(', '), 'tags')}
                className="bg-transparent flex-shrink-0"
              >
                {copied === 'tags' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Keywords */}
        {seo.keywords && seo.keywords.length > 0 && (
          <div>
            <label className="text-sm font-medium">Keywords</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {seo.keywords.map((keyword, idx) => (
                <div
                  key={idx}
                  className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs"
                >
                  {keyword}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div>
            <label className="text-sm font-medium">Hashtags</label>
            <div className="flex gap-2 mt-2">
              <div className="flex-1 p-3 rounded-lg border border-border bg-card/50 break-words">
                <p className="text-sm">{hashtags.join(' ')}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(hashtags.join(' '), 'hashtags')}
                className="bg-transparent flex-shrink-0"
              >
                {copied === 'hashtags' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Pinned Comment */}
        {pinnedComment && (
          <div>
            <label className="text-sm font-medium">Pinned Comment</label>
            <div className="flex gap-2 mt-2">
              <div className="flex-1 p-3 rounded-lg border border-border bg-card/50 break-words">
                <p className="text-sm whitespace-pre-wrap">{pinnedComment}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(pinnedComment, 'pinned')}
                className="bg-transparent flex-shrink-0"
              >
                {copied === 'pinned' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Thumbnail Tips */}
        {seo.thumbnail_tips && (
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-2">
              Thumbnail Tips
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
              {seo.thumbnail_tips}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
