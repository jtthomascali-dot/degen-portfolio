'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toBlob } from 'html-to-image'
import { type Analysis, scoreColor } from '@/lib/analysisTypes'

export default function ShareCardPage() {
  const params = useParams()
  const id = params.id as string
  const cardRef = useRef<HTMLDivElement>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'download' | 'share' | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/analyze?id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setAnalysis(data)
      })
      .catch(() => setError('Failed to load analysis.'))
      .finally(() => setLoading(false))
  }, [id])

  const renderBlob = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null
    return toBlob(cardRef.current, { pixelRatio: 2 })
  }

  const handleDownload = async () => {
    if (!analysis) return
    setBusy('download')
    try {
      const blob = await renderBlob()
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `degen-score-${analysis.degen_score}.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(null)
    }
  }

  const handleShare = async () => {
    if (!analysis) return
    setBusy('share')
    try {
      const blob = await renderBlob()
      if (!blob) return
      const file = new File([blob], `degen-score-${analysis.degen_score}.png`, { type: 'image/png' })
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean
        share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void>
      }
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({
          files: [file],
          title: `My DEGEN Score: ${analysis.degen_score}/100`,
          text: `${analysis.verdict}. Check yours:`,
        })
      } else {
        await handleDownload()
      }
    } catch {
      /* user cancelled share sheet — no-op */
    } finally {
      setBusy(null)
    }
  }

  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink">
        <p className="text-degen-muted">Loading...</p>
      </main>
    )

  if (error || !analysis)
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink px-4">
        <div className="text-center">
          <p className="mb-2 font-bold text-degen-red">Analysis not found</p>
          <Link href="/" className="rounded-[3px] bg-paper px-6 py-3 font-bold text-ink">Try Again</Link>
        </div>
      </main>
    )

  const accent = scoreColor(analysis.degen_score)
  const m = analysis.metrics
  const stat = m
    ? `${analysis.holdings.length} holdings · ${m.cryptoPct}% crypto`
    : `${analysis.holdings.length} holdings`

  return (
    <main className="min-h-screen bg-ink text-paper">
      <div className="flex items-center justify-between border-b border-paper/10 px-6 py-5 sm:px-10">
        <Link href={`/results/${id}`} className="text-[11px] uppercase tracking-[0.18em] text-degen-muted transition-colors hover:text-paper">&larr; Back to results</Link>
        <span className="text-[14px] font-bold tracking-[0.28em]">DEGEN</span>
        <span className="w-[110px]" />
      </div>

      <div className="mx-auto max-w-md px-6 py-12 sm:px-10">
        <div className="mb-3 text-center text-[11px] uppercase tracking-[0.22em] text-degen-muted">// Share Card</div>
        <h1 className="mb-8 text-center font-serif text-[28px] italic text-paper">Ready to flex (or confess)</h1>

        <div
          ref={cardRef}
          className="relative mx-auto flex aspect-square w-full flex-col overflow-hidden rounded-[3px] border border-paper/10 bg-ink"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: `radial-gradient(95% 65% at 50% 118%, ${accent}55, transparent 60%)` }}
          />
          <div className="relative flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-2.5">
              <div className="h-[8px] w-[8px] bg-paper" />
              <span className="text-[13px] font-bold tracking-[0.30em] text-paper">DEGEN</span>
            </div>
            <span className="text-[9px] uppercase tracking-[0.18em] text-degen-muted">Portfolio Roast</span>
          </div>
          <div className="relative flex flex-1 flex-col justify-center px-6">
            <div className="mb-4 text-[10px] uppercase tracking-[0.22em]" style={{ color: accent }}>// Degen Score</div>
            <div className="flex items-baseline gap-2 leading-[0.78]">
              <span className="font-serif text-[88px] leading-[0.78] tracking-tight" style={{ color: accent }}>{analysis.degen_score}</span>
              <span className="font-serif text-[20px] text-degen-dim">/100</span>
            </div>
            <div className="mt-3 font-serif text-[22px] italic leading-tight text-paper">{analysis.verdict}</div>
            <div className="relative mt-5 h-[5px] rounded-full" style={{ background: 'linear-gradient(90deg,#3FCF8E,#F5A623 58%,#FF4438)' }}>
              <div className="absolute -top-[5px] -bottom-[5px] w-[2px] bg-paper" style={{ left: `${analysis.degen_score}%` }} />
            </div>
          </div>
          <div className="relative flex items-center justify-between border-t border-paper/10 px-6 py-4">
            <span className="text-[10px] text-degen-muted">{stat}</span>
            <span className="font-mono text-[10px] font-semibold tracking-[0.10em] text-[#BFC3BC]">degen.app</span>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={handleShare}
            disabled={busy !== null}
            className="flex-1 rounded-[3px] py-3.5 text-[13px] font-bold text-ink transition-all active:scale-[0.99] disabled:opacity-50"
            style={{ background: accent }}
          >
            {busy === 'share' ? 'Preparing…' : 'Share card'}
          </button>
          <button
            onClick={handleDownload}
            disabled={busy !== null}
            className="flex-1 rounded-[3px] border border-paper/15 py-3.5 text-[13px] font-bold text-paper transition-colors hover:border-paper/30 disabled:opacity-50"
          >
            {busy === 'download' ? 'Saving…' : 'Save image'}
          </button>
        </div>
      </div>
    </main>
  )
}
