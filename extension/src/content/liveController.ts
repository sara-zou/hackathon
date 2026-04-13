import { videoType, processingStatus, addResult } from './claimStore'
import { startCaptionReader, drainBuffer } from './captionReader'
import { getVideoContext } from './videoContext'
import type { FactCheckResult, VideoContext } from '../types'

declare const __BACKEND_URL__: string
const BACKEND_URL = __BACKEND_URL__

const INGEST_INTERVAL_MS = 30_000  // send caption buffer every 30 seconds
const POLL_INTERVAL_MS = 15_000    // check for new results every 15 seconds

/**
 * Start the live stream fact-checking flow.
 * - Reads captions every 30s and sends them to /api/live/ingest (fire-and-forget)
 * - Polls /api/video/results every 15s to pick up completed fact-checks
 * Returns a cleanup function.
 */
export function startLiveController(videoId: string): () => void {
  videoType.value = 'live'
  processingStatus.value = 'processing'

  // Grab existing results right away (in case another user already checked this stream)
  pollResults(videoId)

  const stopCaptions = startCaptionReader()

  const ingestTimer = setInterval(() => {
    const buffered = drainBuffer()
    if (!buffered) return
    const videoContext = getVideoContext()
    // Fire-and-forget — the ingest call can take 1–2 min (extraction + fact-check)
    ingestCaptions(videoId, buffered.text, buffered.timestamp, videoContext).catch(
      (err) => console.error('[LiveCheck] ingest error:', err)
    )
  }, INGEST_INTERVAL_MS)

  const pollTimer = setInterval(() => pollResults(videoId), POLL_INTERVAL_MS)

  return () => {
    stopCaptions()
    clearInterval(ingestTimer)
    clearInterval(pollTimer)
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function ingestCaptions(
  videoId: string,
  captionBuffer: string,
  timestamp: number,
  videoContext: VideoContext
) {
  await fetch(`${BACKEND_URL}/api/live/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
    body: JSON.stringify({ videoId, captionBuffer, timestamp, videoContext }),
    signal: AbortSignal.timeout(180_000), // 3 min max
  })
}

async function pollResults(videoId: string) {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/video/results?videoId=${encodeURIComponent(videoId)}`,
      { headers: { 'ngrok-skip-browser-warning': '1' } }
    )
    if (!res.ok) return

    const data = (await res.json()) as { status: string; results: FactCheckResult[] }
    for (const result of data.results ?? []) {
      addResult(result)
    }
  } catch (err) {
    console.error('[LiveCheck] poll error:', err)
  }
}
