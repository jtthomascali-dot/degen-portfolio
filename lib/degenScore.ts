// lib/degenScore.ts
// Deterministic "degen score" engine. Same portfolio -> same score, every time.
//
// The score is a weighted blend of five factors computed from REAL data
// (volatility + beta) and structural facts (concentration, speculative names,
// crypto exposure). The LLM is no longer asked to invent a number; it only
// writes the roast, using the numbers this engine produces.
//
// Pure functions, no external deps, so it can be unit-tested in isolation.

import type { AssetMetrics, HoldingInput } from './marketData'

export interface FactorScore {
  key: 'concentration' | 'volatility' | 'beta' | 'speculative' | 'crypto'
  label: string
  score: number // 0-100
  weight: number // effective weight after renormalization (0-1)
  available: boolean
  detail: string
}

export type Classification = 'safe' | 'boomer' | 'growth' | 'gambling' | 'degen' | 'unhinged'

export interface HoldingScore {
  ticker: string
  allocation: number
  classification: Classification
  assetType: AssetMetrics['assetType']
  beta: number | null
  annualizedVol: number | null
  marketCap: number | null
  change1dPct: number | null
  change1mPct: number | null
  dataSource: AssetMetrics['dataSource']
}

export interface DegenResult {
  degenScore: number // 0-100 integer
  verdict: string
  factors: FactorScore[]
  holdings: HoldingScore[]
  metrics: {
    weightedVol: number | null
    weightedBeta: number | null
    maxWeightPct: number
    cryptoPct: number
    speculativePct: number
    concentrationHHI: number
    holdingsCount: number
    dataQuality: 'live' | 'partial' | 'estimated'
  }
  dataQuality: 'live' | 'partial' | 'estimated'
  roastContext: string
}

// Blend weights for the four asset-risk factors (sum to 1), renormalized over
// whichever have data. Concentration is NOT in this blend; it is applied as a
// booster worth up to CONC_BOOST_MAX points so diversified-junk books still
// score high while all-in single bets get an extra push.
const BASE_WEIGHTS = {
  volatility: 0.3,
  speculative: 0.35,
  crypto: 0.15,
  beta: 0.2,
} as const
const CONC_BOOST_MAX = 15

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x))
const lerp = (x: number, x0: number, x1: number) => ((x - x0) / (x1 - x0)) * 100

// ---------------------------------------------------------------------------

