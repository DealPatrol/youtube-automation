# Environment setup

This document reflects the variables actually referenced by the current Next.js app, FastAPI API, and worker code.

## 1. Core app variables

Required for most app flows:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=videos
OPENAI_API_KEY=
NEXTAUTH_URL=http://localhost:3000
```

Notes:
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is required by the auth context and dashboard pages.
- `SUPABASE_SERVICE_ROLE_KEY` is required by server routes that write projects, results, uploads, and package downloads.
- `SUPABASE_STORAGE_BUCKET` defaults to `videos` if omitted.

## 2. Video generation and media routes

```bash
FAL_KEY=
FASTAPI_URL=http://localhost:8000
VIDEO_ASSEMBLY_URL=
PEXELS_API_KEY=
UNSPLASH_ACCESS_KEY=
UNSPLASH_API_KEY=
```

Notes:
- `FAL_KEY` is required by `/api/generate-image`, `/api/generate-thumbnail`, and `/api/generate-video`.
- Set either `FASTAPI_URL` or `VIDEO_ASSEMBLY_URL` if `/api/assemble-video` should offload work instead of relying only on local ffmpeg execution.
- `UNSPLASH_ACCESS_KEY` is used by `lib/video/video-processor.ts`.
- `UNSPLASH_API_KEY` is used by the Python API and worker containers.
- `PEXELS_API_KEY` is optional and only used by `lib/video/stock-media.ts`.

## 3. Audio and branding options

```bash
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
BACKGROUND_MUSIC_URL=
BACKGROUND_MUSIC_PATH=./public/audio/background.mp3
BACKGROUND_MUSIC_VOLUME=0.2
BRANDING_LOGO_URL=
BRANDING_LOGO_PATH=./public/placeholder-logo.png
BRANDING_LOGO_SCALE=0.12
BRANDING_LOGO_OPACITY=0.85
BRANDING_LOGO_POSITION=top-right
BRANDING_LOGO_PADDING=24
```

Notes:
- OpenAI TTS and Whisper features still need `OPENAI_API_KEY`.
- Branding and background assets can be served from a URL or read from a local path.

## 4. YouTube auth and upload

```bash
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_ACCESS_TOKEN=
ENABLE_YOUTUBE_CAPTIONS=true
```

Notes:
- `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, and `NEXTAUTH_URL` are required for OAuth callback and direct upload routes.
- `YOUTUBE_ACCESS_TOKEN` is only needed for the cron upload route's current service-token flow.
- `ENABLE_YOUTUBE_CAPTIONS=false` disables caption uploads.

## 5. Scheduled jobs and X integration

```bash
CRON_SECRET=
X_BEARER_TOKEN=
X_CONSUMER_KEY=
X_CONSUMER_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=
X_TREND_QUERY=
```

Notes:
- `CRON_SECRET` protects `/api/cron/upload`.
- `X_BEARER_TOKEN` powers `/api/x-trends`.
- OAuth 1.0a X credentials power `/api/x-agent`.

## 6. Backend and worker infrastructure

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/video_db
REDIS_URL=redis://localhost:6379
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=video_db
STORAGE_PATH=/app/storage/videos
STORAGE_PROVIDER=s3
DELETE_LOCAL_AFTER_UPLOAD=false
```

Notes:
- `DATABASE_URL` is consumed by FastAPI. Render-style `postgres://` URLs are normalized in code.
- `DB_USER`, `DB_PASSWORD`, and `DB_NAME` are used by `docker-compose.yml` to build the local `DATABASE_URL`.
- `REDIS_URL` is used by the API and workers.

## 7. Prompt tuning

```bash
OPENAI_PROMPT_ID=
OPENAI_PROMPT_VERSION=1
```

Optional. If omitted, the app falls back to inline prompt construction.

## Sanity check

After setting variables, verify the app sees them:

```bash
curl http://localhost:3000/api/status
```

The response reports which integration groups are configured.
