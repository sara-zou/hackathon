import { createClient } from '@supabase/supabase-js'

// ── Database type definitions ─────────────────────────────────────────────────

export interface VideoRow {
  id: string                            // YouTube video ID
  title: string
  channel: string
  type: 'live' | 'vod'
  status: 'processing' | 'complete' | 'failed'
  created_at: string
  completed_at: string | null
}

export interface FactCheckRow {
  id: string                            // UUID
  video_id: string
  claim_text: string
  verdict: string
  confidence: number
  summary: string
  timestamp_secs: number
  sources: Array<{ title: string; url: string }>
  reasoning: Array<{ step: string; finding: string }>
  checked_at: string
}

// ── Server-side client (service role — full access) ───────────────────────────

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)
