'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2 } from 'lucide-react'

interface CapCutStep {
  order?: number
  title?: string
  description?: string
  duration?: string
  effects?: string[]
  transitions?: string
  tips?: string
}

interface CapCutTabProps {
  steps: (CapCutStep | string)[]
}

export default function CapCutTab({ steps }: CapCutTabProps) {
  if (!steps || steps.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">No CapCut instructions available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>CapCut Editing Guide</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Step-by-step instructions for editing in CapCut
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {steps.map((step, idx) => {
            // Handle both string steps and structured step objects
            const isString = typeof step === 'string'
            const stepNum = idx + 1
            const content = isString ? step : step.description || ''
            const title = isString ? `Step ${stepNum}` : (step.title || `Step ${stepNum}`)
            const effects = (step as CapCutStep).effects || []
            const transitions = (step as CapCutStep).transitions
            const tips = (step as CapCutStep).tips

            return (
              <div
                key={idx}
                className="border border-border rounded-lg p-4 hover:bg-card/50 transition-colors"
              >
                <div className="flex items-start gap-3 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">{title}</h4>
                    {(step as CapCutStep).duration && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(step as CapCutStep).duration}
                      </p>
                    )}
                  </div>
                </div>

                {content && (
                  <p className="text-sm text-foreground mb-3 ml-8 leading-relaxed">
                    {content}
                  </p>
                )}

                {Array.isArray(effects) && effects.length > 0 && (
                  <div className="mb-3 ml-8">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Effects:</p>
                    <div className="flex flex-wrap gap-2">
                      {effects.map((effect, effectIdx) => (
                        <Badge key={effectIdx} variant="outline">
                          {effect}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {transitions && (
                  <div className="mb-3 ml-8">
                    <p className="text-xs font-medium text-muted-foreground">Transition:</p>
                    <p className="text-sm text-foreground">{transitions}</p>
                  </div>
                )}

                {tips && (
                  <div className="ml-8 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-medium text-blue-900 dark:text-blue-200 mb-1">
                      Tip
                    </p>
                    <p className="text-xs text-blue-800 dark:text-blue-300">{tips}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
