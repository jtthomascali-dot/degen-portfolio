'use client'
import { useEffect, useState } from 'react'
import { getScoreColor, getSpectrumSegment, SPECTRUM_LABELS, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import Link from 'next/link'

type HistoryEntry = {
  shareId: string
  score: number
  verdict: string
  holdings: { ticker: string; allocation: string }[]
  date: string
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([])

  useEffect(() => {
    const raw = localStorage.getItem('degen_history')
    if (raw) setHistory(JSON.parse(raw))
  }, [])

  const clearHistory = () => {
    localStorage.removeItem('degen_history')
    setHistory([])
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <div className="text-4xl mb-3">📈</div>
        <h1 className="text-3xl font-bold mb-2">Your History</h1>
        <p className="text-zinc-500">Track how your degen score evolves over time.</p>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <p className="mb-4">No history yet. Analyze a portfolio to get started.</p>
          <Link href="/" className="text-orange-400 hover:underline">Analyze your portfolio →</Link>
        </div>
      ) : (
        <>
          {/* Score trend */}
          <div className="surface rounded-xl p-6 mb-6">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Degen Score Over Time</p>
            <div className="flex items-end gap-2 h-24">
              {history.slice(-10).map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className={cn('text-xs font-mono', getScoreColor(h.score))}>{h.score}</span>
                  <div className="w-full rounded-t" style={{
                    height: `${(h.score / 100) * 64}px`,
                    background: h.score > 70 ? '#ef4444' : h.score > 50 ? '#f97316' : h.score > 30 ? '#eab308' : '#22c55e'
                  }} />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 mb-6">
            {history.slice().reverse().map((entry, i) => {
              const seg = getSpectrumSegment(entry.score)
              return (
                <Link key={i} href={`/results/${entry.shareId}`}
                  className="flex items-center gap-4 surface rounded-xl p-4 hover:border-orange-500/30 transition-all group">
                  <span className={cn('text-2xl font-mono font-bold w-12', getScoreColor(entry.score))}>
                    {entry.score}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{entry.verdict}</span>
                      <span>{SPECTRUM_LABELS[seg].emoji}</span>
                    </div>
                    <p className="text-xs text-zinc-600 font-mono">
                      {entry.holdings.map(h => h.ticker).join(', ')}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-600">{formatDate(entry.date)}</span>
                  <span className="text-zinc-700 group-hover:text-orange-400 transition-colors">→</span>
                </Link>
              )
            })}
          </div>

          <button onClick={clearHistory}
            className="w-full py-3 border border-red-500/20 text-red-400 rounded-xl text-sm hover:bg-red-500/10 transition-colors">
            Clear history
          </button>
        </>
      )}
    </main>
  )
}
