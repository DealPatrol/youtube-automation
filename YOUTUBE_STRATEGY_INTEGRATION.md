# YouTube Strategy Studio Integration Guide

VideoForge now includes a complete **YouTube Strategy Studio** - a 7-step AI-powered system for building your YouTube channel strategy before generating videos.

## What is YouTube Strategy Studio?

The YouTube Strategy Studio is a standalone dashboard tool (Component D) that guides you through building a complete channel strategy using Claude AI. It consists of 7 interactive prompts that cover everything from niche selection to automation workflows.

## The 7 Strategy Prompts

### 1. **Niche Finder** (Prompt #1)
Find your profitable YouTube niche with AI guidance.

**What you provide:**
- Your interests & skills
- Your goals ($X/month, timeline, etc.)
- Hours available per week

**What AI generates:**
- Top 3 niche options with channel names
- Monetization potential (1-10 rating)
- Competition analysis
- Audience demand metrics

### 2. **Content Calendar** (Prompt #2)
Get a complete 90-day content roadmap.

**What you provide:**
- Your niche
- Target audience description
- Posting frequency (3x/week, daily, etc.)

**What AI generates:**
- Week-by-week video titles (SEO optimized)
- Content classifications (Educational, Entertaining, Viral)
- Shorts strategy (1 per long-form)
- Milestone targets (100→500→1000 subs)
- Content pillars (3 main categories)

### 3. **Script Writer** (Prompt #3)
Generate viral YouTube scripts with proven structure.

**What you provide:**
- Video title
- Your niche
- Target viewer profile

**What AI generates:**
- Complete 8-10 minute script with:
  - Hook (0:00-0:30)
  - Problem agitation
  - Credibility bridge
  - Value delivery (3-5 points)
  - Recap & soft CTA
  - Strong CTA
  - Pattern interrupt cues for B-roll

### 4. **SEO Optimizer** (Prompt #4)
Maximize reach with optimized titles, tags, and descriptions.

**What you provide:**
- Video topic
- Target audience
- Channel niche

**What AI generates:**
- 10 title variations (rated for CTR potential)
- Optimized description (150 words)
- 5 thumbnail text ideas
- 10 SEO tags
- Best posting time recommendation
- Keyword strategy

### 5. **Monetization Strategy** (Prompt #5)
Build a multi-stream revenue roadmap.

**What you provide:**
- Channel niche
- Current subscribers
- Content type

