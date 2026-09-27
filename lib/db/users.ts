import { sql } from 'drizzle-orm'
import { docs, rows } from './client'

export async function ensureAppUser(input: {
  id: string
  email?: string | null
  fullName?: string | null
  avatarUrl?: string | null
}): Promise<void> {
  await rows(sql`
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (${input.id}, ${input.email ?? null}, ${input.fullName ?? null}, ${input.avatarUrl ?? null})
    ON CONFLICT (id) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, public.users.email),
      full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
      updated_at = now()
  `)
}

export async function getAppUser(userId: string): Promise<{
  id: string
  email: string | null
  subscription_tier: string | null
} | null> {
  const [user] = await docs<{
    id: string
    email: string | null
    subscription_tier: string | null
  }>(sql`
    SELECT jsonb_build_object(
      'id', id,
      'email', email,
      'subscription_tier', subscription_tier
    ) AS doc
    FROM public.users
    WHERE id = ${userId}
  `)
  return user ?? null
}
