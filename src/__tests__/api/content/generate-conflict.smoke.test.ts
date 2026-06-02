import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/services/seo/content/contentOrchestrator', () => ({
  generateContentObject: vi.fn(),
}))
vi.mock('@/services/event-service', () => ({
  logEvent: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/core/decision/decision-guard', () => ({
  checkOutputAgainstLockedDecisions: vi.fn(),
}))
vi.mock('@/core/decision/guard-policy', () => ({
  logGuardFailure: vi.fn(),
  CRITICAL_DECISION_TYPES: ['architecture', 'strategy', 'brand'],
}))
vi.mock('@/lib/api/response', () => ({
  ok: vi.fn().mockImplementation((data: unknown, status = 200) =>
    new Response(JSON.stringify({ data, error: null }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  err: vi.fn().mockImplementation((code: string, message: string, status = 400) =>
    new Response(JSON.stringify({ data: null, error: { code, message } }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
}))

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateContentObject } from '@/services/seo/content/contentOrchestrator'
import { checkOutputAgainstLockedDecisions } from '@/core/decision/decision-guard'
import { logGuardFailure } from '@/core/decision/guard-policy'
import { POST } from '@/app/api/content/generate/route'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_ID    = '22222222-2222-4222-8222-222222222222'

const VALID_CONTENT_OUTPUT = {
  page_id:             PAGE_ID,
  title:               'Test Sayfa Başlığı',
  meta_title:          'Test Meta Başlık',
  meta_description:    'Test meta açıklaması',
  h1:                  'Test H1 Başlığı',
  h2_structure:        [],
  body_content:        { sections: [] },
  faq_section:         null,
  internal_links:      [],
  seo_score:           85,
  readability_score:   78,
  intent_match_score:  90,
  internal_link_score: 70,
  word_count:          350,
  validation_passed:   true,
  validation_errors:   [],
}

const VIOLATION = {
  locked_decision_id:   'dec-locked-content-1',
  decision_type:        'strategy',
  locked_decision_text: 'Başlıkta rakip marka adı kullanma',
  conflict_summary:     'Kural: direct_negation — "strategy" kararıyla olası çakışma',
}

const PAGE_OBJ = {
  id: PAGE_ID, site_id: 'site-1',
  page_type: 'landing_page', primary_keyword: 'test keyword',
  intent: 'commercial', opportunity_score: 0.8, keyword_set: [],
  url: '/test',
}

// ── Supabase mock factory ─────────────────────────────────────────────────────

function makeThenable<T>(data: T) {
  const p = Promise.resolve({ data, error: null })
  const c: Record<string, unknown> = {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
    single:      vi.fn().mockResolvedValue({ data, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  }
  for (const m of ['select', 'eq', 'is', 'in', 'neq', 'order', 'limit', 'update', 'insert', 'upsert']) {
    c[m] = vi.fn().mockReturnValue(c)
  }
  return c
}

function makeSupabase() {
  const contentInsertSpy = vi.fn()
  const contentArchiveSpy = vi.fn()

  const contentInsertChain = makeThenable({ id: 'content-new-1', version: 2 })
  contentInsertSpy.mockReturnValue(contentInsertChain)

  const contentUpdateChain = makeThenable(null)
  contentArchiveSpy.mockReturnValue(contentUpdateChain)

  // pages table:
  //   direct await → array of page IDs (site-scope duplicate check)
  //   .single()     → full page object (page fetch, homepage fetch)
  const pagesChain = makeThenable([{ id: PAGE_ID }])
  pagesChain.single      = vi.fn().mockResolvedValue({ data: PAGE_OBJ, error: null })
  pagesChain.maybeSingle = vi.fn().mockResolvedValue({ data: PAGE_OBJ, error: null })

  return {
    _contentInsertSpy:  contentInsertSpy,
    _contentArchiveSpy: contentArchiveSpy,
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'projects')          return makeThenable({ id: PROJECT_ID })
        if (table === 'pages')             return pagesChain
        if (table === 'internal_links')    return makeThenable([])
        if (table === 'validation_reports') return makeThenable(null)
        if (table === 'content') {
          // direct await → [] (site title check, returns array)
          // .maybeSingle() → { version: 1 } (version lookup)
          // .update() → archive spy chain
          // .insert() → insert spy chain
          const chain = makeThenable([] as unknown[])
          chain.maybeSingle = vi.fn().mockResolvedValue({ data: { version: 1 }, error: null })
          chain.update = contentArchiveSpy
          chain.insert = contentInsertSpy
          return chain
        }
        return makeThenable(null)
      }),
    },
  }
}

function makeRequest() {
  return new NextRequest('http://localhost/api/content/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: PROJECT_ID, page_id: PAGE_ID }),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/content/generate — conflict guard smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(generateContentObject).mockResolvedValue(VALID_CONTENT_OUTPUT as never)
    vi.mocked(checkOutputAgainstLockedDecisions).mockResolvedValue({
      passed: true,
      violations: [],
      checked_at: new Date().toISOString(),
    })
  })

  // ── Conflict path ───────────────────────────────────────────────────────────

  it('guard violation → 409, DECISION_CONFLICT, content insert bloklandı', async () => {
    vi.mocked(checkOutputAgainstLockedDecisions).mockResolvedValue({
      passed: false,
      violations: [VIOLATION],
      checked_at: new Date().toISOString(),
    })

    const { _contentInsertSpy, supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error.code).toBe('DECISION_CONFLICT')
    expect(body.error.message).toMatch(/çakışıyor/i)
    expect(_contentInsertSpy).not.toHaveBeenCalled()
  })

  it('guard violation → archive (soft delete) de çalışmadı', async () => {
    vi.mocked(checkOutputAgainstLockedDecisions).mockResolvedValue({
      passed: false,
      violations: [VIOLATION],
      checked_at: new Date().toISOString(),
    })

    const { _contentArchiveSpy, supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    await POST(makeRequest())

    // Eski versiyon arşivlenmedi — bütün write path atlandı
    expect(_contentArchiveSpy).not.toHaveBeenCalled()
  })

  // ── Negative path ───────────────────────────────────────────────────────────

  it('guard pass → 201, content insert çalışır', async () => {
    const { _contentInsertSpy, supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await POST(makeRequest())

    expect(res.status).toBe(201)
    expect(_contentInsertSpy).toHaveBeenCalledOnce()
  })

  // ── Fail-close (Wave F kritik fark: keywords/strategy fail-open ↔ content/generate fail-close) ──

  it('FAIL-CLOSE: guard throw → 503, DB write bloklandı, hata loglandı', async () => {
    // keywords/strategy: guard crash → .catch(() => null) → proceed (fail-open)
    // content/generate:  guard crash → try/catch → 503 (fail-close)
    vi.mocked(checkOutputAgainstLockedDecisions).mockRejectedValue(new Error('guard service unavailable'))

    const { _contentInsertSpy, supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.error.code).toBe('GUARD_ERROR')
    expect(_contentInsertSpy).not.toHaveBeenCalled()
    expect(vi.mocked(logGuardFailure)).toHaveBeenCalledWith('content/generate', expect.any(Error))
  })

  it('guard doğru section ile çağrıldı ve contentText title içeriyor', async () => {
    const { supabase } = makeSupabase()
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    await POST(makeRequest())

    expect(vi.mocked(checkOutputAgainstLockedDecisions)).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'u1',
      expect.stringContaining('Test Sayfa Başlığı'),
      'icerik-studio'
    )
  })
})
