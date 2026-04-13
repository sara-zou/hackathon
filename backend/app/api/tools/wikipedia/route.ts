import { NextRequest } from 'next/server'
import { corsJson, corsOptions } from '@/lib/cors'

export async function OPTIONS() {
  return corsOptions()
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  // Subconscious may wrap params — try flat, then nested formats
  const query: string | undefined =
    body?.query ?? body?.parameters?.query ?? body?.input?.query

  console.log('[wikipedia] body:', JSON.stringify(body), '→ query:', query)

  if (!query?.trim()) {
    return corsJson({ error: 'query required' }, { status: 400 })
  }

  try {
    const searchUrl = new URL('https://en.wikipedia.org/w/api.php')
    searchUrl.searchParams.set('action', 'query')
    searchUrl.searchParams.set('list', 'search')
    searchUrl.searchParams.set('srsearch', query)
    searchUrl.searchParams.set('srlimit', '3')
    searchUrl.searchParams.set('format', 'json')
    searchUrl.searchParams.set('origin', '*')

    const searchRes = await fetch(searchUrl.toString(), {
      headers: { 'User-Agent': 'LiveCheck-FactChecker/1.0' },
    })
    const searchData = await searchRes.json()
    const topResult = searchData?.query?.search?.[0]

    if (!topResult) {
      return corsJson({ title: '', extract: 'No Wikipedia article found for this query.', url: '' })
    }

    const extractUrl = new URL('https://en.wikipedia.org/w/api.php')
    extractUrl.searchParams.set('action', 'query')
    extractUrl.searchParams.set('titles', topResult.title)
    extractUrl.searchParams.set('prop', 'extracts')
    extractUrl.searchParams.set('exintro', '1')
    extractUrl.searchParams.set('explaintext', '1')
    extractUrl.searchParams.set('exlimit', '1')
    extractUrl.searchParams.set('format', 'json')
    extractUrl.searchParams.set('origin', '*')

    const extractRes = await fetch(extractUrl.toString(), {
      headers: { 'User-Agent': 'LiveCheck-FactChecker/1.0' },
    })
    const extractData = await extractRes.json()
    const pages = extractData?.query?.pages ?? {}
    const page = Object.values(pages)[0] as { title?: string; extract?: string }

    return corsJson({
      title: page?.title ?? topResult.title,
      extract: (page?.extract ?? '').slice(0, 1500),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(
        (page?.title ?? topResult.title).replace(/ /g, '_')
      )}`,
    })
  } catch (err) {
    console.error('[wikipedia]', err)
    return corsJson({ error: 'Wikipedia lookup failed' }, { status: 500 })
  }
}
