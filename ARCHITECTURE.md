# ContentForge Professional Video Generation Pipeline

## Architecture Overview

ContentForge now has a complete, production-ready video generation pipeline using:
- **Shotstack** - Professional MP4 rendering with transitions and effects
- **ElevenLabs** - High-quality AI voiceovers with multiple voices
- **Pexels** - Royalty-free HD stock footage
- **OpenAI** - Script writing and scene extraction

## API Flow

### Complete Video Generation Flow

```
POST /api/render-video
  ↓
1. Generate Script (OpenAI)
  ↓
2. Extract Scenes with Overlay Text + Keywords (OpenAI)
  ↓
3. Find Stock Footage Clips (Pexels API)
  ↓
4. Generate AI Voiceover (ElevenLabs)
  ↓
5. Build Shotstack Timeline (Dual Format: Portrait + Landscape)
  ↓
6. Submit to Shotstack for Rendering
  ↓
Returns: { portraitRenderId, landscapeRenderId, script, scenes }
  ↓
[Async] Shotstack renders video
  ↓
[Webhook] POST /api/webhooks/shotstack receives completion
  ↓
Updates database with final video URL
```

## API Endpoints

### 1. Script Generation
**POST `/api/generate-script`**
```json
{
  "topic": "How to Start a Faceless YouTube Channel",
  "style": "educational",
  "length": "short"
}
```
Returns: `{ script: "..." }`

### 2. Scene Extraction
**POST `/api/extract-keywords`**
```json
{
  "script": "..."
}
```
Returns: `{ scenes: [{ overlay_text, keywords, length }, ...] }`

### 3. Stock Footage Search
**POST `/api/find-clips`**
```json
{
  "scenes": [{ overlay_text, keywords, length }, ...]
}
```
Returns: `{ scenes: [{ overlay_text, keywords, length, clipUrl }, ...] }`

### 4. Voiceover Generation
**POST `/api/generate-voiceover`**
```json
{
  "script": "..."
}
```
Returns: `{ audioUrl: "data:audio/mpeg;base64,..." }`

### 5. Complete Video Render
**POST `/api/render-video`**
```json
{
  "topic": "How to Start a Faceless YouTube Channel",
  "style": "educational",
  "length": "short"
}
```
Returns:
```json
{
  "script": "...",
  "scenes": [{ id, text, start, length, keywords, clipUrl }, ...],
  "portraitRenderId": "abc123",
  "landscapeRenderId": "def456"
}
```

### 6. Check Render Status
**GET `/api/render-status?id=abc123`**
Returns:
```json
{
  "id": "abc123",
  "status": "completed|queued|rendering",
  "url": "https://..."
}
```

### 7. Shotstack Webhook
**POST `/api/webhooks/shotstack`**
Headers: `x-webhook-signature: <WEBHOOK_SECRET>`
Body: Shotstack completion payload

## Setup Instructions

### 1. Get API Keys

**Shotstack** (Video Rendering)
- Go to https://dashboard.shotstack.io
- Create free account (500 free credits/month)
- Copy API key to `SHOTSTACK_API_KEY`

**ElevenLabs** (Voiceovers)
- Go to https://elevenlabs.io
- Create free account (10k free characters/month)
- Copy API key to `ELEVENLABS_API_KEY`

**Pexels** (Stock Footage)
- Go to https://www.pexels.com/api
- Create free account
- Copy API key to `PEXELS_API_KEY`

**Webhook Secret** (Security)
- Generate random string: `openssl rand -base64 32`
- Set as `WEBHOOK_SECRET`

### 2. Configure Shotstack Webhook

1. Go to Shotstack dashboard
2. Settings → Webhooks
3. Add webhook URL: `https://yourdomain.com/api/webhooks/shotstack`
4. Set signature secret to your `WEBHOOK_SECRET`

### 3. Test the Pipeline

```bash
# Test script generation
curl -X POST http://localhost:3000/api/generate-script \
  -H "Content-Type: application/json" \
  -d '{"topic":"AI tools","style":"entertaining","length":"short"}'

# Test complete flow
curl -X POST http://localhost:3000/api/render-video \
  -H "Content-Type: application/json" \
  -d '{"topic":"AI tools","style":"entertaining","length":"short"}'
```

## Video Output Formats

### Portrait (9:16) - TikTok/Shorts
- Resolution: 1080x1920
- FPS: 30
- Format: MP4

### Landscape (16:9) - YouTube
- Resolution: 1920x1080
- FPS: 30
- Format: MP4

## Error Handling

All APIs include graceful degradation:
- If Pexels fails: Proceeds without stock footage
- If ElevenLabs fails: Proceeds without voiceover
- If Shotstack fails: Returns error with full details

## Next Steps

1. **Add to Frontend**: Create UI component to trigger `/api/render-video`
2. **Store Results**: Save rendered video URLs to Supabase
3. **YouTube Integration**: Connect rendered videos to YouTube API
4. **Analytics**: Track render times and success rates
5. **Scaling**: Use Shotstack webhooks for async processing

## Production Checklist

- [ ] All 4 API keys configured
- [ ] Shotstack webhook configured
- [ ] Error monitoring in place (Sentry)
- [ ] Rate limiting on API endpoints
- [ ] Database schema updated for render jobs
- [ ] User dashboard shows render status
- [ ] Email notifications for completed videos
- [ ] Cost monitoring (track API usage)
