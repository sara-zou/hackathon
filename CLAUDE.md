# LiveCheck — YouTube Live Fact Checker

Hackathon project. Real-time AI fact-checking of YouTube videos via a Chrome extension + Next.js backend powered by the Subconscious platform.

---

## Hackathon Rubric

**Originality:** something no one in the room could have thought of
**Ambition:** attempted something that might not have even been possible
**Use of platform:** would have been significantly harder or impossible without subconscious.dev — a showcase for the platform
**Technical depth:** deep engineering work, hit walls and found creative solutions, the slideshow makes you want to read the code

---

## Project Overview

A Chrome extension that:
1. Reads YouTube closed captions in real time via `MutationObserver` on `.ytp-caption-segment`
2. Every 15 seconds, sends caption buffer to the backend → **Stage 1** extracts factual claims (`tim-edge`, no tools, structured output)
3. Each claim goes into a capped queue → **Stage 2** fact-checks it (`tim-claude` + 5 tools, structured output)
4. Results are shown in a Shadow DOM side panel injected next to the video
5. Each claim card shows: verdict, confidence %, one-sentence summary, expandable step-by-step reasoning, sources, and a timestamp button that seeks the video

### The Subconscious angle (why this needs the platform)
- The nested multi-hop tool use (Wikipedia → web search → news → papers) per claim is orchestrated entirely server-side — no client-side tool loop
- The two-stage pipeline (fast extraction with `tim-edge`, deep check with `tim-claude`) shows platform flexibility
- Structured JSON output from both stages makes the UI deterministic

---

## Tech Stack

| Layer | Tech |
|---|---|
| Chrome extension | TypeScript, Preact, `@preact/signals`, Vite (IIFE lib mode), Manifest V3, Shadow DOM |
| Backend | Next.js 15 App Router, TypeScript, `subconscious` SDK |
| Fact-check tools | Wikipedia (custom function tool endpoint), `web_search`, `news_search`, `fast_search`, `research_paper_search` |
| Deployment | Vercel (backend), Chrome extension loaded unpacked |

---

## Project Structure

```
Hackathon/
├── CLAUDE.md                          ← you are here
├── backend/                           ← Next.js API (deploy to Vercel)
│   ├── .env                           ← NOT committed — see Setup below
│   ├── .env.example
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── app/
│   │   ├── layout.tsx
│   │   └── api/
│   │       ├── extract-claims/route.ts   ← Stage 1: tim-edge claim extractor
│   │       ├── fact-check/route.ts       ← Stage 2: tim-claude fact-checker
│   │       └── tools/wikipedia/route.ts  ← Wikipedia function tool endpoint
│   └── lib/
│       └── schemas.ts                 ← shared types + Subconscious answerFormat schemas
└── extension/                         ← Chrome extension
    ├── package.json
    ├── vite.config.ts                 ← builds IIFE bundle to dist/
    ├── tsconfig.json
    ├── public/
    │   └── manifest.json
    └── src/
        ├── vite-env.d.ts              ← declares ?raw and __BACKEND_URL__
        ├── types.ts                   ← shared TypeScript types
        └── content/
            ├── index.tsx              ← entry point, injects Shadow DOM
            ├── captionReader.ts       ← MutationObserver on YouTube captions
            ├── claimQueue.ts          ← extraction + fact-check queue, Preact signals state
            ├── videoContext.ts        ← reads video title/channel/description from DOM
            └── overlay/
                ├── App.tsx            ← main panel component
                ├── ClaimCard.tsx      ← individual claim with expand/reasoning/seek
                ├── ScoreMeter.tsx     ← animated ring showing overall accuracy %
                └── styles.css         ← injected into Shadow DOM (fully isolated)
```

---

## Setup (macOS / fresh machine)

### Prerequisites
```bash
# macOS with Homebrew
brew install node   # Node 18+ required
```

### Backend
```bash
cd backend
npm install

# Create .env from the example
cp .env.example .env
# Then edit .env and set:
#   SUBCONSCIOUS_API_KEY=sk-a6321b94b5d8b7b5bdc351d9dec0368aa478ce84b263428c269049c2d820e8ca
#   BACKEND_URL=http://localhost:3001  (for local dev)

npm run dev   # starts on http://localhost:3001
```

### Expose backend publicly (required for Wikipedia function tool)
The Subconscious platform calls function tools from its own servers, so `localhost` won't work.
Run this in a separate terminal while developing:
```bash
npx ngrok http 3001
# Copy the https://xxxx.ngrok.io URL
# Update BACKEND_URL in .env to that URL, then restart npm run dev
```

### Extension
```bash
cd extension

# Set backend URL before building (bake it into the bundle)
# For local dev with ngrok:
BACKEND_URL=https://xxxx.ngrok.io npm run build

# Or for prod (after Vercel deploy):
BACKEND_URL=https://your-app.vercel.app npm run build
```

### Load extension in Chrome
1. Go to `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" → select `extension/dist/`
4. Open any YouTube video, enable captions (CC button)
5. The LiveCheck panel appears on the right side of the video

---

## Current Status

- [x] Full backend scaffolded and written
- [x] Extension scaffolded and written
- [x] `.env` created with API key
- [ ] `npm install` not yet run (needed on macOS machine)
- [ ] Extension not yet built
- [ ] ngrok not yet configured (BACKEND_URL still set to localhost)
- [ ] Wikipedia function tool will fail until BACKEND_URL is a real public URL

## Known Issues Fixed
- `index.ts` renamed to `index.tsx` (JSX in .ts file was a TS error)
- `vite.config.ts` entry updated to point to `index.tsx`
- `src/vite-env.d.ts` added (declares `?raw` and `__BACKEND_URL__`)
- `ScoreMeter.tsx` uses `useComputed` instead of `computed` inside component body

---

## Next Steps

1. `cd backend && npm install && npm run dev`
2. In another terminal: `npx ngrok http 3001`, copy the URL
3. Update `backend/.env` → set `BACKEND_URL=https://xxxx.ngrok.io`
4. Restart backend
5. `cd extension && BACKEND_URL=https://xxxx.ngrok.io npm run build`
6. Load `extension/dist/` as unpacked extension in Chrome
7. Open a YouTube video with captions and test

## Vercel Deployment (for demo)
```bash
cd backend
npx vercel --prod
# Set SUBCONSCIOUS_API_KEY and BACKEND_URL env vars in Vercel dashboard
```
Then rebuild extension with `BACKEND_URL=https://your-app.vercel.app npm run build`.

---

## Subconscious API
- API key: in `backend/.env` — do NOT commit this file
- Engines used: `tim-edge` (extraction) + `tim-claude` (fact-check)
- Tools: `WikipediaSearch` (function tool → `/api/tools/wikipedia`), `web_search`, `news_search`, `fast_search`, `research_paper_search`
- Structured output via `answerFormat` (JSON Schema) — `run.result?.answer` returns a parsed object directly

## Installed Skills
- `subconscious-dev` — Subconscious platform reference (`.claude/skills/subconscious-dev/`)
- `next-best-practices` — Next.js patterns (`.claude/skills/next-best-practices/`)
