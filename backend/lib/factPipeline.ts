import { Subconscious } from 'subconscious'
import { EXTRACT_CLAIMS_SCHEMA, FACT_CHECK_SCHEMA, BATCH_FACT_CHECK_SCHEMA } from './schemas'
import type { VideoContext, ExtractedClaim } from './schemas'

const client = new Subconscious({ apiKey: process.env.SUBCONSCIOUS_API_KEY! })
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001'

// ── Claim extraction ──────────────────────────────────────────────────────────

export interface ExtractOptions {
  /** Use tim-edge (faster, cheaper) — for live stream ingests */
  lightweight?: boolean
  /** Transcript already has [M:SS] timestamp markers — ask model to extract them */
  includeTimestamps?: boolean
}

export async function extractClaims(
  text: string,
  videoContext: VideoContext,
  opts: ExtractOptions = {}
): Promise<ExtractedClaim[]> {
  const engine = opts.lightweight ? 'tim-edge' : 'tim-gpt'

  const instructions = opts.includeTimestamps
    ? buildTimedExtractionPrompt(text, videoContext)
    : buildExtractionPrompt(text, videoContext)

  try {
    const run = await client.run({
      engine,
      input: { instructions, tools: [], answerFormat: EXTRACT_CLAIMS_SCHEMA },
      options: { awaitCompletion: true },
    })
    const claims =
      ((run.result?.answer as unknown as { claims?: ExtractedClaim[] })?.claims ?? [])
    console.log(`[factPipeline] extractClaims got ${claims.length} claims`)
    return claims
  } catch (err) {
    console.error('[factPipeline] extractClaims error:', err)
    return []
  }
}

function buildExtractionPrompt(text: string, ctx: VideoContext): string {
  return `You are a claim extractor for a fact-checking system. Identify specific, verifiable factual claims from this transcript.

VIDEO: ${ctx.title} — ${ctx.channel}${ctx.description ? `\n${ctx.description.slice(0, 200)}` : ''}

TRANSCRIPT:
${text}

Rules:
- Extract claims STATED AS FACT. Video format (Minecraft, animation, documentary, etc.) is irrelevant — extract the same way regardless.
- Do NOT refuse based on presentation style or uncertainty. The fact-checker (a separate step) determines truth.
- Extract: named people, events, dates, statistics, causal claims — anything specific and checkable.
- Return empty only if the transcript has literally no factual assertions whatsoever.

Priority (1–5) — score on BOTH specificity AND centrality to the video's main topic:
- 5: Core claim of the video (the central event, finding, or outcome) AND specific/verifiable
- 4: Directly supports or explains the main story; specific and checkable
- 3: Peripheral context — verifiable but background detail not central to the narrative
- 1–2: Vague, generic, or filler

You MUST respond with a JSON object in exactly this format — no prose, no markdown, no explanation:
{"claims":[{"text":"...","type":"...","priority":5,"timestampSecs":0}]}`
}

function buildTimedExtractionPrompt(transcript: string, ctx: VideoContext): string {
  return `You are a claim extractor for a fact-checking system. The transcript has [M:SS] timestamps. Identify specific, verifiable factual claims.

VIDEO: ${ctx.title} — ${ctx.channel}${ctx.description ? `\n${ctx.description.slice(0, 200)}` : ''}

TIMED TRANSCRIPT:
${transcript}

Rules:
- Extract claims STATED AS FACT. Format (Minecraft, animation, etc.) is irrelevant — extract the same way.
- Do NOT refuse based on presentation style or uncertainty. The fact-checker (a separate step) determines truth.
- For each claim, include the timestamp in seconds (convert from [M:SS]).
- Return empty only if the transcript has literally no factual assertions whatsoever.

Priority (1–5) — score on BOTH specificity AND centrality to the video's main topic:
- 5: Core claim of the video (the central event, finding, or outcome) AND specific/verifiable
- 4: Directly supports or explains the main story; specific and checkable
- 3: Peripheral context — verifiable but background detail not central to the narrative
- 1–2: Vague, generic, or filler

You MUST respond with a JSON object in exactly this format — no prose, no markdown, no explanation:
{"claims":[{"text":"...","type":"...","priority":5,"timestampSecs":0}]}`
}

// ── Fact checking ─────────────────────────────────────────────────────────────

export interface FactCheckOptions {
  /** Fewer tools, faster — for live stream claims */
  shallow?: boolean
}

export interface FactCheckCoreResult {
  verdict: string
  confidence: number
  summary: string
  sources: Array<{ title: string; url: string }>
  reasoning: Array<{ step: string; finding: string }>
}

