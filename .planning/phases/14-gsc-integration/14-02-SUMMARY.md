---
phase: 14-gsc-integration
plan: "02"
subsystem: lib/gsc
tags: [google-search-console, oauth2, token-refresh, url-inspection, search-analytics, server-only, vitest, tdd]
dependency_graph:
  requires:
    - "14-01: gsc_tokens JSONB column on projects"
    - "14-01: gsc_index_status column on page_packages"
    - "14-01: gsc_metrics table"
  provides:
    - getValidGscToken — Supabase'den token okur, süresi dolduysa refresh eder, string | null döner
    - saveGscTokens — projects.gsc_tokens JSONB'ye yazar, user_id ownership garantisi ile
    - GscTokensSchema / GscTokens — Zod validated token shape
    - listGscProperties — Sites.list API ile GSC property listesi döner
    - checkUrlIndexStatus — URL Inspection API verdict → IndexStatus map
    - fetchSearchAnalytics — Search Analytics API satırlarını SearchAnalyticsRow[] olarak parse eder
  affects:
    - plans: [14-03, 14-04, 14-05]
      reason: Tüm sonraki planlar bu lib fonksiyonlarını import eder
tech_stack:
  added: []
  patterns:
    - "import 'server-only' — her lib dosyasında zorunlu; client bundle'a sızmaz"
    - "Zod v4 safeParse — JSONB shape doğrulama, parse hatası null döndürür"
    - "fetch POST + URLSearchParams — Google OAuth2 token refresh"
    - "vi.stubGlobal('fetch') + vi.mock('@/lib/supabase/server') — vitest test isolation pattern"
    - "Chained mock: update().eq().eq() double-chain pattern for ownership-guarded updates"
key_files:
  created:
    - src/lib/gsc/auth.ts
    - src/lib/gsc/properties.ts
    - src/lib/gsc/index-check.ts
    - src/lib/gsc/search-analytics.ts
    - src/lib/gsc/__tests__/auth.test.ts
    - src/lib/gsc/__tests__/index-check.test.ts
    - src/lib/gsc/__tests__/search-analytics.test.ts
  modified: []
decisions:
  - "googleapis npm paketi eklenmedi — doğrudan fetch kullanıldı; bundle ağırlığı minimumda tutuldu (RESEARCH.md recommendation)"
  - "auth.ts .eq('user_id', userId) double-ownership check — saveGscTokens ve getValidGscToken'da hem proje hem kullanıcı doğrulanır (T-14-02, T-14-03)"
  - "GscTokensSchema.safeParse — geçersiz token shape'i null döndürür, throw etmez; upstream caller null'u handle eder"
  - "avgPosition: Math.round(row.position * 100) / 100 — 2 ondalık hassasiyet, DB numeric(5,2) ile uyumlu"
metrics:
  duration: "~12 min"
  completed: "2026-04-27"
  tasks_completed: 2
  files_created: 7
  files_modified: 0
requirements:
  - GSC-01
  - GSC-02
  - GSC-03
---

# Phase 14 Plan 02: GSC Lib Katmanı Summary

GSC API ile iletişim kuran token yönetimi (getValidGscToken + refresh), property listesi, index kontrolü ve search analytics için 4 server-only lib dosyası ve 12 birim testi TDD süreci ile oluşturuldu.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | GSC lib testleri — failing | 9799abc | src/lib/gsc/__tests__/auth.test.ts, index-check.test.ts, search-analytics.test.ts |
| 2 (GREEN) | GSC lib implementation + test fix | 2b7f35e | src/lib/gsc/auth.ts, properties.ts, index-check.ts, search-analytics.ts + auth.test.ts mock fix |

## What Was Built

