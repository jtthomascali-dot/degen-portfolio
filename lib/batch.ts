// lib/batch.ts
// Pure, dependency-free helpers for the re-roast endpoints (so they can be unit
// tested without pulling in the SDK / network code).

import type { HoldingInput } from './marketData'

// Rebuild the original {ticker, allocation} inputs from a saved analysis row's
// holdings JSON. Tolerates malformed / partial entries.
export function reconstructHoldings(stored: unknown): HoldingInput[] {
  const arr = Array.isArray(stored) ? stored : []
  return arr
    .map((h: { ticker?: unknown; allocation?: unknown }) => ({
      ticker: String(h?.ticker ?? '').toUpperCase().trim(),
      allocation: Number(h?.allocation) || 0,
    }))
    .filter((h) => h.ticker.length > 0 && h.allocation > 0)
}

// Pick rows that haven't been refreshed within `staleMs` (so a daily cron skips
// anything a user already re-roasted recently, saving LLM + API calls).
export function selectStaleTargets<T extends { refreshed_at?: string | null }>(
  rows: T[],
  staleMs: number,
  now: number = Date.now()
): T[] {
  const cutoff = now - staleMs
  return rows.filter((r) => {
    if (!r.refreshed_at) return true
    const t = new Date(r.refreshed_at).getTime()
    return !isFinite(t) || t < cutoff
  })
}
