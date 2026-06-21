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
    <main className="min-h-screen bg-ink text-paper">
      <div className="mx-auto max-w-2xl px-6 py-12 sm:px-10">
        <div className="mb-10 text-center">
          <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-degen-muted">// Your History</div>
          <h1 className="font-serif text-[40px] italic text-paper">Score over time</h1>
          <p className="mt-2 text-[13px] text-degen-dim">Track how your degen score evolves.</p>
        </div>

        {history.length === 0 ? (
          <div className="py-20 text-center text-degen-dim">
            <p className="mb-4">No history yet. Analyze a portfolio to get started.</p>
            <Link href="/" className="text-degen-amber hover:underline">Analyze your portfolio &rarr;</Link>
          </div>
        ) : (
          <>
            {/* Score trend */}
            <div className="mb-6 rounded-[3px] border border-paper/10 bg-paper/[0.02] p-6">
              <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-degen-muted">// Degen Score Over Time</p>
              <div className="flex h-24 items-end gap-2">
                {history.slice(-10).map((h, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <span className={cn('font-mono text-[11px]', getScoreColor(h.score))}>{h.score}</span>
                    <div
                      className="w-full rounded-t-[2px]"
                      style={{
                        height: `${(h.score / 100) * 64}px`,
                        background: h.score > 70 ? '#FF4438' : h.score > 50 ? '#F5A623' : h.score > 30 ? '#F5A623' : '#3FCF8E',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6 space-y-3">
              {history.slice().reverse().map((entry, i) => {
                const seg = getSpectrumSegment(entry.score)
                return (
                  <Link
                    key={i}
                    href={`/results/${entry.shareId}`}
                    className="group flex items-center gap-4 rounded-[3px] border border-paper/10 bg-paper/[0.02] p-4 transition-colors hover:border-paper/20"
                  >
                    <span className={cn('w-12 font-mono text-[22px] font-bold', getScoreColor(entry.score))}>
                      {entry.score}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-paper">{entry.verdict}</span>
                        <span>{SPECTRUM_LABELS[seg].emoji}</span>
                      </div>
                      <p className="font-mono text-[11px] text-degen-dim">
                        {entry.holdings.map(h => h.ticker).join(', ')}
                      </p>
                    </div>
                    <span className="text-[11px] text-degen-dim">{formatDate(entry.date)}</span>
                    <span className="text-degen-dim transition-colors group-hover:text-degen-amber">&rarr;</span>
                  </Link>
                )
              })}
            </div>

            <button
              onClick={clearHistory}
              className="w-full rounded-[3px] border border-degen-red/20 py-3 text-[12px] uppercase tracking-[0.1em] text-degen-red transition-colors hover:bg-degen-red/10"
            >
              Clear history
            </button>
          </>
        )}
      </div>
    </main>
  )
}
