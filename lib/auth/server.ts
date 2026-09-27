import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { getPublicAppUrl } from '@/lib/config/app-url'
import { getPool } from '@/lib/db/client'
import { ensureAppUser } from '@/lib/db/users'

type AuthInstance = ReturnType<typeof betterAuth<BetterAuthOptions>>

let authInstance: AuthInstance | undefined

function trustedOrigins(): string[] {
  const configured = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  const appUrl = process.env.BETTER_AUTH_URL || getPublicAppUrl()
  return Array.from(new Set([appUrl, ...configured]))
}

export function getAuth(): AuthInstance {
  if (authInstance) return authInstance

  const secret = process.env.BETTER_AUTH_SECRET?.trim()
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET is not set')
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const options: BetterAuthOptions = {
    database: getPool(),
    secret,
    baseURL: process.env.BETTER_AUTH_URL || getPublicAppUrl(),
    trustedOrigins: trustedOrigins(),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 8,
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await ensureAppUser({
              id: user.id,
              email: user.email,
              fullName: user.name,
              avatarUrl: user.image,
            })
          },
        },
      },
    },
    plugins: [nextCookies()],
  }
  if (googleClientId && googleClientSecret) {
    options.socialProviders = {
      google: {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
      },
    }
  }

  authInstance = betterAuth(options)

  return authInstance
}
