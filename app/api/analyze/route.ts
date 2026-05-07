import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { generateShareId } from '@/lib/utils'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { holdings, isPublic } = await req.json()

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({ error: 'No holdings provided' }, { status: 400 })
    }

    const portfolioDesc = holdings
      .map((h: { ticker: string; allocation: string }) => `${h.ticker} (${h.allocation}%)`)
      .join(', ')

    const prompt = `You are the Degen Portfolio Analyzer — brutally funny, financially knowledgeable, and ruthlessly honest. Analyze this portfolio: ${portfolioDesc}

Respond ONLY with a valid JSON object. No markdown, no backticks, no explanation. Raw JSON only.

{
  "score": <integer 0-100, where 0=pure Buffett/safe, 100=peak WSB unhinged ape>,
  "verdict": "<one of: Warren Buffett, Bogle Disciple, Sensible Millennial, Growth Bro, Crypto Curious, Meme Stock Enjoyer, WSB Regular, Full Degen, Peak Ape>",
  "vibes": "<funny 4-7 word vibe check phrase describing this portfolio's energy>",
  "roast": "<2-4 sentence brutally funny roast. Reference specific tickers by name. Be savage but accurate.>",
  "diversification": "<Poor/Fair/Good/Excellent>",
  "volatility": "<Low/Medium/High/Unhinged>",
  "risk_summary": "<one sentence honest risk assessment>",
  "one_good_thing": "<one genuinely positive thing about the portfolio, however small>",
  "holdings": [
    {
      "ticker": "<TICKER>",
      "classification": "<one of: Boomer Safe / Solid Pick / Growth Pick / Spicy / Full Degen / What Is This>",
      "comment": "<8-12 word funny but accurate comment about this specific ticker>"
    }
  ]
}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')

    const clean = text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)

    const shareId = generateShareId()

    // Save to Supabase
    const { error: dbError } = await supabase.from('analyses').insert({
      share_id:           shareId,
      holdings:           holdings,
      score:              result.score,
      verdict:            result.verdict,
      vibes:              result.vibes,
      roast:              result.roast,
      diversification:    result.diversification,
      volatility:         result.volatility,
      risk_summary:       result.risk_summary,
      one_good_thing:     result.one_good_thing,
      holdings_breakdown: result.holdings,
      is_public:          isPublic ?? true,
    })

    if (dbError) console.error('DB error:', dbError)

    return NextResponse.json({ ...result, shareId })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
