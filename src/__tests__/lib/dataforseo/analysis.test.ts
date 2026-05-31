import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/supabase/vault', () => ({
  getDataForSeoCredentials: vi.fn().mockResolvedValue({ login: 'test', password: 'test' }),
}))
vi.mock('@/lib/dataforseo/cache', () => ({
  getCachedOrFetch: vi.fn(),
}))

import { lightAnalysisAction, standardAnalysisAction } from '@/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions'
import { createClient } from '@/lib/supabase/server'
import { getCachedOrFetch } from '@/lib/dataforseo/cache'

const mockCreateClient = vi.mocked(createClient)
const mockGetCachedOrFetch = vi.mocked(getCachedOrFetch)

// Valid UUID v4 format IDs for testing
const TEST_PROJECT_ID = '00000000-0000-0000-0000-000000000001'
const TEST_USER_ID = '00000000-0000-0000-0000-000000000002'
const TEST_RUN_ID = '00000000-0000-0000-0000-000000000003'

function buildSupabaseMock(overrides: Record<string, unknown> = {}) {
  const base = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: TEST_USER_ID } } }) },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    single: vi.fn().mockResolvedValue({ data: { id: TEST_PROJECT_ID, target_country: 'Turkey' } }),
    ...overrides,
  }
  return base
}

describe('lightAnalysisAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('concurrent guard — running job varsa error döner', async () => {
    const mock = buildSupabaseMock()
    // project ownership → success
    mock.single.mockResolvedValueOnce({ data: { id: TEST_PROJECT_ID, target_country: 'Turkey' } })
    // workflow_runs sorgusu: running job var
    mock.maybeSingle.mockResolvedValueOnce({ data: { id: TEST_RUN_ID } })
    mockCreateClient.mockResolvedValue(mock as never)
    const result = await lightAnalysisAction(TEST_PROJECT_ID)
    expect(result.success).toBe(false)
    expect((result as { success: false; error: string }).error).toContain('devam ediyor')
  })

  it('keyword yoksa error döner', async () => {
    const mock = buildSupabaseMock()
    // project ownership
    mock.single.mockResolvedValueOnce({ data: { id: TEST_PROJECT_ID, target_country: 'Turkey' } })
    // workflow_runs: no running job
    mock.maybeSingle.mockResolvedValueOnce({ data: null })
    // keywords: limit() sonrasında boş dizi
    mock.limit.mockResolvedValueOnce({ data: [] })
    mockCreateClient.mockResolvedValue(mock as never)
    mockGetCachedOrFetch.mockResolvedValue(null)
    const result = await lightAnalysisAction(TEST_PROJECT_ID)
    // keyword yok → error
    expect(result).toHaveProperty('success')
  })

  it('geçersiz UUID varsa error döner', async () => {
    const result = await lightAnalysisAction('not-a-valid-uuid')
    expect(result.success).toBe(false)
    expect((result as { success: false; error: string }).error).toContain('Geçersiz')
  })
})

describe('standardAnalysisAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('geçersiz UUID varsa error döner', async () => {
    const result = await standardAnalysisAction('not-a-valid-uuid')
    expect(result.success).toBe(false)
    expect((result as { success: false; error: string }).error).toContain('Geçersiz')
  })

  it('concurrent guard — running job varsa error döner', async () => {
    const mock = buildSupabaseMock()
    mock.single.mockResolvedValueOnce({ data: { id: TEST_PROJECT_ID, target_country: 'Turkey' } })
    mock.maybeSingle.mockResolvedValueOnce({ data: { id: TEST_RUN_ID } })
    mockCreateClient.mockResolvedValue(mock as never)
    const result = await standardAnalysisAction(TEST_PROJECT_ID)
    expect(result.success).toBe(false)
    expect((result as { success: false; error: string }).error).toContain('devam ediyor')
  })

  it('cluster yoksa error döner', async () => {
    const mock = buildSupabaseMock()
    mock.single.mockResolvedValueOnce({ data: { id: TEST_PROJECT_ID, target_country: 'Turkey' } })
    mock.maybeSingle.mockResolvedValueOnce({ data: null }) // no running job
    // keyword_clusters.limit() → boş dizi
    mock.limit.mockResolvedValueOnce({ data: [] })
    mockCreateClient.mockResolvedValue(mock as never)
    const result = await standardAnalysisAction(TEST_PROJECT_ID)
    expect(result).toHaveProperty('success')
  })
})
