import { useComputed } from '@preact/signals'
import { pending } from '../claimStore'

export function VideoNotification() {
  const count = useComputed(() => pending.value.length)
  if (count.value === 0) return null

  return (
    <div class="notif-pill">
      <span class="notif-dot" />
      <span class="notif-label">
        Verifying {count.value} claim{count.value !== 1 ? 's' : ''}
        <span class="notif-ellipsis">…</span>
      </span>
    </div>
  )
}

export const NOTIF_STYLES = `
* { box-sizing: border-box; margin: 0; padding: 0; }
.notif-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(8, 8, 8, 0.82);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  padding: 6px 13px 6px 9px;
  font-size: 12px;
  font-weight: 500;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  color: #d8d8d8;
  pointer-events: none;
  animation: notif-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
  letter-spacing: 0.01em;
  white-space: nowrap;
}
.notif-dot {
  width: 7px;
  height: 7px;
  background: #3ea6ff;
  border-radius: 50%;
  flex-shrink: 0;
  animation: notif-pulse 1.6s ease-in-out infinite;
}
.notif-label { color: #d8d8d8; }
.notif-ellipsis { opacity: 0.6; }
@keyframes notif-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.7); }
}
@keyframes notif-in {
  from { opacity: 0; transform: translateY(8px) scale(0.92); }
  to   { opacity: 1; transform: translateY(0)  scale(1); }
}
`
