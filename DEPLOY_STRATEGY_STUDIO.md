# Deploy YouTube Strategy Studio - Step by Step

## Prerequisites
- Vercel project already deployed
- Supabase connected
- ANTHROPIC_API_KEY set in environment variables

## Step 1: Run Database Migration

This creates the 7 new tables needed for YouTube Strategy Studio.

### In Supabase Dashboard:
1. Log in to https://app.supabase.com
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy the entire contents of: `scripts/003-youtube-strategy-tables.sql`
6. Paste into the SQL editor
7. Click **Run**
8. Wait for ✓ Success message

You should see:
```
CREATE TABLE channel_strategies...
CREATE TABLE strategy_outputs...
CREATE TABLE content_roadmaps...
... (and 5 more tables)

ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
CREATE POLICY ... (RLS policies)

[All completed successfully]
```

## Step 2: Push to GitHub

```bash
cd /vercel/share/v0-project

# Verify all new files exist
git status

# Should see:
# New files:
#   - app/dashboard/strategy/page.tsx
#   - app/api/strategy/generate/route.ts
#   - lib/ai/strategy-prompts.ts
#   - lib/db/strategy-queries.ts
#   - lib/types/strategy.ts
#   - lib/auth/use-session.ts
#   - scripts/003-youtube-strategy-tables.sql
#   - YOUTUBE_STRATEGY_INTEGRATION.md
#   - STRATEGY_INTEGRATION_SUMMARY.md
#   - DEPLOY_STRATEGY_STUDIO.md
#
# Modified files:
#   - app/dashboard/page.tsx
#   - lib/ai/script-generator.ts

# Commit the changes
git add .
git commit -m "feat: Add YouTube Strategy Studio integration

- Add 7 AI-powered strategy prompts (Niche Finder, Content Calendar, Script Writer, SEO Optimizer, Monetization, Shorts Extractor, Automation SOP)
- Create standalone YouTube Strategy Studio dashboard at /dashboard/strategy
- Integrate strategy context into script generation for context-aware videos
- Add 7 new Supabase tables with RLS policies
- Add strategy API endpoint (/api/strategy/generate)
- Update dashboard navigation with YouTube Strategy button

Components implemented:
A) Pre-creation strategy setup for video generation
C) Internal automation optimization from Strategy SOP
D) Standalone YouTube Strategy Studio page

Files: 10 new, 2 modified
Lines: ~1,770 total"

# Push to GitHub
git push origin main
```

## Step 3: Verify Deployment

### Check Vercel Deployment
1. Go to https://vercel.com/dashboard
2. Click your project
3. Wait for deployment to complete (should be ~2 min)
4. When you see "Production" with ✓, it's live

### Test in Production

1. Open your live app: `https://your-app.vercel.app`
2. Navigate to **Dashboard**
3. Click **"YouTube Strategy"** button in top right
4. You should see the YouTube Strategy Studio page load

If you see a 404 or blank page:
- Check browser console for errors (F12)
- Verify ANTHROPIC_API_KEY is set in Vercel environment variables
- Verify Supabase tables were created (check in Supabase SQL Editor)

## Step 4: Complete Your First Strategy

### Test Run:
1. At `/dashboard/strategy`
2. Click on **"Prompt 1: Niche Finder"**
3. Fill in:
   - **Interests**: "AI tools, productivity, entrepreneurship"
   - **Goals**: "Build side income, $5k/month in 6 months"
   - **Hours Available**: "10 hours/week"
4. Click **"RUN PROMPT"**
5. Wait 5-10 seconds for Claude response
6. You should see AI-generated niche recommendations

If it fails:
- Error: "Unauthorized" → Check ANTHROPIC_API_KEY
- Error: "Failed to create strategy" → Check Supabase connection
- Error: "Failed to save strategy output" → Check table permissions in Supabase

## Step 5: Verify Integration with Video Creation

