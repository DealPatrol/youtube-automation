# Content Pipeline — trend discovery to YouTube publish

One command takes a trending topic all the way to a published YouTube video:

```
trends (YouTube / Google Trends / X)
  → hook, script, shot list, title, thumbnail concept   (OpenAI structured output)
  → PHOTOS per scene                                    (fal.ai FLUX → Pexels → title card)
  → TTS narration + SRT/VTT captions                    (ElevenLabs → OpenAI TTS)
  → human approval screen                               (review.html per job)
  → FFmpeg render                                       (Ken Burns photos + narration + overlays)
  → rights manifest + YouTube publish                   (captions + thumbnail + AI disclosure)
```

Everything is stored locally under `content/jobs/<jobId>/` — no database required.

## Create content tonight (minimum setup)

The only **required** key is `OPENAI_API_KEY` (script + TTS). Everything else degrades
gracefully: trends fall back to Google Trends RSS (no key), photos fall back from
fal.ai to Pexels to generated title cards, and publishing is skipped until YouTube
credentials exist.

```bash
cp .env.example .env        # then set OPENAI_API_KEY at minimum
npm install

# 1. Preview today's trending topic candidates (optional)
npm run pipeline -- trends

# 2. Run the pipeline up to the approval gate
npm run pipeline -- create --minutes 1 --aspect 9:16 --tone energetic
#    ...or pick your own topic:
npm run pipeline -- create --topic "why everyone is switching to heat pumps" --minutes 1

# 3. Open the review screen it prints (content/jobs/<jobId>/review.html),
#    check hook, storyboard, narration audio, title, thumbnail — then:
npm run pipeline -- approve <jobId>     # renders video + writes rights manifest

# 4. Publish (once YouTube creds are set — see below)
npm run pipeline -- publish <jobId> --privacy unlisted
```

Fully hands-off (no approval gate, publishes immediately if creds exist):

```bash
npm run pipeline -- create --auto --privacy unlisted
```

## Recommended keys for better output

| Key | Stage | Effect |
|---|---|---|
| `OPENAI_API_KEY` | 2, 4 | **Required.** Script package + TTS fallback |
| `FAL_KEY` | 3 | AI-generated photos per scene (best visuals) |
| `PEXELS_API_KEY` | 3 | Real stock photos when fal.ai is unavailable |
| `ELEVENLABS_API_KEY` | 4 | Premium narration voice |
| `YOUTUBE_API_KEY` | 1 | Real YouTube trending chart for topic discovery |
| `X_BEARER_TOKEN` | 1 | X hashtag trend aggregation |
| `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` / `YOUTUBE_REFRESH_TOKEN` | 7 | Publishing |

## YouTube publishing setup (one time, ~5 min)

1. In Google Cloud Console, create an OAuth client (type: Web application) with
   redirect URI `http://localhost:8787/callback`, and enable the **YouTube Data API v3**.
2. Put `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` in `.env`.
3. Run `npm run pipeline -- auth`, authorize your channel in the browser, and copy
   the printed `YOUTUBE_REFRESH_TOKEN` into `.env`.

Uploads set the title, description (with attribution block), tags, category,
privacy, the SRT caption track, the custom thumbnail (requires a verified channel),
and the `containsSyntheticMedia` disclosure whenever any asset was AI-generated.

## Google Drive motivation Shorts

If you already have motivation clips in Google Drive, use the Drive importer to
create local pipeline jobs and optionally upload them as YouTube Shorts:

```bash
# One-time OAuth. This requests Drive read-only and YouTube upload scopes.
npm run pipeline -- drive-auth

# Preview matching Drive videos without downloading or uploading.
npm run pipeline -- drive-shorts --query motivation --dryRun

# Import one matching video, write a rights manifest, and upload privately.
npm run pipeline -- drive-shorts --query motivation --limit 1 --publish --privacy private
```

Useful options:

| Flag | Purpose |
|---|---|
| `--query motivation` | Search Drive video names/full text. Defaults to `motivation`. |
| `--folderId <id>` | Restrict search to one Drive folder. |
| `--fileId id1,id2` | Import explicit Drive file IDs instead of searching. |
| `--limit 1` | Process up to 10 videos per run. Defaults to 1. |
| `--dryRun` | Preview matches only. |
| `--publish` | Upload to YouTube. Without it, only local jobs are created. |
| `--privacy private` | Upload privacy: `private`, `unlisted`, or `public`. Defaults to `private`. |
| `--license "..."` | Rights note for the Drive asset. |
| `--aiDisclosure` | Mark the imported clip as AI-generated for YouTube disclosure. |

`drive-auth` prints a refresh token. Store it as `YOUTUBE_REFRESH_TOKEN` and
`GOOGLE_DRIVE_REFRESH_TOKEN` in `.env`. The same token must have both Drive
read-only and YouTube upload scopes if you want `--publish` to work in one run.

Only import videos you own or have permission to publish. The importer records a
rights manifest under each job directory and keeps uploads private by default so
you can review the result before making it public.

## Audience growth workflow

The repository intentionally does not automate follow/like/subscribe loops.
Those patterns can look like spam and can violate platform rules, especially on
brand-new accounts. Use automation for research and content operations instead:

1. Run `npm run pipeline -- trends` to find active topics from YouTube, Google
   Trends, and X.
2. Prefer AI/motivation topics where replies and comments show genuine questions
   or requests for recommendations.
3. Publish helpful Shorts with a clear prompt for discussion, then reply manually
   to viewers who engage.
4. Track which topics earn saves, comments, and subscribers; create follow-up
   clips from those signals.

## Rights manifest

Every image, narration track, and thumbnail gets a `RightsRecord` (provider,
license, source URL, prompt, model, photographer credit, AI-generated flag).
`content/jobs/<jobId>/rights-manifest.json` is written before publish, and
publishing **refuses to run** if any asset lacks license information. Photographer
credits and an AI-media disclosure line are appended to the video description
automatically.

## Job lifecycle & commands

Statuses: `created → trends → content → assets → narration → awaiting_approval →
approved → rendering → rendered → publishing → published` (plus `rejected`, `error`).

```bash
npm run pipeline -- status            # last 10 jobs
npm run pipeline -- status <jobId>    # one job in detail
npm run pipeline -- list              # all jobs, one line each
npm run pipeline -- resume <jobId>    # continue after a failure (stages are idempotent)
npm run pipeline -- reject <jobId> --reason "hook is weak, retry tomorrow's trend"
```

Each job directory contains:

```
content/jobs/<jobId>/
├── job.json               # full pipeline state (resumable)
├── review.html            # human approval screen
├── assets/                # scene photos + thumbnail
├── audio/                 # per-scene narration mp3s
├── captions/captions.srt  # uploaded to YouTube
├── captions/captions.vtt
├── render/final.mp4       # the video
└── rights-manifest.json   # licensing record for every asset
```

## Notes

- The renderer uses the repo's bundled `ffmpeg-static`; no system FFmpeg needed.
- Vertical Shorts: `--aspect 9:16 --minutes 1` (or less). Long-form: `--aspect 16:9 --minutes 8`.
- The dashboard flow (`/dashboard/create`) still works independently; this CLI is a
  self-contained path that doesn't need Supabase.
