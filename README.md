# youtube-automation

Production-oriented YouTube automation stack with:
- Next.js app router frontend and API routes
- FastAPI video assembly backend
- Python workers for rendering and uploads
- Supabase for auth, data, and storage

## Create a video end-to-end (CLI)

The fastest path from trending topic to published YouTube video is the content
pipeline CLI — trend discovery → script/shot list → photos → TTS + captions →
human approval → FFmpeg render → rights manifest → publish:

```bash
npm run pipeline -- create --minutes 1 --aspect 9:16
```

See **[CONTENT_PIPELINE.md](CONTENT_PIPELINE.md)** for setup (only
`OPENAI_API_KEY` is required to start) and all commands.

If you already have motivation clips in Google Drive, the same CLI can import
them as YouTube Shorts jobs and optionally publish them privately after rights
confirmation:

```bash
npm run pipeline -- drive-auth
npm run pipeline -- drive-shorts --query motivation --max 5 --dry-run
npm run pipeline -- drive-shorts --query motivation --max 5 --publish --rights-confirmed --privacy private
```

## Standard package manager

This repo is now standardized on **npm**.

```bash
npm install
npm run lint
npm test
npm run dev
```

Do not commit `pnpm-lock.yaml` or use `pnpm install` in this repo.

## Local app setup

1. Copy the template and fill in required secrets.
   ```bash
   cp .env.example .env.local
   ```
2. Install dependencies.
   ```bash
   npm install
   ```
3. Start the Next.js app.
   ```bash
   npm run dev
   ```
4. If you want local video assembly, also start the backend stack.
   ```bash
   docker compose up --build api redis postgres
   ```

## Required environment variables

Minimum app-only flow:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

Required for YouTube OAuth/upload:
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `NEXTAUTH_URL`

Required for image/video generation routes:
- `FAL_KEY`

Required for scheduled upload cron route:
- `CRON_SECRET`
- `YOUTUBE_ACCESS_TOKEN`

Optional but supported:
- `FASTAPI_URL` or `VIDEO_ASSEMBLY_URL`
- `ELEVENLABS_API_KEY`
- `X_BEARER_TOKEN`
- `X_CONSUMER_KEY`, `X_CONSUMER_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`
- branding and background music variables from `.env.example`

See `ENV_SETUP.md` for the full matrix and `DEPLOYMENT.md` for deployment notes.

## Verification

```bash
npm run lint
npm test
```
