import { signal } from '@preact/signals'
import type { FactCheckResult, PendingClaim, VideoContext } from '../types'

declare const __BACKEND_URL__: string
const BACKEND_URL = __BACKEND_URL__

const MAX_CONCURRENT = 2
const MAX_CLAIM_AGE_MS = 90_000  // drop stale claims after 90s
const MIN_PRIORITY = 3           // skip low-priority claims

// ── Demo seed data (pre-populated for demo purposes) ─────────────────────────

const DEMO_RESULTS: FactCheckResult[] = [
  {
    claim: 'Humans only use 10% of their brain',
    verdict: 'false',
    confidence: 99,
    summary:
      'Neuroscience shows virtually all brain regions are active throughout the day. fMRI and PET scans have thoroughly disproved this myth.',
    sources: [
      {
        title: 'Scientific American — Do People Only Use 10% of Their Brains?',
        url: 'https://www.scientificamerican.com/article/do-people-only-use-10-percent-of-their-brains/',
      },
    ],
    reasoning: [
      {
        step: 'Neuroimaging evidence',
        finding:
          'fMRI scans show distributed activity across the entire brain during ordinary tasks',
      },
      {
        step: 'Metabolic cost argument',
        finding:
          'The brain consumes ~20% of the body\'s energy despite being 2% of its mass — inconsistent with 90% lying dormant',
      },
    ],
    timestamp: 0,
    checkedAt: Date.now() - 340_000,
  },
  {
    claim: 'Coffee was first discovered in Ethiopia around the 9th century',
    verdict: 'mostly-true',
    confidence: 71,
    summary:
      'The most widely accepted origin traces coffee to the Kaffa region of Ethiopia, though exact dating is uncertain from surviving historical records.',
    sources: [
      {
        title: 'History of Coffee — Wikipedia',
        url: 'https://en.wikipedia.org/wiki/History_of_coffee',
      },
      {
        title: 'National Coffee Association — History',
        url: 'https://www.ncausa.org/about-coffee/history-of-coffee',
      },
    ],
    reasoning: [
      {
        step: 'Earliest written records',
        finding:
          'Documentation of coffee use appears in 15th-century Yemen, with plants sourced from the Ethiopian highlands',
      },
      {
        step: 'Etymology',
        finding:
          "The word 'coffee' likely derives from 'Kaffa', a region in southwestern Ethiopia",
      },
    ],
    timestamp: 0,
    checkedAt: Date.now() - 160_000,
  },
  {
    claim: 'The Great Wall of China is visible from space with the naked eye',
    verdict: 'false',
    confidence: 95,
    summary:
      "Multiple astronauts confirm the wall's ~9 m width is too narrow to resolve from orbital altitude (~400 km) without optical aids.",
    sources: [
      {
        title: 'NASA — Great Wall of China Visibility',
        url: 'https://www.nasa.gov/vision/space/workinginspace/great_wall.html',
      },
    ],
    reasoning: [
      {
        step: 'Optics analysis',
        finding:
          'Resolving a 9 m object at 400 km altitude requires visual acuity far beyond human capability (~30 arc-seconds limit)',
      },
      {
        step: 'Astronaut testimony',
        finding:
          'Chinese astronaut Yang Liwei (2003) confirmed he could not see the Great Wall from orbit',
      },
    ],
    timestamp: 0,
    checkedAt: Date.now() - 40_000,
  },
]

// ── Public signals (consumed by the overlay UI) ─────────────────────────────

export const results = signal<FactCheckResult[]>(DEMO_RESULTS)
export const pending = signal<PendingClaim[]>([])

// ── Internal queue state ─────────────────────────────────────────────────────

interface QueuedItem {
  id: string
  text: string
  timestamp: number
  priority: number
  enqueuedAt: number
}

const queue: QueuedItem[] = []
let inFlight = 0

// ── Caption-buffer → claim extraction ────────────────────────────────────────

export async function extractAndEnqueue(
  captionText: string,
  captionTimestamp: number,
  videoContext: VideoContext
) {
  try {
    console.log('[LiveCheck] extract-claims fetch start')
    const res = await fetch(`${BACKEND_URL}/api/extract-claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ captions: captionText, videoContext }),
      signal: AbortSignal.timeout(120_000),
    })

    console.log('[LiveCheck] extract-claims status:', res.status)
    if (!res.ok) return

    const { claims } = await res.json() as {
      claims: Array<{ text: string; type: string; priority: number }>
    }
    console.log('[LiveCheck] claims extracted:', claims)

    for (const claim of claims) {
      if (claim.priority < MIN_PRIORITY) continue
      if (isDuplicateResult(claim.text)) continue
      if (isDuplicateInQueue(claim.text)) continue

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      queue.push({
        id,
        text: claim.text,
        timestamp: captionTimestamp,
        priority: claim.priority,
        enqueuedAt: Date.now(),
      })

      // Show as pending in the UI immediately
      pending.value = [
        ...pending.value,
        { id, text: claim.text, timestamp: captionTimestamp },
      ]
    }

    // Sort by priority descending
    queue.sort((a, b) => b.priority - a.priority)
    drainQueue(videoContext)
  } catch (err) {
    console.error('[LiveCheck] extract-claims error:', err)
  }
}

// ── Queue drain / fact-check execution ───────────────────────────────────────

function drainQueue(videoContext: VideoContext) {
  while (inFlight < MAX_CONCURRENT && queue.length > 0) {
    const item = queue.shift()!

    // Drop stale claims
    if (Date.now() - item.enqueuedAt > MAX_CLAIM_AGE_MS) {
      removePending(item.id)
      continue
    }

    inFlight++
    factCheck(item, videoContext).finally(() => {
      inFlight--
      drainQueue(videoContext)
    })
  }
}

async function factCheck(item: QueuedItem, videoContext: VideoContext) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/fact-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({
        claim: item.text,
        videoContext,
        timestamp: item.timestamp,
      }),
      signal: AbortSignal.timeout(180_000),
    })

    if (!res.ok) return

    const result: FactCheckResult = await res.json()
    results.value = [result, ...results.value].slice(0, 50) // keep last 50
  } catch (err) {
    console.error('[LiveCheck] fact-check error:', err)
  } finally {
    removePending(item.id)
  }
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3))
  const wordsB = b.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  if (wordsA.size === 0 || wordsB.length === 0) return 0
  const overlap = wordsB.filter((w) => wordsA.has(w)).length
  return overlap / Math.max(wordsA.size, wordsB.length)
}

function isDuplicateResult(text: string): boolean {
  return results.value.some((r) => wordOverlap(text, r.claim) > 0.6)
}

function isDuplicateInQueue(text: string): boolean {
  return (
    queue.some((q) => wordOverlap(text, q.text) > 0.6) ||
    pending.value.some((p) => wordOverlap(text, p.text) > 0.6)
  )
}

function removePending(id: string) {
  pending.value = pending.value.filter((p) => p.id !== id)
}
