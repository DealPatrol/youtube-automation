'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sparkles, Menu } from 'lucide-react'
import { useState } from 'react'

export function Header() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Show full header only on non-home pages
  const isHomePage = pathname === '/'

  if (isHomePage) {
    return (
      <header className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition">
            <Sparkles className="w-5 h-5 text-accent" />
            YouTube Builder
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <Button variant="ghost" asChild>
              <Link href="#features">Features</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/pricing">Pricing</Link>
            </Button>
          </nav>
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-card p-4 space-y-2">
            <Button variant="ghost" asChild className="w-full justify-start">
              <Link href="#features">Features</Link>
            </Button>
            <Button variant="ghost" asChild className="w-full justify-start">
              <Link href="/pricing">Pricing</Link>
            </Button>
          </div>
        )}
      </header>
    )
  }

  // App header for dashboard/editor
  return (
    <header className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition">
          <Sparkles className="w-5 h-5 text-accent" />
          YouTube Builder
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          <Button variant="ghost" asChild>
            <Link href="/">New Video</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}
