import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function getScoreColor(score: number): string {
  if (score < 20) return 'text-[#3FCF8E]'
  if (score < 40) return 'text-[#3FCF8E]'
  if (score < 60) return 'text-[#F5A623]'
  if (score < 80) return 'text-[#F5A623]'
  return 'text-[#FF4438]'
}

export function getScoreBg(score: number): string {
  if (score < 20) return 'bg-green-400'
  if (score < 40) return 'bg-blue-400'
  if (score < 60) return 'bg-yellow-400'
  if (score < 80) return 'bg-orange-400'
  return 'bg-red-400'
}

export function getClassificationColor(classification: string): string {
  const c = classification.toLowerCase()
  if (c.includes('safe') || c.includes('boomer')) return 'text-green-400 bg-green-400/10 border-green-400/20'
  if (c.includes('solid') || c.includes('growth')) return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
  if (c.includes('spicy')) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
  if (c.includes('degen') || c.includes('ape')) return 'text-red-400 bg-red-400/10 border-red-400/20'
  return 'text-purple-400 bg-purple-400/10 border-purple-400/20'
}

export function getSpectrumSegment(score: number): number {
  return Math.min(4, Math.floor(score / 21))
}

export const SPECTRUM_LABELS = [
  { label: 'Warren Buffett', emoji: '🧓', range: '0–20' },
  { label: 'Boomer',         emoji: '📊', range: '21–40' },
  { label: 'Mid',            emoji: '😐', range: '41–60' },
  { label: 'Spicy',          emoji: '🌶️', range: '61–80' },
  { label: 'Full Ape',       emoji: '🦍', range: '81–100' },
]

export function generateShareId(): string {
  return Math.random().toString(36).substring(2, 10)
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}
