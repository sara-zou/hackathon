# LiveCheck — YouTube AI Fact Checker

Real-time and on-demand AI fact-checking for YouTube videos (live streams and VODs) via a Chrome extension + Next.js backend, powered by the Subconscious platform.

---

## Architecture

### Two Flows

**Recorded (VOD)**
1. Extension detects video is a VOD, extracts videoId
2. Checks `/api/video/results?videoId=xxx` — if already processed, renders cached results instantly
3. Otherwise opens SSE stream to `/api/recorded/stream?videoId=xxx&title=...`
4. Backend fetches full transcript (`youtube-transcript`), extracts all claims (tim-claude, timed transcript), fact-checks each in parallel batches (tim-claude + 5 tools, full depth), streams `claim` events as each completes
5. All results saved to Supabase permanently — subsequent users get instant cache hit

**Live**
1. Extension detects live stream, starts caption reader (1s polling on `.ytp-caption-segment`)
2. Every 30s: POST `/api/live/ingest` with caption buffer (fire-and-forget, runs ~1–2 min)
3. Every 15s: polls `/api/video/results?videoId=xxx` for new results
4. Backend extracts claims (tim-edge, fast), deduplicates against DB, fact-checks top 2 claims (tim-claude + 2 tools, shallow), writes to Supabase
5. Multiple users on the same stream see the same cached results from DB

### Key Design Decisions
- **No in-memory state** — backend is fully stateless; Supabase is the source of truth
- **Word-overlap deduplication** — same claim phrased differently → skip (60% threshold)
- **Live: shallow research** — web_search + fast_search only (2 tools, fewer hops)
- **Recorded: deep research** — Wikipedia + web + news + fast + research_paper (5 tools, full depth)
- **SSE for recorded** — progressive results as each claim completes (best UX)
- **Polling for live** — simple, reliable, works with stateless serverless

---

## Project Structure

```
LiveCheck/
├── CLAUDE.md
├── supabase/
│   └── schema.sql                        ← Run in Supabase SQL editor
├── backend/                              ← Next.js API (deploy to Vercel)
│   ├── .env                              ← NOT committed
│   ├── .env.example
│   ├── package.json
│   ├── next.config.ts
│   ├── app/api/
│   │   ├── video/results/route.ts        ← GET cached results for any videoId
│   │   ├── live/ingest/route.ts          ← POST caption buffer → extract + fact-check
│   │   ├── recorded/stream/route.ts      ← SSE stream — process VOD + stream results
│   │   └── tools/wikipedia/route.ts      ← Wikipedia function tool endpoint
│   └── lib/
│       ├── schemas.ts                    ← Shared types + Subconscious answerFormat schemas
│       ├── supabase.ts                   ← Supabase server client
│       ├── transcript.ts                 ← YouTube transcript fetcher
│       ├── factPipeline.ts               ← Claim extraction + fact-checking logic
│       └── cors.ts                       ← CORS helpers
└── extension/                            ← Chrome extension (Preact, Vite IIFE)
    ├── public/manifest.json
    ├── vite.config.ts
    └── src/
        ├── types.ts
        └── content/
            ├── index.tsx                 ← Entry: mount panels, detect type, start controller
            ├── videoDetector.ts          ← getVideoId(), detectVideoType()
            ├── claimStore.ts             ← Preact signals state (results, pending, status)
            ├── liveController.ts         ← Live flow: caption ingest + polling
            ├── recordedController.ts     ← VOD flow: cache check + SSE stream
            ├── captionReader.ts          ← Polling on .ytp-caption-segment
            ├── videoContext.ts           ← Read title/channel/description from YouTube DOM
            └── overlay/
                ├── App.tsx               ← Main panel (LIVE/VOD badge, score, claim list)
                ├── ClaimCard.tsx         ← Claim with verdict, expand, seek button
                ├── ScoreMeter.tsx        ← Animated accuracy ring
                ├── VideoNotification.tsx ← In-player "Verifying N claims…" pill
                └── styles.css            ← Shadow DOM CSS (fully isolated)
```

---

## Setup

### Prerequisites
```bash
brew install node  # Node 18+
```

### Supabase
1. Create project at https://supabase.com
2. Run `supabase/schema.sql` in the SQL editor
3. Copy project URL and service role key

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Fill in: SUBCONSCIOUS_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BACKEND_URL
npm run dev  # http://localhost:3001
```

### Expose backend publicly (required for Wikipedia function tool)
```bash
npx ngrok http 3001
# Copy the https URL → set BACKEND_URL in .env → restart npm run dev
```

### Extension
```bash
cd extension
npm install
BACKEND_URL=https://xxxx.ngrok.io npm run build
# Load extension/dist/ as unpacked extension in Chrome
```

---

## Environment Variables

| Variable | Where | Notes |
|---|---|---|
| `SUBCONSCIOUS_API_KEY` | backend/.env | From https://subconscious.dev/platform |
| `SUPABASE_URL` | backend/.env | Project URL from Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | backend/.env | Service role key (never expose client-side) |
| `BACKEND_URL` | backend/.env + extension build | Public URL (ngrok for dev, Vercel for prod) |

---

## Subconscious Usage

| Stage | Engine | Tools | Notes |
|---|---|---|---|
| Live extraction | `tim-edge` | none | Fast, cheap, structured output |
| Live fact-check | `tim-claude` | web_search, fast_search | Shallow (2 tools) |
| VOD extraction | `tim-claude` | none | Full transcript with timestamps |
| VOD fact-check | `tim-claude` | Wikipedia + web + news + fast + research_paper | Deep (5 tools) |

---

## Vercel Deployment Notes

- `recorded/stream` route uses `runtime = 'nodejs'` and `maxDuration = 300`
- Vercel Pro supports up to 900s; Hobby is capped at 60s (too short for long videos)
- For very long videos on Hobby tier, consider migrating `recorded/stream` to a background job (Trigger.dev, Inngest, etc.)

## Installed Skills
- `subconscious-dev` — Subconscious platform reference
- `next-best-practices` — Next.js patterns
