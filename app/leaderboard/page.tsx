'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Entry {
  id: string
  nickname: string
  degen_score: number
  verdict: string
  tickers: string[]
}

function scoreColor(score: number) {
  return score >= 80 ? '#FF4438' : score >= 60 ? '#F5A623' : score >= 40 ? '#F5A623' : '#3FCF8E'
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setEntries(data.entries || [])
      })
      .catch(() => setError('Failed to load.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-ink text-paper">
      <div className="flex items-center justify-between border-b border-paper/10 px-6 py-5 sm:px-10">
        <Link href="/" className="text-[11px] uppercase tracking-[0.18em] text-degen-muted transition-colors hover:text-paper">&larr; Back</Link>
        <span className="text-[14px] font-bold tracking-[0.28em] text-paper">HALL OF DEGENS</span>
        <div className="w-10" />
      </div>

      <div className="mx-auto max-w-2xl px-6 py-10 sm:px-10">
        {loading && <p className="text-center text-degen-dim">Loading...</p>}
        {error && <p className="text-center text-degen-red">{error}</p>}

        {!loading && entries.length === 0 && (
          <div className="pt-16 text-center">
            <p className="mb-3 text-degen-muted">No entries yet.</p>
            <Link href="/" className="text-degen-amber">Be the first</Link>
          </div>
        )}

        <div className="space-y-3">
          {entries.map((entry, i) => (
            <Link
              key={entry.id}
              href={`/results/${entry.id}`}
              className="block rounded-[3px] border border-paper/10 bg-paper/[0.02] p-4 transition-colors hover:border-paper/20"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="mr-2 font-mono text-[12px] text-degen-dim">#{i + 1}</span>
                  <span className="font-bold text-paper">{entry.nickname}</span>
                  <div className="mt-1 text-[12px] text-degen-muted">{entry.verdict}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {entry.tickers.slice(0, 5).map(t => (
                      <span key={t} className="rounded-[2px] bg-paper/10 px-1.5 py-0.5 font-mono text-[11px] text-[#BFC3BC]">{t}</span>
                    ))}
                  </div>
                </div>
                <span className="font-serif text-[28px]" style={{ color: scoreColor(entry.degen_score) }}>
                  {entry.degen_score}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {entries.length > 0 && (
          <div className="mt-10 text-center">
            <Link href="/" className="inline-block rounded-[3px] bg-paper px-6 py-3 text-[13px] font-bold uppercase tracking-[0.1em] text-ink">
              Analyze My Portfolio
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
