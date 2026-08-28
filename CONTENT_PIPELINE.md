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

## Import motivation clips from Google Drive as YouTube Shorts

For a brand-new motivation channel, the safer growth workflow is consistent
Shorts publishing, not automated subscribe/follow exchanges. The CLI can import
video files from your Drive, crop them to 9:16, cap them at 60 seconds, create a
local review page, and publish only after you confirm the clip is owned or
licensed for the channel.

One-time Drive setup:

```bash
# Uses a read-only Drive scope and prints GOOGLE_DRIVE_REFRESH_TOKEN.
npm run pipeline -- drive-auth
```

Find candidate clips:

```bash
npm run pipeline -- drive-search --query motivation --max 10
```

Create local Shorts jobs for review:

```bash
npm run pipeline -- drive-shorts --query motivation --max 3
```

Open each printed `content/jobs/<jobId>/review.html`, review the vertical render,
then confirm rights and publish privately:

```bash
npm run pipeline -- confirm-rights <jobId> --license "Owned by channel"
npm run pipeline -- publish <jobId> --privacy private
```

If you already reviewed the source folder and know all matching clips are owned
or licensed, you can create and privately upload in one command:

```bash
npm run pipeline -- drive-shorts --query motivation --max 3 --rights-confirmed --publish --privacy private
```

Drive imports refuse publishing until `confirm-rights` or `--rights-confirmed`
records explicit ownership/licensing confirmation in the rights manifest.

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
| `DRIVE_CLIENT_ID` / `DRIVE_CLIENT_SECRET` / `GOOGLE_DRIVE_REFRESH_TOKEN` | Drive imports | Read-only motivation clip search/download |

## YouTube publishing setup (one time, ~5 min)

1. In Google Cloud Console, create an OAuth client (type: Web application) with
   redirect URI `http://localhost:8787/callback`, and enable the **YouTube Data API v3**.
2. Put `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` in `.env`.
3. Run `npm run pipeline -- auth`, authorize your channel in the browser, and copy
   the printed `YOUTUBE_REFRESH_TOKEN` into `.env`.

Uploads set the title, description (with attribution block), tags, category,
privacy, the SRT caption track, the custom thumbnail (requires a verified channel),
and the `containsSyntheticMedia` disclosure whenever any asset was AI-generated.

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
npm run pipeline -- drive-search --query motivation --max 10
npm run pipeline -- drive-shorts --query motivation --max 3
npm run pipeline -- confirm-rights <jobId>
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
