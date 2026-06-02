import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/ai-context/hub', () => ({
  readHub: vi.fn().mockResolvedValue(null),
  hubToPromptContext: vi.fn().mockReturnValue(''),
}))
vi.mock('@/core/context/prompt-builder', () => ({
  buildFullSystemPrompt: vi.fn().mockResolvedValue({ systemPrompt: 'system', global_brain_count: 0 }),
}))
vi.mock('@/core/phase/engine', () => ({
  checkPhasePrerequisites: vi.fn().mockResolvedValue({ blocked: false, missing_prerequisites: [], warning_text: null }),
}))
vi.mock('@/core/decision/decision-guard', () => ({
  checkOutputAgainstLockedDecisions: vi.fn(),
}))
vi.mock('@/core/context/memory-writer', () => ({
  saveModuleState: vi.fn().mockResolvedValue(undefined),
  buildMemorySnapshot: vi.fn().mockReturnValue({}),
}))

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: mockCreate } }
  },
}))

import { createClient } from '@/lib/supabase/server'
import { checkOutputAgainstLockedDecisions } from '@/core/decision/decision-guard'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/keywords/strategy/route'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_STRATEGY_JSON = JSON.stringify({
  clusters: [
    {
      id: 'cluster-existing-1',
      cluster_name: 'Test Hizmet Kümesi',
      page_type: 'lead',
      target_url: '/test-hizmet',
      intent: 'commercial',
      priority_rank: 1,
      content_month: 1,
      ai_reasoning: 'Ana hizmet sayfası — dönüşüm odaklı',
      keyword_ids: [],
      new_keywords: [],
    },
  ],
  architecture_summary: 'Hizmet odaklı minimal mimari.',
})

const VIOLATION = {
  locked_decision_id: 'dec-locked-arch-1',
  decision_type: 'architecture',
  locked_decision_text: 'Yalnızca traffic page_type kullan, lead sayfası yapma',
  conflict_summary: 'Kural: direct_negation — "architecture" kararıyla olası çakışma',
}

const VALID_PROJECT = {
  id: 'p1', name: 'Test Proje', domain: 'test.com', sector: 'tech',
  business_model: 'saas', target_customer: 'smb', main_goal: 'lead üretimi',
  target_country: 'TR', target_language: 'Turkish',
  initial_competitors: '', target_keywords: 'test', notes: '',
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
  for (const m of ['select', 'eq', 'order', 'limit', 'in', 'upsert']) {
    c[m] = vi.fn().mockReturnValue(c)
  }
  return c
}

function makeSupabase() {
  // Spy: keyword_clusters.update — DB write kanıtı
  const kcUpdateSpy = vi.fn()
  const kcUpdateChain = makeThenable(null)
  kcUpdateSpy.mockReturnValue(kcUpdateChain)

  const kcChain = makeThenable([
    { id: 'cluster-existing-1', cluster_name: 'Test Hizmet Kümesi', intent: 'commercial', total_volume: 500, opportunity_score: 0.9, revenue_type: 'lead' },
  ])
  kcChain.update = kcUpdateSpy

  // projects chain — read (single) + update (arch summary)
  const projUpdateChain = makeThenable(null)
  const projUpdateSpy = vi.fn().mockReturnValue(projUpdateChain)
  const projChain = makeThenable(VALID_PROJECT)
  projChain.update = projUpdateSpy

  return {
    _kcUpdateSpy: kcUpdateSpy,
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'projects') return projChain
        if (table === 'keywords') return makeThenable([])
        if (table === 'keyword_clusters') return kcChain
        if (table === 'business_entities') return makeThenable([])
        return makeThenable(null)
      }),
    },
  }
}

function makeRequest(projectId = 'p1') {
  return new NextRequest('http://localhost/api/keywords/strategy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/keywords/strategy — conflict enforcement smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({ choices: [{ message: { content: VALID_STRATEGY_JSON } }] })
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
    expect(body.error).toMatch(/çakışıyor/i)
    expect(body.violations).toHaveLength(1)
    expect(body.violations[0].locked_decision_id).toBe('dec-locked-arch-1')
    expect(body.violations[0].conflict_summary).toMatch(/direct_negation/)
  })

  it('guard violation → DB write bloklandı (keyword_clusters.update çağrılmadı)', async () => {
    vi.mocked(checkOutputAgainstLockedDecisions).mockResolvedValue({
      passed: false,
      violations: [VIOLATION],
      checked_at: new Date().toISOString(),
    })

    const { _kcUpdateSpy, supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await POST(makeRequest())
    expect(res.status).toBe(409)

    // Guard 409 döndü — keyword_clusters'a hiçbir write gönderilmedi
    expect(_kcUpdateSpy).not.toHaveBeenCalled()
  })

  // ── Negative path ───────────────────────────────────────────────────────────

  it('guard pass → 200, keyword_clusters.update çalışır', async () => {
    const { _kcUpdateSpy, supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.cluster_count).toBe(1)
    // DB write gerçekleşti
    expect(_kcUpdateSpy).toHaveBeenCalled()
  })

  // ── Fail-open risk (documented) ─────────────────────────────────────────────

  it('OPEN RISK — guard throw ederse .catch(() => null) fail-open: 409 dönmez, write devam eder', async () => {
    // Route: const guardResult = await checkOutputAgainstLockedDecisions(...).catch(() => null)
    // Guard throw → guardResult = null → if (null && !null.passed) = false → write proceeds
    // Bu davranış bilinçli: guard servis hatası üretimi bloklamasın.
    // Risk: guard'ın kendisi crash ederse kilitli karar ihlali tespit edilemez.
    vi.mocked(checkOutputAgainstLockedDecisions).mockRejectedValue(new Error('guard service unavailable'))

    const { _kcUpdateSpy, supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    // Guard crash = fail-open: üretim devam etti, 409 dönmedi
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    // DB write gerçekleşti — guard bypass edildi
    expect(_kcUpdateSpy).toHaveBeenCalled()
  })
})
