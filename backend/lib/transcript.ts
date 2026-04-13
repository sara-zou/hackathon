import { YoutubeTranscript } from 'youtube-transcript'

export interface TranscriptSegment {
  text: string
  startSecs: number
}

/**
 * Fetch timed transcript for a YouTube video.
 * `youtube-transcript` returns offset in seconds from YouTube's timedtext XML.
 * Throws if captions are unavailable (no auto-captions or disabled).
 */
export async function fetchTranscript(videoId: string): Promise<TranscriptSegment[]> {
  const raw = await YoutubeTranscript.fetchTranscript(videoId)
  return raw.map((seg) => ({
    text: seg.text.replace(/\n/g, ' ').trim(),
    // youtube-transcript returns offset in milliseconds
    startSecs: Math.round(seg.offset / 1000),
  }))
}

/**
 * Format a timed transcript as a timestamped string for the claim-extraction prompt.
 * Groups segments into ~5-second lines to keep the output manageable.
 */
export function formatTimedTranscript(segments: TranscriptSegment[]): string {
  const lines: string[] = []
  let lineText: string[] = []
  let lineStart = 0

  for (const seg of segments) {
    if (lineText.length > 0 && seg.startSecs - lineStart > 5) {
      const m = Math.floor(lineStart / 60)
      const s = lineStart % 60
      lines.push(`[${m}:${s.toString().padStart(2, '0')}] ${lineText.join(' ')}`)
      lineText = []
      lineStart = seg.startSecs
    }
    if (lineText.length === 0) lineStart = seg.startSecs
    lineText.push(seg.text)
  }

  if (lineText.length > 0) {
    const m = Math.floor(lineStart / 60)
    const s = lineStart % 60
    lines.push(`[${m}:${s.toString().padStart(2, '0')}] ${lineText.join(' ')}`)
  }

  return lines.join('\n')
}
