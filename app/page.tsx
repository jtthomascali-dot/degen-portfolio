'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

type Row = { ticker: string; allocation: string }

const EXAMPLES = [
  { label: 'The Responsible Degen', holdings: [{ ticker: 'SPY', allocation: '50' }, { ticker: 'NVDA', allocation: '30' }, { ticker: 'BTC', allocation: '20' }] },
  { label: 'Full WSB Mode',         holdings: [{ ticker: 'GME', allocation: '40' }, { ticker: 'AMC', allocation: '30' }, { ticker: 'DOGE', allocation: '30' }] },
  { label: 'Crypto Bro',            holdings: [{ ticker: 'BTC', allocation: '40' }, { ticker: 'ETH', allocation: '30' }, { ticker: 'XRP', allocation: '20' }, { ticker: 'PEPE', allocation: '10' }] },
]

export default function Home() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([
    { ticker: '', allocation: '' },
    { ticker: '', allocation: '' },
    { ticker: '', allocation: '' },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [makePublic, setMakePublic] = useState(true)

  const updateRow = (i: number, field: keyof Row, value: string) => {
    const next = [...rows]
    next[i] = { ...next[i], [field]: field === 'ticker' ? value.toUpperCase() : value }
    setRows(next)
  }

  const addRow    = () => setRows([...rows, { ticker: '', allocation: '' }])
  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i))

  const loadExample = (holdings: Row[]) => setRows(holdings)

  const total = rows.reduce((s, r) => s + (parseFloat(r.allocation) || 0), 0)

  const submit = async () => {
    setError('')
    const valid = rows.filter(r => r.ticker.trim())
    if (valid.length < 1) { setError('Add at least one ticker.'); return }
    if (total > 0 && (total < 85 || total > 115)) {
      setError(`Allocations add up to ${Math.round(total)}% — keep it close to 100%.`)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdings: valid, isPublic: makePublic }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      router.push(`/results/${data.shareId}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to analyze portfolio')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">🦍</div>
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          Degen Portfolio Analyzer
        </h1>
        <p className="text-zinc-400 text-lg">
          Find out if you&apos;re a Warren Buffett or a WSB Ape.
          <br />Get brutally roasted by AI.
        </p>
      </div>

      {/* Example portfolios */}
      <div className="mb-6">
        <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Try an example</p>
        <div className="flex gap-2 flex-wrap">
          {EXAMPLES.map(ex => (
            <button key={ex.label} onClick={() => loadExample(ex.holdings)}
              className="text-xs px-3 py-1.5 rounded-full border border-[#333] text-zinc-400 hover:text-white hover:border-[#555] transition-colors">
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input form */}
      <div className="surface rounded-xl p-6 mb-4">
        <div className="flex gap-3 mb-3 text-xs text-zinc-500 uppercase tracking-wider px-1">
          <span className="flex-1">Ticker</span>
          <span className="w-24 text-right">Allocation %</span>
          <span className="w-8" />
        </div>

        {rows.map((row, i) => (
          <div key={i} className="flex gap-3 mb-3 items-center">
            <input
              className="ticker-input flex-1 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange-500/50 text-white placeholder:text-zinc-600"
              placeholder="AAPL"
              maxLength={10}
              value={row.ticker}
              onChange={e => updateRow(i, 'ticker', e.target.value)}
            />
            <input
              className="w-24 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-sm text-right focus:outline-none focus:border-orange-500/50 text-white placeholder:text-zinc-600"
              placeholder="25"
              type="number"
              min={0}
              max={100}
              value={row.allocation}
              onChange={e => updateRow(i, 'allocation', e.target.value)}
            />
            <button onClick={() => removeRow(i)}
              className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10">
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        <button onClick={addRow}
          className="w-full py-2 border border-dashed border-[#333] rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:border-[#555] transition-colors flex items-center justify-center gap-2 mt-1">
          <Plus size={14} /> Add holding
        </button>

        {/* Allocation total indicator */}
        {total > 0 && (
          <div className={cn('mt-4 text-xs text-right', total > 115 || total < 85 ? 'text-red-400' : 'text-green-400')}>
            Total: {Math.round(total)}%
          </div>
        )}

        {/* Public toggle */}
        <div className="mt-4 pt-4 border-t border-[#222] flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-300">Add to leaderboard</p>
            <p className="text-xs text-zinc-600">Let others see your portfolio on the hall of shame</p>
          </div>
          <button onClick={() => setMakePublic(!makePublic)}
            className={cn('w-10 h-6 rounded-full transition-colors relative', makePublic ? 'bg-orange-500' : 'bg-[#333]')}>
            <span className={cn('absolute top-1 w-4 h-4 bg-white rounded-full transition-all', makePublic ? 'left-5' : 'left-1')} />
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}

      <button onClick={submit} disabled={loading}
        className="w-full py-4 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-lg">
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Consulting the WSB oracle...
          </>
        ) : (
          <><TrendingUp size={20} /> Roast my portfolio</>
        )}
      </button>

      <p className="text-center text-xs text-zinc-600 mt-4">
        Not financial advice. Obviously.
      </p>
    </main>
  )
}
