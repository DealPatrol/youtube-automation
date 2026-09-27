# FastAPI and worker deployment

The rendering backend is separate from the Vercel-hosted Next.js app. Run it on
a container host with persistent processes and enough CPU, memory, disk, and
execution time for FFmpeg, such as Render or Fly.io.

## Services

- `api/`: FastAPI assembly API
- `workers/video_renderer.py`: rendering queue consumer
- `workers/upload_worker.py`: storage/upload queue consumer
- Postgres: job and application data
- Redis: worker queue

For local development:

```bash
docker compose up --build postgres redis api video-worker
```

For a managed host, deploy the API and each required worker as separate services
from the same repository. Install each Python service's requirements and use the
commands in `docker-compose.yml` as the source of truth.

## Required worker variables

```bash
DATABASE_URL=
REDIS_URL=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=videos
STORAGE_PATH=/app/storage/videos
STORAGE_PROVIDER=s3
```

Choose and configure one object-storage backend:

```bash
# Amazon S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=

# Cloudflare R2
R2_ENDPOINT_URL=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
CDN_URL=
```

Optional generation, branding, cleanup, and Cloudflare cache variables are
documented in `.env.example`.

## Connect the web app

Expose the FastAPI service over HTTPS, then set one of these on the Next.js
runtime:

```bash
FASTAPI_URL=https://your-worker-api.example
VIDEO_ASSEMBLY_URL=https://your-worker-api.example
```

Keep Postgres, Redis, storage credentials, and worker filesystem settings on the
worker host. They are not required for the Next.js build.
