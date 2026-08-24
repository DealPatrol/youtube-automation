import { StrategyPrompt } from "@/lib/types/strategy";

export const STRATEGY_PROMPTS: StrategyPrompt[] = [
  {
    id: 1,
    title: "Niche & Channel Identity",
    shortTitle: "Niche Finder",
    description: "Discover your perfect profitable niche with channel name, tagline, and content angle.",
    fields: [
      {
        key: "interests",
        label: "Your Interests & Skills",
        placeholder: "e.g. tech, cooking, personal finance, AI tools, gaming...",
        type: "textarea",
      },
      {
        key: "goals",
        label: "Your Goals",
        placeholder: "e.g. replace income, side hustle, brand building, $5k/month in 6 months...",
        type: "textarea",
      },
      {
        key: "timeAvailable",
        label: "Hours Per Week Available",
        placeholder: "e.g. 10 hours/week",
        type: "text",
      },
    ],
    buildPrompt: (vals) => `You are a YouTube strategist. I need help finding a profitable niche for an AI-powered YouTube channel.
My interests and skills: ${vals.interests}
My goals: ${vals.goals}
Time available: ${vals.timeAvailable} per week

Analyze and give me the top 3 niche options. For each niche provide:
- Channel Name
- Tagline (one punchy sentence)
- Content Angle (unique positioning)
- Monetization Potential (rate 1-10 and explain why)
- Competition Level (Low/Medium/High with explanation)
- Content Sustainability (can I keep making content for 2+ years?)
- Audience Demand (search volume and trend direction)

Be specific, actionable, and bold. Don't give generic advice. Format clearly with headers for each niche option.`,
  },
  {
    id: 2,
    title: "90-Day Content Roadmap",
    shortTitle: "Content Calendar",
    description: "Week-by-week 90-day content calendar with SEO titles, pillars, Shorts strategy, and milestone goals.",
    fields: [
      {
        key: "niche",
        label: "Your Niche",
        placeholder: "e.g. AI tools for small business owners",
        type: "text",
      },
      {
        key: "audience",
        label: "Target Audience",
        placeholder: "e.g. entrepreneurs aged 30-50 who want to save time with AI",
        type: "text",
      },
      {
        key: "postingFreq",
        label: "Posting Frequency",
        placeholder: "e.g. 3 videos per week",
        type: "text",
      },
    ],
    buildPrompt: (vals) => `You are a YouTube strategist and content planner. Create a detailed 90-day YouTube content calendar.

Niche: ${vals.niche}
Target Audience: ${vals.audience}
Posting Frequency: ${vals.postingFreq}

Provide:
1. A week-by-week table (Weeks 1-12) with video titles optimized for SEO
2. Label each video as: [EDU] Educational, [ENT] Entertaining, or [VIR] Viral potential
3. Shorts strategy: 1 Short per long-form video — brief description of each Short
4. Milestone goals section:
   - How to reach 100 subs (first 30 days)
   - How to reach 500 subs (days 31-60)
   - How to reach 1000 subs / monetization threshold (days 61-90)
5. Content pillars: define the 3 main content categories for this channel

Format the calendar as a clean week-by-week breakdown. Be specific with actual video titles, not placeholders.`,
  },
  {
    id: 3,
    title: "Viral Script Writer",
    shortTitle: "Script Writer",
    description: "Full 8-10 minute YouTube script with hook, problem agitation, value delivery, and CTAs.",
    fields: [
      {
        key: "title",
        label: "Video Title",
        placeholder: "e.g. 5 AI Tools That Make Me $3,000/Month (And I Only Work 2 Hours/Day)",
        type: "text",
      },
      {
        key: "niche",
        label: "Your Niche/Channel",
        placeholder: "e.g. AI productivity for entrepreneurs",
        type: "text",
      },
      {
        key: "audience",
        label: "Target Viewer",
        placeholder: "e.g. busy entrepreneurs who want to automate their business",
        type: "text",
      },
    ],
    buildPrompt: (vals) => `You are a professional YouTube scriptwriter. Write a full YouTube script.
Video Title: "${vals.title}"
Channel Niche: ${vals.niche}
Target Viewer: ${vals.audience}

Structure the script with these exact sections:

**HOOK (0:00 - 0:30)**
First 30 seconds that stops the scroll. Start with a bold statement, surprising fact, or direct challenge. No intros.

**PROBLEM AGITATION (0:30 - 1:30)**
Dig into the pain point. Make the viewer feel understood. Build tension.

**CREDIBILITY BRIDGE (1:30 - 2:00)**
Quick reason why they should trust you on this topic.

**VALUE DELIVERY (2:00 - 8:00)**
3-5 clear steps or points. Add a [PATTERN INTERRUPT] note every 90 seconds (B-roll cue, screen share, story, stat). Each point should have: the tip, why it works, and a quick example.

**RECAP & SOFT CTA (8:00 - 9:00)**
Summarize the key points in 3 sentences.

**STRONG CTA (9:00 - END)**
Tell them exactly what to do next (subscribe, comment, watch next video).

Tone: Conversational, confident, zero fluff. Write it like you're talking to a friend, not reading a textbook. Target length: 8-10 minutes (approx. 1,200-1,500 words spoken).`,
  },
  {
    id: 4,
    title: "SEO & Title Optimizer",
    shortTitle: "SEO Optimizer",
    description: "10 title variations, optimized description, thumbnail text, tags, and best posting times.",
    fields: [
      {
        key: "topic",
        label: "Video Topic",
        placeholder: "e.g. how to use AI to write product descriptions for Shopify",
        type: "text",
      },
      {
        key: "audience",
        label: "Target Audience",
        placeholder: "e.g. ecommerce store owners in the US",
        type: "text",
      },
      {
        key: "niche",
        label: "Channel Niche",
        placeholder: "e.g. AI for ecommerce",
        type: "text",
      },
    ],
    buildPrompt: (vals) => `You are a YouTube SEO expert. Optimize this video for maximum reach and click-through rate.
Video Topic: ${vals.topic}
Target Audience: ${vals.audience}
Channel Niche: ${vals.niche}

Deliver:

**10 TITLE VARIATIONS**
Mix of: curiosity gap, numbers, emotional triggers, "how to", controversy, transformation
Rate each title 1-10 for click-through potential with a one-line reason.

**OPTIMIZED VIDEO DESCRIPTION (150 words)**
- First 2 lines must include the main keyword (shows in search preview)
- Include 5-7 natural keyword variations
- Add timestamps placeholder
- End with subscribe CTA and social links placeholder

**5 THUMBNAIL TEXT IDEAS**
Under 5 words each. Bold, readable at small size. Power words only.

**10 SEO TAGS**
Mix of broad and specific. Include long-tail keywords.

**BEST POSTING TIME**
Recommend best day and time for the target audience's timezone with reasoning.

**KEYWORD STRATEGY**
What's the main keyword? What's the search volume ballpark? What related keywords should I target in future videos?`,
  },
  {
    id: 5,
    title: "Monetization Strategy",
    shortTitle: "Monetization",
    description: "Full monetization roadmap: AdSense, sponsorships, digital products, affiliates, and revenue estimates.",
    fields: [
      {
        key: "niche",
        label: "Channel Niche",
        placeholder: "e.g. AI tools for small business",
        type: "text",
      },
      {
        key: "subscribers",
        label: "Current Subscribers",
        placeholder: "e.g. 0, 250, 1500...",
        type: "text",
      },
      {
        key: "contentType",
        label: "Content Type",
        placeholder: "e.g. tutorials, reviews, vlogs, educational",
        type: "text",
      },
    ],
    buildPrompt: (vals) => `You are a YouTube monetization strategist. Build a full monetization roadmap.
Channel Niche: ${vals.niche}
Current Subscribers: ${vals.subscribers}
Content Type: ${vals.contentType}

Provide:

**ADSENSE TIMELINE**
When will I realistically hit 1,000 subs + 4,000 watch hours? What steps accelerate this?

**SPONSORSHIP ROADMAP**
- When to start outreach (subscriber count)
- What niches/brands to target
- 2 outreach email templates (cold email format, DM format)
- Expected CPM rates for my niche

**DIGITAL PRODUCT IDEAS**
List 5 specific product ideas for this niche with:
- Product name
- Price point
- Why this audience will buy it
- How to create it (simple vs complex)

**AFFILIATE PROGRAMS**
List 5-8 affiliate programs that match this niche with commission rates.

**COMMUNITY/MEMBERSHIP MODEL**
Describe a Patreon or YouTube membership tier structure with pricing.

**REVENUE ESTIMATES TABLE**
Show realistic monthly revenue for each stream at: 1K subs | 10K subs | 100K subs`,
  },
  {
    id: 6,
    title: "Shorts & Viral Clips",
    shortTitle: "Shorts Extractor",
    description: "Extract 5 YouTube Shorts from your long-form script with hooks, CTAs, and trending audio suggestions.",
    fields: [
      {
        key: "script",
        label: "Your Long-Form Script or Video Summary",
        placeholder: "Paste your script or a summary of your video content here...",
        type: "textarea",
      },
      {
        key: "niche",
        label: "Channel Niche",
        placeholder: "e.g. AI productivity tools",
        type: "text",
      },
    ],
    buildPrompt: (vals) => `You are a YouTube Shorts specialist. Extract viral Shorts from this long-form content.
Channel Niche: ${vals.niche}

Long-Form Script/Summary:
${vals.script}

Deliver:

**5 YOUTUBE SHORTS SCRIPTS**
For each Short:
- Short Title (SEO optimized)
- Hook (first 3 seconds — must grab instantly, no context assumed)
- Core Message (the one thing they'll learn, under 45 seconds)
- CTA (5 seconds — specific action)
- Trending Audio Style suggestion (describe the vibe: upbeat/dramatic/lo-fi/etc.)
- Best visual approach for vertical format

**REPLAY ANALYSIS**
Which moment from the long-form video will get the most replays? Why? How can I make that moment even more re-watchable?

**SHORTS POSTING STRATEGY**
Best schedule to post these 5 Shorts relative to the long-form video (before/after/same day).

**HOOK FORMULAS USED**
Label which hook formula each Short uses (curiosity gap / bold claim / question / story open / stat shock).`,
  },
  {
    id: 7,
    title: "Channel Automation System",
    shortTitle: "Automation SOP",
    description: "Complete AI-powered YouTube workflow for 2 hours/day with tools, SOPs, and batch creation system.",
    fields: [
      {
        key: "niche",
        label: "Channel Niche",
        placeholder: "e.g. AI tools for entrepreneurs",
        type: "text",
      },
      {
        key: "budget",
        label: "Monthly Tool Budget",
        placeholder: "e.g. $0 (free only), $50/month, $200/month",
        type: "text",
      },
      {
        key: "skills",
        label: "Your Current Skills",
        placeholder: "e.g. basic video editing, can write scripts, no voiceover experience",
        type: "text",
      },
    ],
    buildPrompt: (vals) => `You are a YouTube systems designer. Create a complete AI-powered production workflow.
Channel Niche: ${vals.niche}
Monthly Tool Budget: ${vals.budget}
Your Current Skills: ${vals.skills}

Design a system where I can produce:
- 3 videos per week = 12 videos per month
- 2 hours per day maximum
- Using AI tools for script, voiceover, editing

Deliver:

**DAILY WORKFLOW SOP** (step-by-step, minute-by-minute)
- 9:00 AM - [Task description] - [Tool used]
- 9:15 AM - [Task description] - [Tool used]
(Break down the entire 2-hour workflow)

**WEEKLY BATCH SYSTEM**
How to batch 3 videos in one session? Recommended batching strategy?

**RECOMMENDED TOOLS STACK** (considering $${vals.budget} budget)
- For script generation: [Tool + cost]
- For TTS/voiceover: [Tool + cost]
- For video editing: [Tool + cost]
- For thumbnail design: [Tool + cost]
- For SEO/research: [Tool + cost]
Total monthly cost: Should be $${vals.budget} or less

**AUTOMATION CHECKLIST**
What parts can be fully automated? What needs human input?

**GROWTH MILESTONES**
- By week 12: Expected subs, views, watch hours
- By month 6: Next growth phase

**ERROR HANDLING**
If AI-generated script is bad, what's the backup process?
If voiceover fails, how do I retry?

Format as a playbook. Be specific—this is the exact system I'll follow every day.`,
  },
];

export function getStrategyPrompt(promptNumber: number): StrategyPrompt | undefined {
  return STRATEGY_PROMPTS.find((p) => p.id === promptNumber);
}

export function getAllPrompts(): StrategyPrompt[] {
  return STRATEGY_PROMPTS;
}
