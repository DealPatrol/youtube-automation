function normalizeUrl(value?: string): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return withProtocol.replace(/\/$/, '')
}

export function getPublicAppUrl(fallback = 'http://localhost:3000'): string {
  return (
    normalizeUrl(process.env.NEXTAUTH_URL) ||
    normalizeUrl(process.env.RENDER_EXTERNAL_URL) ||
    normalizeUrl(process.env.VERCEL_URL) ||
    fallback
  )
}
