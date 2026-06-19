import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '../../../../lib/supabaseAdmin'
import { analyzeLive, liveColumns, stripNewColumns } from '../../../../lib/degenPipeline'
import { reconstructHoldings, selectStaleTargets } from '../../../../lib/batch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Hobby cap; raise to 300 on Pro

const LIMIT = Number(process.env.LEADERBOARD_REROAST_LIMIT) || 50
const CONCURRENCY = Number(process.env.LEADERBOARD_REROAST_CONCURRENCY) || 5
const STALE_HOURS = Number(process.env.LEADERBOARD_REROAST_STALE_HOURS) || 6
const TIME_BUDGET_MS = (Number(process.env.LEADERBOARD_REROAST_MAX_SECONDS) || 55) * 1000

interface LeaderRow {
  id: string
  holdings: unknown
  refreshed_at: string | null
}

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.warn('CRON_SECRET not set — leaderboard re-roast endpoint is unprotected.')
    return true
  }
  return req.headers.get('authorization') === `Bearer ${secret}`
}

async function reroastRow(admin: ReturnType<typeof getAdminClient>, row: LeaderRow): Promise<boolean> {
  const holdings = reconstructHoldings(row.holdings)
  if (holdings.length === 0) return false

  const analysis = await analyzeLive(holdings)
  const cols = liveColumns(analysis)

  let upd = await admin.from('analyses').update(cols).eq('id', row.id)
  if (upd.error) {
    upd = await admin.from('analyses').update(stripNewColumns(cols)).eq('id', row.id)
  }
  return !upd.error
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()
  const admin = getAdminClient()

  const { data, error } = await admin
    .from('analyses')
    .select('id, holdings, refreshed_at')
    .eq('is_public', true)
    .order('score', { ascending: false })
    .limit(LIMIT)

  if (error) {
    console.error('Cron leaderboard load error:', error)
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 })
  }

  const rows = (data || []) as LeaderRow[]
  const targets = selectStaleTargets(rows, STALE_HOURS * 3600 * 1000)

  let updated = 0
  let failed = 0
  let timedOut = false

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    if (Date.now() - start > TIME_BUDGET_MS) {
      timedOut = true
      break
    }
    const batch = targets.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(batch.map((r) => reroastRow(admin, r)))
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value) updated++
      else failed++
    }
  }

  const summary = {
    ok: true,
    scanned: rows.length,
    eligible: targets.length,
    skippedFresh: rows.length - targets.length,
    updated,
    failed,
    timedOut,
    durationMs: Date.now() - start,
  }
  console.log('Leaderboard re-roast:', summary)
  return NextResponse.json(summary)
}

export async function GET(req: NextRequest) {
  return handle(req)
}
export async function POST(req: NextRequest) {
  return handle(req)
}
