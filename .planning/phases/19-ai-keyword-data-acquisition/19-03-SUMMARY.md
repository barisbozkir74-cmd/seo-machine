---
phase: 19-ai-keyword-data-acquisition
plan: "03"
subsystem: keywords
tags: [typescript, vitest, dataforseo, nextjs, api-route, react, tdd]
dependency_graph:
  requires:
    - 19-01 (AcquisitionInput/AcquisitionResult type contracts, service skeleton)
    - 19-02 (fetchRelatedKeywords in client.ts)
  provides:
    - runKeywordAcquisition full implementation (src/lib/keywords/ai-acquisition.ts)
    - POST /api/keywords/acquire IDOR-protected route (src/app/api/keywords/acquire/route.ts)
    - AiAcquireButton client component (src/app/(dashboard)/projeler/[id]/keyword-stratejisi/AiAcquireButton.tsx)
    - Kaynak sütunu + AiAcquireButton entegrasyonu (keyword-stratejisi/page.tsx)
  affects:
    - keyword-stratejisi sayfası: yeni buton + Kaynak badge kolonu
    - keywords tablosu: competitor/expansion satırları eklenir (source korunur)
tech_stack:
  added: []
  patterns:
    - "ignoreDuplicates:true upsert — manual source korunur (KWST-05)"
    - "Sequential loop with MAX_COMPETITORS=5 cap — rate limit koruması (Tuzak 2)"
    - "Silent-fail expansion/enrichment — fetchRelatedKeywords veya fetchKeywordData hata throw etse dahi acquisition başarılı"
    - "useTransition + fetch POST + router.refresh() — Tuzak 5 mitigation"
    - "Infinite-chain Proxy pattern in vitest mocks — chainable query builder test double"
key_files:
  created:
    - src/app/api/keywords/acquire/route.ts
    - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/AiAcquireButton.tsx
  modified:
    - src/lib/keywords/ai-acquisition.ts
    - src/lib/keywords/ai-acquisition.test.ts
    - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx
decisions:
  - "ignoreDuplicates:true kasıtlı — importKeywords false kullanır (volume override ister); ai-acquisition true kullanır (manual source korunması zorunlu)"
  - "fetchSeedExpansion seeds=manual keywords: volume'e göre top-10; competitor keywords dahil değil (zaten upsert'e gidecek)"
  - "enrichNewKeywords .limit(200) cap — T-19-15 DoS önlemi; patlama riski engellendi"
  - "router.refresh() AiAcquireButton'da zorunlu — server action değil fetch POST; revalidatePath client'ta çalışmaz (Tuzak 5)"
  - "Pre-existing build hataları (untracked dosyalar) kapsam dışı — plan 19-03 değişikliklerinden kaynaklanmıyor"
metrics:
  duration: "~25 dakika"
  completed: "2026-05-08"
  tasks_completed: 3
  files_created: 3
  files_modified: 2
---

# Phase 19 Plan 03: AI Keyword Acquisition Service + Route + UI Summary

**One-liner:** runKeywordAcquisition servisi tam implement edildi (competitor cap+expansion+enrichment pipeline), IDOR korumalı POST route eklendi, AiAcquireButton ile keyword-stratejisi sayfası entegre edildi, Kaynak badge kolonu eklendi.

## Tasks

| # | Name | Status | Commit |
|---|------|--------|--------|
| 1 | Implement ai-acquisition.ts service body + integration test | DONE | 6cc84a5, 2cf6701 |
| 2 | Create POST /api/keywords/acquire route + UI button + Source column wiring | DONE | 0cdb23d |
| 3 | Build verification + manual smoke commands | DONE | (no-op — verification only) |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 6cc84a5 | feat | ai-acquisition.ts full implementation + 6 integration tests |
| 0cdb23d | feat | POST route + AiAcquireButton + Kaynak column in page.tsx |
| 2cf6701 | fix | location_code added to RankedKeywordItem mock objects (Rule 1) |

## Verification Results

```
vitest run src/lib/keywords/ src/lib/dataforseo/: 5 test files, 31 tests — ALL PASSED
  - ai-acquisition.test.ts: 6 tests (export contract, shape, ignoreDuplicates, cap≤5, silent fail expansion, silent fail enrichment)
  - client.test.ts: 4 tests (Plan 02)
  - keyword-stratejisi/actions.test.ts + cluster tests: existing pass

tsc --noEmit (own files): 0 new errors
  - Pre-existing module-not-found errors for untracked files: out of scope (per Plan 01 SUMMARY)

next lint (own files): 0 errors

next build: fails on pre-existing untracked module imports (wp/pipeline, KeywordImport, etc.)
  — not caused by Plan 03 changes; same state as before Plan 03
```

