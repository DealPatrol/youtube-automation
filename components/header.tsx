'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LayoutDashboard, Plus, LogOut, Loader2, Sparkles } from 'lucide-react'
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
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#workflow" className="hover:text-foreground">
            Workflow
          </a>
          <a href="#pricing" className="hover:text-foreground">
            Pricing
          </a>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/">
                  <Plus className="mr-2 h-4 w-4" />
                  New Video
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground"
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Sign out</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <a href="#generator">Start Free</a>
              </Button>
              <Button asChild>
                <a href="#generator">Generate Video</a>
              </Button>
            </>
          )}
        </div>

        <div className="md:hidden">
          {user ? (
            <Button size="sm" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <a href="#generator">Start</a>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
