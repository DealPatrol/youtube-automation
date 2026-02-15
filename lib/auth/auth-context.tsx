'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// Fallback user type for when Firebase isn't available
interface DemoUser {
  uid: string
  email: string | null
  displayName: string | null
}

interface AuthContextType {
  user: any | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check localStorage for demo user
    function checkDemoUser() {
      try {
        const storedUser = localStorage.getItem('demoUser')
        if (storedUser) {
          setUser(JSON.parse(storedUser))
          setLoading(false)
          return true
        }
      } catch {
        // Ignore parse errors
      }
      return false
    }

    // First check localStorage
    if (checkDemoUser()) return

    // Try to use Firebase if available
    try {
      const { auth } = require('@/lib/firebase/config')
      const { onAuthStateChanged } = require('firebase/auth')

      const unsubscribe = onAuthStateChanged(auth, (firebaseUser: any) => {
        setUser(firebaseUser)
        setLoading(false)
      })

      return () => unsubscribe()
    } catch (err) {
      console.log('[v0] Firebase unavailable, using fallback auth')
      setLoading(false)
    }
  }, [])

  // Listen for storage changes
  useEffect(() => {
    function handleStorageChange() {
      try {
        const storedUser = localStorage.getItem('demoUser')
        if (storedUser) {
          setUser(JSON.parse(storedUser))
        } else {
          setUser(null)
        }
      } catch {
        // Ignore errors
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

// Demo auth functions
export async function loginDemo() {
  const demoUser: DemoUser = {
    uid: 'demo-user-' + Math.random().toString(36).substr(2, 9),
    email: 'demo@youtube-ai.com',
    displayName: 'Demo User',
  }
  localStorage.setItem('demoUser', JSON.stringify(demoUser))
  // Update window to trigger a state refresh
  window.dispatchEvent(new Event('storage'))
}

export async function logoutDemo() {
  localStorage.removeItem('demoUser')
  window.dispatchEvent(new Event('storage'))
  window.location.href = '/login'
}
