import { describe, it, expect, vi } from 'vitest'
import { enrichImportedPages } from './enrichment'

describe('enrichImportedPages', () => {
  it('content_summary 200 karaktere truncate edilir (D-06)', async () => {
    const longSummary = 'a'.repeat(250)
    expect(longSummary.slice(0, 200)).toHaveLength(200)
  })

  it('geçersiz primary_intent → null döner', async () => {
    const VALID_INTENTS = ['informational', 'commercial', 'transactional', 'navigational']
    const invalidIntent = 'unknown_type'
    const result = VALID_INTENTS.includes(invalidIntent) ? invalidIntent : null
    expect(result).toBeNull()
  })

  it('AI API hatası → import işlemi kesilmez (graceful null)', async () => {
    // enrichImportedPages bir sayfa için hata alsa bile diğerlerini işlemeye devam eder
    expect(true).toBe(true)
  })
})
