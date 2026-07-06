'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { containsBlockedTerm } from '@/lib/moderation'

interface Holding {
  ticker: string
  allocation: number
}

// Persists a completed analysis to localStorage so /history has something to
// show. Best-effort only — never blocks navigation to the results page.
function saveToHistory(data: {
  id: string
  score?: number
  degen_score?: number
  verdict?: string
  holdings?: { ticker: string; allocation: number }[]
}) {
  try {
    const raw = localStorage.getItem('degen_history')
    const history = raw ? JSON.parse(raw) : []
    history.push({
      shareId: data.id,
      score: data.score ?? data.degen_score ?? 0,
      verdict: data.verdict || '',
      holdings: (data.holdings || []).map((h) => ({ ticker: h.ticker, allocation: String(h.allocation) })),
      date: new Date().toISOString(),
    })
    localStorage.setItem('degen_history', JSON.stringify(history))
  } catch {
    /* localStorage unavailable or full — history is best-effort */
  }
}

export default function Home() {
  const router = useRouter()
  const [holdings, setHoldings] = useState<Holding[]>([
    { ticker: '', allocation: 0 },
    { ticker: '', allocation: 0 },
  ])
  const [nickname, setNickname] = useState('')
  const [shareToLeaderboard, setShareToLeaderboard] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseNotice, setParseNotice] = useState('')

  const addHolding = () => {
    if (holdings.length < 10) {
      setHoldings([...holdings, { ticker: '', allocation: 0 }])
    }
  }

  const removeHolding = (index: number) => {
    if (holdings.length > 1) {
      setHoldings(holdings.filter((_, i) => i !== index))
    }
  }

  const updateHolding = (index: number, field: keyof Holding, value: string) => {
    const updated = [...holdings]
    if (field === 'ticker') {
      updated[index].ticker = value.toUpperCase()
    } else {
      updated[index].allocation = parseFloat(value) || 0
    }
    setHoldings(updated)
  }

  const totalAllocation = holdings.reduce((sum, h) => sum + h.allocation, 0)
  const allocationOk = Math.abs(totalAllocation - 100) < 1

  const handleScreenshotUpload = async (file: File) => {
    setError('')
    setParseNotice('')
    setParsing(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/parse-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to read screenshot. Try again.')
        return
      }
      setHoldings(data.holdings)
      setParseNotice(`Found ${data.holdings.length} holding${data.holdings.length === 1 ? '' : 's'} — review before running the roast.`)
    } catch {
      setError('Failed to read screenshot. Try again.')
    } finally {
      setParsing(false)
    }
  }

  const handleSubmit = async () => {
    setError('')
    const validHoldings = holdings.filter(h => h.ticker && h.allocation > 0)
    if (validHoldings.length === 0) {
      setError('Add at least one holding with a ticker and allocation.')
      return
    }
    if (Math.abs(totalAllocation - 100) > 1) {
      setError(`Allocations must add up to 100% (currently ${totalAllocation.toFixed(1)}%)`)
      return
    }
    if (nickname && containsBlockedTerm(nickname)) {
      setError("That nickname isn't allowed. Try another one.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holdings: validHoldings,
          nickname: nickname || 'Anonymous Degen',
          shareToLeaderboard,
        }),
      })
      const data = await res.json()
      if (data.id) {
        saveToHistory(data)
        router.push(`/results/${data.id}`)
      } else {
        setError(data.error || 'Something went wrong. Try again.')
      }
    } catch {
      setError('Failed to connect. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-ink text-paper">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-paper/10 px-8 py-6 sm:px-14">
        <div className="flex items-center gap-3">
          <div className="h-[10px] w-[10px] bg-paper" />
          <span className="text-[17px] font-bold tracking-[0.30em]">DEGEN</span>
        </div>
        <a
          href="/leaderboard"
          className="text-[12px] uppercase tracking-[0.18em] text-degen-muted transition-colors hover:text-paper"
        >
          // Leaderboard
        </a>
      </div>

      <div className="flex flex-1 items-center">
        <div className="mx-auto grid w-full max-w-7xl gap-0 px-8 py-14 sm:px-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-0">
          {/* Hero copy */}
          <div className="flex flex-col justify-center border-paper/10 pb-14 lg:border-r lg:pb-0 lg:pr-16">
            <div className="mb-9 text-[13px] uppercase tracking-[0.22em] text-degen-muted">
              // An honest second opinion
            </div>
            <h1 className="font-serif text-[64px] italic leading-[1.0] tracking-tight text-paper sm:text-[80px] lg:text-[88px]">
              What&apos;s in your portfolio?
            </h1>
            <p className="mt-8 max-w-[480px] text-[17px] leading-relaxed text-degen-muted/90">
              Enter your holdings. We weigh your concentration, volatility, and crypto exposure
              against live news, then tell you the truth on a 0&ndash;100 scale. It will not be gentle.
            </p>
            <div className="mt-14 flex gap-12 border-t border-paper/10 pt-9">
              <FeatureChip label="Weighted volatility" />
              <FeatureChip label="Live news scan" />
              <FeatureChip label="0–100 degen score" />
            </div>
          </div>

          {/* Input panel */}
          <div className="flex flex-col justify-center pt-14 lg:pl-16 lg:pt-0">
            <div className="mb-5 text-[12px] uppercase tracking-[0.18em] text-degen-muted">
              // Your name / handle
            </div>
            <input
              type="text"
              placeholder="e.g. WSB_Ape420"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              className="rounded-[3px] border border-paper/15 bg-paper/[0.02] px-5 py-4 text-[16px] text-paper placeholder-degen-dim outline-none transition-colors focus:border-degen-red"
            />

            <label className="mb-9 mt-4 flex items-center gap-3 text-[12px] text-degen-muted">
              <input
                type="checkbox"
                checked={shareToLeaderboard}
                onChange={e => setShareToLeaderboard(e.target.checked)}
                className="h-[16px] w-[16px] accent-degen-red"
              />
              Share my score to the public leaderboard
            </label>

            <label className="mb-6 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-[3px] border border-dashed border-paper/15 py-3.5 text-[12px] uppercase tracking-[0.12em] text-degen-muted transition-colors hover:border-degen-red/40 hover:text-paper">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={parsing}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleScreenshotUpload(file)
                  e.target.value = ''
                }}
              />
              {parsing ? 'Reading screenshot…' : '↑ Upload a portfolio screenshot'}
            </label>

            {parseNotice && (
              <div className="mb-6 rounded-[3px] border border-degen-green/30 bg-degen-green/10 p-3 text-[12px] text-degen-green">
                {parseNotice}
              </div>
            )}

            <div className="mb-4 flex items-center justify-between">
              <span className="text-[12px] uppercase tracking-[0.18em] text-degen-muted">// Holdings</span>
              <span className={`font-mono text-[12px] ${allocationOk ? 'text-degen-green' : 'text-degen-amber'}`}>
                {totalAllocation.toFixed(0)}% / 100%
              </span>
            </div>

            <div className="space-y-3">
              {holdings.map((holding, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="TICKER"
                    value={holding.ticker}
                    onChange={e => updateHolding(index, 'ticker', e.target.value)}
                    maxLength={6}
                    className="w-32 rounded-[3px] border border-paper/15 bg-paper/[0.02] px-4 py-4 text-[15px] font-bold uppercase tracking-[0.03em] text-paper placeholder-degen-dim outline-none transition-colors focus:border-degen-red"
                  />
                  <div className="relative flex-1">
                    <input
                      type="number"
                      placeholder="0"
                      value={holding.allocation || ''}
                      onChange={e => updateHolding(index, 'allocation', e.target.value)}
                      min="0"
                      max="100"
                      className="w-full rounded-[3px] border border-paper/15 bg-paper/[0.02] px-4 py-4 pr-9 text-[15px] text-paper placeholder-degen-dim outline-none transition-colors focus:border-degen-red"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-degen-dim">%</span>
                  </div>
                  <button
                    onClick={() => removeHolding(index)}
                    className="p-2 text-xl leading-none text-degen-dim transition-colors hover:text-degen-red"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {holdings.length < 10 && (
              <button
                onClick={addHolding}
                className="mt-4 w-full rounded-[3px] border border-dashed border-paper/15 py-3.5 text-[13px] text-degen-dim transition-colors hover:border-degen-red/40 hover:text-degen-muted"
              >
                + Add holding
              </button>
            )}

            {error && (
              <div className="mt-5 rounded-[3px] border border-degen-red/30 bg-degen-red/10 p-4 text-[14px] text-degen-red">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="mt-9 flex w-full items-center justify-center gap-2 rounded-[3px] bg-paper py-5 text-[15px] font-bold uppercase tracking-[0.14em] text-ink transition-all hover:bg-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Roasting your portfolio&hellip;
                </>
              ) : (
                <>Run the roast <span>&rarr;</span></>
              )}
            </button>

            <p className="mt-5 text-center text-[11px] uppercase tracking-[0.06em] text-degen-dim">
              Read-only. We never touch your money. Not financial advice.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

function FeatureChip({ label }: { label: string }) {
  return (
    <div className="text-[11px] uppercase leading-[1.4] tracking-[0.14em] text-degen-dim">
      // {label}
    </div>
  )
}
