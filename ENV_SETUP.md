# Environment setup

This document reflects the variables actually referenced by the current Next.js app, FastAPI API, and worker code.

## 1. Core app variables

Required at runtime for most connected app flows (not required by `npm run build`):

```bash
DATABASE_URL=
DATABASE_URL_UNPOOLED=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_TRUSTED_ORIGINS=
BLOB_READ_WRITE_TOKEN=
OPENAI_API_KEY=
NEXTAUTH_URL=http://localhost:3000
```

Notes:
- `DATABASE_URL` is the Postgres connection for this deployment. Each Vercel project uses its own Neon database. Runtime can use the pooled URL. `npm run migrate` prefers `DATABASE_URL_UNPOOLED` (the direct Neon URL) and falls back to `DATABASE_URL`.
- `BETTER_AUTH_SECRET` signs sessions. Generate a long random value per project.
- `BETTER_AUTH_URL` is that project's public origin. Optional `BETTER_AUTH_TRUSTED_ORIGINS` is a comma-separated list of extra origins (preview URLs).
- Auth tables live in the same database. Apply them with `npm run migrate`.
- `BLOB_READ_WRITE_TOKEN` stores video files in Vercel Blob under the `videos/` prefix.
- On Render, `RENDER_EXTERNAL_URL` is detected automatically and `NEXTAUTH_URL` can be omitted.
  Set `NEXTAUTH_URL` when using a custom domain.

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
BACKGROUND_MUSIC_PATH=
BACKGROUND_MUSIC_VOLUME=0.2
BRANDING_LOGO_URL=
BRANDING_LOGO_PATH=
BRANDING_LOGO_SCALE=0.12
BRANDING_LOGO_OPACITY=0.85
BRANDING_LOGO_POSITION=top-right
BRANDING_LOGO_PADDING=24
```

Notes:
- OpenAI TTS and Whisper features still need `OPENAI_API_KEY`.
- Branding and background assets can be served from a URL or read from a file under `public/`.

## 4. YouTube auth and upload

```bash
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_ACCESS_TOKEN=
YOUTUBE_REFRESH_TOKEN=
YOUTUBE_API_KEY=
ENABLE_YOUTUBE_CAPTIONS=true
```

Notes:
- `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, and `NEXTAUTH_URL` are required for OAuth callback and direct upload routes.
- `YOUTUBE_ACCESS_TOKEN` is only needed for the cron upload route's current service-token flow.
- `ENABLE_YOUTUBE_CAPTIONS=false` disables caption uploads.

For the read-only Google Drive Shorts importer:

```bash
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_REFRESH_TOKEN=
```

Run `npm run pipeline -- drive-auth` to obtain the refresh token. Shared
`GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` values are also
supported.

## 5. Scheduled jobs and X integration

```bash
CRON_SECRET=
STRIPE_PRICE_ID_PRO=
X_BEARER_TOKEN=
X_CONSUMER_KEY=
X_CONSUMER_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=
X_TREND_QUERY=
```

Notes:
- `CRON_SECRET` protects `/api/cron/upload`.
- `STRIPE_PRICE_ID_PRO` is the configured Pro checkout link identifier.
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
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=
R2_ENDPOINT_URL=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
CDN_URL=
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_API_TOKEN=
```

Notes:
- `DATABASE_URL` is consumed by FastAPI. Render-style `postgres://` URLs are normalized in code.
- `DB_USER`, `DB_PASSWORD`, and `DB_NAME` are used by `docker-compose.yml` to build the local `DATABASE_URL`.
- `REDIS_URL` is used by the API and workers.
- Configure either the S3 or R2 group when `STORAGE_PROVIDER` uses object storage.

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
