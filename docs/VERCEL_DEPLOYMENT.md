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
DATABASE_URL=
DATABASE_URL_UNPOOLED=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://your-domain.example
BETTER_AUTH_TRUSTED_ORIGINS=
BLOB_READ_WRITE_TOKEN=
OPENAI_API_KEY=
FAL_KEY=
NEXTAUTH_URL=https://your-domain.example
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
CRON_SECRET=
YOUTUBE_ACCESS_TOKEN=
```

Each Vercel project (`youtube-automation-e2ej`, `youtube-automation-4ori`,
`v0-next-js-you-tube-ai`) gets its own `DATABASE_URL`, `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL`, and `BLOB_READ_WRITE_TOKEN`. Apply the schema once per
database with `npm run migrate` using that project's direct Postgres URL.

Optional media, X, branding, and model settings are listed in `.env.example`.
Keep `REDIS_URL`, `DB_*`, and `STORAGE_*` on the worker host. The Next.js app
does need `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN`.

## Limits

FFmpeg work that exceeds Vercel function duration or temporary-storage limits
must run on the separately hosted worker stack. Set `FASTAPI_URL` or
`VIDEO_ASSEMBLY_URL` to that service when using the offloaded assembly path.

After deployment, verify `/api/status`, then test OAuth with the exact production
callback URL:

```text
https://your-domain.example/api/auth/youtube/callback
```
