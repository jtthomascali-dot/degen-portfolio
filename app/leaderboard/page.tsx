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
        if (data.error) setError(data.error)
        else setEntries(data.entries || [])
      })
      .catch(() => setError('Failed to load leaderboard.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="border-b border-zinc-800 px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-yellow-400 text-sm hover:underline">← Back</Link>
        <div className="text-center">
          <h1 className="text-lg font-black text-yellow-400 tracking-tight">HALL OF DEGENS</h1>
          <p className="text-xs text-zinc-500">Most reckless portfolios</p>
        </div>
        <div className="w-12" />
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex gap-3 mb-6 overflow-x-auto pb-1">
          {[
            { label: '0–39 Safe', color: 'text-green-400' },
            { label: '40–59 Mid', color: 'text-yellow-400' },
            { label: '60–79 Degen', color: 'text-orange-400' },
            { label: '80–100 Unhinged', color: 'text-red-400' },
          ].map(item => (
            <span key={item.label} className={`text-xs whitespace-nowrap ${item.color}`}>
              {item.label}
            </span>
          ))}
        </div>

        {loading && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3 animate-bounce">🦍</div>
            <p className="text-zinc-500 text-sm">Loading degens...</p>
          </div>
        )}

        {error && (
          <div className="p-4
