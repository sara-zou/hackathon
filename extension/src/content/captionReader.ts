// Reads YouTube closed captions by polling the live DOM every second.
// Polling is more reliable than MutationObserver because YouTube re-emits
// the same segment nodes multiple times as the caption line grows.

let captionBuffer: string[] = []
let timestampBuffer: number[] = []
let lastPolledLine = ''

export function getVideoTimestamp(): number {
  const video = document.querySelector('video') as HTMLVideoElement | null
  return Math.floor(video?.currentTime ?? 0)
}

/** Drain and return the current caption buffer, then clear it. */
export function drainBuffer(): { text: string; timestamp: number } | null {
  if (captionBuffer.length === 0) return null

  const text = captionBuffer.join(' ').trim()
  const timestamp = timestampBuffer[0] ?? getVideoTimestamp()

  captionBuffer = []
  timestampBuffer = []
  lastPolledLine = ''

  return text.length > 10 ? { text, timestamp } : null
}

/** Start polling captions every second. Returns a cleanup function. */
export function startCaptionReader(): () => void {
  const interval = setInterval(() => {
    const segments = document.querySelectorAll('.ytp-caption-segment')
    if (segments.length === 0) return

    const line = Array.from(segments)
      .map((s) => s.textContent?.trim())
      .filter(Boolean)
      .join(' ')

    if (!line || line === lastPolledLine) return

    lastPolledLine = line
    console.log('[LiveCheck] caption:', line)
    captionBuffer.push(line)
    timestampBuffer.push(getVideoTimestamp())
  }, 1000)

  return () => clearInterval(interval)
}
