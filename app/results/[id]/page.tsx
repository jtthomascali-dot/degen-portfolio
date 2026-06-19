'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Classification = 'safe' | 'boomer' | 'growth' | 'gambling' | 'degen' | 'unhinged'

interface Holding {
  ticker: string
  allocation: number
  classification?: Classification
  annualizedVol?: number | null
  beta?: number | null
  marketCap?: number | null
  change1dPct?: number | null
  change1mPct?: number | null
  assetType?: string
  dataSource?: string
}
interface Headline {
  ticker: string
  title: string
  publisher: string
  url: string
  publishedAt: number | null
}
interface Factor {
  key: string
  label: string
  score: number
  weight: number
  available: boolean
  detail: string
}
interface Metrics {
  weightedVol: number | null
  weightedBeta: number | null
  maxWeightPct: number
  cryptoPct: number
  speculativePct: number
  concentrationHHI: number
  holdingsCount: number
  dataQuality: 'live' | 'partial' | 'estimated'
}
interface Analysis {
  id: string
  nickname: string
  degen_score: number
  verdict: string
  roast: string
  holdings: Holding[]
  factors?: Factor[]
  metrics?: Metrics
  data_quality?: 'live' | 'partial' | 'estimated'
  news?: Headline[]
  refreshed_at?: string
  created_at: string
}

function timeAgo(iso?: string): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (!isFinite(ms) || ms < 0) return ''
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function MoveChip({ label, pct }: { label: string; pct?: number | null }) {
  if (pct == null) return null
  const up = pct >= 0
  return (
    <span className="font-mono">
      {label} <span style={{ color: up ? '#4ade80' : '#f87171' }}>{up ? '+' : ''}{pct.toFixed(1)}%</span>
    </span>
  )
}

const CLASS_COLOR: Record<Classification, string> = {
  safe: '#4ade80',
  boomer: '#60a5fa',
  growth: '#facc15',
  gambling: '#fb923c',
  degen: '#f87171',
  unhinged: '#e879f9',
}

function scoreColor(score: number) {
  return score >= 80 ? '#f87171' : score >= 60 ? '#fb923c' : score >= 40 ? '#facc15' : '#4ade80'
}
function humanCap(v?: number | null) {
  if (v == null) return null
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${v}`
}

function ScoreMeter({ score }: { score: number }) {
  const color = scoreColor(score)
  return (
    <div className="my-6">
      <div className="flex justify-between text-xs text-zinc-500 mb-1">
        <span>Safe</span>
        <span>Unhinged</span>
      </div>
      <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <div className="text-center mt-3">
        <span className="text-5xl font-black font-mono" style={{ color }}>{score}</span>
        <span className="text-zinc-500 text-lg">/100</span>
      </div>
    </div>
  )
}

function DataQualityPill({ q }: { q?: string }) {
  if (!q) return null
  const map: Record<string, { label: string; cls: string }> = {
    live: { label: '● Live market data', cls: 'text-green-400 border-green-400/30 bg-green-400/10' },
    partial: { label: '◐ Partial data', cls: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' },
    estimated: { label: '○ Estimated (no live data)', cls: 'text-zinc-400 border-zinc-600 bg-zinc-800/50' },
  }
  const m = map[q] || map.estimated
  return <span className={`text-[10px] uppercase tracking-widest border px-2 py-1 rounded-full ${m.cls}`}>{m.label}</span>
}

function AllocationDonut({ holdings }: { holdings: Holding[] }) {
  const total = holdings.reduce((s, h) => s + (h.allocation || 0), 0) || 1
  const r = 60
  const C = 2 * Math.PI * r
  let cumulative = 0
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 160 160" className="w-36 h-36 flex-shrink-0 -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#27272a" strokeWidth="26" />
        {holdings.map((h, i) => {
          const frac = (h.allocation || 0) / total
          const seg = frac * C
          const offset = -cumulative * C
          cumulative += frac
          const color = CLASS_COLOR[(h.classification as Classification) || 'growth'] || '#facc15'
          return (
            <circle
              key={i}
              cx="80" cy="80" r={r} fill="none"
              stroke={color} strokeWidth="26"
              strokeDasharray={`${seg} ${C - seg}`}
              strokeDashoffset={offset}
            />
          )
        })}
      </svg>
      <div className="flex-1 min-w-0 space-y-1.5">
        {holdings.map((h, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: CLASS_COLOR[(h.classification as Classification) || 'growth'] }} />
            <span className="font-mono font-bold text-white">{h.ticker}</span>
            <span className="text-zinc-500">{h.allocation}%</span>
            {h.classification && <span className="text-zinc-600 ml-auto">{h.classification}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function FactorBars({ factors }: { factors: Factor[] }) {
  return (
    <div className="space-y-3">
      {factors.map((f) => (
        <div key={f.key} className={f.available ? '' : 'opacity-40'}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-zinc-300 font-medium">{f.label}</span>
            <span className="font-mono" style={{ color: f.available ? scoreColor(f.score) : '#71717a' }}>
              {f.available ? f.score : 'n/a'}
            </span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${f.available ? f.score : 0}%`, backgroundColor: scoreColor(f.score) }} />
          </div>
          <p className="text-[11px] text-zinc-600 mt-1">{f.detail}</p>
        </div>
      ))}
    </div>
  )
}

