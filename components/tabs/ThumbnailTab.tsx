'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ThumbnailData {
  design_description: string
  color_palette: string[]
  text_suggestions: string[]
  layout_tips: string
  accessibility_notes: string
}

interface ThumbnailTabProps {
  thumbnail: ThumbnailData
}

export default function ThumbnailTab({ thumbnail }: ThumbnailTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Thumbnail Design Guide</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Professional thumbnail specifications and design recommendations
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Design Description */}
        <div>
          <h4 className="font-semibold mb-2">Design Concept</h4>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {thumbnail.design_description}
          </p>
        </div>

        {/* Color Palette */}
        <div>
          <h4 className="font-semibold mb-3">Recommended Colors</h4>
          <div className="flex flex-wrap gap-3">
            {thumbnail.color_palette.map((color, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div
                  className="w-12 h-12 rounded-lg border border-border shadow-sm"
                  style={{ backgroundColor: color }}
                  title={color}
                />
                <span className="text-sm font-mono text-muted-foreground">{color}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Text Suggestions */}
        <div>
          <h4 className="font-semibold mb-3">Text & Typography</h4>
          <div className="space-y-2">
            {thumbnail.text_suggestions.map((suggestion, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-border bg-card/50">
                <p className="text-sm">{suggestion}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Layout Tips */}
        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
          <p className="text-sm font-medium text-green-900 dark:text-green-200 mb-2">
            📐 Layout & Composition
          </p>
          <p className="text-sm text-green-800 dark:text-green-300 leading-relaxed">
            {thumbnail.layout_tips}
          </p>
        </div>

        {/* Specifications */}
        <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
          <p className="text-sm font-medium text-purple-900 dark:text-purple-200 mb-3">
            ✓ Technical Specs
          </p>
          <div className="space-y-2 text-sm text-purple-800 dark:text-purple-300">
            <div className="flex justify-between">
              <span>Recommended Size:</span>
              <Badge variant="secondary">1280 x 720 px</Badge>
            </div>
            <div className="flex justify-between">
              <span>Aspect Ratio:</span>
              <Badge variant="secondary">16:9</Badge>
            </div>
            <div className="flex justify-between">
              <span>File Format:</span>
              <Badge variant="secondary">JPG, PNG</Badge>
            </div>
            <div className="flex justify-between">
              <span>Max File Size:</span>
              <Badge variant="secondary">2 MB</Badge>
            </div>
          </div>
        </div>

        {/* Accessibility */}
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
            ♿ Accessibility Notes
          </p>
          <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
            {thumbnail.accessibility_notes}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
