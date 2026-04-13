import { NextRequest } from 'next/server'
import { Subconscious } from 'subconscious'
import { FACT_CHECK_SCHEMA, FactCheckRequest, FactCheckResult } from '@/lib/schemas'
import { corsJson, corsOptions } from '@/lib/cors'

const client = new Subconscious({ apiKey: process.env.SUBCONSCIOUS_API_KEY! })

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001'

export async function OPTIONS() {
  return corsOptions()
}

export async function POST(req: NextRequest) {
  const { claim, videoContext, timestamp }: FactCheckRequest = await req.json()

  if (!claim?.trim()) {
    return corsJson({ error: 'claim required' }, { status: 400 })
  }

  try {
    const run = await client.run({
      engine: 'tim-claude',
      input: {
        instructions: `You are a rigorous, objective fact-checker. Verify the following claim made in a YouTube video. Use your tools to find evidence.

VIDEO CONTEXT (helps interpret the claim):
Title: ${videoContext.title}
Channel: ${videoContext.channel}
${videoContext.description ? `Description: ${videoContext.description.slice(0, 300)}` : ''}

CLAIM TO VERIFY:
"${claim}"

Instructions:
1. Use WikipediaSearch first for well-known facts, people, organisations, or events
2. Use web_search and news_search to find current reporting or additional evidence
3. Use research_paper_search for scientific or statistical claims
4. Cross-reference at least 2–3 sources before reaching a verdict
5. Be objective — do not bias toward confirming or denying based on the channel's reputation

Verdict options:
- "true": claim is well-supported by evidence
- "mostly-true": broadly correct with minor inaccuracies or missing context
- "misleading": technically accurate but the framing is deceptive or cherry-picked
- "mostly-false": contains significant factual errors
- "false": clearly contradicted by evidence
- "unverifiable": insufficient evidence to reach a conclusion

Confidence guide: 90+ only if you found very strong, consistent evidence. 60–85 for typical claims. 40–60 for mixed or ambiguous evidence. Do not exceed 95.

Summary: 1–2 plain-English sentences explaining the verdict.
Sources: list every URL that materially influenced your verdict.
Reasoning: describe each search step and what you found — judges will read this.`,
        tools: [
          {
            type: 'function',
            name: 'WikipediaSearch',
            description:
              'Search Wikipedia for factual information about topics, people, events, organisations, and concepts. Best for grounding well-established facts quickly.',
            url: `${BACKEND_URL}/api/tools/wikipedia`,
            method: 'POST',
            timeout: 12,
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query — a topic, name, or concept to look up on Wikipedia',
                },
              },
              required: ['query'],
              additionalProperties: false,
            },
          },
          { type: 'platform', id: 'web_search', options: {} },
          { type: 'platform', id: 'news_search', options: {} },
          { type: 'platform', id: 'fast_search', options: {} },
          { type: 'platform', id: 'research_paper_search', options: {} },
        ],
        answerFormat: FACT_CHECK_SCHEMA,
      },
      options: { awaitCompletion: true },
    })

    const answer = run.result?.answer as unknown as Omit<FactCheckResult, 'claim' | 'timestamp' | 'checkedAt'>

    return corsJson({
      ...answer,
      claim,
      timestamp,
      checkedAt: Date.now(),
    } satisfies FactCheckResult)
  } catch (err: unknown) {
    console.error('[fact-check]', err)
    return corsJson({ error: 'internal' }, { status: 500 })
  }
}
