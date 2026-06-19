// lib/degenPipeline.ts
// The analysis pipeline for the live app. Real market data + news -> a
// deterministic score + per-holding risk -> the LLM writes ONLY the flavor
// (roast + vibes) grounded in the real numbers and current headlines.
//
// Returns exactly the columns this app stores (score, verdict, roast, vibes,
// holdings) plus the new ones (metrics, factors, news, data_quality,
// refreshed_at). The engine's native 6 verdicts and one-word classifications
// already match this app's vocabulary, so no remapping is needed.

import Anthropic from '@anthropic-ai/sdk'
import { getMarketData, type HoldingInput } from './marketData'
import { computeDegenScore } from './degenScore'
import { getNews, formatNewsForRoast, flattenNews, type Headline } from './news'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = process.env.DEGEN_MODEL || 'claude-haiku-4-5-20251001'

export interface EnrichedHolding {
  ticker: string
  allocation: number
  classification: string
  annualizedVol: number | null
  beta: number | null
  marketCap: number | null
  change1dPct: number | null
  change1mPct: number | null
  dataSource: string
}

export interface LiveAnalysis {
  score: number
  verdict: string
  roast: string
  vibes: string
  holdings: EnrichedHolding[]
  metrics: ReturnType<typeof computeDegenScore>['metrics']
  factors: ReturnType<typeof computeDegenScore>['factors']
  news: Headline[]
  data_quality: 'live' | 'partial' | 'estimated'
  refreshed_at: string
}

export async function analyzeLive(holdings: HoldingInput[]): Promise<LiveAnalysis> {
  const { metrics, dataQuality } = await getMarketData(holdings)
  const result = computeDegenScore(holdings, metrics, dataQuality)
  const newsMap = await getNews(holdings.map((h) => h.ticker))

  const flavor = await generateFlavor(result.roastContext, formatNewsForRoast(newsMap))

  const enriched: EnrichedHolding[] = result.holdings.map((h) => ({
    ticker: h.ticker,
    allocation: h.allocation,
    classification: h.classification,
    annualizedVol: h.annualizedVol,
    beta: h.beta,
    marketCap: h.marketCap,
    change1dPct: h.change1dPct,
    change1mPct: h.change1mPct,
    dataSource: h.dataSource,
  }))

  return {
    score: result.degenScore,
    verdict: result.verdict,
    roast: flavor.roast,
    vibes: flavor.vibes,
    holdings: enriched,
    metrics: result.metrics,
    factors: result.factors,
    news: flattenNews(newsMap),
    data_quality: result.dataQuality,
    refreshed_at: new Date().toISOString(),
  }
}

// The DB columns an analysis writes (everything except nickname / is_public,
// which the caller controls). Shared by analyze + reroast + cron.
export function liveColumns(a: LiveAnalysis) {
  return {
    score: a.score,
    verdict: a.verdict,
    roast: a.roast,
    vibes: a.vibes,
    holdings: a.holdings,
    metrics: a.metrics,
    factors: a.factors,
    news: a.news,
    data_quality: a.data_quality,
    refreshed_at: a.refreshed_at,
  }
}

// Drop the columns added by this upgrade, for fallback writes on un-migrated DBs.
export function stripNewColumns<T extends Record<string, unknown>>(row: T): Partial<T> {
  const copy: Record<string, unknown> = { ...row }
  for (const k of ['metrics', 'factors', 'news', 'data_quality', 'refreshed_at']) delete copy[k]
  return copy as Partial<T>
}

// ---------------------------------------------------------------------------
// LLM flavor (roast + vibes), grounded in the real metrics + headlines.
// ---------------------------------------------------------------------------
interface Flavor {
  roast: string
  vibes: string
}

async function generateFlavor(metricsContext: string, newsContext: string): Promise<Flavor> {
  if (!process.env.ANTHROPIC_API_KEY) return fallbackFlavor(metricsContext)
  try {
    const prompt = `You are a brutally honest, darkly funny financial analyst roasting an investment portfolio. You are given REAL computed metrics, recent price moves, and current news. Use them — cite specific tickers, real numbers, recent moves, and riff on actual headlines when relevant.

${metricsContext}

${newsContext}

Respond ONLY with a valid JSON object, no markdown, no backticks:
{
  "roast": "<2-3 sentences, savage but accurate, reference specific tickers + a recent move or headline>",
  "vibes": "<one short funny vibe-check phrase for the whole portfolio>"
}`

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('')
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    return {
      roast: str(parsed.roast) || fallbackFlavor(metricsContext).roast,
      vibes: str(parsed.vibes) || fallbackFlavor(metricsContext).vibes,
    }
  } catch (e) {
    console.warn('Flavor generation failed, using fallback:', e)
    return fallbackFlavor(metricsContext)
  }
}

function fallbackFlavor(metricsContext: string): Flavor {
  const m = metricsContext.match(/Degen score: (\d+)/)
  const score = m ? parseInt(m[1], 10) : 50
  const roast =
    score >= 85 ? 'No survivors, no stop-losses, no chill. Pure adrenaline and zero ballast.'
    : score >= 70 ? 'Diversification was optional and you opted out. Conviction is just one flaming basket.'
    : score >= 55 ? 'Spicy with real risk under the hood — you like chaos but still check the smoke detector. Mostly.'
    : score >= 40 ? 'Respectably balanced with a few characters for entertainment. Sensible, with a wink.'
    : score >= 20 ? 'Calm, diversified, suspiciously responsible. Your portfolio files its taxes early.'
    : 'A financial advisor’s dream. Boring is a strategy and you are committed.'
  const vibes =
    score >= 70 ? 'Maximum overdrive, minimum caution' : score >= 40 ? 'Calculated chaos, mostly calculated' : 'Responsible to a fault'
  return { roast, vibes }
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
