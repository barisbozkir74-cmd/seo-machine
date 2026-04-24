import type { ParsedKeyword } from './parser'

export type Cluster = {
  name: string
  totalVolume: number
  keywords: ParsedKeyword[]
}

// Returns true if keyword shares enough significant words with headKeyword
export function overlapsWithCluster(keyword: string, headKeyword: string): boolean {
  const keywordWords = getSignificantWords(keyword)
  const headWords = getSignificantWords(headKeyword)
  if (keywordWords.size === 0 || headWords.size === 0) return false

  let matchCount = 0
  for (const word of keywordWords) {
    if (headWords.has(word)) matchCount++
  }

  const smallerSize = Math.min(keywordWords.size, headWords.size)
  return matchCount / smallerSize >= 0.5
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
  'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 've', 'de', 'bir', 'bu', 'ile', 'için',
  'ne', 'mi', 'mı', 'mu', 'mü', 'da', 'de',
])

// Returns significant words (filtered stop words, 3+ chars)
export function getSignificantWords(keyword: string): Set<string> {
  return new Set(
    keyword
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
  )
}

// Original clustering function — used by importKeywords action (ParsedKeyword-based)
export function clusterKeywords(keywords: ParsedKeyword[]): Cluster[] {
  if (keywords.length === 0) return []

  // Sort by volume descending (null volume = 0)
  const sorted = [...keywords].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))

  const clusters: Array<{ head: ParsedKeyword; members: ParsedKeyword[] }> = []
  const assigned = new Set<string>()

  for (const kw of sorted) {
    if (assigned.has(kw.keyword)) continue

    let placed = false
    for (const cluster of clusters) {
      if (overlapsWithCluster(kw.keyword, cluster.head.keyword)) {
        cluster.members.push(kw)
        assigned.add(kw.keyword)
        placed = true
        break
      }
    }

    if (!placed) {
      clusters.push({ head: kw, members: [kw] })
      assigned.add(kw.keyword)
    }
  }

  return clusters.map((c) => ({
    name: c.head.keyword,
    totalVolume: c.members.reduce((sum, k) => sum + (k.volume ?? 0), 0),
    keywords: c.members,
  }))
}

// ─── Phase 6: Intent-First Clustering for DB keywords ────────────────────────

export type ClusterInput = {
  id: string
  keyword: string
  volume: number | null
  difficulty: number | null
  cpc: number | null
  search_intent: string | null
}

export type ClusterResult = {
  name: string        // "${head_keyword} (${intent})" — Pitfall 3: UNIQUE constraint önleme
  intent: string | null
  totalVolume: number
  keywords: ClusterInput[]
}

export function clusterEnrichedKeywords(keywords: ClusterInput[]): ClusterResult[] {
  if (keywords.length === 0) return []

  // Adım 1: intent gruplaması
  const intentGroups = new Map<string, ClusterInput[]>()
  for (const kw of keywords) {
    const intent = kw.search_intent?.toLowerCase() ?? 'unknown'
    if (!intentGroups.has(intent)) intentGroups.set(intent, [])
    intentGroups.get(intent)!.push(kw)
  }

  const results: ClusterResult[] = []

  for (const [intent, group] of intentGroups) {
    // Intent grubu içinde volume azalan sıralama
    const sorted = [...group].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))

    // Alt kümeleme: mevcut overlapsWithCluster algoritması ile
    const subClusters: Array<{ head: ClusterInput; members: ClusterInput[] }> = []
    const assigned = new Set<string>()

    for (const kw of sorted) {
      if (assigned.has(kw.keyword)) continue

      let placed = false
      for (const sc of subClusters) {
        if (overlapsWithCluster(kw.keyword, sc.head.keyword)) {
          sc.members.push(kw)
          assigned.add(kw.keyword)
          placed = true
          break
        }
      }

      if (!placed) {
        subClusters.push({ head: kw, members: [kw] })
        assigned.add(kw.keyword)
      }
    }

    for (const sc of subClusters) {
      const members = sc.members.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      const totalVolume = members.reduce((sum, k) => sum + (k.volume ?? 0), 0)
      results.push({
        name: `${sc.head.keyword} (${intent})`,   // Pitfall 3: intent suffix
        intent,
        totalVolume,
        keywords: members,
      })
    }
  }

  // Toplam volume azalan sıralama
  return results.sort((a, b) => b.totalVolume - a.totalVolume)
}