export async function factCheckClaim(
  claim: string,
  videoContext: VideoContext,
  opts: FactCheckOptions = {}
): Promise<FactCheckCoreResult> {
  const depthNote = opts.shallow
    ? 'Use 2–3 sources. Be efficient.'
    : 'Use WikipediaSearch first for established facts, then web/news/research for recent or statistical claims. Cross-reference 2–3+ sources.'

  const tools = opts.shallow
    ? [
        { type: 'platform' as const, id: 'web_search', options: {} },
        { type: 'platform' as const, id: 'fast_search', options: {} },
      ]
    : [
        {
          type: 'function' as const,
          name: 'WikipediaSearch',
          description: 'Search Wikipedia for factual information about topics, people, events, and concepts.',
          url: `${BACKEND_URL}/api/tools/wikipedia`,
          method: 'POST' as const,
          timeout: 12,
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Topic to look up on Wikipedia' },
            },
            required: ['query'],
            additionalProperties: false,
          },
        },
        { type: 'platform' as const, id: 'web_search', options: {} },
        { type: 'platform' as const, id: 'news_search', options: {} },
        { type: 'platform' as const, id: 'fast_search', options: {} },
        { type: 'platform' as const, id: 'research_paper_search', options: {} },
      ]

  const run = await client.run({
    engine: 'tim-claude',
    input: {
      instructions: `You are a rigorous fact-checker. Verify this claim from a YouTube video.

VIDEO: ${videoContext.title} — ${videoContext.channel}

CLAIM: "${claim}"

${depthNote}

Verdicts: true | mostly-true | misleading | mostly-false | false | unverifiable
- true: well-supported; mostly-true: broadly correct with minor gaps; misleading: accurate but deceptive framing; mostly-false: significant errors; false: contradicted by evidence; unverifiable: insufficient evidence

Confidence: 90+ for very strong consistent evidence; 60–85 typical; 40–60 mixed. Max 95.
Summary: 1–2 plain sentences.
Sources: all URLs that materially influenced the verdict.
Reasoning: each search step and what you found.

You MUST respond with a JSON object in exactly this format — no prose, no markdown, no explanation:
{"verdict":"true","confidence":80,"summary":"...","sources":[{"title":"...","url":"..."}],"reasoning":[{"step":"...","finding":"..."}]}`,
      tools,
      answerFormat: FACT_CHECK_SCHEMA,
    },
    options: { awaitCompletion: true },
  })

  let answer = run.result?.answer
  // tim-gpt/tim-claude occasionally returns valid JSON as a string instead of parsed object
  if (typeof answer === 'string') {
    try { answer = JSON.parse(answer) } catch { /* fall through to error below */ }
  }
  if (!answer || typeof answer !== 'object') {
    console.error('[factPipeline] factCheckClaim unexpected answer:', answer)
    throw new Error(`factCheckClaim returned no answer (run status: ${run.status})`)
  }
  return answer as unknown as FactCheckCoreResult
}

// ── Batch fact checking (VOD) ─────────────────────────────────────────────────

/**
 * Verify multiple claims in a single tim-claude run.
 * ~3-4× cheaper than N individual calls: video context and tools are shared,
 * fixed run overhead paid once.
 * Returns results in the same order as the input claims array.
 */
export async function factCheckClaimsBatch(
  claims: string[],
  videoContext: VideoContext,
): Promise<FactCheckCoreResult[]> {
  if (claims.length === 0) return []

  const claimsList = claims.map((c, i) => `${i + 1}. "${c}"`).join('\n')

  const tools = [
    {
      type: 'function' as const,
      name: 'WikipediaSearch',
      description: 'Search Wikipedia for factual information about topics, people, events, and concepts.',
      url: `${BACKEND_URL}/api/tools/wikipedia`,
      method: 'POST' as const,
      timeout: 12,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Topic to look up on Wikipedia' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
    { type: 'platform' as const, id: 'web_search', options: {} },
    { type: 'platform' as const, id: 'news_search', options: {} },
    { type: 'platform' as const, id: 'fast_search', options: {} },
    { type: 'platform' as const, id: 'research_paper_search', options: {} },
  ]

  const run = await client.run({
    engine: 'tim-claude',
    input: {
      instructions: `You are a rigorous fact-checker. Verify each of these ${claims.length} claims from a YouTube video.

VIDEO: ${videoContext.title} — ${videoContext.channel}

CLAIMS:
${claimsList}

Cross-reference each claim with 2–3 sources. Use WikipediaSearch first for established facts, then web/news/research for recent or statistical claims. You may reuse a search result across multiple claims.

Verdicts: true | mostly-true | misleading | mostly-false | false | unverifiable
- true: well-supported; mostly-true: broadly correct with minor gaps; misleading: accurate but deceptive framing; mostly-false: significant errors; false: contradicted by evidence; unverifiable: insufficient evidence

Confidence: 90+ for very strong consistent evidence; 60–85 typical; 40–60 mixed. Max 95.
Summary: 1–2 plain sentences per claim.

You MUST respond with a JSON object in exactly this format — no prose, no markdown, no explanation:
{"results":[{"verdict":"true","confidence":80,"summary":"...","sources":[{"title":"...","url":"..."}],"reasoning":[{"step":"...","finding":"..."}]}]}
The results array must have exactly ${claims.length} items in the same order as the claims list.`,
      tools,
      answerFormat: BATCH_FACT_CHECK_SCHEMA,
    },
    options: { awaitCompletion: true },
  })

  let answer = run.result?.answer
  if (typeof answer === 'string') {
    try { answer = JSON.parse(answer) } catch { /* fall through */ }
  }
  if (!answer || typeof answer !== 'object') {
    throw new Error(`factCheckClaimsBatch returned no answer (run status: ${run.status})`)
  }
  const results = (answer as unknown as { results?: FactCheckCoreResult[] }).results ?? []
  // Guard: model may return fewer results than claims
  return claims.map((_, i) => results[i] ?? null).filter(Boolean) as FactCheckCoreResult[]
}

// ── Claim deduplication ───────────────────────────────────────────────────────

function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3))
  const wordsB = b.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  if (wordsA.size === 0 || wordsB.length === 0) return 0
  const overlap = wordsB.filter((w) => wordsA.has(w)).length
  return overlap / Math.max(wordsA.size, wordsB.length)
}

/**
 * Filter out claims that overlap significantly with already-checked claim texts.
 * Uses word overlap (≥60%) to catch paraphrased duplicates.
 */
export function filterDuplicates(
  newClaims: ExtractedClaim[],
  existingTexts: string[]
): ExtractedClaim[] {
  return newClaims.filter(
    (claim) => !existingTexts.some((existing) => wordOverlap(claim.text, existing) > 0.6)
  )
}
