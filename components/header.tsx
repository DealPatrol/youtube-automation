'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { auth } from '@/lib/firebase/config'
import { signOut as firebaseSignOut } from 'firebase/auth'
import { Button } from '@/components/ui/button'
import { LogOut, Settings, LayoutDashboard } from 'lucide-react'
import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const isAuthPage = pathname?.startsWith('/auth')
  const showHeader = !isAuthPage && isAuthenticated

  if (loading || !showHeader) return null

  async function handleSignOut() {
    try {
      await firebaseSignOut(auth)
      router.push('/auth/login')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
    <header className="border-b border-border">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl">
          YouTube AI Builder
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Button
            variant="ghost"
            asChild
            className="gap-2"
          >
            <Link href="/dashboard">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
          </Button>
          <Button
            variant="ghost"
            asChild
            className="gap-2"
          >
            <Link href="/profile">
              <Settings className="w-4 h-4" />
              Settings
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="gap-2 bg-transparent"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </nav>

        {/* Mobile menu */}
        <div className="md:hidden flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
          >
            <Link href="/profile">
              <Settings className="w-4 h-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
