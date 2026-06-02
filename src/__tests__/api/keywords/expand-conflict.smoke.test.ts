import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/core/context/prompt-builder', () => ({
  buildFullSystemPrompt: vi.fn().mockResolvedValue({ systemPrompt: 'system', global_brain_count: 0 }),
}))
vi.mock('@/core/decision/decision-guard', () => ({
  checkOutputAgainstLockedDecisions: vi.fn(),
}))
vi.mock('@/core/decision/guard-policy', () => ({
  logGuardFailure: vi.fn(),
  CRITICAL_DECISION_TYPES: ['architecture', 'strategy', 'brand'],
  FAIL_CLOSE_ENDPOINTS: ['content/generate', 'keywords/strategy', 'ai/qa-audit', 'keywords/expand', 'ai/generate-page-package'],
  shouldFailClose: vi.fn().mockReturnValue(true),
}))

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: mockCreate } }
  },
}))

import { createClient } from '@/lib/supabase/server'
import { checkOutputAgainstLockedDecisions } from '@/core/decision/decision-guard'
import { logGuardFailure } from '@/core/decision/guard-policy'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/keywords/expand/route'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

const VALID_EXPAND_JSON = JSON.stringify({
  categories: {
    ticari:       ['yazılım fiyat', 'crm satın al'],
    bilgi:        ['crm nedir', 'yazılım nasıl seçilir'],
    yerel:        ['istanbul yazılım şirketi'],
    karsilastirma: ['en iyi crm 2024'],
    sss:          ['crm kurulum süresi'],
    uzun_kuyruk:  ['küçük işletme için crm önerisi'],
    acil:         ['acil yazılım desteği'],
  },
})

const VIOLATION = {
  locked_decision_id: 'dec-locked-strategy-1',
  decision_type: 'strategy',
  locked_decision_text: 'Ticari keyword önerme, sadece bilgi odaklı yaz',
  conflict_summary: 'Kural: direct_negation — "strategy" kararıyla çakışma',
}

const VALID_PROJECT = {
  name: 'Test Proje', domain: 'test.com', sector: 'tech',
  business_model: 'saas', target_customer: 'smb', main_goal: 'lead üretimi',
  target_country: 'TR', target_language: 'Turkish', initial_competitors: '',
}

// ── Mock factory ──────────────────────────────────────────────────────────────

function makeThenable<T>(data: T) {
  const p = Promise.resolve({ data, error: null })
  const c: Record<string, unknown> = {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
    single: vi.fn().mockResolvedValue({ data, error: null }),
  }
  for (const m of ['select', 'eq', 'order', 'limit', 'in', 'is']) {
    c[m] = vi.fn().mockReturnValue(c)
  }
  return c
}

function makeSupabase() {
  return {
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'projects')          return makeThenable(VALID_PROJECT)
        if (table === 'keywords')          return makeThenable([])
        if (table === 'project_decisions') return makeThenable([])
        if (table === 'competitors')       return makeThenable([])
        return makeThenable(null)
      }),
    },
  }
}

function makeRequest(projectId = PROJECT_ID) {
  return new NextRequest('http://localhost/api/keywords/expand', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/keywords/expand — fail-close conflict guard smoke (Wave H)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({ choices: [{ message: { content: VALID_EXPAND_JSON } }] })
    vi.mocked(checkOutputAgainstLockedDecisions).mockResolvedValue({
      passed: true,
      violations: [],
      checked_at: new Date().toISOString(),
    })
  })

  // ── Conflict path ───────────────────────────────────────────────────────────

  it('guard violation → 409 döner, code DECISION_CONFLICT, violations dolu', async () => {
    vi.mocked(checkOutputAgainstLockedDecisions).mockResolvedValue({
      passed: false,
      violations: [VIOLATION],
      checked_at: new Date().toISOString(),
    })

    const { supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.code).toBe('DECISION_CONFLICT')
    expect(body.violations).toHaveLength(1)
    expect(body.violations[0].decision_type).toBe('strategy')
  })

  it('guard violation → yanıt bloklandı, JSON kategoriler dönmez', async () => {
    vi.mocked(checkOutputAgainstLockedDecisions).mockResolvedValue({
      passed: false,
      violations: [VIOLATION],
      checked_at: new Date().toISOString(),
    })

    const { supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.categories).toBeUndefined()
  })

  // ── Fail-close: guard crash ─────────────────────────────────────────────────

  it('FAIL-CLOSE — guard throw ederse 503 döner, GUARD_ERROR kodu', async () => {
    vi.mocked(checkOutputAgainstLockedDecisions).mockRejectedValue(new Error('guard timeout'))

    const { supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.code).toBe('GUARD_ERROR')
  })

  it('FAIL-CLOSE — guard crash sonrası logGuardFailure çağrılır', async () => {
    vi.mocked(checkOutputAgainstLockedDecisions).mockRejectedValue(new Error('guard timeout'))

    const { supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    await POST(makeRequest())

    expect(logGuardFailure).toHaveBeenCalledWith('keywords/expand', expect.any(Error))
  })

  // ── Pass path ───────────────────────────────────────────────────────────────

  it('guard pass → 200, keyword kategorileri döner', async () => {
    const { supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.categories).toBeDefined()
    expect(body.categories.ticari).toContain('yazılım fiyat')
  })
})
