import { useState } from 'preact/hooks'
import { useComputed } from '@preact/signals'
import { ScoreMeter } from './ScoreMeter'
import { ClaimCard } from './ClaimCard'
import { results, pending, videoType, processingStatus, processingMessage } from '../claimStore'

export function App() {
  const [collapsed, setCollapsed] = useState(false)

  const hasActivity = useComputed(
    () => results.value.length > 0 || pending.value.length > 0
  )

  const statusBadge = useComputed(() => {
    if (videoType.value === 'live') return { label: 'LIVE', cls: 'badge-live' }
    if (videoType.value === 'vod') return { label: 'VOD', cls: 'badge-vod' }
    return null
  })

  const showStatusMsg = useComputed(
    () =>
      processingStatus.value === 'processing' &&
      processingMessage.value.length > 0 &&
      results.value.length === 0
  )

  return (
    <div class={`panel ${collapsed ? 'collapsed' : ''}`}>
      {/* Collapse tab */}
      <button
        class="toggle-tab"
        onClick={() => setCollapsed((v) => !v)}
        title={collapsed ? 'Expand LiveCheck' : 'Collapse LiveCheck'}
      >
        {collapsed ? '◀' : '▶'}
      </button>

      {/* Header */}
      <div class="header">
        <div class="header-row">
          <div class="header-logo">
            <span class="header-logo-dot" />
            LiveCheck
          </div>
          {statusBadge.value && (
            <span class={`type-badge ${statusBadge.value.cls}`}>
              {statusBadge.value.label}
            </span>
          )}
        </div>
        <ScoreMeter results={results} />
      </div>

      {/* Claim list */}
      <div class="claim-list">
        {/* Status message (processing, no results yet) */}
        {showStatusMsg.value && (
          <div class="status-msg">
            <div class="spinner" />
            <span>{processingMessage.value}</span>
          </div>
        )}

        {/* Error state */}
        {processingStatus.value === 'error' && results.value.length === 0 && (
          <div class="empty-state">
            <div class="empty-icon">⚠</div>
            <div>{processingMessage.value || 'Processing failed'}</div>
          </div>
        )}

        {/* In-progress checks */}
        {pending.value.map((p) => (
          <div key={p.id} class="pending-card">
            <div class="spinner" />
            <span class="pending-text">
              {p.text.length > 90 ? p.text.slice(0, 87) + '…' : p.text}
            </span>
          </div>
        ))}

        {/* Completed checks, newest first */}
        {results.value.map((r) => (
          <ClaimCard key={`${r.claim}-${r.checkedAt}`} result={r} />
        ))}

        {/* Empty state */}
        {!hasActivity.value &&
          processingStatus.value !== 'processing' &&
          processingStatus.value !== 'error' && (
            <div class="empty-state">
              <div class="empty-icon">◎</div>
              <div>Listening for claims…</div>
              <div class="empty-hint">Enable CC on the video to start fact-checking.</div>
            </div>
          )}
      </div>
    </div>
  )
}
