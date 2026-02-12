'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Scene {
  id: number
  title: string
  start_time?: string
  end_time?: string
  visual_description?: string
  on_screen_text?: string
  duration?: string
  description?: string
  assets?: string[]
  camera_movements?: string
  audio_notes?: string
}

interface ScenesTabProps {
  scenes: Scene[]
}

export default function ScenesTab({ scenes }: ScenesTabProps) {
  if (!scenes || scenes.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">No scene data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scene Breakdown</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">{scenes.length} scenes total</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {scenes.map((scene) => (
            <div key={scene.id} className="border border-border rounded-lg p-4 hover:bg-card/50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold">Scene {scene.id}: {scene.title}</h4>
                  {(scene.start_time || scene.duration) && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {scene.start_time && scene.end_time ? `${scene.start_time} - ${scene.end_time}` : scene.duration}
                    </p>
                  )}
                </div>
                <Badge variant="secondary">{scene.id}</Badge>
              </div>

              {(scene.visual_description || scene.description) && (
                <p className="text-sm text-foreground mb-4 leading-relaxed">
                  {scene.visual_description || scene.description}
                </p>
              )}

              {scene.on_screen_text && (
                <div className="mb-3 p-3 bg-muted rounded-md">
                  <p className="text-xs font-medium text-muted-foreground mb-1">On-Screen Text:</p>
                  <p className="text-sm text-foreground">{scene.on_screen_text}</p>
                </div>
              )}

              {scene.assets && scene.assets.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Assets Required:</p>
                  <div className="flex flex-wrap gap-2">
                    {scene.assets.map((asset, idx) => (
                      <Badge key={idx} variant="outline">
                        {asset}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {(scene.camera_movements || scene.audio_notes) && (
                <div className="space-y-2 text-sm border-t border-border pt-3">
                  {scene.camera_movements && (
                    <div>
                      <p className="font-medium text-muted-foreground">Camera:</p>
                      <p className="text-foreground">{scene.camera_movements}</p>
                    </div>
                  )}
                  {scene.audio_notes && (
                    <div>
                      <p className="font-medium text-muted-foreground">Audio:</p>
                      <p className="text-foreground">{scene.audio_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
