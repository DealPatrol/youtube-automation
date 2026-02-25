'use server'

import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return null
  }
  return createClient(supabaseUrl, supabaseKey)
}

export async function signIn(
  email: string,
  password: string
): Promise<{ error?: string }> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { error: 'Supabase credentials not configured' }
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { error: error.message }
  }
  return {}
}

export async function signUp(
  email: string,
  password: string,
  fullName?: string
): Promise<{ error?: string }> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { error: 'Supabase credentials not configured' }
  }
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })
  if (error) {
    return { error: error.message }
  }
  return {}
}

export async function signInWithGoogle(): Promise<{ error?: string }> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { error: 'Supabase credentials not configured' }
  }
  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/`
      : `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/`
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  if (error) {
    return { error: error.message }
  }
  return {}
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient()
  if (supabase) {
    await supabase.auth.signOut()
  }
}
