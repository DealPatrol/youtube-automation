'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Copy, Download } from 'lucide-react'

interface ScriptTabProps {
  script: {
    title: string
    duration: number
    content: string
    sections: Array<{
      time: string
      speaker: string
      text: string
    }>
  }
}

export default function ScriptTab({ script }: ScriptTabProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(formatScript())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const element = document.createElement('a')
    element.setAttribute(
      'href',
      'data:text/plain;charset=utf-8,' + encodeURIComponent(formatScript())
    )
    element.setAttribute('download', `${script.title}.txt`)
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const formatScript = () => {
    return `${script.title}
Duration: ${script.duration} minutes

${script.content}

${script.sections.map((s) => `[${s.time}] ${s.speaker}: ${s.text}`).join('\n\n')}`
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{script.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {script.duration} minutes • {script.sections.length} sections
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="bg-transparent"
            >
              <Copy className="w-4 h-4 mr-2" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} className="bg-transparent">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="prose prose-sm max-w-none">
          <p className="text-muted-foreground whitespace-pre-wrap">{script.content}</p>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold">Script Breakdown</h4>
          {script.sections.map((section, idx) => (
            <div key={idx} className="p-4 border border-border rounded-lg bg-card/50">
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-medium text-primary">[{section.time}]</span>
                <span className="text-sm font-medium text-muted-foreground">{section.speaker}</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{section.text}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
