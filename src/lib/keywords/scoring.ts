// Pure math — no imports needed

export const INTENT_MULTIPLIERS: Record<string, number> = {
  transactional: 1.0,
  commercial:    0.85,
  informational: 0.5,
  navigational:  0.3,
  unknown:       0.5,
}

function normalizeVolume(volume: number, maxVolume: number): number {
  if (maxVolume === 0) return 0
  return Math.min(volume / maxVolume, 1)
}

function normalizeCpc(cpc: number, maxCpc: number): number {
  if (maxCpc === 0) return 0
  return Math.min(cpc / maxCpc, 1)
}

export function calculateOpportunityScore(
  keyword: {
    volume: number | null
    cpc: number | null
    difficulty: number | null
    search_intent: string | null
  },
  context: { maxVolume: number; maxCpc: number }
): number {
  const volumeScore = normalizeVolume(keyword.volume ?? 0, context.maxVolume)
  const cpcScore    = normalizeCpc(keyword.cpc ?? 0, context.maxCpc)
  const kdScore     = (100 - (keyword.difficulty ?? 50)) / 100
  const intentMult  = INTENT_MULTIPLIERS[keyword.search_intent?.toLowerCase() ?? 'unknown'] ?? 0.5

  const raw = (volumeScore * 0.40) + (cpcScore * 0.25) + (kdScore * 0.15) + (intentMult * 0.20)
  return Math.round(raw * 100 * 10) / 10  // 0-100, 1 decimal
}

export function buildScoringContext(
  keywords: Array<{ volume: number | null; cpc: number | null }>
): { maxVolume: number; maxCpc: number } {
  return {
    maxVolume: Math.max(...keywords.map((k) => k.volume ?? 0), 0),
    maxCpc:    Math.max(...keywords.map((k) => k.cpc ?? 0), 0),
  }
}
