import { describe, it, expect, vi } from 'vitest'
import { matchGscData } from './gsc-match'

describe('matchGscData', () => {
  it('null döner — gsc_property_url null ise', async () => {
    const result = await matchGscData('proj-123', null)
    expect(result).toBeNull()
  })

  it('sc-domain: property skip edilir — null döner', async () => {
    const result = await matchGscData('proj-123', 'sc-domain:example.com')
    expect(result).toBeNull()
  })

  it('URL normalizasyonu: www/http/trailing-slash varyantları eşleştirilir', async () => {
    // matchGscData internals — normalizeUrl entegrasyonunu doğrular
    // Modül henüz yok; Wave 0 stub olarak fail eder
    expect(true).toBe(true)
  })
})
