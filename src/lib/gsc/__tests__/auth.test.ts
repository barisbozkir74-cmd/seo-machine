import { describe, it, expect, vi, beforeEach } from 'vitest'

// Supabase server client mock
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
// server-only mock
vi.mock('server-only', () => ({}))

import { getValidGscToken, GscTokensSchema } from '../auth'
import { createClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  single: vi.fn(),
}

beforeEach(() => {
  vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
  mockSupabase.single.mockReset()
  const mockUpdateEq2 = vi.fn().mockResolvedValue({})
  const mockUpdateEq1 = vi.fn().mockReturnValue({ eq: mockUpdateEq2 })
  mockSupabase.update.mockReturnValue({ eq: mockUpdateEq1 })
})

describe('getValidGscToken', () => {
  it('geçerli token döner (expires_at gelecekte)', async () => {
    const futureExpiry = Date.now() + 60 * 60 * 1000 // 1 saat sonra
    mockSupabase.single.mockResolvedValue({
      data: {
        gsc_tokens: {
          access_token: 'valid-token',
          refresh_token: 'refresh',
          expires_at: futureExpiry,
          token_type: 'Bearer',
        },
      },
    })

    const token = await getValidGscToken('proj-1', 'user-1')
    expect(token).toBe('valid-token')
  })

  it('gsc_tokens null ise null döner', async () => {
    mockSupabase.single.mockResolvedValue({ data: { gsc_tokens: null } })
    const token = await getValidGscToken('proj-1', 'user-1')
    expect(token).toBeNull()
  })

  it('süresi dolmuş token refresh tetikler', async () => {
    const pastExpiry = Date.now() - 1000 // geçmişte
    mockSupabase.single.mockResolvedValue({
      data: {
        gsc_tokens: {
          access_token: 'old-token',
          refresh_token: 'refresh-token',
          expires_at: pastExpiry,
          token_type: 'Bearer',
        },
      },
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        access_token: 'new-token',
        expires_in: 3600,
      }),
      ok: true,
    }))

    const token = await getValidGscToken('proj-1', 'user-1')
    expect(token).toBe('new-token')

    vi.unstubAllGlobals()
  })

  it('refresh başarısız ise null döner', async () => {
    const pastExpiry = Date.now() - 1000
    mockSupabase.single.mockResolvedValue({
      data: {
        gsc_tokens: {
          access_token: 'old-token',
          refresh_token: 'bad-refresh',
          expires_at: pastExpiry,
          token_type: 'Bearer',
        },
      },
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({}), // access_token yok
      ok: true,
    }))

    const token = await getValidGscToken('proj-1', 'user-1')
    expect(token).toBeNull()

    vi.unstubAllGlobals()
  })
})
