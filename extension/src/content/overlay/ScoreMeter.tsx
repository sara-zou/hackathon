import { useComputed } from '@preact/signals'
import type { Signal } from '@preact/signals'
import type { FactCheckResult, Verdict } from '../../types'

interface Props {
  results: Signal<FactCheckResult[]>
}

const VERDICT_SCORE: Record<Verdict, number> = {
  'true': 95,
  'mostly-true': 75,
  'misleading': 40,
  'mostly-false': 20,
  'false': 5,
  'unverifiable': 50,
}

const R = 18
const CIRCUMFERENCE = 2 * Math.PI * R

function ringColor(score: number): string {
  if (score >= 70) return '#4ade80'
  if (score >= 50) return '#fbbf24'
  return '#f87171'
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Mostly Accurate'
  if (score >= 60) return 'Mixed Accuracy'
  if (score >= 40) return 'Questionable'
  return 'Highly Inaccurate'
}

export function ScoreMeter({ results }: Props) {
  const stats = useComputed(() => {
    const all = results.value
    if (all.length === 0) return null

    const avg = all.reduce((sum, r) => sum + VERDICT_SCORE[r.verdict], 0) / all.length

    const counts = all.reduce(
      (acc, r) => {
        if (r.verdict === 'true' || r.verdict === 'mostly-true') acc.ok++
        else if (r.verdict === 'misleading') acc.misleading++
        else if (r.verdict === 'mostly-false' || r.verdict === 'false') acc.bad++
        return acc
      },
      { ok: 0, misleading: 0, bad: 0 }
    )

    return { avg, counts, total: all.length }
  })

  if (!stats.value) {
    return (
      <div class="score-meter">
        <div class="score-info">
          <div class="score-value" style={{ color: '#333' }}>—</div>
          <div class="score-label">Waiting for claims…</div>
        </div>
      </div>
    )
  }

  const { avg, counts, total } = stats.value
  const offset = CIRCUMFERENCE - (avg / 100) * CIRCUMFERENCE
  const color = ringColor(avg)

  return (
    <div class="score-meter">
      <div class="score-ring-wrap">
        <svg width="44" height="44" class="score-ring" viewBox="0 0 44 44">
          <circle class="score-ring-bg" cx="22" cy="22" r={R} />
          <circle
            class="score-ring-fill"
            cx="22"
            cy="22"
            r={R}
            stroke={color}
            stroke-dasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            stroke-dashoffset={offset}
          />
        </svg>
      </div>
      <div class="score-info">
        <div class="score-value" style={{ color }}>
          {Math.round(avg)}%
        </div>
        <div class="score-label">
          {scoreLabel(avg)} · {total} claim{total !== 1 ? 's' : ''}
        </div>
        <div class="score-breakdown">
          {counts.ok > 0 && (
            <span class="score-badge v-true">{counts.ok} true</span>
          )}
          {counts.misleading > 0 && (
            <span class="score-badge v-misleading">{counts.misleading} misleading</span>
          )}
          {counts.bad > 0 && (
            <span class="score-badge v-false">{counts.bad} false</span>
          )}
        </div>
      </div>
    </div>
  )
}
