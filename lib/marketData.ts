// lib/marketData.ts
// Pluggable market-data layer for the Degen Portfolio Analyzer.
//
// Goal: turn a list of {ticker, allocation} into REAL per-asset metrics
// (price, beta, market cap, sector, realized volatility, 52w range) so the
// degen score is computed from data instead of LLM guesswork.
//
// Providers (all optional, graceful fallback):
//   - Equities/ETFs:  Financial Modeling Prep (FMP_API_KEY)  -> richest data
//                     Yahoo Finance chart endpoint (no key)  -> price + vol fallback
//   - Crypto:         CoinGecko (no key)
//   - Last resort:    dataSource = 'estimated' (the API route lets the LLM
//                     estimate, clearly flagged, so the app never hard-fails).
//
// Nothing in here throws: a failed lookup yields a low-confidence AssetMetrics
// object so one bad ticker can't take down the whole analysis.

export type AssetType = 'equity' | 'etf' | 'crypto' | 'unknown'
export type DataSource = 'fmp' | 'yahoo' | 'coingecko' | 'estimated'

export interface HoldingInput {
  ticker: string
  allocation: number // percent, e.g. 25 means 25%
}

export interface AssetMetrics {
  ticker: string
  name: string
  assetType: AssetType
  price: number | null
  marketCap: number | null // USD
  beta: number | null
  sector: string | null
  annualizedVol: number | null // 0.45 == 45% annualized realized vol
  week52High: number | null
  week52Low: number | null
  change1dPct: number | null // recent move, e.g. -4.2 == down 4.2% on the day
  change1mPct: number | null // ~1 month move
  isLeveragedEtf: boolean
  isMeme: boolean
  isBroadMarketEtf: boolean
  dataSource: DataSource
}

// ---------------------------------------------------------------------------
// Reference lists (heuristics for the "fun" part of the score)
// ---------------------------------------------------------------------------

// Common crypto tickers -> CoinGecko ids. Accepts optional -USD / -USDT suffix.
const CRYPTO_MAP: Record<string, string> = {
  BTC: 'bitcoin', XBT: 'bitcoin', ETH: 'ethereum', SOL: 'solana',
  DOGE: 'dogecoin', SHIB: 'shiba-inu', XRP: 'ripple', ADA: 'cardano',
  AVAX: 'avalanche-2', MATIC: 'matic-network', POL: 'matic-network',
  LINK: 'chainlink', DOT: 'polkadot', LTC: 'litecoin', BCH: 'bitcoin-cash',
  PEPE: 'pepe', BONK: 'bonk', WIF: 'dogwifcoin', FLOKI: 'floki',
  TRX: 'tron', TON: 'the-open-network', NEAR: 'near', ATOM: 'cosmos',
  UNI: 'uniswap', AAVE: 'aave', ARB: 'arbitrum', OP: 'optimism',
  SUI: 'sui', APT: 'aptos', INJ: 'injective-protocol', RNDR: 'render-token',
  FET: 'fetch-ai', TAO: 'bittensor', SEI: 'sei-network', JUP: 'jupiter-exchange-solana',
}

// Leveraged / inverse / volatility ETFs and single-stock leveraged ETFs.
const LEVERAGED_ETFS = new Set([
  'TQQQ', 'SQQQ', 'SOXL', 'SOXS', 'SPXL', 'SPXS', 'UPRO', 'SPXU', 'UDOW', 'SDOW',
  'TNA', 'TZA', 'LABU', 'LABD', 'FNGU', 'FNGD', 'BULZ', 'WEBL', 'WEBS', 'TECL', 'TECS',
  'UVXY', 'VXX', 'SVXY', 'UVIX', 'SVIX', 'BOIL', 'KOLD', 'NUGT', 'DUST', 'JNUG', 'JDST',
  'GUSH', 'DRIP', 'UCO', 'SCO', 'YINN', 'YANG', 'TMF', 'TMV', 'TSLL', 'TSLQ', 'NVDL',
  'NVDU', 'NVDD', 'CONL', 'MSTU', 'MSTX', 'MSTZ', 'AMDL', 'GGLL', 'AAPU', 'BITX', 'ETHU',
])

// High-meme / WSB-favorite equities. Heuristic flavor, not exhaustive.
const MEME_TICKERS = new Set([
  'GME', 'AMC', 'BB', 'NOK', 'KOSS', 'BBBY', 'MULN', 'NKLA', 'FFIE', 'TLRY', 'SNDL',
  'CVNA', 'DJT', 'SMCI', 'RIOT', 'MARA', 'COIN', 'MSTR', 'HOOD', 'SOFI', 'PLTR',
  'RIVN', 'LCID', 'CHPT', 'WKHS', 'RKT', 'CLOV', 'WISH', 'BBIG', 'ATER', 'PROG',
  'GamesStop', 'SPCE', 'PTON', 'HYMC', 'GME', 'IONQ', 'RGTI', 'QBTS', 'SOUN', 'BBAI',
])

