'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { type Analysis, type Classification, type Factor, type Holding, CLASS_COLOR, scoreColor } from '@/lib/analysisTypes'

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

function humanCap(v?: number | null) {
  if (v == null) return null
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${v}`
}
function signed(x: number) {
  return `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`
}

function buildDonutGradient(holdings: Holding[]): string {
  const total = holdings.reduce((s, h) => s + (h.allocation || 0), 0) || 1
  let cum = 0
  const stops = holdings.map((h) => {
    const frac = (h.allocation || 0) / total
    const color = CLASS_COLOR[(h.classification as Classification) || 'growth'] || '#C7CBC4'
    const start = cum * 100
    cum += frac
    const end = cum * 100
    return `${color} ${start}% ${end}%`
  })
  if (stops.length === 0) return 'rgba(236,234,228,0.08)'
  return `conic-gradient(${stops.join(', ')})`
}

// Splits the roast into lead-in sentences plus a closing "punchline" — a
// trailing run of short sentences (under ~8 words each), matching the
// design's short, staccato closer treatment (e.g. "Touch grass. Then,
// maybe, an index fund."). Falls back to just the last sentence if none
// of the trailing sentences are short.
function splitRoast(text: string): { body: string[]; punchline: string } {
  // Protect decimal points (e.g. "0.5%") so they aren't mistaken for sentence
  // endings, then split on terminal punctuation — pulling along any trailing
  // closing quote/paren so it doesn't leak onto the next sentence.
  const protected_ = text
    .replace(/(\d)\.(?=\d)/g, '$1\x00')
    .replace(/(?<!\d)\.(?=\d)/g, '\x00')
  const rawSentences = protected_.match(/[^.!?]+[.!?]+[)'"’”]*(?:\s+|$)/g) || [protected_]
  const sentences = rawSentences.map((s) => s.replace(/\x00/g, '.').trim()).filter(Boolean)
  if (sentences.length <= 1) return { body: [], punchline: text.trim() }

  const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length
  let i = sentences.length - 1
  const punchlineSentences = [sentences[i]]
  i--
  while (i >= 0 && wordCount(sentences[i]) <= 8 && punchlineSentences.length < 3) {
    punchlineSentences.unshift(sentences[i])
    i--
  }
  return { body: sentences.slice(0, i + 1), punchline: punchlineSentences.join(' ') }
}

// Highlights dollar/percent figures (in the score's accent color) and known
// portfolio tickers (amber) inside roast text, mirroring the design's
// colored-callout treatment. The figure color shifts with the degen score
// itself — green for safe portfolios, amber/red as it gets riskier.
function highlightRoast(text: string, tickers: string[], accent: string): ReactNode[] {
  const escaped = tickers.filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const tickerGroup = escaped.length ? `|\\b(?:${escaped.join('|')})\\b` : ''
  const pattern = new RegExp(`(\\$[0-9][0-9,.]*[a-zA-Z]*|[+-]?[0-9]+(?:\\.[0-9]+)?\\s?(?:%|percent)${tickerGroup})`, 'gi')
  const parts = text.split(pattern)
  return parts.map((part, i) => {
    if (!part) return null
    if (/^\$[0-9]/.test(part) || /(%|percent)$/i.test(part)) {
      return <span key={i} style={{ color: accent }}>{part}</span>
    }
    if (tickers.includes(part)) {
      return <span key={i} style={{ color: '#F5A623' }}>{part}</span>
    }
    return <span key={i}>{part}</span>
  })
}

// Animates a number from its previous value up to `target` with ease-out,
// used to make the score and meter feel live instead of snapping into place.
function useCountUp(target: number, duration = 1100): number {
  const [value, setValue] = useState(target)
  useEffect(() => {
    const start = performance.now()
    const from = 0
    let raf: number
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(from + eased * (target - from)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

function FactorBars({ factors }: { factors: Factor[] }) {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    setRevealed(false)
    const t = setTimeout(() => setRevealed(true), 50)
    return () => clearTimeout(t)
  }, [factors])

  return (
    <div className="space-y-5">
      {factors.map((f, i) => (
        <div key={f.key} className={f.available ? '' : 'opacity-40'}>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[12px] uppercase tracking-[0.04em] text-[#BFC3BC]">{f.label}</span>
            <span className="font-mono text-[12px] font-semibold" style={{ color: f.available ? scoreColor(f.score) : '#71717a' }}>
              {f.available ? f.score : 'n/a'}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-[3px] bg-paper/[0.09]">
            <div
              className="h-full rounded-[3px] transition-[width] duration-700 ease-out"
              style={{
                width: revealed && f.available ? `${f.score}%` : '0%',
                backgroundColor: scoreColor(f.score),
                transitionDelay: `${i * 70}ms`,
              }}
            />
          </div>
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
  const animatedScore = useCountUp(analysis?.degen_score ?? 0)

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
      <main className="flex min-h-screen items-center justify-center bg-ink">
        <div className="text-center">
          <div className="mb-4 animate-bounce text-5xl">🔥</div>
          <p className="text-degen-muted">Loading your roast...</p>
        </div>
      </main>
    )

  if (error || !analysis)
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink px-4">
        <div className="text-center">
          <div className="mb-4 text-5xl">💀</div>
          <p className="mb-2 font-bold text-degen-red">Analysis not found</p>
          <p className="mb-6 text-sm text-degen-dim">{error}</p>
          <Link href="/" className="rounded-[3px] bg-paper px-6 py-3 font-bold text-ink">Try Again</Link>
        </div>
      </main>
    )

  const accent = scoreColor(analysis.degen_score)
  const score = analysis.degen_score
  const tickers = analysis.holdings.map((h) => h.ticker)
  const { body: roastBody, punchline } = splitRoast(analysis.roast)

  return (
    <main className="min-h-screen bg-ink text-paper">
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: `radial-gradient(120% 70% at 78% -8%, ${accent}38, transparent 55%), radial-gradient(90% 60% at 12% 4%, ${accent}1a, transparent 50%)` }}
      />

      {/* chrome */}
      <div className="relative flex items-center justify-between border-b border-paper/10 px-7 py-[26px] sm:px-14">
        <div className="flex items-center">
          <span className="text-[15px] font-bold tracking-[0.30em]">DEGEN</span>
          <span className="ml-[3px] h-[16px] w-[6px] animate-deg-blink bg-degen-red" />
        </div>
        <div className="flex gap-8 text-[11px] uppercase tracking-[0.18em] text-degen-muted">
          <Link href="/" className="transition-colors hover:text-paper">&larr; New analysis</Link>
          <span>// Portfolio Roast</span>
          <Link href="/leaderboard" className="transition-colors hover:text-paper">Leaderboard</Link>
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl">
        {/* hero */}
        <div className="animate-slide-up px-7 pb-12 pt-[60px] [animation-fill-mode:both] sm:px-14">
          <div className="mb-[18px] text-[11px] uppercase tracking-[0.22em] text-degen-muted">
            // {analysis.nickname} &mdash; {analysis.holdings.length} positions analyzed
          </div>
          <div className="flex flex-wrap items-end gap-10">
            <div
              className="font-serif text-[120px] leading-[0.82] tracking-tight sm:text-[200px]"
              style={{ color: accent, textShadow: `0 0 60px ${accent}59` }}
            >
              {animatedScore}
            </div>
            <div className="pb-6">
              <div className="mb-[14px] text-[12px] uppercase tracking-[0.18em]" style={{ color: accent }}>Verdict</div>
              <div className="font-serif text-[34px] italic leading-tight text-paper sm:text-[48px]">{analysis.verdict}</div>
            </div>
          </div>

          {/* meter */}
          <div className="mt-[54px]">
            <div className="relative h-[7px] rounded-full" style={{ background: 'linear-gradient(90deg,#3FCF8E 0%,#7FBF5E 32%,#F5A623 58%,#FF4438 100%)' }}>
              <div className="absolute -top-[7px] -bottom-[7px] w-[2px] bg-paper" style={{ left: `${animatedScore}%` }} />
              <div
                className="absolute -top-[30px] -translate-x-1/2 whitespace-nowrap font-mono text-[11px] font-semibold tracking-[0.10em] text-paper"
                style={{ left: `${animatedScore}%` }}
              >
                {animatedScore} / 100
              </div>
            </div>
            <div className="mt-[14px] flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-degen-dim">
              <span style={{ color: score < 20 ? accent : undefined }}>Safe</span>
              <span>Steady</span>
              <span>Spicy</span>
              <span>Reckless</span>
              <span style={{ color: score >= 80 ? accent : undefined }}>Unhinged</span>
            </div>
          </div>
        </div>

        {/* roast + breakdown/news */}
        <div className="animate-slide-up grid grid-cols-1 border-t border-paper/10 [animation-delay:80ms] [animation-fill-mode:both] lg:grid-cols-[1.42fr_1fr]">
          <div className="px-7 py-10 sm:px-14 lg:border-r lg:border-paper/10">
            <div className="mb-[22px] flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.18em] text-degen-muted">// The Roast</span>
              {analysis.refreshed_at && (
                <span className="text-[10px] text-degen-dim">updated {timeAgo(analysis.refreshed_at)}</span>
              )}
            </div>
            <div className="mb-5 font-mono text-[12px] text-degen-green">$ degen --analyze --news=today</div>
            <div className="text-[14.5px] leading-[1.72] text-[#BFC3BC]">
              {roastBody.map((sentence, i) => (
                <p key={i} className="mb-[18px] last:mb-0">{highlightRoast(sentence, tickers, accent)}</p>
              ))}
            </div>
            {punchline && (
              <p className="mt-[26px] font-serif text-[21px] italic leading-[1.45] text-paper">
                {punchline}
              </p>
            )}
            <div className="mt-8 flex gap-3.5">
              <button
                onClick={handleReroast}
                disabled={reroasting}
                className="rounded-[2px] px-[22px] py-[13px] text-[11px] font-semibold uppercase tracking-[0.14em] text-ink transition-opacity disabled:opacity-50"
                style={{ background: accent }}
              >
                {reroasting ? "Pulling latest news…" : "Re-roast with today's news"}
              </button>
              <button
                onClick={handleShare}
                className="rounded-[2px] border border-paper/15 px-[22px] py-[13px] text-[11px] font-semibold uppercase tracking-[0.14em] text-[#BFC3BC] transition-colors hover:border-paper/30"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="px-7 py-10 sm:px-14 lg:px-[44px]">
            {analysis.factors && analysis.factors.length > 0 && (
              <>
                <div className="mb-6 text-[11px] uppercase tracking-[0.18em] text-degen-muted">// Score Breakdown</div>
                <FactorBars factors={analysis.factors} />
              </>
            )}

            {analysis.news && analysis.news.length > 0 && (
              <>
                <div className="mb-5 mt-[34px] text-[11px] uppercase tracking-[0.18em] text-degen-muted">// In The News</div>
                <div>
                  {analysis.news.slice(0, 5).map((n, i) => (
                    <a
                      key={i}
                      href={n.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block animate-slide-up group [animation-fill-mode:both]"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <div className="flex gap-3.5 border-t border-paper/[0.08] py-3">
                        <span className="flex-none font-mono text-[10px] font-semibold tracking-[0.08em] text-degen-amber/90">{n.ticker}</span>
                        <span className="text-[12.5px] leading-snug text-[#A7ABA4] group-hover:text-paper">{n.title}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* allocation + holdings */}
        <div className="animate-slide-up grid grid-cols-1 border-t border-paper/10 [animation-delay:140ms] [animation-fill-mode:both] lg:grid-cols-[0.85fr_1.6fr]">
          <div className="flex flex-col items-center px-7 py-10 sm:px-14 lg:border-r lg:border-paper/10">
            <div className="mb-7 w-full text-[11px] uppercase tracking-[0.18em] text-degen-muted">// Allocation</div>
            <div className="relative h-[204px] w-[204px] rounded-full" style={{ background: buildDonutGradient(analysis.holdings) }}>
              <div className="absolute inset-[38px] flex flex-col items-center justify-center rounded-full bg-ink">
                <div className="font-serif text-[34px] leading-none text-paper">{analysis.holdings.length}</div>
                <div className="mt-[6px] text-[9px] uppercase tracking-[0.16em] text-degen-muted">Positions</div>
              </div>
            </div>
            <div className="mt-[26px] flex flex-wrap justify-center gap-4 text-[10px] uppercase tracking-[0.06em] text-degen-muted">
              {Array.from(new Set(analysis.holdings.map(h => h.classification).filter(Boolean))).map((c) => (
                <span key={c} className="flex items-center gap-[7px]">
                  <span className="h-2 w-2" style={{ background: CLASS_COLOR[c as Classification] }} />
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="px-7 py-10 sm:px-14 lg:px-[44px]">
            <div className="mb-6 text-[11px] uppercase tracking-[0.18em] text-degen-muted">// Holdings &mdash; 1D / 1M</div>
            <div className="grid grid-cols-1 gap-[1px] border border-paper/[0.08] bg-paper/[0.08] sm:grid-cols-2">
              {analysis.holdings.map((h, i) => {
                const cap = humanCap(h.marketCap)
                return (
                  <div
                    key={h.ticker}
                    className="animate-slide-up bg-ink px-[18px] py-4 [animation-fill-mode:both]"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-mono text-[16px] font-bold tracking-[0.04em] text-paper">{h.ticker}</span>
                      {h.classification && (
                        <span
                          className="rounded-[2px] px-[7px] py-[4px] text-[9px] uppercase tracking-[0.12em]"
                          style={{ color: CLASS_COLOR[h.classification], backgroundColor: `${CLASS_COLOR[h.classification]}1a` }}
                        >
                          {h.classification}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-degen-muted">{h.allocation}% · vol {h.annualizedVol != null ? `${Math.round(h.annualizedVol * 100)}%` : '—'}{cap ? ` · ${cap}` : ''}</span>
                      <span>
                        {h.change1dPct != null && <span style={{ color: h.change1dPct >= 0 ? '#3FCF8E' : '#FF4438' }}>{signed(h.change1dPct)}</span>}
                        {h.change1dPct != null && h.change1mPct != null && <span className="text-degen-dim"> / </span>}
                        {h.change1mPct != null && <span style={{ color: h.change1mPct >= 0 ? '#3FCF8E' : '#FF4438' }}>{signed(h.change1mPct)}</span>}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* share card CTA */}
        <div className="flex flex-col gap-5 border-t border-paper/10 px-7 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-14">
          <div>
            <div className="mb-[9px] text-[11px] uppercase tracking-[0.18em] text-degen-muted">// Share Card</div>
            <div className="text-[12.5px] leading-relaxed text-degen-muted">Get a square, postable version of your score &mdash; save it or share it straight from your phone.</div>
          </div>
          <Link
            href={`/results/${id}/share`}
            className="flex-none rounded-[2px] px-[22px] py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-ink transition-opacity hover:opacity-90"
            style={{ background: accent }}
          >
            Open share card &rarr;
          </Link>
        </div>

        {/* post-roast capture */}
        <div className="flex flex-col gap-6 border-t border-paper/10 bg-paper/[0.015] px-7 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-14">
          <div>
            <div className="mb-[9px] text-[11px] uppercase tracking-[0.18em] text-degen-muted">// Want the deeper second opinion?</div>
            <div className="text-[12.5px] leading-relaxed text-degen-muted">Tax drag, correlation, and position-by-position fixes — in your inbox when it ships.</div>
          </div>
          <div className="flex flex-none overflow-hidden rounded-[2px] border border-paper/15">
            <input type="email" placeholder="you@email.com" className="w-[220px] bg-transparent px-4 py-[13px] text-[12px] tracking-[0.04em] text-paper placeholder-degen-dim outline-none" />
            <button className="border-l border-paper/15 px-5 py-[13px] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#BFC3BC] transition-colors hover:text-paper">Notify me</button>
          </div>
        </div>

        {/* footer actions */}
        <div className="flex flex-col gap-4 border-t border-paper/10 px-7 py-[22px] sm:flex-row sm:items-center sm:justify-between sm:px-14">
          <span className="text-[10px] uppercase tracking-[0.16em] text-degen-dim">Not financial advice. Obviously.</span>
          <div className="flex gap-3">
            <button onClick={handleShare} className="rounded-[2px] bg-paper px-[22px] py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-white">
              {copied ? '✓ Copied!' : 'Share score'}
            </button>
            <Link href="/" className="rounded-[2px] border border-paper/[0.18] px-[22px] py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#BFC3BC] transition-colors hover:border-paper/30">
              Reanalyze
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
