# Deployment guide

This repo currently has three deployable surfaces:
- `Next.js` app, including most user-facing APIs
- `FastAPI` service in `api/` for assembly and storage-heavy work
- `Python` workers in `workers/` for rendering and upload jobs

## Recommended deployment: Render

The root `render.yaml` defines a complete persistent Node web service. This avoids serverless
function time limits and runs the bundled FFmpeg binary in the same service as the app.

1. In Render, create a Blueprint from this repository.
2. Supply the environment variables marked `sync: false`.
3. Deploy the Blueprint.
4. Add the deployed callback URL to Google OAuth:
   `https://<service>.onrender.com/api/auth/youtube/callback`.

Render automatically supplies `RENDER_EXTERNAL_URL`, so `NEXTAUTH_URL` is optional unless a
custom domain should be used for OAuth callbacks.

## Local baseline

### Frontend / app routes
Run the Next.js app using Node 22+.

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

The default production flow is:
1. Next.js app and video assembly on a persistent Render Node service
2. Supabase Postgres and Storage
3. OpenAI for scripts and voiceover
4. fal.ai for scene images or video clips

The separate FastAPI and worker services remain optional for higher-volume rendering.

### Environment mapping

At minimum, production should provide:
- app core: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`
- media routes: `FAL_KEY`
- public URL: automatically provided by Render; set `NEXTAUTH_URL` only for a custom domain
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

## Operational notes

- Use at least a persistent paid Render instance for reliable long-video rendering; free instances
  can sleep and have tighter memory limits.
- Keep secrets in Render environment settings, never in `render.yaml`.
- FastAPI and Redis workers are optional and are not required by the default video flow.

## Pre-release checklist

- `npm run lint`
- `npm test`
- `npm run build`
- validate `/api/status`
- validate YouTube OAuth callback with the production `NEXTAUTH_URL`
- validate one end-to-end render path against the deployed FastAPI service
