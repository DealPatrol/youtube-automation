# Deployment guide

This repo currently has three deployable surfaces:
- `Next.js` app, including most user-facing APIs
- `FastAPI` service in `api/` for assembly and storage-heavy work
- `Python` workers in `workers/` for rendering and upload jobs

## Reality check

The repository is not a single-click production deployment yet. In particular:
- the Next.js app can run on its own, but some video assembly features expect ffmpeg or a reachable `FASTAPI_URL` / `VIDEO_ASSEMBLY_URL`
- the Docker compose stack is for local or single-host use, not hardened multi-tenant production
- `render.yaml` is incomplete and should not be treated as a full deployment manifest

## Recommended baseline

### Frontend / app routes
Deploy the Next.js app separately using Node 20+.

```bash
npm ci
npm run lint
npm test
npm run build
npm run start
```

Set the environment variables documented in `ENV_SETUP.md`.

### Backend services
For local integration testing:

```bash
docker compose up --build postgres redis api video-worker
```

This brings up:
- Postgres on `5432`
- Redis on `6379`
- FastAPI on `8000`

## Production shape

A more realistic production setup is:
1. Next.js app on Vercel, Render, Fly.io, or a Node host
2. Managed Postgres
3. Managed Redis
4. Dedicated Python worker service with ffmpeg installed
5. Supabase storage bucket for rendered assets

### Environment mapping

At minimum, production should provide:
- app core: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `NEXTAUTH_URL`
- media routes: `FAL_KEY`, plus either `FASTAPI_URL` or `VIDEO_ASSEMBLY_URL`
- YouTube: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`
- workers/api: `DATABASE_URL`, `REDIS_URL`

## Deployment steps

### Next.js app
```bash
npm ci
npm run build
```

Health check:
```bash
curl https://your-app.example.com/api/status
```

### FastAPI service
```bash
cd api
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Health check:
```bash
curl http://localhost:8000/health
```

### Worker service
```bash
cd workers
pip install -r requirements.txt
python video_renderer.py
```

## Known gaps and risks

- No complete CI pipeline is defined in the repo yet.
- No production-ready secrets management or rotation guidance is checked in.
- Worker orchestration is still fairly ad hoc.
- `tts-worker` is referenced in `docker-compose.yml`, but the corresponding script should be validated before relying on it in production.
- `render.yaml` should be replaced with a real multi-service manifest before using Render seriously.

## Pre-release checklist

- `npm run lint`
- `npm test`
- `npm run build`
- validate `/api/status`
- validate YouTube OAuth callback with the production `NEXTAUTH_URL`
- validate one end-to-end render path against the deployed FastAPI service
