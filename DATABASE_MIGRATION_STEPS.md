# VideoForge Database Migration - Step by Step

## CRITICAL: Run This Before Testing

Your VideoForge project won't work until you create the required database tables. Here's how:

### Step 1: Get Your Supabase URL & Key
1. Go to your Supabase dashboard: https://app.supabase.com/
2. Select your project (the one connected to v0)
3. Go to **Settings** → **API** 
4. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Service Role Key** (anon key won't work for migrations)

### Step 2: Run the Database Migration

**Option A: Via Supabase Dashboard (Easiest)**
1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy the entire content from `/vercel/share/v0-project/scripts/002-videoforge-tables.sql`
4. Paste it into the query editor
5. Click **Run** (or press Ctrl+Enter)
6. Wait for success message ✓

**Option B: Via Command Line (Advanced)**
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Run the migration
psql postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres < scripts/002-videoforge-tables.sql

# Replace PASSWORD with your Supabase password
# Replace xxxxx with your project ref from the URL
```

### Step 3: Verify the Migration

Go back to Supabase Dashboard:
1. Click **Table Editor** (left sidebar)
2. You should see these new tables:
   - `scripts`
   - `videos`
   - `voiceovers`
   - `clips`
   - `trending_topics`
   - `user_usage`
   - `video_pricing`
   - `audit_logs`

If you see all 8 tables, you're good! ✓

### Step 4: Verify Environment Variables

Make sure these are set in your Vercel project settings:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key
- `ANTHROPIC_API_KEY` - Your Claude API key (already added)

### Step 5: Test Locally
```bash
cd /vercel/share/v0-project
npm run dev
# Visit http://localhost:3000/dashboard/create
```

## Common Issues

**"Permission denied" error?**
- Use the Service Role Key, NOT the anon key
- Make sure you're logged into the correct Supabase project

**"Table already exists" error?**
- That's OK! The migration script uses `IF NOT EXISTS` to avoid re-creating tables
- Just keep running until it completes

**"Column xxx does not exist" error later?**
- The migration may not have fully run
- Run the SQL script again from Step 2

## Next Steps After Migration

1. Deploy to Vercel: `git push origin main`
2. Configure YouTube OAuth in environment variables
3. Test the video creation workflow
4. Add Stripe integration when ready

---

**Once migration is complete, your VideoForge backend is 100% ready to use!**
