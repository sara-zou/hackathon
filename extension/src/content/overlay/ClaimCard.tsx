import { useState } from 'preact/hooks'
import type { FactCheckResult } from '../../types'

interface Props {
  result: FactCheckResult
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function seekVideo(seconds: number) {
  const video = document.querySelector('video') as HTMLVideoElement | null
  if (video) video.currentTime = seconds
}

const VERDICT_LABELS: Record<string, string> = {
  'true': 'True',
  'mostly-true': 'Mostly True',
  'misleading': 'Misleading',
  'mostly-false': 'Mostly False',
  'false': 'False',
  'unverifiable': 'Unverifiable',
}

export function ClaimCard({ result }: Props) {
  const [expanded, setExpanded] = useState(false)
  const verdictClass = `v-${result.verdict}`
  const cardClass = `card-${result.verdict}`

  return (
    <div
      class={`claim-card ${cardClass} ${expanded ? 'expanded' : ''}`}
      onClick={() => setExpanded((v) => !v)}
    >
      <span class="claim-text">
        {result.claim.length > 110 ? result.claim.slice(0, 107) + '…' : result.claim}
      </span>

      <div class="claim-meta">
        <span class={`verdict-label ${verdictClass}`}>
          {VERDICT_LABELS[result.verdict] ?? result.verdict}
        </span>
        <span class="confidence">{result.confidence}%</span>

        {result.timestamp > 0 ? (
          <button
            class="timestamp-btn"
            onClick={(e) => {
              e.stopPropagation()
              seekVideo(result.timestamp)
            }}
          >
            ▶ {formatTimestamp(result.timestamp)}
          </button>
        ) : (
          <span class="expand-hint">{expanded ? '▲' : '▼'}</span>
        )}
      </div>

      {expanded && (
        <div class="claim-detail">
          <p class="detail-summary">{result.summary}</p>

          {result.reasoning.length > 0 && (
            <>
              <div class="detail-section-title">Reasoning</div>
              <ul class="reasoning-list">
                {result.reasoning.map((r, i) => (
                  <li key={i} class="reasoning-item">
                    <span class="reasoning-step">{r.step}</span>
                    {r.finding}
                  </li>
                ))}
              </ul>
            </>
          )}

          {result.sources.length > 0 && (
            <>
              <div class="detail-section-title">Sources</div>
              <ul class="source-list">
                {result.sources.slice(0, 4).map((s, i) => (
                  <li key={i} class="source-item">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" title={s.title}>
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
