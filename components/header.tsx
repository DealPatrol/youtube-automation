'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LayoutDashboard } from 'lucide-react'

export function Header() {
  const router = useRouter()
  const pathname = usePathname()

  // Hide header on home page
  if (pathname === '/') return null

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
            <Link href="/">
              <LayoutDashboard className="w-4 h-4" />
              Home
            </Link>
          </Button>
        </nav>

        {/* Mobile menu */}
        <div className="md:hidden flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
          >
            <Link href="/">
              <LayoutDashboard className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
