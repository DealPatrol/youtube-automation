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

## Publish motivation Shorts from Google Drive

To turn existing motivation videos in Google Drive into YouTube Shorts jobs:

```bash
npm run pipeline -- drive-auth
npm run pipeline -- drive-shorts --query motivation --dryRun
npm run pipeline -- drive-shorts --query motivation --limit 1 --publish --privacy private
```

`drive-shorts` defaults to `private` uploads and requires `--publish` before it
will upload anything. See `CONTENT_PIPELINE.md` for Drive scopes and options.

Audience-growth automation should stay on the research/content side: identify
topics and communities that respond well, then publish strong Shorts and engage
manually. Do not automate follow/like/subscribe loops.

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
