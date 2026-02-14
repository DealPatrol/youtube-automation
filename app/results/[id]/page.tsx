'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Copy, Download, ArrowLeft } from 'lucide-react'

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [copied, setCopied] = useState(false)

  const videoData = {
    id,
    topic: 'How to Learn Python Programming',
    platform: 'YouTube',
    status: 'completed',
    script: `# Video Script: How to Learn Python Programming

## INTRO (0:00-0:15)
"Hey everyone! If you want to learn Python but don't know where to start, you're in the right place. In this video, I'm breaking down the best way to learn Python from zero to hero."

## SECTION 1: Why Python? (0:15-1:00)
"First, let's talk about why Python is so popular. Python is easy to read, has a massive community, and you can build anything with it - web apps, data science, AI, automation."

## SECTION 2: Setup (1:00-2:00)
"To get started, you'll need to install Python from python.org, then get a code editor. I recommend VS Code because it's free and powerful."

## SECTION 3: Fundamentals (2:00-4:00)
"Let's start with the basics: variables, data types, and functions. These are the building blocks of every program you'll write."

## OUTRO (9:45-10:00)
"Thanks for watching! If you found this helpful, smash that subscribe button. What's your favorite Python feature? Let me know in the comments!"`,
    seoData: {
      title: 'How to Learn Python Programming - Complete Beginner Guide',
      description: 'Learn Python from scratch with this comprehensive beginner-friendly guide. Perfect for anyone wanting to start coding.',
      tags: ['python', 'programming', 'tutorial', 'beginner', 'coding', 'learn to code'],
    },
    scenes: [
      {
        number: 1,
        title: 'Intro - Hook & Welcome',
        duration: '0:00-0:15',
        description: 'Engaging intro with eye contact to camera, energetic delivery',
      },
      {
        number: 2,
        title: 'Why Python',
        duration: '0:15-1:00',
        description: 'Show Python logo, mention use cases with B-roll',
      },
      {
        number: 3,
        title: 'Setup Instructions',
        duration: '1:00-2:00',
        description: 'Screen recording of installation process',
      },
      {
        number: 4,
        title: 'Code Along',
        duration: '2:00-9:45',
        description: 'Screen recording with code examples and explanations',
      },
      {
        number: 5,
        title: 'Outro',
        duration: '9:45-10:00',
        description: 'Call to action - subscribe, comment, like',
      },
    ],
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Back Button */}
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        {/* Header */}
        <div className="mb-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">{videoData.topic}</h1>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-secondary/20 text-secondary text-sm font-medium">
                  {videoData.platform}
                </span>
                <span className="text-sm text-muted-foreground">ID: {videoData.id}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                Edit
              </Button>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          {/* Script Section */}
          <Card className="border-border bg-card p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Video Script</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(videoData.script)}
              >
                <Copy className="w-4 h-4 mr-2" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="bg-input rounded-lg p-6 whitespace-pre-wrap font-mono text-sm leading-relaxed overflow-auto max-h-96">
              {videoData.script}
            </div>
          </Card>

          {/* Scenes */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Scene Breakdown</h2>
            <div className="space-y-4">
              {videoData.scenes.map((scene) => (
                <Card key={scene.number} className="border-border bg-card p-6 hover:border-accent/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold px-2 py-1 rounded-full bg-secondary/20 text-secondary">
                          Scene {scene.number}
                        </span>
                        <span className="text-xs text-muted-foreground">{scene.duration}</span>
                      </div>
                      <h3 className="text-lg font-semibold mb-1">{scene.title}</h3>
                      <p className="text-muted-foreground">{scene.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* SEO Data */}
          <div>
            <h2 className="text-2xl font-bold mb-6">SEO Optimization</h2>
            <Card className="border-border bg-card p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-2">Title</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={videoData.seoData.title}
                    readOnly
                    className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(videoData.seoData.title)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Description</label>
                <div className="flex gap-2">
                  <textarea
                    value={videoData.seoData.description}
                    readOnly
                    className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground resize-none"
                    rows={3}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(videoData.seoData.description)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {videoData.seoData.tags.map((tag, idx) => (
                    <span key={idx} className="px-3 py-1 rounded-full bg-accent/20 text-accent text-sm font-medium">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