## Acceptance Criteria

| Criteria | Status |
|----------|--------|
| runKeywordAcquisition exported, skeleton replaced | PASS |
| ignoreDuplicates: true literal | PASS |
| MAX_COMPETITORS = 5 literal | PASS |
| RELATED_DEPTH = 1 literal | PASS |
| import 'server-only' first line | PASS |
| vitest ≥4 passing (ai-acquisition.test.ts) | PASS (6/6) |
| manual source protection test | PASS |
| route POST export | PASS |
| route IDOR check (.eq id + user_id + 404) | PASS |
| route 503 DATAFORSEO_NOT_CONFIGURED | PASS |
| route UUID validation | PASS |
| AiAcquireButton 'use client' | PASS |
| AiAcquireButton fetch URL | PASS |
| AiAcquireButton router.refresh() | PASS |
| AiAcquireButton TR label "AI ile Keyword Çek" | PASS |
| page.tsx AiAcquireButton import | PASS |
| page.tsx source column in SELECT | PASS |
| page.tsx Kaynak TableHead | PASS |
| page.tsx Rakip/Manual/Genişletme badges | PASS |
| ClusterButton/ViewToggle/ClusterPanel untouched | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RankedKeywordItem mock missing required `location_code` field**
- **Found during:** Task 3 (tsc --noEmit check)
- **Issue:** `location_code` field is required in `RankedKeywordItem` type; test mock objects omitted it causing TS2741 error
- **Fix:** Added `location_code: 2792` to 3 mock objects in ai-acquisition.test.ts
- **Files modified:** src/lib/keywords/ai-acquisition.test.ts
- **Commit:** 2cf6701

### Pre-existing Build Failures (Out of Scope)

`next build` fails due to untracked files (wp/pipeline, KeywordImport, AddLinkDialog, etc.) that were already present before Plan 03. These are not caused by Plan 03 changes. Documented in Plan 01 SUMMARY as well. Build was failing in the same way before.

## Manual Smoke Test Checklist (UAT)

1. Keyword-stratejisi sayfası yüklenir → "AI ile Keyword Çek" butonu görünür (hem dolu hem boş keyword listesinde)
2. Butona basılır → spinner döner → "Keywordler Çekiliyor..." görünür → liste yenilenir
3. Yeni keywordler "Rakip" badge'i ile tabloda görünür; mevcut manual kayıtlar "Manual" badge'ini korur
4. DataForSEO env var silip tetiklenirse buton 503 hatasıyla kırmızı mesaj: "DataForSEO credentials yapılandırılmamış."
5. Başka kullanıcının projectId'si ile direct fetch `/api/keywords/acquire` → 404 döner

## Known Stubs

None — all functionality fully wired. No placeholders or TODO markers in Plan 03 code.

## Threat Surface Scan

All threats covered per plan's threat model:

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-19-09 | IDOR: .eq('id').eq('user_id').single() → 404 | IMPLEMENTED |
| T-19-10 | UUID regex validation → 400 | IMPLEMENTED |
| T-19-11 | Credential error filtered; only code: DATAFORSEO_NOT_CONFIGURED exposed | IMPLEMENTED |
| T-19-13 | KeywordRow type: 'competitor'\|'expansion' literal union; client cannot set source | IMPLEMENTED |
| T-19-14 | ignoreDuplicates: true + integration test verifying manual source preserved | IMPLEMENTED |
| T-19-15 | enrichNewKeywords .limit(200) cap | IMPLEMENTED |

## Self-Check

```bash
[ -f "src/lib/keywords/ai-acquisition.ts" ] → FOUND
[ -f "src/app/api/keywords/acquire/route.ts" ] → FOUND
[ -f "src/app/(dashboard)/projeler/[id]/keyword-stratejisi/AiAcquireButton.tsx" ] → FOUND
git log: 6cc84a5 → FOUND
git log: 0cdb23d → FOUND
git log: 2cf6701 → FOUND
vitest: 31 tests passed → CONFIRMED
```

## Self-Check: PASSED
