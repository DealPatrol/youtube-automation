'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles } from 'lucide-react'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-3 font-semibold text-lg">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow">
            <Sparkles className="h-4 w-4" />
          </span>
          YouTube AI Studio
          <Badge className="border-0 bg-primary/15 text-primary">Pro</Badge>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#workflow" className="hover:text-foreground">Workflow</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" asChild>
            <a href="#generator">Start Free</a>
          </Button>
          <Button asChild>
            <a href="#generator">Generate Video</a>
          </Button>
        </div>

        <Button className="md:hidden" asChild size="sm">
          <a href="#generator">Start</a>
        </Button>
      </div>
    </header>
  )
}
