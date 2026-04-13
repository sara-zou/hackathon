import { signal } from '@preact/signals'
import type { FactCheckResult, PendingClaim, VideoType } from '../types'

// ── Public signals (consumed by overlay UI) ───────────────────────────────────

export const results = signal<FactCheckResult[]>([])
export const pending = signal<PendingClaim[]>([])
export const videoType = signal<VideoType | null>(null)
export const processingStatus = signal<'idle' | 'processing' | 'complete' | 'error'>('idle')
export const processingMessage = signal<string>('')

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Add a result, skipping exact duplicates (by id or claim text). */
export function addResult(result: FactCheckResult) {
  const dupe = results.value.some(
    (r) => (result.id && r.id === result.id) || r.claim === result.claim
  )
  if (!dupe) {
    // Newest first, cap at 100
    results.value = [result, ...results.value].slice(0, 100)
  }
}

export function addPending(item: PendingClaim) {
  pending.value = [...pending.value, item]
}

export function removePending(id: string) {
  pending.value = pending.value.filter((p) => p.id !== id)
}

/** Called on every YouTube SPA navigation to a new video. */
export function reset() {
  results.value = []
  pending.value = []
  videoType.value = null
  processingStatus.value = 'idle'
  processingMessage.value = ''
}
