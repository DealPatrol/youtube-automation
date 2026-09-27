'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authClient } from './client'

interface DemoUser {
  uid: string
  email: string | null
  displayName: string | null
}

export interface AppUser {
  id: string
  email: string | null
  name: string | null
}

export function getAuthUserId(user: AppUser | DemoUser | null): string | undefined {
  if (!user) return undefined
  return 'id' in user ? user.id : user.uid
}

interface AuthContextType {
  user: AppUser | DemoUser | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
})

function readDemoUser() {
  try {
    const storedUser = localStorage.getItem('demoUser')
    return storedUser ? (JSON.parse(storedUser) as DemoUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionUser, setSessionUser] = useState<AppUser | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [demoUser, setDemoUser] = useState<DemoUser | null>(null)
  const [demoReady, setDemoReady] = useState(false)

  useEffect(() => {
    let active = true

    async function refreshSession() {
      const result = await authClient.getSession()
      if (!active) return
      const nextUser = result.data?.user
      setSessionUser(
        nextUser
          ? {
              id: nextUser.id,
              email: nextUser.email ?? null,
              name: nextUser.name ?? null,
            }
          : null
      )
      setSessionLoading(false)
    }

    setDemoUser(readDemoUser())
    setDemoReady(true)
    void refreshSession()

    function handleStorageChange() {
      setDemoUser(readDemoUser())
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('auth-changed', refreshSession)
    return () => {
      active = false
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('auth-changed', refreshSession)
    }
  }, [])

  const user = demoUser ?? sessionUser
  const loading = demoUser ? false : !demoReady || sessionLoading

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

export async function loginDemo() {
  const demoUser: DemoUser = {
    uid: 'demo-user-' + Math.random().toString(36).slice(2, 11),
    email: 'demo@youtube-ai.com',
    displayName: 'Demo User',
  }
  localStorage.setItem('demoUser', JSON.stringify(demoUser))
  window.dispatchEvent(new Event('storage'))
}

export async function logoutDemo() {
  localStorage.removeItem('demoUser')
  window.dispatchEvent(new Event('storage'))
  window.location.href = '/login'
}
