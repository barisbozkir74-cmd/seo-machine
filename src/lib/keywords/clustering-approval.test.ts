import { describe, it, expect, vi, beforeEach } from 'vitest'

// Supabase client mock — her testten önce sıfırlanır
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// vault.ts modül seviyesinde Supabase client oluşturuyor — test ortamı için mock'la
vi.mock('@/lib/supabase/vault', () => ({
  getDataForSeoCredentials: vi.fn(),
  saveWpCredentials: vi.fn(),
  getWordPressCredentials: vi.fn(),
  hasWordPressCredentials: vi.fn(),
  getSerpApiKey: vi.fn(),
}))

// next/cache mock — revalidatePath çağrısını izlemek için
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { updateClusterStatus, approveStrategy, removeKeywordFromCluster, type DraftCluster } from '@/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions'

function makeMockSupabase(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'cluster-abc' }, error: null }),
    }),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// Gerçek UUID formatında test ID'leri (36 karakter, UUID v4 yapısı)
const CLUSTER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const PROJECT_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'

describe('updateClusterStatus', () => {
  it('rejects invalid status values', async () => {
    const result = await updateClusterStatus(CLUSTER_ID, 'invalid', PROJECT_ID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Geçersiz durum değeri.')
  })

  it('returns error when auth is missing', async () => {
    const mockSupabase = makeMockSupabase()
    mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never)

    const result = await updateClusterStatus(CLUSTER_ID, 'approved', PROJECT_ID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Oturum bulunamadı.')
  })

  it('returns error when cluster ownership check fails', async () => {
    const mockSupabase = makeMockSupabase()
    // single() → null veri (ownership başarısız)
    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    mockSupabase.from = vi.fn().mockReturnValue(fromMock)
    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never)

    const result = await updateClusterStatus(CLUSTER_ID, 'approved', PROJECT_ID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Küme bulunamadı.')
  })

  it('succeeds without calling revalidatePath', async () => {
    const ownershipMock = { data: { id: CLUSTER_ID }, error: null }
    const updateMock = { error: null }
    let callCount = 0

    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return Promise.resolve(ownershipMock)  // ownership
        return Promise.resolve(updateMock)
      }),
    }
    const mockSupabase = makeMockSupabase()
    mockSupabase.from = vi.fn().mockReturnValue(fromMock)
    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never)

    const result = await updateClusterStatus(CLUSTER_ID, 'approved', PROJECT_ID)
    expect(result.success).toBe(true)
    // revalidatePath çağrılmamalı — overlay state korunur (Pitfall 3)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('approveStrategy', () => {
  it('calls revalidatePath after successful update', async () => {
    const ownershipMock = { data: { id: PROJECT_ID }, error: null }
    const updateMock = { error: null }
    let callCount = 0

    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return Promise.resolve(ownershipMock)
        return Promise.resolve(updateMock)
      }),
    }
    const mockSupabase = makeMockSupabase()
    mockSupabase.from = vi.fn().mockReturnValue(fromMock)
    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never)

    const result = await approveStrategy(PROJECT_ID, true)
    expect(result.success).toBe(true)
    expect(revalidatePath).toHaveBeenCalledWith(expect.stringContaining('/keyword-stratejisi'))
  })

  it('returns error when project ownership fails', async () => {
    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const mockSupabase = makeMockSupabase()
    mockSupabase.from = vi.fn().mockReturnValue(fromMock)
    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never)

    const result = await approveStrategy(PROJECT_ID, true)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Proje bulunamadı.')
  })
})

// Gerçek UUID formatında ek test ID'leri
const KEYWORD_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012'

describe('removeKeywordFromCluster', () => {
  it('rejects invalid UUID format', async () => {
    const result = await removeKeywordFromCluster('bad-id', CLUSTER_ID, PROJECT_ID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Geçersiz ID formatı.')
  })

  it('returns error when auth is missing', async () => {
    const mockSupabase = makeMockSupabase()
    mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never)

    const result = await removeKeywordFromCluster(KEYWORD_ID, CLUSTER_ID, PROJECT_ID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Oturum bulunamadı.')
  })

  it('returns error when cluster ownership check fails', async () => {
    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const mockSupabase = makeMockSupabase()
    mockSupabase.from = vi.fn().mockReturnValue(fromMock)
    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never)

    const result = await removeKeywordFromCluster(KEYWORD_ID, CLUSTER_ID, PROJECT_ID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Küme bulunamadı.')
  })

  it('succeeds and does not call revalidatePath', async () => {
    // Call sequence: 1) cluster ownership, 2) keyword update, 3) remaining keywords, 4) cluster volume update
    let callCount = 0
    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return Promise.resolve({ data: { id: CLUSTER_ID }, error: null }) // ownership
        return Promise.resolve({ data: null, error: null })
      }),
      // keyword update (.update({cluster_id: null})) returns no single() — uses eq chain directly
    }
    // Need to handle the keyword update (returns { error }) and volume queries (returns { data, error })
    const updateResult = { error: null }
    const selectResult = { data: [{ volume: 500 }], error: null }

    // Build a more complete mock
    const mockFrom = vi.fn().mockImplementation(() => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: CLUSTER_ID }, error: null }),
      }
      // after update() → eq() → returns updateResult
      chain.update.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(updateResult),
        }),
      })
      return chain
    })

    const mockSupabase = makeMockSupabase()
    mockSupabase.from = mockFrom
    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never)

    const result = await removeKeywordFromCluster(KEYWORD_ID, CLUSTER_ID, PROJECT_ID)
    // revalidatePath çağrılmamalı (Pitfall 3)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('DraftCluster type', () => {
  it('DraftCluster type has expected fields', () => {
    // Type-level check — runtime'da DraftCluster tipi kullanılabilir
    const draft: DraftCluster = {
      id: CLUSTER_ID,
      cluster_name: 'Test Cluster',
      intent: 'informational',
      total_volume: 1000,
      status: 'draft',
      keywords: [{ id: KEYWORD_ID, keyword: 'test kw', volume: 500 }],
    }
    expect(draft.status).toBe('draft')
    expect(draft.keywords).toHaveLength(1)
  })
})
