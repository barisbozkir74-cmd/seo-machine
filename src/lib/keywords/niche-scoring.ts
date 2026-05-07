// Pure math — no imports needed
// Cluster-level niche scoring (keyword-level scoring.ts'in cluster adaptasyonu)

export type ClusterKeywordData = {
  volume: number | null
  cpc: number | null
  difficulty: number | null
  search_intent: string | null
}

/**
 * Cluster-level niche selection skoru.
 * Formül: (volumeScore * 0.4) + (competitionScore * 0.35) + (cpcScore * 0.25)
 * Tüm bileşenler min-max normalize (0–1), sonuç 0–100 aralığında 1 decimal.
 *
 * @param keywords - Cluster'daki tüm keyword'ler
 * @param context  - Proje geneli max değerler (normalizasyon için)
 */
export function calculateNicheScore(
  keywords: ClusterKeywordData[],
  context: { maxClusterVolume: number; maxCpc: number }
): number {
  if (keywords.length === 0) return 0

  const totalVolume = keywords.reduce((s, k) => s + (k.volume ?? 0), 0)
  const avgDifficulty = keywords.reduce((s, k) => s + (k.difficulty ?? 50), 0) / keywords.length
  const avgCpc = keywords.reduce((s, k) => s + (k.cpc ?? 0), 0) / keywords.length

  const volumeScore = context.maxClusterVolume > 0
    ? Math.min(totalVolume / context.maxClusterVolume, 1)
    : 0
  const competitionScore = (100 - avgDifficulty) / 100  // düşük KD = iyi
  const cpcScore = context.maxCpc > 0
    ? Math.min(avgCpc / context.maxCpc, 1)
    : 0

  const raw = (volumeScore * 0.4) + (competitionScore * 0.35) + (cpcScore * 0.25)
  return Math.round(raw * 100 * 10) / 10  // 0-100, 1 decimal
}

/**
 * Cluster'daki keyword'lerin search_intent dağılımına göre revenue tipi atar.
 * - Çoğunluk (>50%) informational → 'bilgi'
 * - Çoğunluk (>50%) commercial veya transactional → 'ticari'
 * - Karma → 'mixed'
 */
export function classifyRevenueType(
  keywords: ClusterKeywordData[]
): 'bilgi' | 'mixed' | 'ticari' {
  if (keywords.length === 0) return 'mixed'

  let informational = 0
  let commercial = 0

  for (const kw of keywords) {
    const intent = kw.search_intent?.toLowerCase() ?? ''
    if (intent === 'informational') informational++
    else if (intent === 'commercial' || intent === 'transactional') commercial++
  }

  const total = keywords.length
  if (informational / total > 0.5) return 'bilgi'
  if (commercial / total > 0.5) return 'ticari'
  return 'mixed'
}
