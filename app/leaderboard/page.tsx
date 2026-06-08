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
    <main style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #27272a', paddingBottom: '16px', marginBottom: '24px' }}>
        <Link href="/" style={{ color: '#facc15', textDecoration: 'none' }}>Back</Link>
        <h1 style={{ color: '#facc15', margin: 0, fontSize: '18px' }}>HALL OF DEGENS</h1>
        <div style={{ width: '40px' }} />
      </div>

      {loading && <p style={{ textAlign: 'center', color: '#71717a' }}>Loading...</p>}
      {error && <p style={{ textAlign: 'center', color: '#f87171' }}>{error}</p>}

      {!loading && entries.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: '64px' }}>
          <p style={{ color: '#a1a1aa' }}>No entries yet.</p>
          <Link href="/" style={{ color: '#facc15' }}>Be the first</Link>
        </div>
      )}

      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {entries.map((entry, i) => (
          <Link key={entry.id} href={'/results/' + entry.id} style={{ display: 'block', textDecoration: 'none', color: '#fff', background: '#18181b', borderRadius: '12px', padding: '16px', marginBottom: '12px', border: '1px solid #27272a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ color: '#71717a', marginRight: '8px' }}>#{i + 1}</span>
                <span style={{ fontWeight: 'bold' }}>{entry.nickname}</span>
                <div style={{ color: '#71717a', fontSize: '12px', marginTop: '4px' }}>{entry.verdict}</div>
                <div style={{ marginTop: '8px' }}>
                  {entry.tickers.slice(0, 5).map(t => (
                    <span key={t} style={{ background: '#27272a', borderRadius: '4px', padding: '2px 6px', marginRight: '4px', fontSize: '12px', fontFamily: 'monospace' }}>{t}</span>
                  ))}
                </div>
              </div>
              <span style={{ fontSize: '24px', fontWeight: '900', color: entry.degen_score >= 80 ? '#f87171' : entry.degen_score >= 60 ? '#fb923c' : entry.degen_score >= 40 ? '#facc15' : '#4ade80' }}>
                {entry.degen_score}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {entries.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <Link href="/" style={{ background: '#facc15', color: '#000', fontWeight: '900', padding: '12px 24px', borderRadius: '12px', textDecoration: 'none' }}>
            Analyze My Portfolio
          </Link>
        </div>
      )}
    </main>
  )
}
