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
import { updateClusterStatus, approveStrategy } from '@/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions'

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

describe('updateClusterStatus', () => {
  it('rejects invalid status values', async () => {
    const result = await updateClusterStatus('cluster-abc-12345678901234567890', 'invalid', 'proj-abc-12345678901234567890')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Geçersiz durum değeri.')
  })

  it('returns error when auth is missing', async () => {
    const mockSupabase = makeMockSupabase()
    mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never)

    const result = await updateClusterStatus('cluster-abc-12345678901234567890', 'approved', 'proj-abc-12345678901234567890')
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

    const result = await updateClusterStatus('cluster-abc-12345678901234567890', 'approved', 'proj-abc-12345678901234567890')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Küme bulunamadı.')
  })

  it('succeeds without calling revalidatePath', async () => {
    const ownershipMock = { data: { id: 'cluster-abc-12345678901234567890' }, error: null }
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

    const result = await updateClusterStatus('cluster-abc-12345678901234567890', 'approved', 'proj-abc-12345678901234567890')
    expect(result.success).toBe(true)
    // revalidatePath çağrılmamalı — overlay state korunur (Pitfall 3)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('approveStrategy', () => {
  it('calls revalidatePath after successful update', async () => {
    const ownershipMock = { data: { id: 'proj-abc-12345678901234567890' }, error: null }
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

    const result = await approveStrategy('proj-abc-12345678901234567890', true)
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

    const result = await approveStrategy('proj-abc-12345678901234567890', true)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Proje bulunamadı.')
  })
})
