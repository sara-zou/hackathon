import type { VideoContext } from '../types'

// YouTube's DOM selectors change occasionally — we try several fallbacks.
export function getVideoContext(): VideoContext {
  const title =
    (document.querySelector('h1.ytd-video-primary-info-renderer') as HTMLElement)?.innerText ||
    (document.querySelector('h1.style-scope.ytd-watch-metadata') as HTMLElement)?.innerText ||
    (document.querySelector('ytd-watch-metadata h1 yt-formatted-string') as HTMLElement)
      ?.innerText ||
    document.title.replace(/ - YouTube$/, '') ||
    'Unknown video'

  const channel =
    (
      document.querySelector(
        'ytd-channel-name#channel-name yt-formatted-string'
      ) as HTMLElement
    )?.innerText ||
    (document.querySelector('#owner #channel-name') as HTMLElement)?.innerText ||
    (document.querySelector('#upload-info #channel-name') as HTMLElement)?.innerText ||
    'Unknown channel'

  const description =
    (
      document.querySelector(
        'ytd-expandable-video-description-body-renderer yt-attributed-string'
      ) as HTMLElement
    )?.innerText ||
    (document.querySelector('#description yt-formatted-string') as HTMLElement)?.innerText ||
    (document.querySelector('#description-inline-expander') as HTMLElement)?.innerText ||
    ''

  return {
    title: title.trim(),
    channel: channel.trim(),
    description: description.trim().slice(0, 500),
  }
}
