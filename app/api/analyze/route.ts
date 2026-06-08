import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }
  return NextResponse.json({ ...data, degen_score: data.score })
}

export async function POST(req: NextRequest) {
  try {
    const { holdings, nickname } = await req.json()

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({ error: 'No holdings provided' }, { status: 400 })
    }

    const holdingsList = holdings
      .map((h: { ticker: string; allocation: number }) => `${h.ticker}: ${h.allocation}%`)
      .join(', ')

    const prompt = `You are a brutally honest, darkly funny financial analyst who roasts investment portfolios. Analyze this portfolio: ${holdingsList}

Respond ONLY with a valid JSON object, no markdown, no extra text:
{
  "score": <integer 0-100, where 0=Warren Buffett, 100=lost everything on meme coins>,
  "verdict": <one of exactly: "Warren Buffett", "Index Fund Andy", "Casual Gambler", "WSB Recruit", "Full Degen", "Certifiable">,
  "roast": <2-3 sentences, brutal and funny, reference specific tickers>,
  "vibes": <one sentence vibe check on the overall portfolio>,
  "holdings": [
    {"ticker": "<TICKER>", "allocation": <number>, "classification": "<one word: safe/boomer/growth/gambling/degen/unhinged>"}
  ]
}

Scoring: 0-20=boring/safe, 21-40=sensible, 41-60=some edge, 61-80=degen tendencies, 81-100=certifiable.`

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = rawText.replace(/```json|```/g, '').trim()
    const result = JSON.parse(cleaned)

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('analyses')
      .insert({
        nickname: nickname || 'Anonymous Degen',
        score: result.score,
        verdict: result.verdict,
        roast: result.roast,
        vibes: result.vibes || '',
        holdings: result.holdings,
        is_public: true,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json({ error: 'Failed to save: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ id: data.id, degen_score: result.score, ...result })
  } catch (err) {
    console.error('Analyze error:', err)
    return NextResponse.json({ error: 'Analysis failed. Try again.' }, { status: 500 })
  }
}