export function computeDegenScore(
  holdings: HoldingInput[],
  metrics: AssetMetrics[],
  dataQuality: 'live' | 'partial' | 'estimated'
): DegenResult {
  const n = holdings.length
  const byTicker = new Map(metrics.map((m) => [m.ticker, m]))

  // Normalized portfolio weights (fractions summing to 1).
  const totalAlloc = holdings.reduce((s, h) => s + (h.allocation || 0), 0)
  const rows = holdings.map((h) => {
    const m = byTicker.get(normalize(h.ticker)) || byTicker.get(h.ticker)
    const w = totalAlloc > 0 ? (h.allocation || 0) / totalAlloc : 1 / n
    return { input: h, m, w }
  })

  // --- Concentration (look-through) ---
  // A broad ETF (VOO, VTI...) holds hundreds of names, so 60% in VOO is NOT a
  // concentrated bet. Discount broad ETFs heavily so only real single-name
  // concentration counts. Raw hhi/maxWeight are kept for honest display.
  const hhi = rows.reduce((s, r) => s + r.w * r.w, 0)
  const maxWeight = rows.reduce((mx, r) => Math.max(mx, r.w), 0)
  const effHhi = rows.reduce((s, r) => s + (r.m?.isBroadMarketEtf ? (r.w * r.w) / 25 : r.w * r.w), 0)
  const effMaxWeight = rows.reduce((mx, r) => Math.max(mx, r.m?.isBroadMarketEtf ? r.w / 10 : r.w), 0)
  const concScore = clamp(
    0.5 * clamp(lerp(effHhi, 0.1, 0.6)) + 0.5 * clamp(lerp(effMaxWeight, 0.2, 0.8))
  )

  // --- Factor 2: Volatility (needs realized vol on >=1 holding) ---
  const volRows = rows.filter((r) => r.m?.annualizedVol != null)
  const volWeightSum = volRows.reduce((s, r) => s + r.w, 0)
  const weightedVol =
    volRows.length > 0
      ? volRows.reduce((s, r) => s + (r.w / volWeightSum) * (r.m!.annualizedVol as number), 0)
      : null
  const volAvailable = weightedVol != null
  const volScore = volAvailable ? clamp(lerp(weightedVol as number, 0.15, 0.9)) : 0

  // --- Factor 3: Beta (needs beta on >=1 equity) ---
  const betaRows = rows.filter((r) => r.m?.beta != null)
  const betaWeightSum = betaRows.reduce((s, r) => s + r.w, 0)
  const weightedBeta =
    betaRows.length > 0
      ? betaRows.reduce((s, r) => s + (r.w / betaWeightSum) * (r.m!.beta as number), 0)
      : null
  const betaAvailable = weightedBeta != null
  const betaScore = betaAvailable ? clamp(lerp(weightedBeta as number, 0.5, 2.5)) : 0

  // --- Factor 4: Speculative exposure (always available) ---
  let speculativePct = 0
  const specScore = clamp(
    rows.reduce((s, r) => {
      const intensity = speculativeIntensity(r.m, r.input.ticker)
      speculativePct += r.w * (intensity > 0.5 ? 1 : 0)
      return s + r.w * intensity
    }, 0) * 100
  )
  speculativePct *= 100

  // --- Factor 5: Crypto exposure (always available) ---
  const cryptoWeight = rows.reduce(
    (s, r) => s + (r.m?.assetType === 'crypto' || cryptoLike(r.input.ticker) ? r.w : 0),
    0
  )
  const cryptoScore = clamp(100 * Math.pow(cryptoWeight, 0.6))

  // --- Blend the four "how dangerous are the assets" factors ---
  // Weights renormalize over whichever factors have data. Concentration is
  // applied separately as a booster (below) so a diversified book of junk
  // still scores high, while all-in single bets get an extra push.
  const riskParts = [
    { key: 'volatility', base: BASE_WEIGHTS.volatility, score: round(volScore), available: volAvailable },
    { key: 'speculative', base: BASE_WEIGHTS.speculative, score: round(specScore), available: true },
    { key: 'crypto', base: BASE_WEIGHTS.crypto, score: round(cryptoScore), available: true },
    { key: 'beta', base: BASE_WEIGHTS.beta, score: round(betaScore), available: betaAvailable },
  ]
  const availBase = riskParts.filter((f) => f.available).reduce((s, f) => s + f.base, 0)
  const effWeight = new Map<string, number>()
  let riskBlend = 0
  for (const f of riskParts) {
    const w = f.available ? f.base / availBase : 0
    effWeight.set(f.key, w)
    riskBlend += w * f.score
  }
  const concBoost = (concScore / 100) * CONC_BOOST_MAX
  const degenScore = round(clamp(riskBlend + concBoost))

  const rawFactors: FactorScore[] = [
    { key: 'concentration', label: 'Concentration', score: round(concScore), weight: CONC_BOOST_MAX / 100, available: true, detail: concentrationDetail(hhi, maxWeight, n) },
    { key: 'volatility', label: 'Volatility', score: round(volScore), weight: effWeight.get('volatility') || 0, available: volAvailable, detail: volAvailable ? `${pct(weightedVol as number)} annualized (weighted)` : 'No price history available' },
    { key: 'beta', label: 'Market beta', score: round(betaScore), weight: effWeight.get('beta') || 0, available: betaAvailable, detail: betaAvailable ? `${(weightedBeta as number).toFixed(2)}x weighted beta` : 'No beta data available' },
    { key: 'speculative', label: 'Speculative names', score: round(specScore), weight: effWeight.get('speculative') || 0, available: true, detail: `${Math.round(speculativePct)}% in meme / small-cap / leveraged / crypto` },
    { key: 'crypto', label: 'Crypto exposure', score: round(cryptoScore), weight: effWeight.get('crypto') || 0, available: true, detail: `${Math.round(cryptoWeight * 100)}% of book in crypto` },
  ]

  // --- Per-holding classification ---
  const holdingScores: HoldingScore[] = rows.map((r) => ({
    ticker: normalize(r.input.ticker),
    allocation: r.input.allocation,
    classification: classify(r.m, r.input.ticker),
    assetType: r.m?.assetType ?? (cryptoLike(r.input.ticker) ? 'crypto' : 'unknown'),
    beta: r.m?.beta ?? null,
    annualizedVol: r.m?.annualizedVol ?? null,
    marketCap: r.m?.marketCap ?? null,
    change1dPct: r.m?.change1dPct ?? null,
    change1mPct: r.m?.change1mPct ?? null,
    dataSource: r.m?.dataSource ?? 'estimated',
  }))

  const result: DegenResult = {
    degenScore,
    verdict: verdictFor(degenScore),
    factors: rawFactors,
    holdings: holdingScores,
    metrics: {
      weightedVol,
      weightedBeta,
      maxWeightPct: round(maxWeight * 100),
      cryptoPct: round(cryptoWeight * 100),
      speculativePct: round(speculativePct),
      concentrationHHI: Math.round(hhi * 1000) / 1000,
      holdingsCount: n,
      dataQuality,
    },
    dataQuality,
    roastContext: '',
  }
  result.roastContext = buildRoastContext(result, holdingScores)
  return result
}

// ---------------------------------------------------------------------------
// Verdicts (kept compatible with the existing UI + leaderboard emojis)
// ---------------------------------------------------------------------------

export function verdictFor(score: number): string {
  if (score < 10) return 'Warren Buffett'
  if (score < 20) return 'Bond Dad'
  if (score < 30) return 'Index Fund Andy'
  if (score < 40) return 'Boglehead in Recovery'
  if (score < 50) return 'Casual Gambler'
  if (score < 60) return 'Spicy But Survivable'
  if (score < 70) return 'WSB Recruit'
  if (score < 80) return 'Full Degen'
  if (score < 90) return 'Certifiable'
  return 'Margin Call Incoming'
}

