import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizeTicker, type HoldingInput } from '../../../lib/marketData'
import { analyzeLive, liveColumns, stripNewColumns } from '../../../lib/degenPipeline'
import { containsBlockedTerm } from '../../../lib/moderation'

export const runtime = 'nodejs'
export const maxDuration = 60

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Light in-memory rate limiter (per server instance) — protects Anthropic
// credits + provider rate limits from spam.
const RL_WINDOW_MS = 60_000
const RL_MAX = 10
const rl = new Map<string, number[]>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const hits = (rl.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS)
  hits.push(now)
  rl.set(ip, hits)
  return hits.length > RL_MAX
}

// GET /api/analyze?id=xxx — fetch a saved analysis (degen_score aliased to score)
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = getSupabase()
  const { data, error } = await supabase.from('analyses').select('*').eq('id', id).single()
  if (error || !data) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }
  return NextResponse.json({ ...data, degen_score: data.score })
}

// POST /api/analyze — real data + news -> deterministic score + fresh roast
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (rateLimited(ip)) {
      return NextResponse.json({ error: 'Slow down — too many requests.' }, { status: 429 })
    }

    const body = await req.json()
    const nickname = String(body?.nickname || 'Anonymous Degen').slice(0, 40)
    if (containsBlockedTerm(nickname)) {
      return NextResponse.json({ error: 'That nickname isn\'t allowed. Try another one.' }, { status: 400 })
    }
    const isPublic = body?.shareToLeaderboard !== false

    const rawHoldings = Array.isArray(body?.holdings) ? body.holdings : []
    const holdings: HoldingInput[] = rawHoldings
      .map((h: { ticker?: unknown; allocation?: unknown }) => ({
        ticker: normalizeTicker(String(h?.ticker ?? '')).slice(0, 8),
        allocation: Math.max(0, Math.min(100, Number(h?.allocation) || 0)),
      }))
      .filter((h: HoldingInput) => h.ticker.length > 0 && h.allocation > 0)
      .slice(0, 12)

    if (holdings.length === 0) {
      return NextResponse.json({ error: 'No valid holdings provided' }, { status: 400 })
    }

    const analysis = await analyzeLive(holdings)

    const fullRow = {
      nickname,
      ...liveColumns(analysis),
      is_public: isPublic,
    }

    const supabase = getSupabase()
    let insert = await supabase.from('analyses').insert(fullRow).select('id').single()
    if (insert.error) {
      // New columns may not be migrated yet — retry with the original columns only.
      console.warn('Insert with new columns failed, retrying base columns:', insert.error.message)
      insert = await supabase.from('analyses').insert(stripNewColumns(fullRow)).select('id').single()
    }

    if (insert.error || !insert.data) {
      console.error('Supabase insert error:', insert.error)
      return NextResponse.json(
        { error: 'Failed to save: ' + (insert.error?.message || 'unknown') },
        { status: 500 }
      )
    }

    return NextResponse.json({ id: insert.data.id, degen_score: analysis.score, ...analysis })
  } catch (err) {
    console.error('Analyze error:', err)
    return NextResponse.json({ error: 'Analysis failed. Try again.' }, { status: 500 })
  }
}
