import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase
      .from('analyses')
      .select('id, nickname, score, verdict, holdings, created_at')
      .eq('is_public', true)
      .order('score', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch leaderboard.' }, { status: 500 })
    }

    const entries = (data || []).map((row: {
      id: string
      nickname: string | null
      score: number
      verdict: string
      holdings: Array<{ ticker: string }> | null
      created_at: string
    }) => ({
      id: row.id,
      nickname: row.nickname || 'Anonymous Degen',
      degen_score: row.score,
      verdict: row.verdict,
      tickers: Array.isArray(row.holdings) ? row.holdings.map(h => h.ticker) : [],
      created_at: row.created_at,
    }))

    return NextResponse.json({ entries })
  } catch (err) {
    console.error('Leaderboard error:', err)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
