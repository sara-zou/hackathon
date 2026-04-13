import { render } from 'preact'
import { App } from './overlay/App'
import { VideoNotification, NOTIF_STYLES } from './overlay/VideoNotification'
import { getVideoId, detectVideoType } from './videoDetector'
import { startLiveController } from './liveController'
import { startRecordedController } from './recordedController'
import { reset } from './claimStore'
import styles from './overlay/styles.css?raw'

// ── Guard: only run once per page ─────────────────────────────────────────────

if (!document.getElementById('livecheck-host')) {
  init()
}

// ── Main init ─────────────────────────────────────────────────────────────────

function init() {
  const videoId = getVideoId()
  if (!videoId) return

  // ── Shadow DOM panel ────────────────────────────────────────────────────────
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

  // ── Video notification overlay ──────────────────────────────────────────────
  mountVideoNotification()

  // ── Start fact-checking controller ─────────────────────────────────────────
  // Wait up to 5s for the video element to load, then detect live vs VOD.
  let stopController: (() => void) | null = null
  let retries = 0

  const detectAndStart = () => {
    const video = document.querySelector('video') as HTMLVideoElement | null
    const ready = video && video.readyState >= 1 && video.duration !== 0

    if (ready || retries >= 10) {
      const type = detectVideoType(video)
      stopController =
        type === 'live'
          ? startLiveController(videoId)
          : startRecordedController(videoId)
    } else {
      retries++
      setTimeout(detectAndStart, 500)
    }
  }

  detectAndStart()

  // ── YouTube SPA navigation cleanup ─────────────────────────────────────────
  let lastUrl = location.href
  const navObserver = new MutationObserver(() => {
    if (location.href === lastUrl) return
    lastUrl = location.href

    if (location.pathname === '/watch') {
      stopController?.()
      stopController = null
      reset()
      host.remove()
      document.getElementById('livecheck-notif-host')?.remove()
      navObserver.disconnect()
      // Give YouTube's SPA a moment to render the new video page
      setTimeout(init, 1500)
    }
  })

  navObserver.observe(document.body, { childList: true, subtree: true })
}

// ── Video notification (small in-player pill) ─────────────────────────────────

function mountVideoNotification() {
  const player = document.querySelector('#movie_player') as HTMLElement | null
  if (!player) {
    setTimeout(mountVideoNotification, 1200)
    return
  }
  if (document.getElementById('livecheck-notif-host')) return

  const notifHost = document.createElement('div')
  notifHost.id = 'livecheck-notif-host'
  notifHost.style.cssText =
    'position: absolute; bottom: 72px; left: 16px; z-index: 9999; pointer-events: none;'
  player.appendChild(notifHost)

  const notifShadow = notifHost.attachShadow({ mode: 'open' })
  const notifStyle = document.createElement('style')
  notifStyle.textContent = NOTIF_STYLES
  notifShadow.appendChild(notifStyle)
  const notifMount = document.createElement('div')
  notifShadow.appendChild(notifMount)
  render(<VideoNotification />, notifMount)
}