### src/lib/gsc/auth.ts
- `GscTokensSchema` (Zod v4) — `access_token, refresh_token, expires_at, token_type` shape doğrulama
- `saveGscTokens(projectId, userId, tokens)` — `projects.gsc_tokens` JSONB yazar; `.eq('user_id', userId)` ownership garantisi
- `getValidGscToken(projectId, userId)` — token geçerliyse direkt döner; expires_at < now+5dk ise POST `https://oauth2.googleapis.com/token` ile refresh; refresh başarısızsa null döner

### src/lib/gsc/properties.ts
- `listGscProperties(accessToken)` — GET `https://www.googleapis.com/webmasters/v3/sites`; `data.siteEntry` dizisi döner; API başarısızsa `[]`

### src/lib/gsc/index-check.ts
- `checkUrlIndexStatus(accessToken, inspectionUrl, siteUrl)` — POST `https://searchconsole.googleapis.com/v1/urlInspection/index:inspect`
- Verdict mapping: `PASS → 'indexed'`, `FAIL → 'not_indexed'`, `NEUTRAL → 'crawled_not_indexed'`, diğer → `'unknown'`

### src/lib/gsc/search-analytics.ts
- `fetchSearchAnalytics(accessToken, siteUrl, startDate, endDate)` — POST Search Analytics API; `dimensions: ['page', 'query']`, `rowLimit: 25000`
- `row.keys[0] = pageUrl`, `row.keys[1] = keyword`; `avgPosition = Math.round(position * 100) / 100`

### Test Suite (12/12 passing)
- `auth.test.ts`: 4 test case — geçerli token, null tokens, refresh tetikleme, refresh başarısız
- `index-check.test.ts`: 5 test case — PASS/FAIL/NEUTRAL/bilinmeyen/res.ok false
- `search-analytics.test.ts`: 3 test case — rows parse, boş rows, res.ok false

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] auth.test.ts mock: update().eq().eq() double-chain eksikti**
- **Found during:** Task 2 GREEN — test çalıştırıldığında `supabase.from(...).update(...).eq(...).eq is not a function` hatası
- **Issue:** `saveGscTokens` iki `.eq()` çağırıyor (`eq('id', projectId)` + `eq('user_id', userId)`), ancak mock yalnızca bir `.eq()` döndürüyordu
- **Fix:** `mockSupabase.update.mockReturnValue({ eq: mockUpdateEq1 })` → `mockUpdateEq1` ikinci bir `eq` mock'u içerecek şekilde güncellendi; `mockUpdateEq1.mockReturnValue({ eq: mockUpdateEq2 })`
- **Files modified:** src/lib/gsc/__tests__/auth.test.ts
- **Commit:** 2b7f35e (GREEN commit içinde)

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED — test(14-02): failing tests | 9799abc | PASSED |
| GREEN — feat(14-02): implementation | 2b7f35e | PASSED |

## Threat Surface Scan

Yeni network surface:
- `fetch('https://oauth2.googleapis.com/token')` — GOOGLE_CLIENT_SECRET server-only env var; token loglanmıyor (T-14-02b)
- `fetch('https://searchconsole.googleapis.com/v1/urlInspection/...')` — Bearer token; response içinde token string geçmiyor
- `fetch('https://www.googleapis.com/webmasters/v3/sites/...')` — Bearer token

Tüm bu surface'lar plan'ın `<threat_model>` bölümünde kayıtlı; yeni tehdit yok.

## Self-Check

### Created files exist:
- `src/lib/gsc/auth.ts` — FOUND
- `src/lib/gsc/properties.ts` — FOUND
- `src/lib/gsc/index-check.ts` — FOUND
- `src/lib/gsc/search-analytics.ts` — FOUND
- `src/lib/gsc/__tests__/auth.test.ts` — FOUND
- `src/lib/gsc/__tests__/index-check.test.ts` — FOUND
- `src/lib/gsc/__tests__/search-analytics.test.ts` — FOUND

### Commits exist:
- `9799abc` test(14-02): add failing tests for GSC lib — FOUND
- `2b7f35e` feat(14-02): implement GSC lib layer — FOUND

## Self-Check: PASSED
