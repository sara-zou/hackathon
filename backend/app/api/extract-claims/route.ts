import { NextRequest } from 'next/server'
import { Subconscious } from 'subconscious'
import {
  EXTRACT_CLAIMS_SCHEMA,
  ExtractClaimsRequest,
  ExtractClaimsResponse,
} from '@/lib/schemas'
import { corsJson, corsOptions } from '@/lib/cors'

const client = new Subconscious({ apiKey: process.env.SUBCONSCIOUS_API_KEY! })

export async function OPTIONS() {
  return corsOptions()
}

export async function POST(req: NextRequest) {
  const { captions, videoContext }: ExtractClaimsRequest = await req.json()

  if (!captions?.trim()) {
    return corsJson({ claims: [] })
  }

  try {
    const run = await client.run({
      engine: 'tim-claude',
      input: {
        instructions: `You are a claim extractor for a real-time fact-checking system. Your job is to identify factual claims from a short transcript snippet that are worth verifying.

VIDEO CONTEXT:
Title: ${videoContext.title}
Channel: ${videoContext.channel}
${videoContext.description ? `Description: ${videoContext.description.slice(0, 300)}` : ''}

TRANSCRIPT SNIPPET (last ~15 seconds):
${captions}

Extract only claims that are ALL of the following:
- Specific and verifiable (named facts, statistics, historical events, scientific assertions, causal claims)
- Non-trivial — something a reasonable person might doubt or want to verify
- NOT pure opinions, predictions, or rhetorical questions

Priority scoring:
- 5: Specific statistic ("X% of people..."), named historical event with claimed details, scientific claim
- 4: Named person/organisation attributed with a specific action or position
- 3: General factual assertion that could be looked up
- 1–2: Borderline, vague, or hard to verify

If nothing in the snippet is worth fact-checking, return an empty claims array. Do not invent claims.`,
        tools: [],
        answerFormat: EXTRACT_CLAIMS_SCHEMA,
      },
      options: { awaitCompletion: true },
    })

    const result = run.result?.answer as unknown as ExtractClaimsResponse
    return corsJson(result ?? { claims: [] })
  } catch (err) {
    console.error('[extract-claims]', err)
    return corsJson({ claims: [] })
  }
}
