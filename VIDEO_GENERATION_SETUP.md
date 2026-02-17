# Video Generation Setup Guide

## Required Environment Variables

To enable video generation in your YouTube AI Builder app, you need the following environment variables:

### 1. OpenAI (Script Generation)
\`\`\`
OPENAI_API_KEY=sk-...
\`\`\`
**Get it from:** https://platform.openai.com/api-keys
- Used for generating video scripts, scenes, SEO data, and thumbnails
- Cost: ~$0.01-0.05 per video generation

### 2. fal.ai (Image Generation)
\`\`\`
FAL_KEY=...
\`\`\`
**Get it from:** https://fal.ai/dashboard/keys
- Used for generating scene images from visual descriptions
- Free tier: 100 requests/month
- Cost: ~$0.003 per image after free tier

### 3. Supabase (Database)
\`\`\`
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_STORAGE_BUCKET=videos
\`\`\`
**Get it from:** Your Supabase project settings
- Already configured if you have Supabase integration
- `SUPABASE_STORAGE_BUCKET` should be a public bucket where assembled videos are uploaded

### 4. FFmpeg (Video Assembly)
Install FFmpeg locally or on your server:

- macOS: `brew install ffmpeg`
- Ubuntu: `sudo apt-get install ffmpeg`
- Windows: https://ffmpeg.org/download.html

If you are running on Vercel, you should offload assembly to a backend with FFmpeg:

\`\`\`
VIDEO_ASSEMBLY_URL=https://your-backend.com/api/assemble-video
\`\`\`
The backend must have these env vars:
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`

### 5. Optional Enhancements
\`\`\`
BACKGROUND_MUSIC_URL=https://your-cdn.com/music.mp3
BACKGROUND_MUSIC_PATH=./public/audio/background.mp3
BACKGROUND_MUSIC_VOLUME=0.2
BRANDING_LOGO_URL=https://your-cdn.com/logo.png
BRANDING_LOGO_PATH=./public/placeholder-logo.png
BRANDING_LOGO_SCALE=0.12
BRANDING_LOGO_OPACITY=0.85
BRANDING_LOGO_POSITION=top-right
BRANDING_LOGO_PADDING=24
ENABLE_YOUTUBE_CAPTIONS=true
\`\`\`
- Background music and branding are optional; set either a URL or a local path
- Captions are auto-generated from scene narration when available

## Setup Steps

### Step 1: Get fal.ai API Key

1. Go to https://fal.ai
2. Sign up for a free account
3. Navigate to Dashboard → API Keys
4. Create a new API key
5. Copy the key and add it to your environment variables as `FAL_KEY`

### Step 2: Test Video Generation

1. Go to your app homepage
2. Fill in the video creation form:
   - Topic: "How to make money online"
   - Length: 10 minutes
   - Tone: Educational
   - Platform: YouTube
3. Click "Generate Video"
4. Wait 30-60 seconds for script generation
5. On the results page, click "Create Video"
6. Wait 2-5 minutes for scene images to generate

### Step 3: Verify Setup

Check the browser console for logs:
- ✅ `[API] OPENAI_API_KEY exists: true`
- ✅ `[API] Generating image for scene 1: Intro Scene`
- ✅ `[API] Scene 1 image generated: https://...`
- ✅ `[API] Video generation complete`

## How It Works

1. **Script Generation** (30s)
   - User submits video idea
   - OpenAI generates script, scenes, SEO, thumbnail
   - Saved to Supabase

2. **Image Generation** (2-5 min)
   - For each scene, fal.ai generates a 16:9 image
   - Images stored and linked to scenes
   - Results page updated with preview

3. **Video Assembly** (Manual in Editor)
   - User opens project in video editor
   - Scenes displayed with generated images
   - Can edit, trim, add effects
   - Export or upload to YouTube

## Costs

For 100 videos per month:
- OpenAI: ~$3-5
- fal.ai: ~$0.90 (300 images @ $0.003 each)
- **Total: ~$4-6/month**

## Troubleshooting

**Error: "Image generation not configured"**
- Make sure `FAL_KEY` is added to environment variables
- Verify the key starts with your fal.ai API key format

**Error: "Failed to generate image"**
- Check fal.ai API quota
- Verify scene descriptions are not empty
- Try regenerating individual scenes

**Images not appearing**
- Check browser console for CORS errors
- Verify Supabase is updating scene `image_url` fields
- Refresh the results page

**Slow generation**
- Each scene takes ~30-40 seconds to generate
- 3 scenes = ~2 minutes total
- Use fewer scenes for faster generation

## Advanced: Custom Video Rendering

To create actual video files (not just images):

1. Set up a video rendering backend (FFmpeg, MoviePy, etc.)
2. Deploy to a service like Render.com or Railway
3. Add endpoint URL as `VIDEO_RENDER_URL` env variable
4. Update `/app/api/render-video/route.ts` to call your backend

Example video rendering services:
- **Remotion** - React-based video rendering
- **Shotstack** - Cloud video editing API
- **Custom FFmpeg** - Self-hosted with Docker

## Next Steps

1. Add `FAL_KEY` to your Vercel environment variables
2. Test video generation end-to-end
3. Customize scene prompts for better images
4. Set up YouTube OAuth for direct uploads
5. Build scheduling/automation features
