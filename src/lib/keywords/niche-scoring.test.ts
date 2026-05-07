import { describe, it, expect } from 'vitest'
import { calculateNicheScore, classifyRevenueType } from './niche-scoring'

describe('calculateNicheScore', () => {
  it('boş keyword listesi için 0 döner', () => {
    expect(calculateNicheScore([], { maxClusterVolume: 1000, maxCpc: 5 })).toBe(0)
  })

  it('3 bileşenli formülle 0-100 aralığında skor döner', () => {
    const keywords = [
      { volume: 500, cpc: 2.5, difficulty: 30, search_intent: 'commercial' },
      { volume: 300, cpc: 1.5, difficulty: 40, search_intent: 'transactional' },
    ]
    const score = calculateNicheScore(keywords, { maxClusterVolume: 1000, maxCpc: 5 })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
    // volumeScore = 800/1000 = 0.8; competitionScore = (100-35)/100 = 0.65; cpcScore = 2/5 = 0.4
    // raw = (0.8*0.4) + (0.65*0.35) + (0.4*0.25) = 0.32 + 0.2275 + 0.10 = 0.6475 → 64.8
    expect(score).toBeCloseTo(64.8, 0)
  })
})

describe('classifyRevenueType', () => {
  it('boş array için mixed döner', () => {
    expect(classifyRevenueType([])).toBe('mixed')
  })

  it('çoğunluk informational için bilgi döner', () => {
    const keywords = [
      { volume: null, cpc: null, difficulty: null, search_intent: 'informational' },
      { volume: null, cpc: null, difficulty: null, search_intent: 'informational' },
      { volume: null, cpc: null, difficulty: null, search_intent: 'commercial' },
    ]
    expect(classifyRevenueType(keywords)).toBe('bilgi')
  })

  it('çoğunluk commercial/transactional için ticari döner', () => {
    const keywords = [
      { volume: null, cpc: null, difficulty: null, search_intent: 'commercial' },
      { volume: null, cpc: null, difficulty: null, search_intent: 'transactional' },
      { volume: null, cpc: null, difficulty: null, search_intent: 'informational' },
    ]
    expect(classifyRevenueType(keywords)).toBe('ticari')
  })

  it('karma dağılım için mixed döner', () => {
    const keywords = [
      { volume: null, cpc: null, difficulty: null, search_intent: 'informational' },
      { volume: null, cpc: null, difficulty: null, search_intent: 'commercial' },
    ]
    expect(classifyRevenueType(keywords)).toBe('mixed')
  })
})
