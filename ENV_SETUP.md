# Environment Variables Setup Guide

## Quick Setup Checklist

Add these to your v0 Vars section (click "Vars" in the left sidebar):

### Required Core Variables

**Supabase:**
\`\`\`
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
\`\`\`

**YouTube Integration:**
\`\`\`
YOUTUBE_CLIENT_ID=your_youtube_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret
NEXTAUTH_URL=https://your-domain.com (or http://localhost:3000 for local dev)
\`\`\`

**OpenAI (for video script generation):**
\`\`\`
OPENAI_API_KEY=your_openai_api_key
\`\`\`

### Optional Variables

**Firebase (if using for auth/storage):**
\`\`\`
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY_ID=your_firebase_private_key_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_CLIENT_ID=your_firebase_client_id
\`\`\`

**Stripe (for payments):**
\`\`\`
STRIPE_PRICE_ID_PRO=your_stripe_price_id
\`\`\`

**Cron Jobs (for scheduled uploads):**
\`\`\`
CRON_SECRET=your_secure_random_string
\`\`\`

**Video Processing:**
\`\`\`
FASTAPI_URL=http://localhost:8000 (for local dev) or your-backend-url
NEXT_PUBLIC_API_URL=http://localhost:8000
UNSPLASH_ACCESS_KEY=your_unsplash_api_key
\`\`\`

## How to Get Each Variable

### 1. Supabase
- Go to [supabase.com](https://supabase.com)
- Create/select your project
- Go to Settings → API
- Copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- Copy `Service Role Key` → `SUPABASE_SERVICE_ROLE_KEY`

### 2. YouTube OAuth Credentials
- Go to [Google Cloud Console](https://console.cloud.google.com)
- Create a project
- Enable YouTube Data API v3
- Go to Credentials → Create OAuth 2.0 Client ID (Web Application)
- Add authorized redirect URIs:
  - `http://localhost:3000/api/auth/youtube/callback` (local)
  - `https://your-domain.com/api/auth/youtube/callback` (production)
- Copy Client ID → `YOUTUBE_CLIENT_ID`
- Copy Client Secret → `YOUTUBE_CLIENT_SECRET`

### 3. OpenAI API Key
- Go to [platform.openai.com](https://platform.openai.com)
- Create API key
- Set usage limits for safety
- Copy → `OPENAI_API_KEY`

### 4. Firebase (Optional)
- Go to [firebase.google.com](https://firebase.google.com)
- Create project
- Go to Project Settings
- Copy values from "Your apps" section

### 5. Stripe (Optional)
- Go to [stripe.com](https://stripe.com)
- Create product and price
- Copy price ID → `STRIPE_PRICE_ID_PRO`

### 6. Unsplash (Optional - for stock images)
- Go to [unsplash.com/developers](https://unsplash.com/developers)
- Create application
- Copy Access Key → `UNSPLASH_ACCESS_KEY`

## Local Development (.env.local)

If running locally, create a `.env.local` file in the root directory:

\`\`\`bash
# Core
NEXT_PUBLIC_SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
NEXTAUTH_URL=http://localhost:3000

# YouTube
YOUTUBE_CLIENT_ID=your_id
YOUTUBE_CLIENT_SECRET=your_secret

# OpenAI
OPENAI_API_KEY=your_key

# Optional - FastAPI Backend
FASTAPI_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000

# Optional - Cron Secret
CRON_SECRET=your_secure_random_string
\`\`\`

## Production Deployment (Vercel)

1. Go to your Vercel project settings
2. Go to Environment Variables
3. Add all required variables (use the public URLs, not localhost)
4. Make sure `NEXTAUTH_URL=https://your-production-domain.com`

## Security Notes

- **Never commit `.env.local`** - add it to `.gitignore`
- **Keep secrets private** - don't share API keys or secrets
- **Use environment variables** - never hardcode secrets in code
- **Rotate keys regularly** - especially in production
- **Use service accounts** - for sensitive operations like YouTube uploads

## Troubleshooting

### "Missing Supabase credentials"
- Check `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Verify they're not empty strings
- Check for typos

### "YouTube not authenticated"
- Ensure `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` are set
- Verify YouTube Data API v3 is enabled in Google Cloud Console
- Check redirect URI matches exactly

### "Invalid API key"
- Verify `OPENAI_API_KEY` is set and not expired
- Check you have API credits available
- Try regenerating the key in OpenAI dashboard

## Testing Variables

Use these endpoints to verify variables are set correctly:

\`\`\`bash
# Test Supabase connection
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  $NEXT_PUBLIC_SUPABASE_URL/rest/v1/results

# Test OpenAI connection
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models
\`\`\`

## Next Steps

1. Add all required variables to v0 Vars section
2. Deploy to production with `NEXTAUTH_URL=https://your-domain.com`
3. Test YouTube upload flow: Results page → Upload to YouTube → Grant permissions
4. Test video generation: Create new project → Generate → Download or Upload
