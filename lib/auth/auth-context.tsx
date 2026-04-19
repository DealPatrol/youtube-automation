'use client'

import { createClient, type User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface DemoUser {
  uid: string
  email: string | null
  displayName: string | null
}

interface AuthContextType {
  user: User | DemoUser | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
})

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  return url && anonKey ? createClient(url, anonKey) : null
}

function readDemoUser() {
  try {
    const storedUser = localStorage.getItem('demoUser')
    return storedUser ? (JSON.parse(storedUser) as DemoUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | DemoUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const demoUser = readDemoUser()
    if (demoUser) {
      setUser(demoUser)
      setLoading(false)
      return
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      setLoading(false)
      return
    }

    let active = true

    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return
      if (error) {
        console.warn('[auth] Failed to load session user', error.message)
      }
      setUser(data.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? readDemoUser())
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    function handleStorageChange() {
      setUser(readDemoUser())
    }

    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

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
