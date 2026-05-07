'use client'
import { useEffect, useState } from 'react'
import { getScoreColor, getSpectrumSegment, SPECTRUM_LABELS, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import Link from 'next/link'

type Entry = {
  share_id: string
  score: number
  verdict: string
  vibes: string
  roast: string
  holdings: { ticker: string; allocation: string }[]
  created_at: string
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => { setEntries(data); setLoading(false) })
  }, [])

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <div className="text-4xl mb-3">🏆</div>
        <h1 className="text-3xl font-bold mb-2">Hall of Shame</h1>
        <p className="text-zinc-500">The most degenerate portfolios submitted. Publicly.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <p className="mb-4">No public entries yet. Be the first degen.</p>
          <Link href="/" className="text-orange-400 hover:underline">Analyze your portfolio →</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry, i) => {
            const seg = getSpectrumSegment(entry.score)
            const tickers = entry.holdings.map(h => h.ticker).join(', ')
            return (
              <Link key={entry.share_id} href={`/results/${entry.share_id}`}
                className="block surface rounded-xl p-5 hover:border-orange-500/30 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="text-2xl font-mono font-bold text-zinc-600 w-8 shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={cn('text-2xl font-mono font-bold', getScoreColor(entry.score))}>
                        {entry.score}
                      </span>
                      <span className="text-sm font-medium">{entry.verdict}</span>
                      <span className="text-lg">{SPECTRUM_LABELS[seg].emoji}</span>
                    </div>
                    <p className="text-xs text-zinc-600 font-mono mb-2">{tickers}</p>
                    <p className="text-sm text-zinc-400 italic line-clamp-2">&ldquo;{entry.roast}&rdquo;</p>
                    <p className="text-xs text-zinc-600 mt-2">{formatDate(entry.created_at)}</p>
                  </div>
                  <div className="text-zinc-700 group-hover:text-orange-400 transition-colors text-lg shrink-0">→</div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div className="text-center mt-10">
        <Link href="/" className="inline-block px-6 py-3 bg-orange-500 hover:bg-orange-400 text-white rounded-xl transition-colors">
          Analyze your portfolio →
        </Link>
      </div>
    </main>
  )
}
