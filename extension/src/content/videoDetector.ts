import type { VideoType } from '../types'

/** Extract the YouTube video ID from the current URL. */
export function getVideoId(): string | null {
  return new URLSearchParams(location.search).get('v')
}

/**
 * Detect whether the current YouTube page is a live stream or a VOD.
 *
 * Primary signal: video.duration — finite & > 0 means VOD, Infinity means live.
 * Fallback: live badge visibility (only for streams that haven't loaded yet).
 *
 * Call after video.readyState >= 1 so duration is already set.
 */
export function detectVideoType(video?: HTMLVideoElement | null): VideoType {
  if (video && video.readyState >= 1 && video.duration !== 0) {
    // isFinite(Infinity) === false, so live streams fall through to 'live'
    return isFinite(video.duration) ? 'vod' : 'live'
  }

  // Fallback: live badge — check it is actually visible, not just present in DOM
  const liveBadge = document.querySelector('.ytp-live-badge') as HTMLElement | null
  if (liveBadge && liveBadge.offsetParent !== null) return 'live'

  return 'vod'
}
