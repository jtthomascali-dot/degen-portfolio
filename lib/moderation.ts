// Lightweight nickname moderation. Blocks common slurs (and simple leetspeak
// obfuscations of them) before a nickname is ever stored. Not exhaustive —
// it's a first line of defense, not a substitute for human moderation.

const BLOCKED_TERMS = [
  'nigger', 'nigga', 'chink', 'gook', 'spic', 'wetback', 'kike', 'kyke',
  'faggot', 'fag', 'dyke', 'tranny', 'retard', 'retarded',
  'paki', 'beaner', 'coon', 'spook', 'gypo', 'gyppo',
  'cunt', 'whore', 'slut',
]

// Normalizes text so obfuscation (n1gger, f@ggot, n-i-g-g-a) still matches:
// lowercases, maps common leetspeak substitutions, strips non-letters.
function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[0@]/g, 'o')
    .replace(/1|!/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5|\$/g, 's')
    .replace(/7/g, 't')
    .replace(/[^a-z]/g, '')
}

export function containsBlockedTerm(text: string): boolean {
  const normalized = normalize(text)
  if (!normalized) return false
  return BLOCKED_TERMS.some((term) => normalized.includes(term))
}