// Broad, diversified market ETFs -> treated as "safe" ballast.
const BROAD_MARKET_ETFS = new Set([
  'SPY', 'VOO', 'IVV', 'VTI', 'VT', 'QQQ', 'QQQM', 'DIA', 'IWM', 'SCHB', 'SCHX',
  'VEA', 'VWO', 'VXUS', 'BND', 'AGG', 'VIG', 'SCHD', 'VYM', 'VUG', 'VTV', 'ITOT',
])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase().replace(/\$/g, '')
}

export function cryptoId(ticker: string): string | null {
  const t = normalizeTicker(ticker).replace(/-?USDT?$/i, '').replace(/-USD$/i, '')
  return CRYPTO_MAP[t] ?? null
}

export function isLeveraged(ticker: string): boolean {
  return LEVERAGED_ETFS.has(normalizeTicker(ticker))
}

export function isMemeTicker(ticker: string): boolean {
  return MEME_TICKERS.has(normalizeTicker(ticker))
}

export function isBroadEtf(ticker: string): boolean {
  return BROAD_MARKET_ETFS.has(normalizeTicker(ticker))
}

// Annualized realized volatility from a series of closing prices.
// Uses daily log returns, sample std dev, annualized by sqrt(252).
export function annualizedVolFromCloses(closes: number[]): number | null {
  const clean = closes.filter((c) => typeof c === 'number' && c > 0)
  if (clean.length < 10) return null
  const returns: number[] = []
  for (let i = 1; i < clean.length; i++) {
    returns.push(Math.log(clean[i] / clean[i - 1]))
  }
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1)
  return Math.sqrt(variance) * Math.sqrt(252)
}

// Percent change of a chronological close series over `lookback` data points.
export function pctChange(closes: number[], lookback: number): number | null {
  const clean = closes.filter((c) => typeof c === 'number' && c > 0)
  if (clean.length < lookback + 1) return null
  const last = clean[clean.length - 1]
  const prev = clean[clean.length - 1 - lookback]
  if (!prev) return null
  return (last / prev - 1) * 100
}

// ---------------------------------------------------------------------------
// Tiny in-memory cache (per server instance). TTL keeps quotes fresh-ish
// while avoiding hammering providers / rate limits during bursts.
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 1000 * 60 * 15 // 15 minutes
const cache = new Map<string, { at: number; data: AssetMetrics }>()

function getCached(key: string): AssetMetrics | null {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data
  return null
}
function setCached(key: string, data: AssetMetrics) {
  cache.set(key, { at: Date.now(), data })
}

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

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

// FMP: one profile call (beta, sector, marketCap, price, isEtf, name) plus a
// historical call for realized volatility. Free tier covers US tickers.
async function fetchEquityFMP(ticker: string, apiKey: string): Promise<AssetMetrics | null> {
  const t = normalizeTicker(ticker)
  const profileArr = (await fetchJson(
    `https://financialmodelingprep.com/api/v3/profile/${t}?apikey=${apiKey}`
  )) as Array<Record<string, unknown>> | null
  const profile = Array.isArray(profileArr) ? profileArr[0] : null
  if (!profile) return null

  let annualizedVol: number | null = null
  let change1dPct: number | null = null
  let change1mPct: number | null = null
  const hist = (await fetchJson(
    `https://financialmodelingprep.com/api/v3/historical-price-full/${t}?timeseries=120&apikey=${apiKey}`
  )) as { historical?: Array<{ close?: number; adjClose?: number }> } | null
  if (hist?.historical?.length) {
    // FMP returns newest-first; reverse to chronological for log returns.
    const closes = hist.historical
      .map((d) => (typeof d.adjClose === 'number' ? d.adjClose : d.close ?? 0))
      .reverse()
    annualizedVol = annualizedVolFromCloses(closes)
    change1dPct = pctChange(closes, 1)
    change1mPct = pctChange(closes, 21)
  }

  const isEtf = profile.isEtf === true
  return {
    ticker: t,
    name: (profile.companyName as string) || t,
    assetType: isEtf ? 'etf' : 'equity',
    price: numOrNull(profile.price),
    marketCap: numOrNull(profile.mktCap),
    beta: numOrNull(profile.beta),
    sector: (profile.sector as string) || (isEtf ? 'ETF' : null),
    annualizedVol,
    week52High: range52High(profile.range),
    week52Low: range52Low(profile.range),
    change1dPct,
    change1mPct,
    isLeveragedEtf: isLeveraged(t),
    isMeme: isMemeTicker(t),
    isBroadMarketEtf: isBroadEtf(t),
    dataSource: 'fmp',
  }
}

