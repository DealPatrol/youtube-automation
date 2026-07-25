# Fix "Unknown error" in VideoForge

## Root Cause

The "Unknown error" message appears because the `ANTHROPIC_API_KEY` environment variable is not set in your Vercel project. This is required for the AI script generation feature to work.

## Quick Fix (5 minutes)

### Step 1: Add Your API Key to Vercel

1. Go to **Vercel Dashboard** → Your VideoForge Project
2. Click **Settings** (top right)
3. Go to **Environment Variables**
4. Add this variable:
   - **Name**: `ANTHROPIC_API_KEY`
   - **Value**: `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`
   - **Environments**: Select all (Production, Preview, Development)

5. Click **Save**

### Step 2: Redeploy

After adding the environment variable, Vercel automatically redeployed your app. If not:
1. Go to **Deployments**
2. Click the latest deployment
3. Click **Redeploy** button

### Step 3: Test

Refresh the page and try creating a video again. The error should now be gone and scripts should generate successfully.

---

## If Error Still Persists

### Check the Browser Console

1. Open your page in Chrome/Firefox
2. Right-click → **Inspect** → **Console** tab
3. Look for red errors with `[v0]` prefix
4. Take a screenshot and reference the exact error

### Common Issues

**Issue**: "ANTHROPIC_API_KEY is not configured"
- **Fix**: Make sure you added the exact key from above and redeployed

**Issue**: "Failed to generate script" (without details)
- **Fix**: Check your API key is correct - go to https://console.anthropic.com/ and verify it works

**Issue**: Rate limit or quota exceeded
- **Fix**: You may have hit API limits. Check your Anthropic console usage

---

## Advanced Debugging

### Enable Debug Mode

The code now includes enhanced logging. Check:
1. Browser Console (F12 → Console tab)
2. Vercel Logs: Dashboard → Deployments → Latest → Logs
3. Look for `[v0]` prefixed messages

### Server-Side Logs

To see server errors:
1. Go to **Vercel Dashboard** → **VideoForge Project**
2. Click **Deployments** → Latest deployment
3. Click **Logs** tab
4. Search for errors related to "generate"

### Test the API Directly

Run this in your browser console:

```javascript
fetch('/api/scripts/generate/estimate?duration=600')
  .then(r => r.json())
  .then(data => console.log(data))
  .catch(e => console.error(e));
```

If this returns an error about ANTHROPIC_API_KEY, then environment variables weren't set correctly.

---

## Verify Setup

Run this checklist:

- [ ] ANTHROPIC_API_KEY added in Vercel Environment Variables
- [ ] All three environments selected (Production, Preview, Development)
- [ ] Project redeployed (check Deployments shows recent build)
- [ ] Cleared browser cache (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
- [ ] Tried creating a video without errors

---

## Still Stuck?

If you've done all the above and still seeing "Unknown error":

1. **Check API Key**: https://console.anthropic.com/ → verify key works
2. **Check Logs**: Vercel Dashboard → Deployments → Logs
3. **Check Database**: Make sure Supabase migration ran (scripts tables exist)
4. **Contact Support**: Open a ticket at vercel.com/help with the server logs

---

## What Should Happen

Once fixed:
1. Enter a video topic (e.g., "Top 10 productivity hacks")
2. Select format (YouTube Long-form)
3. Click "Generate Script"
4. Watch Claude AI generate your script in real-time
5. See the script preview with scenes and voiceover text

If you see all this without errors, you're good to go!
