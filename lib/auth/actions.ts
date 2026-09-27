'use client'

import { authClient } from './client'

type AuthResult = {
  error?: string
}

function notifyAuthChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth-changed'))
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const result = await authClient.signIn.email({ email, password })
  if (result.error) return { error: result.error.message || 'Sign in failed' }
  notifyAuthChanged()
  return {}
}

export async function signUp(email: string, password: string, fullName?: string): Promise<AuthResult> {
  const result = await authClient.signUp.email({
    email,
    password,
    name: fullName?.trim() || email.split('@')[0] || 'Creator',
  })
  if (result.error) return { error: result.error.message || 'Sign up failed' }
  notifyAuthChanged()
  return {}
}

export async function signInWithGoogle(): Promise<AuthResult> {
  const result = await authClient.signIn.social({
    provider: 'google',
    callbackURL: '/',
  })
  return result.error ? { error: result.error.message || 'Google sign-in is not configured' } : {}
}

export async function signOut(): Promise<AuthResult> {
  const result = await authClient.signOut()
  if (result.error) return { error: result.error.message || 'Sign out failed' }
  notifyAuthChanged()
  return {}
}
