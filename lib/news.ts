// lib/news.ts
// Pulls recent headlines per ticker so roasts can reference what's actually
// happening right now. Keyless by default (Yahoo Finance search endpoint),
// with an optional FMP fallback. Never throws.

export interface Headline {
  ticker: string
  title: string
  publisher: string
  url: string
  publishedAt: number | null // unix ms
}

const CACHE_TTL_MS = 1000 * 60 * 10 // news moves fast — 10 min cache
const cache = new Map<string, { at: number; data: Headline[] }>()

async function fetchJson(url: string, ms = 8000): Promise<unknown | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), ms)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'degen-portfolio/1.0', Accept: 'application/json' },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function clip(s: string, n = 140): string {
  const t = (s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

// Yahoo Finance search — returns a `news` array, no API key required.
async function fetchYahooNews(ticker: string, limit: number): Promise<Headline[]> {
  const data = (await fetchJson(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      ticker
    )}&quotesCount=0&newsCount=${limit}&enableFuzzyQuery=false`
  )) as { news?: Array<Record<string, unknown>> } | null
  const news = Array.isArray(data?.news) ? data!.news : []
  return news
    .filter((n) => typeof n.title === 'string')
    .map((n) => ({
      ticker,
      title: clip(n.title as string),
      publisher: (n.publisher as string) || 'News',
      url: (n.link as string) || '',
      publishedAt: typeof n.providerPublishTime === 'number' ? (n.providerPublishTime as number) * 1000 : null,
    }))
}

// FMP fallback (used only if FMP_API_KEY is set and Yahoo returned nothing).
async function fetchFmpNews(ticker: string, limit: number, apiKey: string): Promise<Headline[]> {
  const data = (await fetchJson(
    `https://financialmodelingprep.com/api/v3/stock_news?tickers=${ticker}&limit=${limit}&apikey=${apiKey}`
  )) as Array<Record<string, unknown>> | null
  if (!Array.isArray(data)) return []
  return data
    .filter((n) => typeof n.title === 'string')
    .map((n) => ({
      ticker,
      title: clip(n.title as string),
      publisher: (n.site as string) || 'News',
      url: (n.url as string) || '',
      publishedAt: n.publishedDate ? Date.parse(n.publishedDate as string) || null : null,
    }))
}

async function newsForTicker(ticker: string, limit: number): Promise<Headline[]> {
  const key = `${ticker}:${limit}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data

  let headlines = await fetchYahooNews(ticker, limit)
  if (headlines.length === 0 && process.env.FMP_API_KEY) {
    headlines = await fetchFmpNews(ticker, limit, process.env.FMP_API_KEY)
  }
  // newest first, de-duped by title
  const seen = new Set<string>()
  headlines = headlines
    .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
    .filter((h) => (seen.has(h.title) ? false : (seen.add(h.title), true)))
    .slice(0, limit)

  cache.set(key, { at: Date.now(), data: headlines })
  return headlines
}

// Fetch news for many tickers in parallel. Returns a map keyed by ticker.
export async function getNews(
  tickers: string[],
  perTicker = 3
): Promise<Record<string, Headline[]>> {
  const uniq = Array.from(new Set(tickers.map((t) => t.toUpperCase())))
  const results = await Promise.all(uniq.map((t) => newsForTicker(t, perTicker)))
  const map: Record<string, Headline[]> = {}
  uniq.forEach((t, i) => (map[t] = results[i]))
  return map
}

// Flatten a news map into the lines we hand to the roast model.
export function formatNewsForRoast(newsMap: Record<string, Headline[]>): string {
  const lines: string[] = []
  for (const [ticker, items] of Object.entries(newsMap)) {
    if (!items.length) continue
    const heads = items.slice(0, 2).map((h) => `"${h.title}" (${h.publisher})`).join('; ')
    lines.push(`- ${ticker}: ${heads}`)
  }
  return lines.length ? `Recent headlines:\n${lines.join('\n')}` : 'Recent headlines: none found.'
}

// A flat, de-duplicated list for displaying on the results page.
export function flattenNews(newsMap: Record<string, Headline[]>, max = 8): Headline[] {
  const all = Object.values(newsMap).flat()
  all.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
  return all.slice(0, max)
}
