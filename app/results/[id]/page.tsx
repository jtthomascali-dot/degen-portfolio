'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getScoreColor, getClassificationColor, SPECTRUM_LABELS, getSpectrumSegment, formatDate } from '@/lib/utils'
import { Share2, RefreshCw, MessageCircle, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

type Analysis = {
  share_id: string
  created_at: string
  holdings: { ticker: string; allocation: string }[]
  score: number
  verdict: string
  vibes: string
  roast: string
  diversification: string
  volatility: string
  risk_summary: string
  one_good_thing: string
  holdings_breakdown: { ticker: string; classification: string; comment: string }[]
}

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export default function ResultsPage() {
  const { id } = useParams()
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('analyses')
        .select('*')
        .eq('share_id', id)
        .single()
      setAnalysis(data)
      setLoading(false)
    }
    load()
  }, [id])

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sendChat = async () => {
    if (!chatInput.trim() || !analysis) return
    const userMsg: ChatMessage = { role: 'user', content: chatInput }
    const next = [...chatMessages, userMsg]
    setChatMessages(next)
    setChatInput('')
    setChatLoading(true)

    const portfolioContext = analysis.holdings
      .map(h => `${h.ticker} (${h.allocation}%)`)
      .join(', ')

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: next,
        portfolioContext,
      }),
    })
    const data = await res.json()
    setChatMessages([...next, { role: 'assistant', content: data.message }])
    setChatLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="text-center py-32">
        <p className="text-zinc-500 mb-4">Analysis not found.</p>
        <Link href="/" className="text-orange-400 hover:underline">Start over</Link>
      </div>
    )
  }

  const seg = getSpectrumSegment(analysis.score)
  const total = analysis.holdings.reduce((s, h) => s + (parseFloat(h.allocation) || 0), 0)

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">

      {/* Header verdict */}
      <div className="text-center mb-10 animate-fade-in">
        <div className="text-5xl mb-3">{SPECTRUM_LABELS[seg].emoji}</div>
        <h1 className="text-3xl font-bold mb-1">{analysis.verdict}</h1>
        <p className="text-zinc-500 text-sm">{analysis.vibes}</p>
        <p className="text-xs text-zinc-600 mt-1">{formatDate(analysis.created_at)}</p>
      </div>

      {/* Degen score */}
      <div className="surface rounded-xl p-6 mb-4 animate-slide-up">
        <div className="flex items-end justify-between mb-3">
          <span className="text-sm text-zinc-400">Degen Score</span>
          <span className={cn('text-5xl font-mono font-bold', getScoreColor(analysis.score))}>
            {analysis.score}
            <span className="text-xl text-zinc-600">/100</span>
          </span>
        </div>

        {/* Spectrum bar */}
        <div className="flex rounded-lg overflow-hidden h-10 mb-2">
          {SPECTRUM_LABELS.map((s, i) => (
            <div key={s.label}
              className={cn('flex-1 flex items-center justify-center text-xs font-medium transition-all',
                i === seg
                  ? 'bg-orange-500 text-white'
                  : 'bg-[#1a1a1a] text-zinc-600')}>
              {i === seg ? `${s.emoji} ${s.label}` : s.emoji}
            </div>
          ))}
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {[
            { label: 'Diversification', value: analysis.diversification },
            { label: 'Volatility',      value: analysis.volatility },
          ].map(m => (
            <div key={m.label} className="bg-[#1a1a1a] rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-1">{m.label}</p>
              <p className="text-sm font-medium">{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* The Roast */}
      <div className="surface rounded-xl p-6 mb-4 animate-slide-up border-l-2 border-orange-500">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">The Roast</p>
        <p className="text-zinc-200 leading-relaxed italic">&ldquo;{analysis.roast}&rdquo;</p>
      </div>

      {/* Holdings breakdown */}
      <div className="surface rounded-xl p-6 mb-4 animate-slide-up">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Holdings Breakdown</p>
        <div className="space-y-3">
          {analysis.holdings_breakdown?.map((h, i) => {
            const holding = analysis.holdings.find(r => r.ticker === h.ticker)
            const pct = total > 0 ? ((parseFloat(holding?.allocation || '0') / total) * 100) : 0
            return (
              <div key={i}>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono text-sm font-bold w-16">{h.ticker}</span>
                  <div className="flex-1 h-1.5 bg-[#222] rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-zinc-500 w-10 text-right">{Math.round(pct)}%</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border', getClassificationColor(h.classification))}>
                    {h.classification}
                  </span>
                </div>
                {h.comment && <p className="text-xs text-zinc-500 ml-16 italic">{h.comment}</p>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Risk + one good thing */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="surface rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Risk Summary</p>
          <p className="text-sm text-zinc-300">{analysis.risk_summary}</p>
        </div>
        <div className="surface rounded-xl p-4 border border-green-500/20">
          <p className="text-xs text-green-500 uppercase tracking-wider mb-2">One Good Thing</p>
          <p className="text-sm text-zinc-300">{analysis.one_good_thing}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <button onClick={copyLink}
          className="flex-1 py-3 border border-[#333] rounded-xl text-sm flex items-center justify-center gap-2 hover:border-[#555] transition-colors">
          <Share2 size={16} /> {copied ? 'Copied!' : 'Share result'}
        </button>
        <button onClick={() => setChatOpen(!chatOpen)}
          className="flex-1 py-3 border border-orange-500/30 text-orange-400 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-orange-500/10 transition-colors">
          <MessageCircle size={16} /> Ask a question
        </button>
        <Link href="/"
          className="flex-1 py-3 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
          <RefreshCw size={16} /> Try again
        </Link>
      </div>

      {/* AI Chat */}
      {chatOpen && (
        <div className="surface rounded-xl p-4 animate-slide-up">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Ask the Oracle</p>
          <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
            {chatMessages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {['Should I sell GME?', 'What\'s less degen?', 'Am I gonna make it?', 'Roast me harder'].map(q => (
                  <button key={q} onClick={() => setChatInput(q)}
                    className="text-xs px-3 py-1.5 border border-[#333] rounded-full text-zinc-400 hover:text-white hover:border-[#555] transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} className={cn('text-sm rounded-lg p-3', m.role === 'user' ? 'bg-[#222] text-zinc-200 ml-8' : 'bg-orange-500/10 text-zinc-200 mr-8 border border-orange-500/20')}>
                {m.content}
              </div>
            ))}
            {chatLoading && (
              <div className="bg-orange-500/10 rounded-lg p-3 mr-8 border border-orange-500/20">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50 text-white placeholder:text-zinc-600"
              placeholder="Ask anything about your portfolio..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
            />
            <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 rounded-lg transition-colors">
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-zinc-700 mt-6">Not financial advice. Obviously.</p>
    </main>
  )
}
