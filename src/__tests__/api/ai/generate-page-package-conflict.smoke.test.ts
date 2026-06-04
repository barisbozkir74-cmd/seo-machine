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
vi.mock('@/core/decision/guard-policy', () => ({
  logGuardFailure: vi.fn(),
  CRITICAL_DECISION_TYPES: ['architecture', 'strategy', 'brand'],
  FAIL_CLOSE_ENDPOINTS: ['content/generate', 'keywords/strategy', 'ai/qa-audit', 'keywords/expand', 'ai/generate-page-package'],
  shouldFailClose: vi.fn().mockReturnValue(true),
}))

// Streaming route — create mock as a readable async iterable
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
import { POST } from '@/app/api/ai/generate-page-package/route'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const PAGE_ID    = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

const VIOLATION = {
  locked_decision_id: 'dec-locked-arch-1',
  decision_type: 'architecture',
  locked_decision_text: 'Hiçbir lead page oluşturma, sadece traffic pages',
  conflict_summary: 'Kural: direct_negation — "architecture" kararıyla çakışma',
}

const VALID_PROJECT = {
  id: PROJECT_ID, name: 'Test Proje', domain: 'test.com', sector: 'tech',
  target_country: 'TR', target_language: 'Turkish', business_model: 'saas',
  site_type: 'blog', brand_tone: 'profesyonel', target_customer: 'smb',
  main_goal: 'lead üretimi',
}

const VALID_PAGE = {
  id: PAGE_ID, title: 'CRM Yazılımı', slug: '/crm-yazilimi',
  page_type: 'lead', focus_keyword_id: null, source_wp_id: null,
}

// Async iterable for streaming mock — yields nothing since pre-flight guard blocks first
async function* emptyStream() {}

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
  // page_packages: no locked package (status != 'locked')
  const pkgChain = makeThenable(null)
  pkgChain.single = vi.fn().mockResolvedValue({ data: null, error: null })

  const pageChain = makeThenable(VALID_PAGE)
  pageChain.single = vi.fn().mockResolvedValue({ data: VALID_PAGE, error: null })

  return {
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'projects')                return makeThenable(VALID_PROJECT)
        if (table === 'pages')                   return pageChain
        if (table === 'page_packages')           return pkgChain
        if (table === 'project_imported_pages')  return makeThenable(null)
        if (table === 'keywords')                return makeThenable([])
        if (table === 'research_reports')        return makeThenable([])
        return makeThenable(null)
      }),
    },
  }
}

function makeRequest() {
  return new NextRequest('http://localhost/api/ai/generate-page-package', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: PROJECT_ID, pageId: PAGE_ID }),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/ai/generate-page-package — pre-stream fail-close guard smoke (Wave H)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: guard passes, stream is empty (tests focus on guard, not stream content)
    vi.mocked(checkOutputAgainstLockedDecisions).mockResolvedValue({
      passed: true,
      violations: [],
      checked_at: new Date().toISOString(),
    })
    mockCreate.mockResolvedValue(emptyStream())
  })

  // ── Pre-stream conflict path ────────────────────────────────────────────────

  it('pre-stream guard violation → 409 döner, stream başlamaz', async () => {
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
    expect(body.violations[0].decision_type).toBe('architecture')
  })

  it('guard violation → OpenAI stream çağrılmaz (pre-flight bloklama)', async () => {
    vi.mocked(checkOutputAgainstLockedDecisions).mockResolvedValue({
      passed: false,
      violations: [VIOLATION],
      checked_at: new Date().toISOString(),
    })

    const { supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    await POST(makeRequest())

    // OpenAI stream açılmadı — guard öncesinde bloklandı
    expect(mockCreate).not.toHaveBeenCalled()
  })

  // ── Pre-stream fail-close: guard crash ─────────────────────────────────────

  it('FAIL-CLOSE — guard throw ederse 503 döner, stream başlamaz', async () => {
    vi.mocked(checkOutputAgainstLockedDecisions).mockRejectedValue(new Error('guard service down'))

    const { supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.code).toBe('GUARD_ERROR')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('FAIL-CLOSE — guard crash sonrası logGuardFailure çağrılır', async () => {
    vi.mocked(checkOutputAgainstLockedDecisions).mockRejectedValue(new Error('guard service down'))

    const { supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    await POST(makeRequest())

    expect(logGuardFailure).toHaveBeenCalledWith('ai/generate-page-package', expect.any(Error))
  })

  // ── Guard doğru section ile çağrılıyor ─────────────────────────────────────

  it('pre-flight guard "icerik-studio" section ile çağrılır', async () => {
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
