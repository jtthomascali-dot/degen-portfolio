'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Holding {
  ticker: string
  allocation: number
}

export default function Home() {
  const router = useRouter()
  const [holdings, setHoldings] = useState<Holding[]>([
    { ticker: '', allocation: 0 },
    { ticker: '', allocation: 0 },
  ])
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

    setLoading(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdings: validHoldings, nickname: nickname || 'Anonymous Degen' }),
      })
      const data = await res.json()
      if (data.id) {
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
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-yellow-400">DEGEN</h1>
          <p className="text-xs text-zinc-500 tracking-widest uppercase">Portfolio Analyzer</p>
        </div>
        <a
          href="/leaderboard"
          className="text-xs text-yellow-400 border border-yellow-400/40 px-3 py-1.5 rounded hover:bg-yellow-400/10 transition-colors"
        >
          🏆 Leaderboard
        </a>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Hero */}
        <div className="mb-8 text-center">
          <div className="text-5xl mb-3">🦍</div>
          <h2 className="text-3xl font-black tracking-tight mb-2">
            How degen is your<br />
            <span className="text-yellow-400">portfolio?</span>
          </h2>
          <p className="text-zinc-400 text-sm">
            Enter your holdings. Get roasted by AI. Find out if you&apos;re a genius or a degenerate gambler.
          </p>
        </div>

        {/* Nickname */}
        <div className="mb-6">
          <label className="block text-xs text-zinc-500 uppercase tracking-widest mb-2">
            Your Name / Handle
          </label>
          <input
            type="text"
            placeholder="e.g. WSB_Ape420"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400 transition-colors text-base"
          />
        </div>

        {/* Holdings */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-zinc-500 uppercase tracking-widest">Holdings</label>
            <span className={`text-xs font-mono ${Math.abs(totalAllocation - 100) < 1 ? 'text-green-400' : 'text-yellow-400'}`}>
              {totalAllocation.toFixed(0)}% / 100%
            </span>
          </div>

          <div className="space-y-2">
            {holdings.map((holding, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="TICKER"
                  value={holding.ticker}
                  onChange={e => updateHolding(index, 'ticker', e.target.value)}
                  className="w-28 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400 transition-colors font-mono text-sm uppercase"
                  maxLength={6}
                />
                <div className="relative flex-1">
                  <input
                    type="number"
                    placeholder="0"
                    value={holding.allocation || ''}
                    onChange={e => updateHolding(index, 'allocation', e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-3 pr-8 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400 transition-colors text-sm"
                    min="0"
                    max="100"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
                </div>
                <button
                  onClick={() => removeHolding(index)}
                  className="text-zinc-600 hover:text-red-400 transition-colors p-2 text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Add holding */}
        {holdings.length < 10 && (
          <button
            onClick={addHolding}
            className="w-full border border-dashed border-zinc-700 rounded-lg py-2.5 text-zinc-500 hover:border-yellow-400/50 hover:text-yellow-400/70 transition-colors text-sm mb-6"
          >
            + Add holding
          </button>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-yellow-400 text-black font-black text-lg py-4 rounded-xl hover:bg-yellow-300 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed tracking-tight"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Roasting your portfolio...
            </span>
          ) : (
            'ANALYZE MY PORTFOLIO 🔥'
          )}
        </button>

        <p className="text-center text-zinc-600 text-xs mt-4">
          Not financial advice. Obviously.
        </p>
      </div>
    </main>
  )
}
