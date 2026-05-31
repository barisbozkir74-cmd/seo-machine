import { describe, it, expect, vi, beforeEach } from 'vitest'

// server-only mock — ZORUNLU (20-01 kararı)
vi.mock('server-only', () => ({}))

// orchestrator mock — getCachedOrFetch bunu sarmalar
vi.mock('@/lib/dataforseo/orchestrator', () => ({
  fetchWithCache: vi.fn(),
  makeFingerprint: vi.fn((_spec: unknown) => 'test-fingerprint'),
}))

import { getCachedOrFetch } from '@/lib/dataforseo/cache'
import { fetchWithCache } from '@/lib/dataforseo/orchestrator'

const mockFetchWithCache = vi.mocked(fetchWithCache)

describe('getCachedOrFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cache hit durumunda fromCache: true döndürür', async () => {
    mockFetchWithCache.mockResolvedValueOnce({
      data: { volume: 1000 },
      fromCache: true,
      skipped: false,
    })
    const result = await getCachedOrFetch({
      projectId: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000002',
      spec: {
        module: 'keyword_stratejisi',
        endpoint: 'keyword_data/search_volume',
        target: { type: 'keywords', value: ['seo'] },
        locationCode: 2792,
        languageCode: 'tr',
      },
      fetcher: vi.fn(),
    })
    expect(result).toEqual({ data: { volume: 1000 }, fromCache: true })
  })

  it('cache miss durumunda fromCache: false döndürür', async () => {
    mockFetchWithCache.mockResolvedValueOnce({
      data: { volume: 500 },
      fromCache: false,
      skipped: false,
    })
    const result = await getCachedOrFetch({
      projectId: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000002',
      spec: {
        module: 'keyword_stratejisi',
        endpoint: 'keyword_data/search_volume',
        target: { type: 'keywords', value: ['seo'] },
        locationCode: 2792,
        languageCode: 'tr',
      },
      fetcher: vi.fn(),
    })
    expect(result).toEqual({ data: { volume: 500 }, fromCache: false })
  })

  it('skipped: true olunca null döndürür', async () => {
    mockFetchWithCache.mockResolvedValueOnce({
      data: null,
      fromCache: false,
      skipped: true,
      reason: 'BUDGET_EXCEEDED',
    })
    const result = await getCachedOrFetch({
      projectId: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000002',
      spec: {
        module: 'keyword_stratejisi',
        endpoint: 'keyword_data/search_volume',
        target: { type: 'keywords', value: ['seo'] },
        locationCode: 2792,
        languageCode: 'tr',
      },
      fetcher: vi.fn(),
    })
    expect(result).toBeNull()
  })
})
