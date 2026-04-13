import { useState } from 'preact/hooks'
import { ScoreMeter } from './ScoreMeter'
import { ClaimCard } from './ClaimCard'
import { results, pending } from '../claimQueue'

export function App() {
  const [collapsed, setCollapsed] = useState(false)

  const hasActivity = results.value.length > 0 || pending.value.length > 0

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
        </div>
        <ScoreMeter results={results} />
      </div>

      {/* Claim list */}
      <div class="claim-list">
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
        {!hasActivity && (
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
