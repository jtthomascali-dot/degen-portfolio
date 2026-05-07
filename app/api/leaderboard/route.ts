import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('analyses')
    .select('share_id, score, verdict, vibes, roast, holdings, holdings_breakdown, created_at')
    .eq('is_public', true)
    .order('score', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
