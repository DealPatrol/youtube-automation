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
import { LayoutDashboard, Plus, LogOut, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { signOut } from '@/lib/auth/actions'
import { logoutDemo } from '@/lib/auth/auth-context'

export function Header() {
  const pathname = usePathname()
  const { user, loading } = useAuth()

  if (pathname === '/login') return null

  async function handleLogout() {
    try {
      await signOut()
    } catch {
      await logoutDemo()
    }
  }

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
    <header className="border-b border-border bg-card/50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg">
          YouTube AI Builder
        </Link>

        <nav className="flex items-center gap-2">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/">
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">New Video</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground"
              >
                <LogOut className="w-4 h-4" />
                <span className="sr-only">Sign out</span>
              </Button>
            </>
          ) : (
            <Button size="sm" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}
