import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchTranscript, formatTimedTranscript } from '@/lib/transcript'
import { extractClaims, factCheckClaimsBatch, filterDuplicates } from '@/lib/factPipeline'
import type { VideoContext, FactCheckResult } from '@/lib/schemas'

// Node runtime needed for long-running SSE connections.
// Set maxDuration to your Vercel plan limit (300s Pro / 60s Hobby).
export const runtime = 'nodejs'
export const maxDuration = 300

const MIN_PRIORITY = 3
const MAX_CLAIMS = 8      // cap to control cost on long videos

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const videoId = searchParams.get('videoId')
  if (!videoId) return new Response('videoId required', { status: 400, headers: CORS_HEADERS })

  const videoContext: VideoContext = {
    title: searchParams.get('title') ?? 'Unknown video',
    channel: searchParams.get('channel') ?? 'Unknown channel',
    description: searchParams.get('description') ?? '',
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          // Client disconnected — ignore
        }
      }

      try {
        // ── Check if already fully processed ─────────────────────────────────
        const { data: video } = await supabase
          .from('videos')
          .select('status')
          .eq('id', videoId)
          .single()

        if (video?.status === 'complete') {
          const { data: rows } = await supabase
            .from('fact_checks')
            .select('*')
            .eq('video_id', videoId)
            .order('timestamp_secs', { ascending: true })

          // Only use cache if there are actual results; otherwise reprocess
          if (rows && rows.length > 0) {
            for (const row of rows) {
              send('claim', rowToResult(row))
            }
            send('done', { cached: true, total: rows.length })
            controller.close()
            return
          }
          // Reset status so we reprocess below
          await supabase.from('videos').update({ status: 'processing' }).eq('id', videoId)
        }

        // ── Create / mark video as processing ─────────────────────────────────
        await supabase.from('videos').upsert(
          {
            id: videoId,
            title: videoContext.title,
            channel: videoContext.channel,
            type: 'vod',
            status: 'processing',
          },
          { onConflict: 'id' }
        )

        // ── Fetch transcript ──────────────────────────────────────────────────
        send('status', { message: 'Fetching transcript…' })
        let segments
        try {
          segments = await fetchTranscript(videoId)
        } catch {
          send('error', { message: 'No captions available for this video.' })
          await supabase.from('videos').update({ status: 'failed' }).eq('id', videoId)
          controller.close()
          return
        }

        const timedTranscript = formatTimedTranscript(segments)
        send('status', { message: `Analysing ${segments.length} transcript segments…` })

        // ── Extract all claims (keepalive prevents SSE timeout during long run) ─
        const keepalive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'))
          } catch {
            // client disconnected — interval will be cleared below
          }
        }, 15_000)

        let extracted: Awaited<ReturnType<typeof extractClaims>> = []
        try {
          extracted = await extractClaims(timedTranscript, videoContext, {
            lightweight: false,
            includeTimestamps: true,
          })
        } finally {
          clearInterval(keepalive)
        }

        console.log(`[recorded/stream] extracted ${extracted.length} claims`)

        const candidates = extracted
          .filter((c) => c.priority >= MIN_PRIORITY)
          .sort((a, b) => b.priority - a.priority)

        console.log(`[recorded/stream] ${candidates.length} candidates after priority filter`)

        // Deduplicate against DB (retry safety) AND within the batch itself
        const { data: existing } = await supabase
          .from('fact_checks')
          .select('claim_text')
          .eq('video_id', videoId)

        const existingTexts = (existing ?? []).map((r) => r.claim_text)
        const dedupedFromDb = filterDuplicates(candidates, existingTexts)

        // Self-deduplicate: build list greedily, rejecting each claim that
        // overlaps >55% with any already-accepted claim in this batch.
        const toProcess: typeof dedupedFromDb = []
        for (const claim of dedupedFromDb) {
          if (filterDuplicates([claim], toProcess.map((c) => c.text)).length > 0) {
            toProcess.push(claim)
          }
          if (toProcess.length >= MAX_CLAIMS) break
        }

        console.log(`[recorded/stream] ${toProcess.length} claims to process after dedup/cap`)
        send('status', { message: `Verifying ${toProcess.length} claims…`, total: toProcess.length })

        // ── Single batch fact-check (one tim-claude run for all claims) ────────
        let processed = 0
        try {
          const results = await factCheckClaimsBatch(
            toProcess.map((c) => c.text),
            videoContext,
          )

          for (let i = 0; i < results.length; i++) {
            const result = results[i]
            const claim = toProcess[i]
            if (!result || !claim) continue

            const timestampSecs = claim.timestampSecs ?? 0
            const { data: inserted } = await supabase
              .from('fact_checks')
              .insert({
                video_id: videoId,
                claim_text: claim.text,
                verdict: result.verdict,
                confidence: result.confidence,
                summary: result.summary,
                timestamp_secs: timestampSecs,
                sources: result.sources,
                reasoning: result.reasoning,
              })
              .select('id, checked_at')
              .single()

            processed++
            send('claim', {
              id: inserted?.id,
              claim: claim.text,
              verdict: result.verdict as FactCheckResult['verdict'],
              confidence: result.confidence,
              summary: result.summary,
              sources: result.sources,
              reasoning: result.reasoning,
              timestamp: timestampSecs,
              checkedAt: inserted?.checked_at
                ? new Date(inserted.checked_at).getTime()
                : Date.now(),
            } satisfies FactCheckResult)
          }
        } catch (err) {
          console.error('[recorded/stream] batch factCheck error:', err)
        }

        // ── Mark complete ─────────────────────────────────────────────────────
        await supabase
          .from('videos')
          .update({ status: 'complete', completed_at: new Date().toISOString() })
          .eq('id', videoId)

        send('done', { cached: false, total: processed })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        send('error', { message })
        console.error('[recorded/stream] pipeline error:', err)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no', // disable Nginx buffering for SSE
    },
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToResult(row: Record<string, unknown>): FactCheckResult {
  return {
    id: row.id as string,
    claim: row.claim_text as string,
    verdict: row.verdict as FactCheckResult['verdict'],
    confidence: row.confidence as number,
    summary: row.summary as string,
    sources: row.sources as FactCheckResult['sources'],
    reasoning: row.reasoning as FactCheckResult['reasoning'],
    timestamp: row.timestamp_secs as number,
    checkedAt: new Date(row.checked_at as string).getTime(),
  }
}