export default function ResultsPage() {
  const params = useParams()
  const id = params.id as string
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [reroasting, setReroasting] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/analyze?id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setAnalysis(data)
      })
      .catch(() => setError('Failed to load analysis.'))
      .finally(() => setLoading(false))
  }, [id])

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({
        title: `My DEGEN Score: ${analysis?.degen_score}/100`,
        text: `${analysis?.nickname} got a ${analysis?.degen_score} degen score. ${analysis?.verdict}. Check yours:`,
        url,
      })
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleReroast = async () => {
    if (!analysis || reroasting) return
    setReroasting(true)
    try {
      const res = await fetch('/api/reroast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: analysis.id }),
      })
      const data = await res.json()
      if (!data.error) setAnalysis({ ...analysis, ...data })
    } catch {
      /* keep the existing roast on failure */
    } finally {
      setReroasting(false)
    }
  }

  if (loading)
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🔥</div>
          <p className="text-zinc-400">Loading your roast...</p>
        </div>
      </main>
    )

  if (error || !analysis)
    return (
      <main className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">💀</div>
          <p className="text-red-400 font-bold mb-2">Analysis not found</p>
          <p className="text-zinc-500 text-sm mb-6">{error}</p>
          <Link href="/" className="bg-yellow-400 text-black font-black px-6 py-3 rounded-xl">Try Again</Link>
        </div>
      </main>
    )

  const m = analysis.metrics
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="border-b border-zinc-800 px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-yellow-400 text-sm hover:underline">← New Analysis</Link>
        <Link href="/leaderboard" className="text-xs text-zinc-500 hover:text-yellow-400 transition-colors">🏆 Leaderboard</Link>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="text-center mb-2">
          <p className="text-zinc-500 text-sm">{analysis.nickname}</p>
          <h2 className="text-2xl font-black text-yellow-400 mt-1">{analysis.verdict}</h2>
          <div className="mt-2 flex justify-center"><DataQualityPill q={analysis.data_quality || m?.dataQuality} /></div>
        </div>

        <ScoreMeter score={analysis.degen_score} />

        {/* Roast */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-zinc-500 uppercase tracking-widest">🤖 AI Roast</p>
            {analysis.refreshed_at && (
              <span className="text-[10px] text-zinc-600">updated {timeAgo(analysis.refreshed_at)}</span>
            )}
          </div>
          <p className="text-zinc-200 text-sm leading-relaxed">{analysis.roast}</p>
          <button
            onClick={handleReroast}
            disabled={reroasting}
            className="mt-3 w-full border border-yellow-400/40 text-yellow-400 text-xs font-bold py-2 rounded-lg hover:bg-yellow-400/10 transition-colors disabled:opacity-50"
          >
            {reroasting ? 'Pulling latest news…' : "🔁 Re-roast with today's news"}
          </button>
        </div>

        {/* Key metrics */}
        {m && (
          <div className="grid grid-cols-2 gap-2 mb-5">
            <Metric label="Weighted volatility" value={m.weightedVol != null ? `${Math.round(m.weightedVol * 100)}%` : '—'} />
            <Metric label="Weighted beta" value={m.weightedBeta != null ? `${m.weightedBeta.toFixed(2)}x` : '—'} />
            <Metric label="Top position" value={`${m.maxWeightPct}%`} />
            <Metric label="Crypto exposure" value={`${m.cryptoPct}%`} />
          </div>
        )}

        {/* Allocation donut */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Allocation</p>
          <AllocationDonut holdings={analysis.holdings} />
        </div>

        {/* Factor breakdown */}
        {analysis.factors && analysis.factors.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-5">
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Score breakdown</p>
            <FactorBars factors={analysis.factors} />
          </div>
        )}

        {/* In the news (drives the roast) */}
        {analysis.news && analysis.news.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-5">
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">📰 In the news</p>
            <div className="space-y-2.5">
              {analysis.news.slice(0, 6).map((n, i) => (
                <a
                  key={i}
                  href={n.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-mono font-bold text-yellow-400/80 mt-0.5 flex-shrink-0">{n.ticker}</span>
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-300 group-hover:text-white leading-snug">{n.title}</p>
                      <p className="text-[10px] text-zinc-600">
                        {n.publisher}
                        {n.publishedAt ? ` · ${timeAgo(new Date(n.publishedAt).toISOString())}` : ''}
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Holdings with real data */}
        <div className="mb-6">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Holdings</p>
          <div className="space-y-2">
            {analysis.holdings.map((h) => {
              const cap = humanCap(h.marketCap)
              return (
                <div key={h.ticker} className="flex items-center justify-between bg-zinc-900 rounded-lg px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">{h.ticker}</span>
                      {h.classification && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: CLASS_COLOR[h.classification], backgroundColor: `${CLASS_COLOR[h.classification]}1a` }}>
                          {h.classification}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-zinc-500 font-mono">
                      {h.annualizedVol != null && <span>vol {Math.round(h.annualizedVol * 100)}%</span>}
                      {h.beta != null && <span>β {h.beta.toFixed(2)}</span>}
                      {cap && <span>{cap}</span>}
                      <MoveChip label="1d" pct={h.change1dPct} />
                      <MoveChip label="1mo" pct={h.change1mPct} />
                    </div>
                  </div>
                  <span className="font-mono text-yellow-400 text-sm flex-shrink-0">{h.allocation}%</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handleShare} className="flex-1 bg-yellow-400 text-black font-black py-3.5 rounded-xl hover:bg-yellow-300 active:scale-95 transition-all text-sm">
            {copied ? '✓ Copied!' : '📤 Share My Score'}
          </button>
          <Link href="/" className="flex-1 border border-zinc-700 text-white font-bold py-3.5 rounded-xl hover:border-zinc-500 transition-colors text-sm text-center">🔄 Reanalyze</Link>
        </div>

        <div className="mt-4 text-center">
          <Link href="/leaderboard" className="text-zinc-600 text-xs hover:text-yellow-400 transition-colors">See how you rank on the leaderboard →</Link>
        </div>
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-black font-mono text-white mt-0.5">{value}</p>
    </div>
  )
}
