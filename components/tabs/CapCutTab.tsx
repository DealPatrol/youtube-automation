'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface CapCutStep {
  order: number
  title: string
  description: string
  duration: string
  effects: string[]
  transitions: string
  tips: string
}

interface CapCutTabProps {
  steps: CapCutStep[]
}

export default function CapCutTab({ steps }: CapCutTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>CapCut Editing Guide</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Step-by-step instructions for editing in CapCut
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.order} className="border border-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold text-sm flex-shrink-0">
                    {step.order}
                  </div>
                  <div>
                    <h4 className="font-semibold">{step.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.duration}</p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-foreground mb-3 ml-11 leading-relaxed">{step.description}</p>

              {step.effects.length > 0 && (
                <div className="mb-3 ml-11">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Effects to Add:</p>
                  <div className="flex flex-wrap gap-2">
                    {step.effects.map((effect, idx) => (
                      <Badge key={idx} variant="outline">
                        {effect}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {step.transitions && (
                <div className="mb-3 ml-11">
                  <p className="text-xs font-medium text-muted-foreground">Transition: </p>
                  <p className="text-sm text-foreground">{step.transitions}</p>
                </div>
              )}

              {step.tips && (
                <div className="ml-11 p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-medium text-blue-900 dark:text-blue-200">💡 Tip: </p>
                  <p className="text-xs text-blue-800 dark:text-blue-300">{step.tips}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
