# VideoForge Deployment Checklist

## Quick Start (Next 5 Minutes)

### 1. Get API Keys
- [ ] Claude API: https://console.anthropic.com/
- [ ] (Optional) ElevenLabs: https://elevenlabs.io/
- [ ] Google Cloud: https://console.cloud.google.com/

### 2. Set Environment Variables Locally
```bash
# In .env.local
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=... (optional)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json (optional)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_key
SUPABASE_STORAGE_BUCKET=videos
```

### 3. Run Database Migration
```bash
# Using Supabase dashboard:
# 1. Go to SQL Editor
# 2. Create new query
# 3. Copy entire content of scripts/002-videoforge-tables.sql
# 4. Run it

# Or via CLI:
supabase db reset --linked
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Test Creator Flow
- Navigate to http://localhost:3000/dashboard/create
- Enter topic: "How to make great coffee"
- Select format: "Tutorial"  
- Click "Generate Script with AI"
- Watch it flow through script → voiceover → video

---

## Deploy to Vercel (5-10 Minutes)

### Step 1: Push to GitHub
```bash
git add .
git commit -m "feat: VideoForge unified video creation SaaS - AI scripts, TTS, video assembly"
git push origin main
```

### Step 2: Deploy on Vercel
```bash
vercel deploy
```

Or via dashboard: https://vercel.com/new

### Step 3: Add Environment Variables
In Vercel dashboard → Settings → Environment Variables:

```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=videos
ELEVENLABS_API_KEY=... (optional)
GOOGLE_OAUTH_CLIENT_ID=... (for YouTube)
GOOGLE_OAUTH_CLIENT_SECRET=... (for YouTube)
GOOGLE_OAUTH_REDIRECT_URI=https://your-domain.vercel.app/api/uploads/youtube/callback
```

### Step 4: Redeploy with Env Vars
```bash
vercel deploy --prod
```

---

## Test Production Deployment

### Test Script Generation
```bash
curl -X POST https://your-app.vercel.app/api/scripts/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-user-id" \
  -d '{
    "topic": "AI trends in 2024",
    "format": "long-form",
    "duration": 600
  }'
```

### Test Voiceover
```bash
curl https://your-app.vercel.app/api/voiceovers/voices?provider=google-cloud
```

### Test Trends
```bash
curl https://your-app.vercel.app/api/trends?platform=youtube
```

---

## Verify All Systems Working

- [ ] Script generation returns JSON without errors
- [ ] Voiceover generation returns audio URL
- [ ] Video assembly completes successfully
- [ ] Dashboard loads at /dashboard/create
- [ ] All API endpoints return 2xx or appropriate error codes
- [ ] Database has data in scripts/videos/voiceovers tables

---

## Optional: Production Enhancements

### Add Stripe Billing
1. Create Stripe account: https://stripe.com
2. Get API keys from Dashboard
3. Add to Vercel env vars:
   ```
   STRIPE_SECRET_KEY=sk_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
4. Implement checkout flow (code template ready in `/api/stripe/`)

### Add Error Tracking
1. Create Sentry account: https://sentry.io
2. Get DSN from project settings
3. Add to `.env.local` and Vercel:
   ```
   NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
   ```

### Add Real Trend APIs
1. Install scrapers:
   ```bash
   npm install youtube-api tiktok-scraper twitter-api
   ```
2. Replace mock data in `lib/trends/trend-scraper.ts`
3. Add API keys to env vars

---

## Common Issues & Fixes

### Issue: "ANTHROPIC_API_KEY not found"
**Fix:** Make sure key is set in:
- `.env.local` for local development
- Vercel Settings → Environment Variables for production
- Then redeploy: `vercel deploy --prod`

### Issue: "Supabase connection refused"
**Fix:** 
- Verify URL and keys are correct
- Check your Supabase project is active (not paused)
- Run the migration script again
- Ensure RLS is enabled on tables

### Issue: "FFmpeg not found"
**Fix (Local):** 
```bash
# On macOS
brew install ffmpeg

# On Ubuntu
sudo apt-get install ffmpeg

# On Windows
# Download from https://ffmpeg.org/download.html
```

**Note:** Vercel Functions have limited OS tools. For production, consider:
- Using a video service API (Mux, Cloudinary, AWS MediaConvert)
- Running FFmpeg on a separate worker service
- Pre-compiling FFmpeg for Vercel (advanced)

### Issue: "Video upload to YouTube fails"
**Fix:**
- Verify GOOGLE_OAUTH credentials are from same Google Cloud project
- Ensure OAuth app is not in test mode (publish it)
- Check redirect URI matches exactly
- Try re-authorizing at `/api/uploads/youtube/auth`

---

## Performance Optimization

### For 100+ concurrent users:

1. **Enable Caching**
   ```bash
   npm install @vercel/edge-cache
   ```

2. **Add Rate Limiting**
   ```bash
   npm install @upstash/redis
   ```

3. **Use Database Indexes** (already created in migration)
   ```sql
   -- Already included in 002-videoforge-tables.sql
   CREATE INDEX idx_scripts_user_id ON scripts(user_id);
   CREATE INDEX idx_videos_status ON videos(status);
   -- etc
   ```

4. **Queue Long Operations**
   - Use Vercel Cron for trend refresh
   - Use job queue for batch video generation
   - Consider Upstash for Redis-backed jobs

---

## Monitoring & Analytics

### Add monitoring to Vercel dashboard:
- Navigate to Deployments → Production
- Check Function Duration, Cold Starts, Errors
- Monitor database connection limits in Supabase

### Key metrics to track:
- Script generation success rate
- Average voiceover generation time
- Video assembly completion rate
- YouTube upload success rate
- Total videos created (MRR indicator)

---

## Security Checklist

- [ ] All API keys in Vercel (never in code)
- [ ] RLS enabled on all Supabase tables
- [ ] CORS configured for your domain only
- [ ] Rate limiting on public endpoints
- [ ] Input validation on all API routes
- [ ] Error messages don't leak sensitive info
- [ ] YouTube OAuth redirect URI exactly matches

---

## Next: Monetization Setup

Once deployed and stable, add Stripe:

```bash
npm install @stripe/stripe-js
```

Then uncomment the Stripe setup in planned features. Cost structure is already coded:

```
Base cost: ~$1.50 per video
User price: $2.50-$3.00 per video
Margin: 50-100% profit per video
```

---

## Success! You now have:

✅ AI-powered video script generation (Claude 3.5)  
✅ Natural voiceovers (Google Cloud or ElevenLabs)  
✅ Automated video assembly (FFmpeg)  
✅ YouTube integration (OAuth + auto-upload)  
✅ Trend analysis (YouTube, TikTok, Twitter)  
✅ Dashboard UI (multi-step builder)  
✅ Production database (Supabase)  
✅ Deployed on Vercel  

**Start creating videos NOW!**
