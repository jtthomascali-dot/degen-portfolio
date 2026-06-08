'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface LeaderboardEntry {
  id: string
  nickname: string
  degen_score: number
  verdict: string
  tickers: string[]
  created_at: string
}

const VERDICT_EMOJI: Record<string, string> = {
  'Warren Buffett': '🎩',
  'Index Fund Andy': '😴',
  'Casual Gambler': '🎲',
  'WSB Recruit': '🦍',
  'Full Degen': '🚀',
  'Certifiable': '💀',
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'text-red-400 border-red-400/40 bg-red-400/10' :
    score >= 60 ? 'text-orange-400 border-orange-400/40 bg-orange-400/10' :
    score >= 40 ? 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10' :
    'text-green-400 border-green-400/40 bg-green-400/10'

  return (
    <span className={`font-black font-mono text-lg border px-2 py-0.5 rounded ${color}`}>
      {score}
    </span>
  )
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setEntries(data.entries || [])
        }
      })
      .catch(() => setError('Failed to load leaderboard.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="border-b border-zinc-800 px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-yellow-400 text-sm hover:underline">
          Back
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-black text-yellow-400 tracking-tight">HALL OF DEGENS</h1>
          <p className="text-xs text-zinc-500">Most reckless portfolios</p>
        </div>
        <div className="w-12" />
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex gap-3 mb-6 overflow-x-auto pb-1">
          <span className="text-xs whitespace-nowrap text-green-400">0-39 Safe</span>
          <span className="text-xs whitespace-nowrap text-yellow-400">40-59 Mid</span>
          <span className="text-xs whitespace-nowrap text-orange-400">60-79 Degen</span>
          <span className="text-xs whitespace-nowrap text-red-400">80-100 Unhinged</span>
        </div>

        {loading && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🦍</div>
            <p className="text-zinc-500 text-sm">Loading degens...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🏜️</div>
            <p className="text-zinc-400 font-bold mb-1">No degens yet</p>
            <p className="text-zinc-600 text-sm mb-6">Be the first to get roasted.</p>
            <Link href="/" className="bg-yellow-400 text-black font-black px-6 py-3 rounded-xl text-sm">
              Analyze My Portfolio
            </Link>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="space-y-3">
            {entries.map((entry, index) => (
              <Link
                key={entry.id}
                href={`/results/${entry.id}`}
                className="block bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-yellow-400/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="text-zinc-600 font-mono text-sm w-6 flex-shrink-0 pt-0.5">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '#' + (index + 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold truncate text-white">
                        {VERDICT_EMOJI[entry.verdict] || '📊'} {entry.nickname}
                      </span>
                      <ScoreBadge score={entry.degen_score} />
                    </div>
                    <p className="text-xs text-zinc-500 mb-2">{entry.verdict}</p>
                    <div className="flex flex-wrap gap-1">
                      {entry.tickers.slice(0, 6).map(ticker => (
                        <span key={ticker} className="text-xs font-mono bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-300">
                          {ticker}
                        </span>
                      ))}
                      {entry.tickers.length > 6 && (
                        <span className="text-xs text-zinc-600">+{entry.tickers.length - 6}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="mt-8 text-center">
            <Link href="/" className="bg-yellow-400 text-black font-black px-6 py-3 rounded-xl text-sm inline-block">
              Analyze My Portfolio
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
