export type Verdict =
  | 'true'
  | 'mostly-true'
  | 'misleading'
  | 'mostly-false'
  | 'false'
  | 'unverifiable'

export interface FactCheckSource {
  title: string
  url: string
}

export interface FactCheckReasoningStep {
  step: string
  finding: string
}

export interface FactCheckResult {
  claim: string
  verdict: Verdict
  confidence: number // 0–100
  summary: string
  sources: FactCheckSource[]
  reasoning: FactCheckReasoningStep[]
  timestamp: number   // seconds into the video
  checkedAt: number   // Date.now()
}

export interface VideoContext {
  title: string
  channel: string
  description: string
}

export interface PendingClaim {
  id: string
  text: string
  timestamp: number
}
