'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type AuthResult = {
  error?: string
}

let client: SupabaseClient | null | undefined

function getSupabaseClient() {
  if (client !== undefined) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  client = url && anonKey ? createClient(url, anonKey) : null
  return client
}

function unavailable(): AuthResult {
  return {
    error:
      'Authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or use Demo Mode.',
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabaseClient()
  if (!supabase) return unavailable()

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error ? { error: error.message } : {}
}

export async function signUp(email: string, password: string, fullName?: string): Promise<AuthResult> {
  const supabase = getSupabaseClient()
  if (!supabase) return unavailable()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
    },
  })

  return error ? { error: error.message } : {}
}

export async function signInWithGoogle(): Promise<AuthResult> {
  const supabase = getSupabaseClient()
  if (!supabase) return unavailable()

  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: redirectTo ? { redirectTo } : undefined,
  })

  return error ? { error: error.message } : {}
}

export async function signOut(): Promise<AuthResult> {
  const supabase = getSupabaseClient()
  if (!supabase) return unavailable()

  const { error } = await supabase.auth.signOut()
  return error ? { error: error.message } : {}
}