// Yahoo chart endpoint (keyless). Gives price + closes (=> vol) + 52w meta.
// No beta/marketCap/sector here; the scorer down-weights those when missing.
async function fetchEquityYahoo(ticker: string): Promise<AssetMetrics | null> {
  const t = normalizeTicker(ticker)
  const data = (await fetchJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${t}?range=6mo&interval=1d`
  )) as {
    chart?: {
      result?: Array<{
        meta?: Record<string, unknown>
        indicators?: { adjclose?: Array<{ adjclose?: number[] }>; quote?: Array<{ close?: number[] }> }
      }>
    }
  } | null
  const result = data?.chart?.result?.[0]
  if (!result) return null
  const meta = result.meta || {}
  const closes = (
    result.indicators?.adjclose?.[0]?.adjclose ??
    result.indicators?.quote?.[0]?.close ??
    []
  ).filter(Boolean) as number[]

  return {
    ticker: t,
    name: (meta.shortName as string) || (meta.longName as string) || t,
    assetType: isBroadEtf(t) || isLeveraged(t) ? 'etf' : 'equity',
    price: numOrNull(meta.regularMarketPrice),
    marketCap: null,
    beta: null,
    sector: null,
    annualizedVol: annualizedVolFromCloses(closes),
    week52High: numOrNull(meta.fiftyTwoWeekHigh),
    week52Low: numOrNull(meta.fiftyTwoWeekLow),
    change1dPct: pctChange(closes, 1),
    change1mPct: pctChange(closes, 21),
    isLeveragedEtf: isLeveraged(t),
    isMeme: isMemeTicker(t),
    isBroadMarketEtf: isBroadEtf(t),
    dataSource: 'yahoo',
  }
}

// CoinGecko (keyless). Price + market cap from /coins/markets, realized vol
// from /market_chart daily prices.
async function fetchCrypto(ticker: string, id: string): Promise<AssetMetrics | null> {
  const t = normalizeTicker(ticker)
  const markets = (await fetchJson(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${id}`
  )) as Array<Record<string, unknown>> | null
  const m = Array.isArray(markets) ? markets[0] : null

  let annualizedVol: number | null = null
  let change1mPct: number | null = null
  const chart = (await fetchJson(
    `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=90&interval=daily`
  )) as { prices?: Array<[number, number]> } | null
  if (chart?.prices?.length) {
    const series = chart.prices.map((p) => p[1])
    annualizedVol = annualizedVolFromCloses(series)
    change1mPct = pctChange(series, 30)
  }

  return {
    ticker: t,
    name: (m?.name as string) || t,
    assetType: 'crypto',
    price: numOrNull(m?.current_price),
    marketCap: numOrNull(m?.market_cap),
    beta: null, // crypto handled by its own scoring factor
    sector: 'Crypto',
    annualizedVol,
    week52High: numOrNull(m?.high_24h), // approximate; CoinGecko markets has limited 52w
    week52Low: numOrNull(m?.low_24h),
    change1dPct: numOrNull(m?.price_change_percentage_24h),
    change1mPct,
    isLeveragedEtf: false,
    isMeme: false,
    isBroadMarketEtf: false,
    dataSource: 'coingecko',
  }
}

function estimatedMetrics(ticker: string): AssetMetrics {
  const t = normalizeTicker(ticker)
  return {
    ticker: t,
    name: t,
    assetType: cryptoId(t) ? 'crypto' : 'unknown',
    price: null,
    marketCap: null,
    beta: null,
    sector: null,
    annualizedVol: null,
    week52High: null,
    week52Low: null,
    change1dPct: null,
    change1mPct: null,
    isLeveragedEtf: isLeveraged(t),
    isMeme: isMemeTicker(t),
    isBroadMarketEtf: isBroadEtf(t),
    dataSource: 'estimated',
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

async function resolveOne(ticker: string): Promise<AssetMetrics> {
  const t = normalizeTicker(ticker)
  const cached = getCached(t)
  if (cached) return cached

  const id = cryptoId(t)
  let metrics: AssetMetrics | null = null

  if (id) {
    metrics = await fetchCrypto(t, id)
  } else {
    const fmpKey = process.env.FMP_API_KEY
    if (fmpKey) metrics = await fetchEquityFMP(t, fmpKey)
    if (!metrics) metrics = await fetchEquityYahoo(t)
  }

  const final = metrics ?? estimatedMetrics(t)
  if (final.dataSource !== 'estimated') setCached(t, final)
  return final
}

export interface MarketDataResult {
  metrics: AssetMetrics[]
  liveCount: number
  estimatedCount: number
  dataQuality: 'live' | 'partial' | 'estimated'
}

// Resolve all holdings in parallel; never throws.
export async function getMarketData(holdings: HoldingInput[]): Promise<MarketDataResult> {
  const metrics = await Promise.all(holdings.map((h) => resolveOne(h.ticker)))
  const estimatedCount = metrics.filter((m) => m.dataSource === 'estimated').length
  const liveCount = metrics.length - estimatedCount
  const dataQuality: MarketDataResult['dataQuality'] =
    estimatedCount === 0 ? 'live' : liveCount === 0 ? 'estimated' : 'partial'
  return { metrics, liveCount, estimatedCount, dataQuality }
}

// ---------------------------------------------------------------------------
// small utils
// ---------------------------------------------------------------------------

function numOrNull(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number)
  return typeof n === 'number' && isFinite(n) ? n : null
}

// FMP profile.range looks like "164.08-260.10"
function range52Low(range: unknown): number | null {
  if (typeof range !== 'string') return null
  const lo = parseFloat(range.split('-')[0])
  return isFinite(lo) ? lo : null
}
function range52High(range: unknown): number | null {
  if (typeof range !== 'string') return null
  const hi = parseFloat(range.split('-')[1])
  return isFinite(hi) ? hi : null
}
