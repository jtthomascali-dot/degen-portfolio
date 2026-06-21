export type Classification = 'safe' | 'boomer' | 'growth' | 'gambling' | 'degen' | 'unhinged'

export interface Holding {
  ticker: string
  allocation: number
  classification?: Classification
  annualizedVol?: number | null
  beta?: number | null
  marketCap?: number | null
  change1dPct?: number | null
  change1mPct?: number | null
  assetType?: string
  dataSource?: string
}
export interface Headline {
  ticker: string
  title: string
  publisher: string
  url: string
  publishedAt: number | null
}
export interface Factor {
  key: string
  label: string
  score: number
  weight: number
  available: boolean
  detail: string
}
export interface Metrics {
  weightedVol: number | null
  weightedBeta: number | null
  maxWeightPct: number
  cryptoPct: number
  speculativePct: number
  concentrationHHI: number
  holdingsCount: number
  dataQuality: 'live' | 'partial' | 'estimated'
}
export interface Analysis {
  id: string
  nickname: string
  degen_score: number
  verdict: string
  roast: string
  holdings: Holding[]
  factors?: Factor[]
  metrics?: Metrics
  data_quality?: 'live' | 'partial' | 'estimated'
  news?: Headline[]
  refreshed_at?: string
  created_at: string
}

export const CLASS_COLOR: Record<Classification, string> = {
  safe: '#3FCF8E',
  boomer: '#5C8FD6',
  growth: '#C7CBC4',
  gambling: '#F5A623',
  degen: '#FF4438',
  unhinged: '#e879f9',
}

export function scoreColor(score: number) {
  return score >= 80 ? '#FF4438' : score >= 60 ? '#F5A623' : score >= 40 ? '#F5A623' : '#3FCF8E'
}
