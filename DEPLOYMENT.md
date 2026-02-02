# Production Architecture Setup Guide

## Overview
This is a distributed video generation SaaS with the following components:
- **Frontend**: Next.js + TypeScript (Vercel/v0)
- **Backend API**: FastAPI + PostgreSQL + Redis
- **Video Workers**: Python + MoviePy + FFmpeg
- **Storage**: S3/R2 + Cloudflare CDN
- **AI Services**: OpenAI (TTS, Images), ElevenLabs (Professional TTS)

## Local Development Setup

### Prerequisites
- Docker & Docker Compose
- Python 3.11+
- Node.js 18+
- Git

### 1. Clone and Setup

\`\`\`bash
# Clone the repository
git clone <repo-url>
cd saas-video-engine

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
nano .env
\`\`\`

### 2. Start Services with Docker Compose

\`\`\`bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f api
docker-compose logs -f video-worker

# Stop services
docker-compose down
\`\`\`

Services will be available at:
- **API**: http://localhost:8000
- **Database**: PostgreSQL on localhost:5432
- **Redis**: localhost:6379

### 3. Test the API

\`\`\`bash
# Health check
curl http://localhost:8000/health

# View API docs
open http://localhost:8000/docs
\`\`\`

## Production Deployment

### Option 1: AWS EC2 + RDS + ElastiCache

\`\`\`bash
# 1. Launch EC2 instance (Ubuntu 22.04 LTS)
# 2. Install Docker and Docker Compose
# 3. Clone repository
# 4. Configure RDS endpoint in .env
# 5. Configure ElastiCache endpoint in .env
# 6. Deploy with docker-compose
docker-compose up -d
\`\`\`

### Option 2: Railway / Render / Fly.io

**Railway:**
\`\`\`bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
railway link
railway up
\`\`\`

### Option 3: Kubernetes

\`\`\`bash
# Build images
docker build -t saas-video-api ./api
docker build -t saas-video-worker ./workers

# Deploy to cluster
kubectl apply -f k8s/
\`\`\`

## Architecture Details

### 1. Frontend → API Flow

\`\`\`
Next.js App
    ↓
POST /api/generate
    ↓
FastAPI Backend
    ├─ Store in PostgreSQL
    ├─ Enqueue job to Redis
    └─ Return resultId
    ↓
Return to UI
\`\`\`

### 2. Video Processing Pipeline

\`\`\`
Redis Queue
    ↓
Video Worker (pulls job)
    ├─ Fetch images (Unsplash API)
    ├─ Generate voiceover (ElevenLabs/OpenAI)
    ├─ Generate subtitles (Whisper)
    ├─ Compose video (MoviePy)
    └─ Encode to MP4 (FFmpeg)
    ↓
Upload to S3/R2
    ↓
Invalidate CDN cache
    ↓
Store video_url in DB
\`\`\`

### 3. Scaling Strategy

**Horizontal Scaling:**
- Add more video-worker containers to process jobs faster
- Use AWS SQS instead of Redis for distributed queues
- Scale PostgreSQL with read replicas

**Vertical Scaling:**
- Use GPU instances (AWS G4) for faster video encoding
- Increase worker memory for processing large videos

## Monitoring & Logging

### Local Development
\`\`\`bash
# View API logs
docker-compose logs -f api

# View Worker logs  
docker-compose logs -f video-worker

# Monitor Redis
redis-cli MONITOR

# Monitor Database
psql -U postgres -d video_db -c "\dt"
\`\`\`

### Production (AWS CloudWatch)
\`\`\`bash
# Enable CloudWatch logging in docker-compose
# Log group: /saas/api and /saas/workers
# Use CloudWatch Dashboard to monitor:
# - Queue size
# - Job completion rate
# - Video render time
# - Error rate
\`\`\`

## API Endpoints

### Generate Video
\`\`\`bash
POST /api/videos/generate
Content-Type: application/json

{
  "topic": "AI in 2024",
  "description": "A deep dive into AI",
  "video_length_minutes": 10,
  "tone": "professional",
  "platform": "youtube"
}

Response:
{
  "job_id": "uuid",
  "result_id": "uuid",
  "status": "pending"
}
\`\`\`

### Check Status
\`\`\`bash
GET /api/videos/{result_id}/status

Response:
{
  "status": "processing",
  "progress": 45,
  "current_step": "encoding_video",
  "video_url": "/videos/video_xxx.mp4"
}
\`\`\`

### Get Result
\`\`\`bash
GET /api/videos/{result_id}

Response:
{
  "id": "uuid",
  "video_url": "https://cdn.example.com/videos/video_xxx.mp4",
  "video_status": "completed",
  "script": {...},
  "scenes": [...]
}
\`\`\`

## Troubleshooting

### Worker not processing jobs
\`\`\`bash
# Check Redis connection
redis-cli ping

# Check queue size
redis-cli LLEN video:queue

# View worker logs
docker-compose logs video-worker
\`\`\`

### Video encoding fails
\`\`\`bash
# Check FFmpeg installation
ffmpeg -version

# Check available disk space
df -h /app/storage

# Increase timeout in docker-compose
# environment: 
#   - RENDER_TIMEOUT=600
\`\`\`

### Database connection errors
\`\`\`bash
# Test PostgreSQL connection
psql postgresql://user:pass@localhost:5432/video_db

# Check PostgreSQL logs
docker-compose logs postgres
\`\`\`

## Next Steps

1. **Connect Frontend**: Update Next.js to call FastAPI endpoints
2. **S3 Integration**: Upload rendered videos to S3
3. **CDN Setup**: Configure Cloudflare/CloudFront for video delivery
4. **Monitoring**: Set up Sentry for error tracking
5. **Analytics**: Track job metrics and performance
