import { render } from 'preact'
import { App } from './overlay/App'
import { VideoNotification, NOTIF_STYLES } from './overlay/VideoNotification'
import { startCaptionReader, drainBuffer } from './captionReader'
import { extractAndEnqueue } from './claimQueue'
import { getVideoContext } from './videoContext'
import styles from './overlay/styles.css?raw'

// ── Guard: only run once per page ────────────────────────────────────────────

if (document.getElementById('livecheck-host')) {
  // Already injected (e.g. after a soft navigation) — bail out
} else {
  init()
}

function mountVideoNotification() {
  const player = document.querySelector('#movie_player') as HTMLElement | null
  if (!player) {
    // Player not ready yet — retry after a short delay
    setTimeout(mountVideoNotification, 1200)
    return
  }

  if (document.getElementById('livecheck-notif-host')) return

  const notifHost = document.createElement('div')
  notifHost.id = 'livecheck-notif-host'
  notifHost.style.cssText =
    'position: absolute; bottom: 72px; left: 16px; z-index: 9999; pointer-events: none;'
  player.appendChild(notifHost)

  const shadow = notifHost.attachShadow({ mode: 'open' })
  const styleEl = document.createElement('style')
  styleEl.textContent = NOTIF_STYLES
  shadow.appendChild(styleEl)

  const mountPoint = document.createElement('div')
  shadow.appendChild(mountPoint)
  render(<VideoNotification />, mountPoint)
}

function init() {
  // ── Shadow DOM host ─────────────────────────────────────────────────────

  const host = document.createElement('div')
  host.id = 'livecheck-host'
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; top: 0; right: 0;'
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })

  const styleEl = document.createElement('style')
  styleEl.textContent = styles
  shadow.appendChild(styleEl)

  const mountPoint = document.createElement('div')
  shadow.appendChild(mountPoint)

  render(<App />, mountPoint)

  // ── Video notification overlay ──────────────────────────────────────────

  mountVideoNotification()

  // ── Caption reader ──────────────────────────────────────────────────────

  const stopCaptions = startCaptionReader()

  // Every 10 seconds, drain the caption buffer and extract claims
  const extractInterval = setInterval(() => {
    console.log('[LiveCheck] interval fired, draining buffer...')
    const buffered = drainBuffer()
    if (!buffered) {
      console.log('[LiveCheck] buffer empty — no captions captured yet')
      return
    }
    console.log('[LiveCheck] sending to extract-claims:', buffered.text.slice(0, 100))
    const videoContext = getVideoContext()
    extractAndEnqueue(buffered.text, buffered.timestamp, videoContext)
  }, 10_000)

  // ── YouTube SPA navigation cleanup ─────────────────────────────────────

  let lastUrl = location.href
  const navObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      if (location.pathname === '/watch') {
        clearInterval(extractInterval)
        stopCaptions()
        host.remove()
        document.getElementById('livecheck-notif-host')?.remove()
        navObserver.disconnect()
        setTimeout(init, 1500)
      }
    }
  })

  navObserver.observe(document.body, { childList: true, subtree: true })
}
