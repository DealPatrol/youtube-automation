# Vercel deployment (Next.js only)

Vercel hosts the Next.js dashboard and its server routes. It does not run the
FastAPI service, Redis queue, or long-running Python workers.

## Build settings

- Framework preset: Next.js
- Install command: `npm ci`
- Build command: `npm run build`
- Node.js: 22

The build intentionally succeeds with no environment variables. Integrations
that are not configured return a clear runtime error or remain unavailable.

## Runtime variables

Configure only the integrations used by the web app:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=videos
OPENAI_API_KEY=
FAL_KEY=
NEXTAUTH_URL=https://your-domain.example
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
CRON_SECRET=
YOUTUBE_ACCESS_TOKEN=
```

Optional media, X, branding, and model settings are listed in `.env.example`.
Do not add worker-only variables such as `DATABASE_URL`, `REDIS_URL`, `DB_*`, or
`STORAGE_*` to Vercel unless a Next.js route is deliberately configured to call
an external worker through `FASTAPI_URL` or `VIDEO_ASSEMBLY_URL`.

## Limits

FFmpeg work that exceeds Vercel function duration or temporary-storage limits
must run on the separately hosted worker stack. Set `FASTAPI_URL` or
`VIDEO_ASSEMBLY_URL` to that service when using the offloaded assembly path.

After deployment, verify `/api/status`, then test OAuth with the exact production
callback URL:

```text
https://your-domain.example/api/auth/youtube/callback
```
