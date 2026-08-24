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

## Import motivation videos from Google Drive as YouTube Shorts

Use this when the channel already has motivation clips in Google Drive and you want
to turn the newest matching files into vertical YouTube Shorts. The importer is
private-by-default and still requires rights confirmation before upload.

```bash
# One time: authorize read-only Drive access.
npm run pipeline -- drive-auth

# Import the newest matching motivation video, crop it to 9:16, and create review.html.
npm run pipeline -- drive-shorts --query motivation --max 1

# Review content/jobs/<jobId>/review.html, then confirm you own or can upload it.
npm run pipeline -- confirm-rights <jobId>

# Publish privately first, then review in YouTube Studio before making public.
npm run pipeline -- publish <jobId> --privacy private
```

If Drive and YouTube credentials are already configured and the source clips are
known to be owned/licensed for the channel, the same flow can run in one command:

```bash
npm run pipeline -- drive-shorts --query motivation --max 1 --rights-confirmed --publish --privacy private
```

Optional flags:

- `--folder <driveFolderId>` limits search to a specific Drive folder.
- `--seconds <15-60>` trims each imported video to Shorts length (default: 60).
- `--max <1-10>` imports multiple recent matches.

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
| `GOOGLE_DRIVE_CLIENT_ID` / `GOOGLE_DRIVE_CLIENT_SECRET` / `GOOGLE_DRIVE_REFRESH_TOKEN` | Drive Shorts | Read-only Drive video imports |

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
npm run pipeline -- drive-shorts --query motivation --max 1
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
