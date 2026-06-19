import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '../../../lib/supabaseAdmin'
import { analyzeLive, liveColumns, stripNewColumns } from '../../../lib/degenPipeline'
import { reconstructHoldings } from '../../../lib/batch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const RL_WINDOW_MS = 60_000
const RL_MAX = 15
const rl = new Map<string, number[]>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const hits = (rl.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS)
  hits.push(now)
  rl.set(ip, hits)
  return hits.length > RL_MAX
}

// POST /api/reroast { id } — re-pull live data + news for a saved analysis,
// recompute the score, write a brand-new roast. Makes results change over time.
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (rateLimited(ip)) {
      return NextResponse.json({ error: 'Slow down — too many refreshes.' }, { status: 429 })
    }

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const admin = getAdminClient()
    const { data: existing, error } = await admin
      .from('analyses')
      .select('id, holdings')
      .eq('id', id)
      .single()

    if (error || !existing) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
    }

    const holdings = reconstructHoldings(existing.holdings)
    if (holdings.length === 0) {
      return NextResponse.json({ error: 'No holdings to re-roast' }, { status: 400 })
    }

    const analysis = await analyzeLive(holdings)
    const cols = liveColumns(analysis)

    let upd = await admin.from('analyses').update(cols).eq('id', id)
    if (upd.error) {
      console.warn('Reroast update failed, retrying base columns:', upd.error.message)
      upd = await admin.from('analyses').update(stripNewColumns(cols)).eq('id', id)
    }
    if (upd.error) {
      console.error('Reroast update error:', upd.error)
      return NextResponse.json({ error: 'Failed to refresh: ' + upd.error.message }, { status: 500 })
    }

    return NextResponse.json({ id, degen_score: analysis.score, ...analysis })
  } catch (e) {
    console.error('Reroast error:', e)
    return NextResponse.json({ error: 'Re-roast failed. Try again.' }, { status: 500 })
  }
}
