// lib/screenshotParser.ts
// Uses Claude's vision capability to read tickers + allocation percentages
// out of a portfolio screenshot (broker app, spreadsheet, etc). Returns raw
// parsed holdings for the user to review/edit — never auto-submitted as-is,
// since vision extraction of dollar amounts/percentages can be imprecise.

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = process.env.DEGEN_MODEL || 'claude-haiku-4-5-20251001'

export interface ParsedHolding {
  ticker: string
  allocation: number
}

export async function parseHoldingsFromImage(base64: string, mediaType: string): Promise<ParsedHolding[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Screenshot parsing is not configured (missing ANTHROPIC_API_KEY).')
  }

  const prompt = `This image is a screenshot of someone's investment portfolio (a brokerage app, exchange, or spreadsheet). Extract every holding you can identify.

For each holding, output its ticker/symbol and its allocation as a percentage of the total portfolio shown.
- If percentages are shown directly, use them.
- If only dollar values or share counts are shown, compute each holding's percentage of the total value shown in the image.
- Use standard ticker symbols (e.g. "AAPL", "BTC", "VTI"), not company names.
- Skip cash/USD balances unless they're clearly part of the allocation breakdown.
- Limit to at most 12 holdings — if there are more, keep the largest ones.

Respond ONLY with a valid JSON array, no markdown, no backticks, no commentary:
[{"ticker": "AAPL", "allocation": 42.5}, ...]

If you cannot identify any holdings in the image, respond with: []`

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', data: base64 },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  })

  const text = message.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('')
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
  if (!Array.isArray(parsed)) return []

  return parsed
    .map((h: { ticker?: unknown; allocation?: unknown }) => ({
      ticker: String(h?.ticker ?? '').toUpperCase().trim().slice(0, 8),
      allocation: Math.max(0, Math.min(100, Number(h?.allocation) || 0)),
    }))
    .filter((h: ParsedHolding) => h.ticker.length > 0 && h.allocation > 0)
    .slice(0, 12)
}
