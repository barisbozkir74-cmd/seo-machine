import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type AcquisitionResult } from './ai-acquisition'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/vault', () => ({
  getDataForSeoCredentials: vi.fn().mockResolvedValue({ login: 'test', password: 'test' }),
}))

vi.mock('@/lib/dataforseo/client', () => ({
  fetchRankedKeywords: vi.fn().mockResolvedValue([]),
  fetchRelatedKeywords: vi.fn().mockResolvedValue([]),
  fetchKeywordData: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/dataforseo/location-map', () => ({
  resolveLocation: vi.fn().mockReturnValue({ locationCode: 2792, languageCode: 'tr' }),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Infinite-chain proxy: her method kendini döndürür, `await` için then/Symbol.toPrimitive yok;
 * en sonda resolveWith olan thenable olur.
 */
function makeQueryChain(resolveWith: unknown) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (onFulfilled: (v: unknown) => void) => Promise.resolve(resolveWith).then(onFulfilled)
      }
      // Her method chain döndürür
      return (..._args: unknown[]) => new Proxy({}, handler)
    },
  }
  return new Proxy({}, handler)
}

/**
 * upsert chain: .upsert(rows, opts) → .select() → resolveWith
 */
function makeUpsertChain(upsertResult: unknown) {
  return {
    upsert: vi.fn((_rows: unknown, _opts: unknown) => makeQueryChain(upsertResult)),
    select: vi.fn(() => makeQueryChain(upsertResult)),
    update: vi.fn(() => makeQueryChain({ error: null })),
  }
}

/**
 * Basit from() mock factory.
 * table adına göre farklı chain döner.
 */
function buildMockSupabase({
  projectData = { target_country: 'turkey', target_language: 'turkish' },
  competitorData = [] as Array<{ domain: string }>,
  manualKeywordData = [] as Array<{ keyword: string; volume: number | null }>,
  pendingEnrichData = [] as Array<{ keyword: string }>,
  upsertData = [] as Array<{ id: string }>,
} = {}) {
  const upsertSpy = vi.fn((_rows: unknown, opts: unknown) =>
    makeQueryChain({ data: upsertData, error: null })
  )

  const fromSpy = vi.fn((table: string) => {
    if (table === 'projects') {
      return makeQueryChain({ data: projectData, error: null })
    }
    if (table === 'competitors') {
      return makeQueryChain({ data: competitorData, error: null })
    }
    if (table === 'keywords') {
      return {
        select: vi.fn(() => makeQueryChain({ data: manualKeywordData, error: null })),
        upsert: upsertSpy,
        update: vi.fn(() => makeQueryChain({ error: null })),
      }
    }
    return makeQueryChain({ data: null, error: null })
  })

  return { from: fromSpy, upsertSpy }
}

// Import the module under test AFTER mocks
const { createClient } = await import('@supabase/supabase-js')
const { fetchRankedKeywords, fetchRelatedKeywords, fetchKeywordData } = await import('@/lib/dataforseo/client')
const { runKeywordAcquisition } = await import('./ai-acquisition')

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ai-acquisition (Plan 03 implementation)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('export contract: runKeywordAcquisition is a function', () => {
    expect(typeof runKeywordAcquisition).toBe('function')
  })

  it('AcquisitionResult shape sanity', () => {
    const sample: AcquisitionResult = { competitorCount: 0, expansionCount: 0, totalAdded: 0 }
    expect(sample.competitorCount + sample.expansionCount).toBe(sample.totalAdded)
  })

  it('upsertKeywordPool ignoreDuplicates:true ile çağrılır (manual source korunur — KWST-05)', async () => {
    const { from, upsertSpy } = buildMockSupabase({
      competitorData: [{ domain: 'example.com' }],
      upsertData: [{ id: 'kw1' }],
    })
    vi.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<typeof createClient>)
    vi.mocked(fetchRankedKeywords).mockResolvedValue([
      { keyword: 'test keyword', location_code: 2792, keyword_data: { keyword_info: { search_volume: 100, cpc: 0.5 } } },
    ])

    await runKeywordAcquisition({
      projectId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    })

    // upsert en az bir kez çağrıldı
    expect(upsertSpy).toHaveBeenCalled()
    // Her çağrıda ignoreDuplicates: true var
    for (const call of upsertSpy.mock.calls) {
      const opts = call[1] as Record<string, unknown>
      expect(opts).toEqual(
        expect.objectContaining({ onConflict: 'project_id,keyword', ignoreDuplicates: true })
      )
    }
  })

  it('rakip cap: 6 rakip varsa fetchRankedKeywords en fazla 5 kez çağrılır (Tuzak 2)', async () => {
    const sixDomains = Array.from({ length: 6 }, (_, i) => ({ domain: `domain${i}.com` }))

    const { from } = buildMockSupabase({
      competitorData: sixDomains,
      upsertData: [],
    })
    vi.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<typeof createClient>)
    vi.mocked(fetchRankedKeywords).mockResolvedValue([])

    await runKeywordAcquisition({
      projectId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    })

    // 6 rakip olmasına rağmen MAX_COMPETITORS=5 cap'i nedeniyle en fazla 5 kez çağrılmalı
    const callCount = vi.mocked(fetchRankedKeywords).mock.calls.length
    expect(callCount).toBeLessThanOrEqual(5)
    expect(callCount).toBeGreaterThan(0)
  })

  it('fetchRelatedKeywords throw ederse expansionCount === 0, exception fırlatmaz (silent fail)', async () => {
    const { from } = buildMockSupabase({
      competitorData: [{ domain: 'example.com' }],
      manualKeywordData: [{ keyword: 'seed keyword', volume: 500 }],
      upsertData: [{ id: 'kw1' }],
    })
    vi.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<typeof createClient>)
    vi.mocked(fetchRankedKeywords).mockResolvedValue([
      { keyword: 'competitor kw', location_code: 2792, keyword_data: { keyword_info: { search_volume: 100 } } },
    ])
    vi.mocked(fetchRelatedKeywords).mockRejectedValue(new Error('API timeout'))

    // Exception fırlatmamalı
    const result = await runKeywordAcquisition({
      projectId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    })

    expect(result.expansionCount).toBe(0)
    expect(result).toHaveProperty('competitorCount')
    expect(result).toHaveProperty('totalAdded')
  })

  it('fetchKeywordData (enrichment) throw ederse runKeywordAcquisition başarılı sayılır', async () => {
    const { from } = buildMockSupabase({
      competitorData: [{ domain: 'example.com' }],
      pendingEnrichData: [{ keyword: 'enrich me' }],
      upsertData: [{ id: 'kw1' }, { id: 'kw2' }],
    })
    vi.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<typeof createClient>)
    vi.mocked(fetchRankedKeywords).mockResolvedValue([
      { keyword: 'test kw', location_code: 2792, keyword_data: { keyword_info: { search_volume: 200 } } },
    ])
    vi.mocked(fetchKeywordData).mockRejectedValue(new Error('Enrichment API error'))

    // Exception fırlatmamalı — enrichment sessiz fail
    const result = await runKeywordAcquisition({
      projectId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    })

    expect(result.totalAdded).toBeGreaterThanOrEqual(0)
    expect(result).toHaveProperty('competitorCount')
    expect(result).toHaveProperty('expansionCount')
  })
})
