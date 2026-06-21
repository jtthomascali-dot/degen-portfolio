import { NextRequest, NextResponse } from 'next/server'
import { parseHoldingsFromImage } from '../../../lib/screenshotParser'

export const runtime = 'nodejs'
export const maxDuration = 30

const RL_WINDOW_MS = 60_000
const RL_MAX = 10
const rl = new Map<string, number[]>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const hits = (rl.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS)
  hits.push(now)
  rl.set(ip, hits)
  return hits.length > RL_MAX
}

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const MAX_BASE64_CHARS = 6_000_000 // ~4.5MB decoded, comfortably under typical serverless body limits

// POST /api/parse-screenshot { image: "data:image/png;base64,...." }
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (rateLimited(ip)) {
      return NextResponse.json({ error: 'Slow down — too many requests.' }, { status: 429 })
    }

    const body = await req.json()
    const dataUrl = String(body?.image || '')
    const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
    if (!match) {
      return NextResponse.json({ error: 'Invalid image data.' }, { status: 400 })
    }
    const [, mediaType, base64] = match
    if (!ALLOWED_TYPES.has(mediaType)) {
      return NextResponse.json({ error: 'Unsupported image type. Use PNG, JPEG, WebP, or GIF.' }, { status: 400 })
    }
    if (base64.length > MAX_BASE64_CHARS) {
      return NextResponse.json({ error: 'Image too large. Try a smaller screenshot or crop it.' }, { status: 400 })
    }

    const holdings = await parseHoldingsFromImage(base64, mediaType)
    if (holdings.length === 0) {
      return NextResponse.json({ error: "Couldn't find any holdings in that screenshot. Try a clearer crop." }, { status: 422 })
    }

    return NextResponse.json({ holdings })
  } catch (err) {
    console.error('Screenshot parse error:', err)
    return NextResponse.json({ error: 'Failed to read screenshot. Try again.' }, { status: 500 })
  }
}
