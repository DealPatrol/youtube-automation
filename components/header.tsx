'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
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

  return (
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
