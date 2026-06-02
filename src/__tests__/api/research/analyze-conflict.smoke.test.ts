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
vi.mock('@/core/decision/locking-engine', () => ({ checkConflicts: vi.fn() }))
vi.mock('@/core/context/memory-writer', () => ({
  saveModuleState: vi.fn().mockResolvedValue(undefined),
  buildMemorySnapshot: vi.fn().mockReturnValue({}),
}))
vi.mock('@/lib/memory', () => ({ writeModuleState: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/core/context/compressor', () => ({ distillRows: vi.fn().mockReturnValue('distilled') }))

// vi.hoisted: mockCreate is available inside the vi.mock factory (runs before module import)
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: mockCreate } }
  },
}))

import { createClient } from '@/lib/supabase/server'
import { checkConflicts } from '@/core/decision/locking-engine'
import { checkOutputAgainstLockedDecisions } from '@/core/decision/decision-guard'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/research/analyze/route'
import type { LockedDecision } from '@/core/decision/locking-engine'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_AI_DECISIONS = JSON.stringify([
  { decision_type: 'strategy', decision: 'Hizmet odaklı içerik oluştur', reason: 'Rakip analizi bunu gösteriyor' },
])

const VALID_PROJECT = {
  id: 'p1', name: 'Test Proje', domain: 'test.com', sector: 'tech',
  business_model: 'saas', target_customer: 'smb', main_goal: 'lead üretimi',
  target_keywords: 'test keyword', initial_competitors: '',
}

const VALID_REPORTS = [
  { section: 'market_overview', rows: [{ key: 'insight', value: 'pazar bilgisi' }] },
]

const LOCKED_DECISION: LockedDecision = {
  id: 'dec-locked-1',
  project_id: 'p1',
  section: 'arastirma',
  decision_type: 'strategy',
  decision: 'Hizmet odaklı içerik oluştur',
  reason: null,
  scope_type: 'section',
  entity_type: null,
  is_active: true,
  lifecycle_status: 'locked',
  locked_at: '2026-06-01T10:00:00Z',
  locked_by: 'u1',
  lock_reason: 'Onaylandı',
  created_at: '2026-06-01T00:00:00Z',
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

function makeSupabase(insertError: string | null = null) {
  const insertSpy = vi.fn().mockResolvedValue({ data: null, error: insertError ? { message: insertError } : null })

  const pdChain = makeThenable(null)
  pdChain.update = vi.fn().mockReturnValue(pdChain)
  pdChain.insert = insertSpy

  return {
    _insertSpy: insertSpy,
    _pdFromCalls: [] as string[],
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'test@test.com' } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'projects') return makeThenable(VALID_PROJECT)
        if (table === 'research_reports') return makeThenable(VALID_REPORTS)
        if (table === 'business_entities') return makeThenable([])
        if (table === 'project_decisions') return pdChain
        return makeThenable(null)
      }),
    },
  }
}

function makeRequest(projectId = 'p1') {
  return new NextRequest('http://localhost/api/research/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/research/analyze — conflict enforcement smoke', () => {
  const noConflict = {
    has_conflict: false,
    conflicting_decisions: [],
    reason: null,
    semantic_conflicts: [],
    has_semantic_conflict: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({ choices: [{ message: { content: VALID_AI_DECISIONS } }] })
    vi.mocked(checkConflicts).mockResolvedValue(noConflict as never)
    vi.mocked(checkOutputAgainstLockedDecisions).mockResolvedValue({
      passed: true, violations: [], checked_at: new Date().toISOString(),
    })
  })

  // ── Conflict path ───────────────────────────────────────────────────────────

  it('kilitli karar çakışması → 409 döner, code DECISION_CONFLICT, conflicts dolu', async () => {
    vi.mocked(checkConflicts).mockResolvedValue({
      has_conflict: true,
      conflicting_decisions: [LOCKED_DECISION],
      reason: '"strategy" tipi için section="arastirma" kapsamında 1 kilitli karar mevcut',
      semantic_conflicts: [],
      has_semantic_conflict: false,
    } as never)

    const { supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.code).toBe('DECISION_CONFLICT')
    expect(body.error).toMatch(/çakışma/i)
    expect(body.conflicts).toHaveLength(1)
    expect(body.conflicts[0].proposed).toBe('Hizmet odaklı içerik oluştur')
    expect(body.conflicts[0].conflicting[0].id).toBe('dec-locked-1')
    expect(body.conflicts[0].conflicting[0].locked_at).toBe('2026-06-01T10:00:00Z')
  })

  it('çakışma → DB write bloklandı (insert çağrılmadı)', async () => {
    vi.mocked(checkConflicts).mockResolvedValue({
      has_conflict: true,
      conflicting_decisions: [LOCKED_DECISION],
      reason: 'çakışma var',
      semantic_conflicts: [],
      has_semantic_conflict: false,
    } as never)

    const { _insertSpy, supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await POST(makeRequest())
    expect(res.status).toBe(409)

    // Hiçbir project_decisions INSERT gönderilmedi
    expect(_insertSpy).not.toHaveBeenCalled()
  })

  it('kilitli karar korunuyor — 409 sonrası project_decisions mutasyonu yok', async () => {
    vi.mocked(checkConflicts).mockResolvedValue({
      has_conflict: true,
      conflicting_decisions: [LOCKED_DECISION],
      reason: 'çakışma var',
      semantic_conflicts: [],
      has_semantic_conflict: false,
    } as never)

    const { _insertSpy, supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    await POST(makeRequest())

    // project_decisions hiç çağrılmadı — conflict check write öncesinde durdu
    const pdCalls = (supabase.from.mock.calls as string[][]).filter(([t]) => t === 'project_decisions')
    expect(pdCalls).toHaveLength(0)
    expect(_insertSpy).not.toHaveBeenCalled()
  })

  // ── Negative path ───────────────────────────────────────────────────────────

  it('çakışma yok → 200, insert çalışır', async () => {
    const { _insertSpy, supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.count).toBe(1)
    expect(_insertSpy).toHaveBeenCalledOnce()
  })

  // ── Guard fail-open (audit-only path) ───────────────────────────────────────

  it('audit guard throw ederse route engellenmez (fire-and-forget)', async () => {
    // checkOutputAgainstLockedDecisions fire-and-forget: .catch(() => {}) — hiçbir zaman bloklamamalı
    vi.mocked(checkOutputAgainstLockedDecisions).mockRejectedValue(new Error('guard service down'))

    const { supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })
})
