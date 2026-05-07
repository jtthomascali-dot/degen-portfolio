import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Holding = {
  ticker: string
  allocation: number
}

export type AnalysisResult = {
  id?: string
  created_at?: string
  holdings: Holding[]
  score: number
  verdict: string
  vibes: string
  roast: string
  diversification: string
  volatility: string
  holdings_breakdown: HoldingBreakdown[]
  is_public: boolean
  share_id?: string
}

export type HoldingBreakdown = {
  ticker: string
  classification: string
  comment: string
}