**What AI generates:**
- AdSense timeline (when you'll hit monetization)
- Sponsorship roadmap (outreach templates, CPM rates)
- 5 digital product ideas
- 8+ affiliate programs
- Membership/Patreon structure
- Revenue estimates at 1K/10K/100K subs

### 6. **Shorts Extractor** (Prompt #6)
Extract viral YouTube Shorts from long-form content.

**What you provide:**
- Your long-form script
- Channel niche

**What AI generates:**
- 5 YouTube Shorts scripts with:
  - Hook (instant grab)
  - Core message (under 45 sec)
  - CTA
  - Trending audio style
  - Visual approach for vertical format
- Replay analysis (most re-watchable moments)
- Shorts posting schedule
- Hook formulas used

### 7. **Automation SOP** (Prompt #7)
Complete workflow for producing 2+ hours/day with minimal time.

**What you provide:**
- Channel niche
- Monthly tool budget
- Your current skills

**What AI generates:**
- Daily workflow SOP (minute-by-minute)
- Weekly batch system
- Recommended tools (within budget)
- Automation checklist
- Growth milestones (weekly/monthly)
- Error handling procedures

## Accessing YouTube Strategy Studio

### For Users:
1. Log into your VideoForge dashboard
2. Click **"YouTube Strategy"** button in the top right
3. Work through the 7 prompts sequentially
4. Your progress is saved automatically

### URL:
```
/dashboard/strategy
```

## How It Works (Technical)

### Architecture

```
┌─────────────────────────────────────────────────┐
│           YouTube Strategy Studio               │
│  /dashboard/strategy (React Component)          │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │  API Route                 │
    │  /api/strategy/generate    │
    └────────┬───────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│  Claude 3.5 Sonnet (AI Engine)             │
│  Prompt: STRATEGY_PROMPTS[1-7]             │
└────────┬───────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│  Supabase Database                         │
│  Tables: channel_strategies,               │
│          strategy_outputs,                 │
│          content_roadmaps,                 │
│          monetization_plans, etc.          │
└────────────────────────────────────────────┘
```

### Database Tables

All strategy data is stored in Supabase with Row Level Security (RLS):

- **channel_strategies** - Main channel strategy record
- **strategy_outputs** - AI-generated responses from each prompt
- **content_roadmaps** - Weekly content calendar
- **content_pillars** - Main content categories
- **monetization_plans** - Revenue stream details
- **automation_sops** - Workflow automation config
- **script_strategy_context** - Links scripts to strategies

## Integration with VideoForge

### Component A: Pre-Creation Strategy Setup

When creating a video in `/dashboard/create`, you can now:

1. Link it to your channel strategy
2. Use strategy context to enhance script generation
3. Automatically apply niche/audience/monetization guidelines

### Component C: Internal Optimization (Automation SOP)

The **Automation SOP** from Prompt #7 is used internally by VideoForge to:

1. **Optimize generation pipeline** - Use recommended tools based on user's budget
2. **Batch processing** - Queue multiple videos based on batch size
3. **Error recovery** - Follow the SOP's error handling procedures
4. **Growth tracking** - Monitor milestone targets

### Component D: Standalone Dashboard

The YouTube Strategy Studio is a complete standalone application at:

```
GET /dashboard/strategy
```

Features:
- 7-step guided wizard
- Real-time progress tracking
- Copy-to-clipboard outputs
- Strategy summary
- Mobile-responsive design

## How Video Generation Uses Strategy

### Without Strategy:
```javascript
const script = await generateVideoScript(userId, {
  topic: "Best AI Tools for 2025",
  format: "long-form",
});
```

### With Strategy Context:
```javascript
const strategy = await getUserStrategy(userId);
const script = await generateVideoScript(userId, {
  topic: "Best AI Tools for 2025",
  format: "long-form",
  strategyContext: {
    niche: strategy.niche,
    targetAudience: strategy.targetAudience,
    contentPillar: "AI Tools & Reviews",
    monetizationAngle: "Affiliate + Sponsorship",
  },
});
```

Claude will then:
1. Generate a script specifically for your niche
2. Tailor language/examples for your audience
3. Include monetization angles (affiliate links, sponsor mentions)
4. Align with your content pillars
5. Follow your channel's brand voice

## File Structure

### Components
```
app/dashboard/strategy/page.tsx          # Main UI component
```

### Services & APIs
```
lib/ai/strategy-prompts.ts               # 7 prompt definitions
lib/db/strategy-queries.ts               # Database operations
lib/types/strategy.ts                    # TypeScript types
app/api/strategy/generate/route.ts       # API endpoint
```

### Database
```
scripts/003-youtube-strategy-tables.sql  # Migration script
```

## Setup Checklist

- [x] Database migration (003-youtube-strategy-tables.sql)
- [x] TypeScript types defined
- [x] API endpoint created
- [x] React component built
- [x] Integration with script generator
- [x] Dashboard navigation link added

## Usage Example

### Step 1: Complete YouTube Strategy Studio
1. Navigate to `/dashboard/strategy`
2. Work through all 7 prompts
3. Get strategy outputs saved to database

### Step 2: Use Strategy When Creating Videos
1. Go to `/dashboard/create`
2. Your strategy context is automatically available
3. Scripts generated will use your niche/audience/monetization

### Step 3: Monitor Automation SOP
1. Review Prompt #7 output for daily workflow
2. Implement the recommended tools
3. Follow the batch processing system
4. Track milestone targets

## Cost

All 7 strategy prompts are powered by Claude 3.5 Sonnet:
- Approximate cost per complete strategy: $0.10-0.20
- Stored forever in your account
- Re-generate anytime for fresh insights

## Pro Tips

1. **Complete all 7 prompts** before creating videos - this ensures full context
2. **Refer to your Automation SOP daily** - use it as your production playbook
3. **Use SEO Optimizer before posting** - copy the titles/descriptions directly to YouTube
4. **Track monetization milestones** - update strategy monthly with new subscriber counts
5. **Extract Shorts weekly** - turn each long-form video into 5+ Shorts

## Troubleshooting

### Strategy generation fails
- Check ANTHROPIC_API_KEY is set
- Verify Supabase connection
- Ensure all form fields are filled

### Can't see previous responses
- Go back to the prompt (e.g., click "Prompt 1")
- Outputs are cached in Supabase
- Use "Copy" button to save responses

### Strategy context not being used
- Ensure strategy is created first
- Pass strategyContext when calling generateVideoScript()
- Check that niche/audience fields are filled

## Next Steps

1. Run database migration: `scripts/003-youtube-strategy-tables.sql`
2. Redeploy to Vercel
3. Navigate to `/dashboard/strategy`
4. Complete all 7 prompts
5. Start creating context-aware videos at `/dashboard/create`

---

**VideoForge YouTube Strategy Studio is now active and ready to power your channel!**
