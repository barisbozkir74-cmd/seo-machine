import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/core/context/prompt-builder', () => ({
  buildFullSystemPrompt: vi.fn().mockResolvedValue({ systemPrompt: 'system', global_brain_count: 0 }),
}))
vi.mock('@/core/phase/engine', () => ({
  checkPhasePrerequisites: vi.fn().mockResolvedValue({ blocked: false, missing_prerequisites: [], warning_text: null }),
}))
vi.mock('@/core/governance/prompt-security', () => ({
  registerInjectionAuditCallback: vi.fn(),
}))
vi.mock('@/core/audit/trail', () => ({
  recordAuditEntry: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/core/decision/decision-guard', () => ({
  checkOutputAgainstLockedDecisions: vi.fn(),
}))
vi.mock('@/core/decision/guard-policy', () => ({
  logGuardFailure: vi.fn(),
  CRITICAL_DECISION_TYPES: ['architecture', 'strategy', 'brand'],
  FAIL_CLOSE_ENDPOINTS: ['content/generate', 'keywords/strategy', 'ai/qa-audit'],
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
import { POST } from '@/app/api/ai/qa-audit/route'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PACKAGE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PAGE_ID    = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const QA_RESULT_JSON = JSON.stringify({
  checks: [
    { id: 'intent_drift',      severity: 'ok',       note: 'İçerik intent ile uyuşuyor' },
    { id: 'robotic_language',  severity: 'warning',  note: 'Bazı kalıplar tekrarlıyor' },
    { id: 'entity_gap',        severity: 'ok',       note: 'Temel entityler mevcut' },
    { id: 'duplicate_risk',    severity: 'ok',       note: 'Çakışma riski düşük' },
  ],
  content_score: 78,
  human_score: 72,
})

const VIOLATION = {
  locked_decision_id: 'dec-locked-brand-1',
  decision_type: 'brand',
  locked_decision_text: 'Marka tonu her zaman resmi ve kurumsal olmalı',
  conflict_summary: 'Kural: direct_negation — "brand" kararıyla çakışma',
}

const VALID_PROJECT = {
  id: PROJECT_ID, name: 'Test Proje', domain: 'test.com',
  sector: 'tech', target_language: 'Turkish', brand_tone: 'profesyonel',
}

const VALID_PKG = {
  id: PACKAGE_ID, status: 'locked',
  seo_title: 'Test SEO Title', meta_description: 'Test meta',
  h1: 'Test H1', search_intent: 'informational',
  strategic_purpose: 'Test purpose', content_blocks: [], schema_jsonld: null,
}

// ── Mock factory ──────────────────────────────────────────────────────────────

function makeThenable<T>(data: T) {
  const p = Promise.resolve({ data, error: null })
  const c: Record<string, unknown> = {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
    single: vi.fn().mockResolvedValue({ data, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  }
  for (const m of ['select', 'eq', 'order', 'limit', 'in', 'is', 'update', 'insert']) {
    c[m] = vi.fn().mockReturnValue(c)
  }
  return c
}

function makeSupabase() {
  const pkgChain = makeThenable(VALID_PKG)
  // page_packages: first .single() = pkg, second .single() = page_id row
  let pkgSingleCall = 0
  pkgChain.single = vi.fn().mockImplementation(() => {
    pkgSingleCall++
    if (pkgSingleCall === 1) return Promise.resolve({ data: VALID_PKG, error: null })
    return Promise.resolve({ data: { page_id: PAGE_ID }, error: null })
  })

  const pageChain = makeThenable({ focus_keyword_id: null })
  pageChain.single = vi.fn().mockResolvedValue({ data: { focus_keyword_id: null }, error: null })

  return {
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'projects')      return makeThenable(VALID_PROJECT)
        if (table === 'page_packages') return pkgChain
        if (table === 'pages')         return pageChain
        if (table === 'keywords')      return makeThenable(null)
        return makeThenable(null)
      }),
    },
  }
}

function makeRequest() {
  return new NextRequest('http://localhost/api/ai/qa-audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packageId: PACKAGE_ID, projectId: PROJECT_ID }),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/ai/qa-audit — fail-close conflict guard smoke (Wave G)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: `\`\`\`json\n${QA_RESULT_JSON}\n\`\`\`` } }],
    })
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
    expect(body.violations[0].decision_type).toBe('brand')
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

    expect(logGuardFailure).toHaveBeenCalledWith('ai/qa-audit', expect.any(Error))
  })

  // ── Pass path ───────────────────────────────────────────────────────────────

  it('guard pass → 200, QA sonucu döner', async () => {
    const { supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.checks).toHaveLength(4)
    expect(body.content_score).toBe(78)
  })

  // ── Guard doğru section ile çağrılıyor ─────────────────────────────────────

  it('guard "icerik-studio" section ile çağrılır', async () => {
    const { supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    await POST(makeRequest())

    expect(checkOutputAgainstLockedDecisions).toHaveBeenCalledWith(
      expect.anything(),
      PROJECT_ID,
      'u1',
      expect.any(String),
      'icerik-studio'
    )
  })
})
