import { describe, it, expect } from 'vitest'
import { clusterEnrichedKeywords, type ClusterInput } from './clustering'

function kw(overrides: Partial<ClusterInput> & { keyword: string }): ClusterInput {
  return {
    id: Math.random().toString(),
    volume: 1000,
    difficulty: 30,
    cpc: 1.5,
    search_intent: 'informational',
    ...overrides,
  }
}

describe('clusterEnrichedKeywords', () => {
  it('returns empty array for empty input', () => {
    expect(clusterEnrichedKeywords([])).toEqual([])
  })

  it('separates keywords by intent into different clusters', () => {
    const keywords = [
      kw({ keyword: 'istanbul seo', search_intent: 'commercial', volume: 5000 }),
      kw({ keyword: 'seo nedir', search_intent: 'informational', volume: 3000 }),
    ]
    const clusters = clusterEnrichedKeywords(keywords)
    const intents = clusters.map((c) => c.intent)
    expect(intents).toContain('commercial')
    expect(intents).toContain('informational')
  })

  it('cluster name uses "${head_keyword} (${intent})" format', () => {
    const keywords = [kw({ keyword: 'seo ajansı', search_intent: 'commercial', volume: 8000 })]
    const clusters = clusterEnrichedKeywords(keywords)
    expect(clusters[0].name).toBe('seo ajansı (commercial)')
  })

  it('assigns null intent keyword to "unknown" group', () => {
    const keywords = [kw({ keyword: 'test keyword', search_intent: null })]
    const clusters = clusterEnrichedKeywords(keywords)
    expect(clusters[0].intent).toBe('unknown')
    expect(clusters[0].name).toContain('(unknown)')
  })

  it('groups text-similar keywords within same intent', () => {
    const keywords = [
      kw({ keyword: 'istanbul seo ajans', search_intent: 'commercial', volume: 5000 }),
      kw({ keyword: 'istanbul seo hizmet', search_intent: 'commercial', volume: 3000 }),
      kw({ keyword: 'ankara dijital pazarlama', search_intent: 'commercial', volume: 2000 }),
    ]
    const clusters = clusterEnrichedKeywords(keywords)
    // istanbul seo keywords should cluster together
    const istanbulCluster = clusters.find((c) => c.name.includes('istanbul'))
    expect(istanbulCluster?.keywords.length).toBeGreaterThanOrEqual(2)
  })

  it('a keyword belongs to at most one cluster (no duplication)', () => {
    const keywords = [
      kw({ keyword: 'seo nedir', search_intent: 'informational', volume: 4000 }),
      kw({ keyword: 'seo ne demek', search_intent: 'informational', volume: 2000 }),
      kw({ keyword: 'dijital pazarlama', search_intent: 'commercial', volume: 3000 }),
    ]
    const clusters = clusterEnrichedKeywords(keywords)
    const allKeywordIds = clusters.flatMap((c) => c.keywords.map((k) => k.id))
    const uniqueIds = new Set(allKeywordIds)
    expect(uniqueIds.size).toBe(allKeywordIds.length)
  })

  it('sorts clusters by totalVolume descending', () => {
    const keywords = [
      kw({ keyword: 'düşük volume', search_intent: 'navigational', volume: 100 }),
      kw({ keyword: 'yüksek volume', search_intent: 'transactional', volume: 9000 }),
    ]
    const clusters = clusterEnrichedKeywords(keywords)
    expect(clusters[0].totalVolume).toBeGreaterThanOrEqual(clusters[1]?.totalVolume ?? 0)
  })
})

// Phase 20 — D-07: clusterAndScoreKeywords status='draft' yazma kontrolü
// Bu test mocked değil; clusterAndScoreKeywords server action gerektirdiğinden
// burada sadece clusterEnrichedKeywords çıktı yapısının 'status' içermediğini
// (clustering.ts layer'ında) ve action layer'ında eklendiğini belgelemek için
// bir smoke test eklenir:
describe('clusterEnrichedKeywords output — no status field (status is set in action layer)', () => {
  it('clusterEnrichedKeywords sonucu status alanı taşımaz — status actions.ts tarafından eklenir', () => {
    // clustering.ts'den gelen ClusterResult tipinde 'status' yok; doğru mimari
    const result = clusterEnrichedKeywords([
      { id: '1', keyword: 'test keyword', volume: 100, difficulty: 30, cpc: 1.0, search_intent: 'informational' },
    ])
    // ClusterResult'ın 'status' property'si yok; actions.ts upsert'inde eklenir
    expect(result[0]).not.toHaveProperty('status')
  })
})
