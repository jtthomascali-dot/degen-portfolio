'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Analysis {
  id: string
  nickname: string
  degen_score: number
  verdict: string
  roast: string
  holdings: Array<{ ticker: string; allocation: number; classification?: string }>
  created_at: string
}

function ScoreMeter({ score }: { score: number }) {
  const color =
    score >= 80 ? '#f87171' :
    score >= 60 ? '#fb923c' :
    score >= 40 ? '#facc15' :
    '#4ade80'

  return (
    <div className="my-6">
      <div className="flex justify-between text-xs text-zinc-500 mb-1">
        <span>Safe</span>
        <span>Unhinged</span>
      </div>
      <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <div className="text-center mt-3">
        <span className="text-5xl font-black font-mono" style={{ color }}>{score}</span>
        <span className="text-zinc-500 text-lg">/100</span>
      </div>
    </div>
  )
}

export default function ResultsPage() {
  const params = useParams()
  const id = params.id as string
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/analyze?id=${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setAnalysis(data)
      })
      .catch(() => setError('Failed to load analysis.'))
      .finally(() => setLoading(false))
  }, [id])

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({
        title: `My DEGEN Score: ${analysis?.degen_score}/100`,
        text: `${analysis?.nickname} got a ${analysis?.degen_score} degen score. ${analysis?.verdict}. Check yours:`,
        url,
      })
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-bounce">🔥</div>
        <p className="text-zinc-400">Loading your roast...</p>
      </div>
    </main>
  )

  if (error || !analysis) return (
    <main className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-5xl mb-4">💀</div>
        <p className="text-red-400 font-bold mb-2">Analysis not found</p>
        <p className="text-zinc-500 text-sm mb-6">{error}</p>
        <Link href="/" className="bg-yellow-400 text-black font-black px-6 py-3 rounded-xl">Try Again</Link>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="border-b border-zinc-800 px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-yellow-400 text-sm hover:underline">← New Analysis</Link>
        <Link href="/leaderboard" className="text-xs text-zinc-500 hover:text-yellow-400 transition-colors">🏆 Leaderboard</Link>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="text-center mb-2">
          <p className="text-zinc-500 text-sm">{analysis.nickname}</p>
          <h2 className="text-2xl font-black text-yellow-400 mt-1">{analysis.verdict}</h2>
        </div>

        <ScoreMeter score={analysis.degen_score} />

        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 mb-5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">🤖 AI Roast</p>
          <p className="text-zinc-200 text-sm leading-relaxed">{analysis.roast}</p>
        </div>

        <div className="mb-6">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Holdings</p>
          <div className="space-y-2">
            {analysis.holdings.map((h) => (
              <div key={h.ticker} className="flex items-center justify-between bg-zinc-900 rounded-lg px-4 py-3">
                <div>
                  <span className="font-mono font-bold text-white">{h.ticker}</span>
                  {h.classification && <span className="ml-2 text-xs text-zinc-500">{h.classification}</span>}
                </div>
                <span className="font-mono text-yellow-400 text-sm">{h.allocation}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handleShare} className="flex-1 bg-yellow-400 text-black font-black py-3.5 rounded-xl hover:bg-yellow-300 active:scale-95 transition-all text-sm">
            {copied ? '✓ Copied!' : '📤 Share My Score'}
          </button>
          <Link href="/" className="flex-1 border border-zinc-700 text-white font-bold py-3.5 rounded-xl hover:border-zinc-500 transition-colors text-sm text-center">
            🔄 Reanalyze
          </Link>
        </div>

        <div className="mt-4 text-center">
          <Link href="/leaderboard" className="text-zinc-600 text-xs hover:text-yellow-400 transition-colors">
            See how you rank on the leaderboard →
          </Link>
        </div>
      </div>
    </main>
  )
}
