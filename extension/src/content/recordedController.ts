import { videoType, processingStatus, processingMessage, addResult } from './claimStore'
import { getVideoContext } from './videoContext'
import type { FactCheckResult } from '../types'

declare const __BACKEND_URL__: string
const BACKEND_URL = __BACKEND_URL__

/**
 * Start the recorded-video fact-checking flow.
 * 1. Checks /api/video/results — if complete, loads results from cache.
 * 2. Otherwise opens an SSE stream to /api/recorded/stream which processes
 *    the video in real-time and emits claim events as each fact-check completes.
 * Returns a cleanup / abort function.
 */
export function startRecordedController(videoId: string): () => void {
  videoType.value = 'vod'
  processingStatus.value = 'processing'
  processingMessage.value = 'Connecting…'

  const abortController = new AbortController()
  let done = false

  run(videoId, abortController.signal).catch((err) => {
    if (!done) {
      console.error('[LiveCheck] recorded controller error:', err)
      processingStatus.value = 'error'
      processingMessage.value = 'Failed to connect'
    }
  })

  return () => {
    done = true
    abortController.abort()
  }
}

async function run(videoId: string, signal: AbortSignal) {
  // ── 1. Check cache ────────────────────────────────────────────────────────
  try {
    const cacheRes = await fetch(
      `${BACKEND_URL}/api/video/results?videoId=${encodeURIComponent(videoId)}`,
      { headers: { 'ngrok-skip-browser-warning': '1' }, signal }
    )
    if (cacheRes.ok) {
      const data = (await cacheRes.json()) as {
        status: string
        results: FactCheckResult[]
      }
      if (data.status === 'complete' && data.results.length > 0) {
        for (const result of data.results) addResult(result)
        processingStatus.value = 'complete'
        processingMessage.value = ''
        return
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
  }

  // ── 2. Open SSE stream ────────────────────────────────────────────────────
  const ctx = getVideoContext()
  const url = new URL(`${BACKEND_URL}/api/recorded/stream`)
  url.searchParams.set('videoId', videoId)
  url.searchParams.set('title', ctx.title)
  url.searchParams.set('channel', ctx.channel)
  url.searchParams.set('description', ctx.description.slice(0, 300))

  const res = await fetch(url.toString(), {
    headers: { 'ngrok-skip-browser-warning': '1' },
    signal,
  })

  if (!res.ok || !res.body) {
    processingStatus.value = 'error'
    processingMessage.value = 'Backend unavailable'
    return
  }

  // ── 3. Parse SSE events ───────────────────────────────────────────────────
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buf += decoder.decode(value, { stream: true })

    // SSE messages are separated by \n\n
    const messages = buf.split('\n\n')
    buf = messages.pop() ?? ''

    for (const message of messages) {
      let event = 'message'
      let dataStr = ''

      for (const line of message.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim()
        else if (line.startsWith('data: ')) dataStr = line.slice(6)
      }

      if (!dataStr) continue
      let data: Record<string, unknown>
      try {
        data = JSON.parse(dataStr)
      } catch {
        continue
      }

      switch (event) {
        case 'claim':
          addResult(data as unknown as FactCheckResult)
          break
        case 'status':
          processingMessage.value = (data.message as string) ?? ''
          break
        case 'done':
          processingStatus.value = 'complete'
          processingMessage.value = ''
          break
        case 'error':
          processingStatus.value = 'error'
          processingMessage.value = (data.message as string) ?? 'Processing failed'
          break
      }
    }
  }
}
