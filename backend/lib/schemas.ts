import type { OutputSchema } from 'subconscious'

// ── Shared types ──────────────────────────────────────────────────────────────

export interface VideoContext {
  title: string
  channel: string
  description: string
}

export interface ExtractedClaim {
  text: string
  type: 'factual' | 'statistic' | 'opinion' | 'other'
  priority: number      // 1–5
  timestampSecs?: number // present when extracted from a timed transcript
}

export interface ExtractClaimsResponse {
  claims: ExtractedClaim[]
}

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

/** Shape returned by the API to clients (extension). */
export interface FactCheckResult {
  id?: string           // DB UUID (present when loaded from Supabase)
  claim: string
  verdict: Verdict
  confidence: number    // 0–100
  summary: string
  sources: FactCheckSource[]
  reasoning: FactCheckReasoningStep[]
  timestamp: number     // seconds into the video
  checkedAt: number     // Date.now() epoch ms
}

// ── Subconscious answerFormat schemas ────────────────────────────────────────

export const EXTRACT_CLAIMS_SCHEMA: OutputSchema = {
  type: 'object',
  title: 'ExtractedClaims',
  properties: {
    claims: {
      type: 'array',
      description: 'Factual claims extracted from the transcript',
      items: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The claim exactly as stated (or closely paraphrased)',
          },
          type: {
            type: 'string',
            description: 'Classification of the claim (e.g. factual, statistic, event, opinion)',
          },
          priority: {
            type: 'number',
            description:
              '1–5: 5 = specific verifiable fact or statistic, 3 = general factual claim, 1 = borderline / hard to check',
          },
          timestampSecs: {
            type: 'number',
            description:
              'Approximate video timestamp in seconds where this claim was made (convert from [M:SS] markers if present)',
          },
        },
        required: ['text', 'type', 'priority'],
        additionalProperties: false,
      },
    },
  },
  required: ['claims'],
}

export const FACT_CHECK_SCHEMA: OutputSchema = {
  type: 'object',
  title: 'FactCheckResult',
  properties: {
    verdict: {
      type: 'string',
      enum: ['true', 'mostly-true', 'misleading', 'mostly-false', 'false', 'unverifiable'],
      description: 'Verdict on the claim',
    },
    confidence: {
      type: 'number',
      description: 'Confidence in the verdict, 0–100. Be conservative: most claims 55–85.',
    },
    summary: {
      type: 'string',
      description: 'One or two sentences explaining the verdict in plain, neutral language',
    },
    sources: {
      type: 'array',
      description: 'Sources consulted',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Page or article title' },
          url: { type: 'string', description: 'Full URL' },
        },
        required: ['title', 'url'],
        additionalProperties: false,
      },
    },
    reasoning: {
      type: 'array',
      description: 'Step-by-step reasoning chain',
      items: {
        type: 'object',
        properties: {
          step: { type: 'string', description: 'Label for this reasoning step' },
          finding: { type: 'string', description: 'What was found or concluded' },
        },
        required: ['step', 'finding'],
        additionalProperties: false,
      },
    },
  },
  required: ['verdict', 'confidence', 'summary', 'sources', 'reasoning'],
}

const FACT_CHECK_ITEM = FACT_CHECK_SCHEMA

export const BATCH_FACT_CHECK_SCHEMA: OutputSchema = {
  type: 'object',
  title: 'BatchFactCheckResults',
  properties: {
    results: {
      type: 'array',
      description: 'Verdicts for each claim, in the same order as the input list',
      items: FACT_CHECK_ITEM,
    },
  },
  required: ['results'],
}
