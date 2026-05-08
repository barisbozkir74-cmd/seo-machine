import { describe, it, expect } from 'vitest'
import { runKeywordAcquisition, type AcquisitionInput, type AcquisitionResult } from './ai-acquisition'

describe('ai-acquisition (Wave 0 scaffold)', () => {
  it('export contract: runKeywordAcquisition is a function', () => {
    expect(typeof runKeywordAcquisition).toBe('function')
  })

  it('skeleton throws "Not implemented" until Plan 03 lands', async () => {
    const input: AcquisitionInput = { projectId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }
    await expect(runKeywordAcquisition(input)).rejects.toThrow(/Not implemented/)
  })

  it.skip('TODO Plan 03: upsertKeywordPool uses ignoreDuplicates:true so manual rows keep their source', async () => {
    // Plan 03 implementation lands → bu test enable edilir.
    // Beklenen: önce 'manual' source ile satır insert; sonra aynı keyword için 'competitor' source upsert;
    // SELECT source — hâlâ 'manual' olmalı (ignoreDuplicates: true).
    expect(true).toBe(false)
  })

  it('AcquisitionResult shape sanity', () => {
    const sample: AcquisitionResult = { competitorCount: 0, expansionCount: 0, totalAdded: 0 }
    expect(sample.competitorCount + sample.expansionCount).toBe(sample.totalAdded)
  })
})
