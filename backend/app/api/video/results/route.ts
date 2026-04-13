import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { corsJson, corsOptions } from '@/lib/cors'
import type { FactCheckResult } from '@/lib/schemas'

export async function OPTIONS() {
  return corsOptions()
}

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('videoId')
  if (!videoId) return corsJson({ error: 'videoId required' }, { status: 400 })

  const { data: video } = await supabase
    .from('videos')
    .select('id, type, status')
    .eq('id', videoId)
    .single()

  if (!video) {
    return corsJson({ status: 'not_found', type: null, results: [] })
  }

  const { data: rows } = await supabase
    .from('fact_checks')
    .select('*')
    .eq('video_id', videoId)
    .order('timestamp_secs', { ascending: true })

  const results: FactCheckResult[] = (rows ?? []).map((row) => ({
    id: row.id,
    claim: row.claim_text,
    verdict: row.verdict as FactCheckResult['verdict'],
    confidence: row.confidence,
    summary: row.summary,
    sources: row.sources,
    reasoning: row.reasoning,
    timestamp: row.timestamp_secs,
    checkedAt: new Date(row.checked_at).getTime(),
  }))

  return corsJson({ status: video.status, type: video.type, results })
}
