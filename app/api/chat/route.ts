import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { messages, portfolioContext } = await req.json()

    const systemPrompt = `You are a brutally funny but financially knowledgeable AI advisor analyzing this specific portfolio: ${portfolioContext}.

You already roasted them. Now they're asking follow-up questions. Be helpful but keep your savage sense of humor. 
Give real financial insights mixed with appropriate roasting. Keep responses concise — 2-4 sentences max unless they ask for something detailed.
Never give specific buy/sell advice. Always add "not financial advice" somewhere if discussing specific actions.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: systemPrompt,
      messages,
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')

    return NextResponse.json({ message: text })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 })
  }
}
