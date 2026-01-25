'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Scene {
  id: number
  title: string
  duration: string
  description: string
  assets: string[]
  camera_movements: string
  audio_notes: string
}

interface ScenesTabProps {
  scenes: Scene[]
}

export default function ScenesTab({ scenes }: ScenesTabProps) {
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
                  <p className="text-sm text-muted-foreground mt-1">{scene.duration}</p>
                </div>
                <Badge variant="secondary">{scene.id}</Badge>
              </div>

              <p className="text-sm text-foreground mb-4 leading-relaxed">{scene.description}</p>

              {scene.assets.length > 0 && (
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
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
