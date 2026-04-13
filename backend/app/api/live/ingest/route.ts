import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { corsJson, corsOptions } from '@/lib/cors'
import { extractClaims, factCheckClaim, filterDuplicates } from '@/lib/factPipeline'
import type { VideoContext } from '@/lib/schemas'

const MIN_PRIORITY = 3
const MAX_CONCURRENT = 2  // keep shallow for live — speed > depth

export async function OPTIONS() {
  return corsOptions()
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { videoId, captionBuffer, timestamp, videoContext } = body as {
    videoId: string
    captionBuffer: string
    timestamp: number
    videoContext: VideoContext
  }

  if (!videoId?.trim() || !captionBuffer?.trim()) {
    return corsJson({ error: 'videoId and captionBuffer required' }, { status: 400 })
  }

  // Ensure video row exists (first ingest creates it)
  await supabase.from('videos').upsert(
    { id: videoId, title: videoContext.title, channel: videoContext.channel, type: 'live', status: 'processing' },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  // Extract claims from the caption buffer (lightweight = tim-edge)
  const extracted = await extractClaims(captionBuffer, videoContext, { lightweight: true })
  const candidates = extracted.filter((c) => c.priority >= MIN_PRIORITY)

  if (candidates.length === 0) return corsJson({ accepted: 0 })

  // Deduplicate against all existing claims for this video
  const { data: existing } = await supabase
    .from('fact_checks')
    .select('claim_text')
    .eq('video_id', videoId)

  const existingTexts = (existing ?? []).map((r) => r.claim_text)
  const toProcess = filterDuplicates(candidates, existingTexts)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_CONCURRENT)

  if (toProcess.length === 0) return corsJson({ accepted: 0 })

  // Fact-check in parallel (shallow: 2 tools, fewer hops — live is time-sensitive)
  await Promise.all(
    toProcess.map(async (claim) => {
      try {
        const result = await factCheckClaim(claim.text, videoContext, { shallow: true })
        await supabase.from('fact_checks').insert({
          video_id: videoId,
          claim_text: claim.text,
          verdict: result.verdict,
          confidence: result.confidence,
          summary: result.summary,
          timestamp_secs: timestamp,
          sources: result.sources,
          reasoning: result.reasoning,
        })
      } catch (err) {
        console.error('[live/ingest] factCheck error for claim:', claim.text, err)
      }
    })
  )

  return corsJson({ accepted: toProcess.length })
}