### Test Strategy Context in Script Generation:
1. Complete all 7 prompts in YouTube Strategy Studio (takes ~5 min)
2. Go to **/dashboard/create** to create a video
3. When you generate a script, it will now:
   - Use your saved strategy context
   - Tailor the script to your niche
   - Include your target audience specifics
   - Add monetization angles

You can verify this by looking at the generated script - it should:
- Reference your specific niche
- Include examples for your audience
- Suggest monetization opportunities

## Troubleshooting

### Issue: "Database tables don't exist"
**Solution**: Run the migration script again in Supabase SQL Editor
```sql
-- Check if tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE '%strateg%';
-- Should show: channel_strategies, strategy_outputs, etc.
```

### Issue: "Strategy generation times out"
**Solution**: Check Claude API quota at console.anthropic.com
- Verify ANTHROPIC_API_KEY is correct
- Check if you've hit rate limits
- Try running a different prompt

### Issue: "Can't see YouTube Strategy button in dashboard"
**Solution**: 
- Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache
- Verify app redeployed successfully

### Issue: "Form fields don't work / inputs disappear"
**Solution**:
- Check browser console for JavaScript errors (F12)
- Verify React is loading correctly
- Try a different browser
- Clear localStorage: `localStorage.clear()` in console

### Issue: "AI response is blank or won't display"
**Solution**:
- Check that the response loaded (check Network tab in F12)
- Verify NEXT_PUBLIC_SUPABASE_URL environment variable is set
- Check Supabase connection status
- Try regenerating the prompt

## Rollback Plan

If you need to revert the changes:

```bash
# Undo the last commit (keeps files on disk)
git reset --soft HEAD~1

# Or, revert to previous version (removes files)
git revert HEAD
git push origin main

# In Supabase, drop the new tables:
DROP TABLE IF EXISTS script_strategy_context;
DROP TABLE IF EXISTS automation_sops;
DROP TABLE IF EXISTS monetization_plans;
DROP TABLE IF EXISTS content_pillars;
DROP TABLE IF EXISTS content_roadmaps;
DROP TABLE IF EXISTS strategy_outputs;
DROP TABLE IF EXISTS channel_strategies;
```

## Monitoring

### Check Application Logs:
1. Vercel Dashboard → your project → **Logs**
2. Look for any errors in the `/api/strategy/generate` endpoint
3. Check for 500 errors or timeouts

### Monitor Costs:
1. Anthropic Console → Usage Dashboard
2. Each prompt costs ~$0.01-0.03 (very cheap)
3. Monitor if there's unexpected usage

### Database Monitoring:
1. Supabase Dashboard → **Database** → **Tables**
2. Check row counts:
   - `channel_strategies` - should be 1 per user
   - `strategy_outputs` - should be ~7 per user (max)
   - Should grow slowly

## What to Tell Users

Once deployed, tell your users:

---

**New Feature: YouTube Strategy Studio** 🎬

You now have access to a complete 7-step YouTube strategy builder powered by AI!

**Get started:**
1. Go to Dashboard → Click "YouTube Strategy"
2. Work through 7 prompts (takes ~5 minutes)
3. Get AI-generated strategies for:
   - Finding your profitable niche
   - 90-day content calendar
   - Viral script formulas
   - SEO optimization
   - Monetization roadmap
   - Shorts extraction
   - Daily automation workflow

**Then:** Create videos with VideoForge and your strategy context will automatically enhance them!

---

## Next Steps

1. ✓ Run database migration
2. ✓ Deploy to Vercel
3. ✓ Test YouTube Strategy Studio
4. ✓ Complete your first strategy
5. ✓ Create a video with strategy context
6. ✓ Monitor performance and costs

**YouTube Strategy Studio is now live!** 🚀

---

## Support

If you hit any issues:
1. Check the **Troubleshooting** section above
2. Review error messages in browser console (F12)
3. Check Vercel deployment logs
4. Check Supabase connectivity
5. Verify all environment variables are set

**Everything should work - you're good to go!**
