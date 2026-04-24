import { describe, it, expect } from 'vitest'
import { calculateOpportunityScore, buildScoringContext, INTENT_MULTIPLIERS } from './scoring'

const ctx = { maxVolume: 10000, maxCpc: 5.0 }

describe('calculateOpportunityScore', () => {
  it('returns a number between 0 and 100', () => {
    const score = calculateOpportunityScore(
      { volume: 5000, cpc: 2.5, difficulty: 30, search_intent: 'commercial' },
      ctx
    )
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('transactional scores higher than commercial for identical keyword data', () => {
    const base = { volume: 5000, cpc: 2.5, difficulty: 40 }
    const transactional = calculateOpportunityScore({ ...base, search_intent: 'transactional' }, ctx)
    const commercial    = calculateOpportunityScore({ ...base, search_intent: 'commercial' }, ctx)
    expect(transactional).toBeGreaterThan(commercial)
  })

  it('low difficulty scores higher than high difficulty', () => {
    const base = { volume: 5000, cpc: 2.5, search_intent: 'commercial' }
    const easy = calculateOpportunityScore({ ...base, difficulty: 10 }, ctx)
    const hard = calculateOpportunityScore({ ...base, difficulty: 90 }, ctx)
    expect(easy).toBeGreaterThan(hard)
  })

  it('handles all-null inputs without throwing', () => {
    const score = calculateOpportunityScore(
      { volume: null, cpc: null, difficulty: null, search_intent: null },
      { maxVolume: 0, maxCpc: 0 }
    )
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('returns 1 decimal precision', () => {
    const score = calculateOpportunityScore(
      { volume: 3333, cpc: 1.77, difficulty: 45, search_intent: 'informational' },
      ctx
    )
    expect(score.toString()).toMatch(/^\d+(\.\d)?$/)
  })
})

describe('buildScoringContext', () => {
  it('returns maxVolume and maxCpc from array', () => {
    const result = buildScoringContext([
      { volume: 1000, cpc: 2.0 },
      { volume: 5000, cpc: 1.5 },
      { volume: null, cpc: null },
    ])
    expect(result.maxVolume).toBe(5000)
    expect(result.maxCpc).toBe(2.0)
  })

  it('returns zeros for empty array', () => {
    const result = buildScoringContext([])
    expect(result.maxVolume).toBe(0)
    expect(result.maxCpc).toBe(0)
  })
})

// INTENT_MULTIPLIERS export kontrolü
describe('INTENT_MULTIPLIERS', () => {
  it('transactional has higher multiplier than commercial', () => {
    expect(INTENT_MULTIPLIERS.transactional).toBeGreaterThan(INTENT_MULTIPLIERS.commercial)
  })
})