// ---------------------------------------------------------------------------
// Per-asset heuristics
// ---------------------------------------------------------------------------

function speculativeIntensity(m: AssetMetrics | undefined, ticker: string): number {
  if (m?.assetType === 'crypto' || cryptoLike(ticker)) return 1.0 // crypto is peak speculative
  if (m?.isLeveragedEtf) return 1.0
  if (m?.isBroadMarketEtf) return 0.0
  if (m?.isMeme) return 0.9

  const signals: number[] = [0.1] // small baseline
  if (m?.marketCap != null) {
    if (m.marketCap < 300e6) signals.push(0.9)
    else if (m.marketCap < 2e9) signals.push(0.65)
    else if (m.marketCap < 10e9) signals.push(0.35)
    else signals.push(0.05)
  }
  if (m?.annualizedVol != null) {
    if (m.annualizedVol > 0.8) signals.push(0.8)
    else if (m.annualizedVol > 0.5) signals.push(0.5)
  }
  if (!m || m.dataSource === 'estimated') signals.push(0.5) // unknown ticker = uncertain
  return Math.max(...signals)
}

export function classify(m: AssetMetrics | undefined, ticker: string): Classification {
  if (m?.isLeveragedEtf) return 'unhinged'
  if (m?.assetType === 'crypto' || cryptoLike(ticker)) {
    return (m?.annualizedVol ?? 0) > 1.0 ? 'unhinged' : 'degen'
  }
  if (m?.isMeme) return 'gambling'
  if (m?.isBroadMarketEtf) return 'safe'
  const vol = m?.annualizedVol ?? null
  const cap = m?.marketCap ?? null
  const beta = m?.beta ?? null
  if ((vol != null && vol > 0.8) || (cap != null && cap < 300e6)) return 'gambling'
  if ((vol != null && vol > 0.45) || (cap != null && cap < 2e9) || (beta != null && beta > 1.5)) return 'growth'
  if ((cap != null && cap > 50e9 && (beta == null || beta < 1.0)) || (vol != null && vol < 0.25)) return 'boomer'
  return 'growth'
}

function cryptoLike(ticker: string): boolean {
  const t = normalize(ticker).replace(/-?USDT?$/i, '').replace(/-USD$/i, '')
  // Mirror of CRYPTO_MAP keys in marketData (kept local to stay dependency-free).
  return CRYPTO_KEYS.has(t)
}

const CRYPTO_KEYS = new Set([
  'BTC', 'XBT', 'ETH', 'SOL', 'DOGE', 'SHIB', 'XRP', 'ADA', 'AVAX', 'MATIC', 'POL', 'LINK',
  'DOT', 'LTC', 'BCH', 'PEPE', 'BONK', 'WIF', 'FLOKI', 'TRX', 'TON', 'NEAR', 'ATOM', 'UNI',
  'AAVE', 'ARB', 'OP', 'SUI', 'APT', 'INJ', 'RNDR', 'FET', 'TAO', 'SEI', 'JUP',
])

function normalize(raw: string): string {
  return raw.trim().toUpperCase().replace(/\$/g, '')
}

// ---------------------------------------------------------------------------
// Detail strings + LLM context
// ---------------------------------------------------------------------------

function concentrationDetail(hhi: number, maxWeight: number, n: number): string {
  if (n === 1) return 'Entire book in a single position'
  return `Top position ${Math.round(maxWeight * 100)}% · HHI ${(Math.round(hhi * 1000) / 1000).toFixed(3)}`
}

function buildRoastContext(r: DegenResult, holdings: HoldingScore[]): string {
  const lines = holdings.map((h) => {
    const bits = [`${h.ticker} ${h.allocation}%`, h.classification]
    if (h.annualizedVol != null) bits.push(`vol ${pct(h.annualizedVol)}`)
    if (h.beta != null) bits.push(`beta ${h.beta.toFixed(2)}`)
    if (h.marketCap != null) bits.push(`mktcap ${humanCap(h.marketCap)}`)
    if (h.change1dPct != null) bits.push(`today ${signed(h.change1dPct)}`)
    if (h.change1mPct != null) bits.push(`1mo ${signed(h.change1mPct)}`)
    if (h.dataSource === 'estimated') bits.push('(no market data found)')
    return '- ' + bits.join(', ')
  })
  const m = r.metrics
  return [
    `Degen score: ${r.degenScore}/100 (${r.verdict}). Data quality: ${r.dataQuality}.`,
    `Weighted volatility: ${m.weightedVol != null ? pct(m.weightedVol) : 'n/a'}; weighted beta: ${m.weightedBeta != null ? m.weightedBeta.toFixed(2) : 'n/a'}.`,
    `Top position ${m.maxWeightPct}%; crypto ${m.cryptoPct}%; speculative ${m.speculativePct}%.`,
    `Factor scores: ${r.factors.map((f) => `${f.label} ${f.score}`).join(', ')}.`,
    `Holdings:`,
    ...lines,
  ].join('\n')
}

const round = (x: number) => Math.round(x)
const pct = (x: number) => `${Math.round(x * 100)}%`
const signed = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`
function humanCap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${v}`
}
