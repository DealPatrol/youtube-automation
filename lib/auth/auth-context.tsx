'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authClient } from './client'

export interface AppUser {
  id: string
  email: string | null
  name: string | null
}

export function getAuthUserId(user: AppUser | null): string | undefined {
  return user?.id
}

interface AuthContextType {
  user: AppUser | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
})

/**
 * Client view of the Better Auth session. There is intentionally no
 * localStorage "demo" user: every server route that creates or renders video
 * requires a real session cookie, so a fake client-side user only produced a
 * UI that looked signed in while every action failed with 401.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    // Clear the legacy demo-mode marker so old browsers stop showing a fake session.
    try {
      localStorage.removeItem('demoUser')
      localStorage.removeItem('demoResults')
    } catch {
      // storage unavailable (private mode); nothing to clear
    }

    async function refreshSession() {
      try {
        const result = await authClient.getSession()
        if (!active) return
        const nextUser = result.data?.user
        setUser(
          nextUser
            ? {
                id: nextUser.id,
                email: nextUser.email ?? null,
                name: nextUser.name ?? null,
              }
            : null
        )
      } catch {
        if (active) setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    void refreshSession()
    window.addEventListener('auth-changed', refreshSession)
    return () => {
      active = false
      window.removeEventListener('auth-changed', refreshSession)
    }
  }, [])

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
