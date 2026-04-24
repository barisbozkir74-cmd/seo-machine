---
phase: 07-site-blueprint-tree
plan: "01"
subsystem: database, api
tags: [site-blueprint, server-actions, slugify, page-generation, clustering, typescript]

# Dependency graph
requires:
  - phase: 06-keyword-clustering-scoring
    provides: keyword_clusters table with intent, primary_keyword_id fields
  - phase: 02-project-core
    provides: pages table schema (parent_id, cluster_id, focus_keyword_id, sort_order, page_type, slug)
provides:
  - "slugify(text, existingSlugs) — D-06 kurallı slug üretici: Türkçe normalize, max 60 char, -2/-3 duplicate suffix"
  - "generatePagesFromClusters Server Action — BLUE-01/BLUE-02: cluster'lardan batch pages INSERT, duplicate guard, ownership check"
  - "reorderPage Server Action — BLUE-03: aynı parent altındaki kardeşle sort_order takası, Promise.all ile"
  - "INTENT_TO_PAGE_TYPE sabit haritası — D-02: intent → page_type kuralları"
  - "intentToPageType() yardımcı fonksiyonu — null-safe intent lookup"
  - "GenerateRowInput ve GenerateResult tip tanımları"
affects:
  - 07-02-PLAN (GeneratePagesDialog + GenerateFromClustersButton + tab switcher bu action'ları çağırır)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Slug üretimi: TR_MAP lookup + normalize() + Set-based duplicate suffix — pure function, no deps"
    - "Batch INSERT guard: existingPages sorgusu → takenClusterIds Set → skip/insert ayrımı"
    - "sort_order swap: Promise.all([update current, update neighbor]) pattern"
    - "UUID validation guard: /^[0-9a-f-]{36}$/i — her Server Action'da tüm string UUID parametrelerine uygulandı"
    - "Cluster ownership double-check: .in('id', clusterIds).eq('user_id', user.id) — başka kullanıcının cluster'ını projeye bağlanamaz"

key-files:
  created:
    - "src/lib/pages/slugify.ts"
    - "src/lib/pages/slugify.test.ts"
  modified:
    - "src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts"

key-decisions:
  - "slugify pure function olarak src/lib/pages/ altına alındı — server-only değil, test edilebilir, client da kullanabilir"
  - "generatePagesFromClusters rows[]'u UI'dan alır (pageName, pageType, clusterId) — D-02 taslak type'ı sunulur ama kullanıcı override edebilir"
  - "Duplicate guard cluster_id bazlı — aynı cluster için ikinci INSERT skip edilir, sayısı skipped olarak raporlanır"
  - "reorderPage kenar durum: ilk/son kardeşte no-op { success: true } döner — UI disabled prop için ayrı kontrol gerekli"
  - "priority: 'orta' (Türkçe) — mevcut addPage ile tutarlılık için"
  - "site-blueprint/ dosyaları (AddPageModal, MenuEditor, page.tsx) worktree'ye kopyalandı — ana repo'da uncommitted olduklarından worktree'de görünmüyordu (Rule 3 blocker)"

patterns-established:
  - "TDD RED-GREEN pattern: test.ts commit (failing) → implementation commit (10/10 pass)"
  - "Server Action'larda DoS guard: rows.length > 500 early return (clusterAndScoreKeywords ile aynı limit)"

requirements-completed: [BLUE-01, BLUE-02, BLUE-03]

# Metrics
duration: 15min
completed: 2026-04-24
---

# Phase 7 Plan 01: Site Blueprint Backend Foundation Summary

**D-06 kurallı `slugify` pure function + `generatePagesFromClusters` (batch INSERT + duplicate guard) + `reorderPage` (sort_order swap via Promise.all) Server Action'ları site-blueprint/actions.ts'e eklendi**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-24T18:08:00Z
- **Completed:** 2026-04-24T18:21:00Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 added to worktree)

## Accomplishments
- `slugify.ts` — D-06 kurallarıyla Türkçe karakter normalizasyonu, 60-char max, -2/-3 duplicate suffix; 10/10 vitest test geçer
- `generatePagesFromClusters` — BLUE-01/BLUE-02 gereksinimleri; cluster intent'ten page_type türetir (D-02), cluster_id duplicate guard, ownership double-check, DoS limiti (>500 row)
- `reorderPage` — BLUE-03 gereksinimi; adjacent sibling sort_order takası Promise.all ile, edge-case no-op

## Task Commits

Her task atomik olarak commit edildi (TDD akışı):

1. **Task 1 RED: slugify.test.ts (failing)** - `599bfcf` (test)
2. **Task 1 GREEN: slugify.ts implementation** - `1b191ca` (feat)
3. **Task 2: site-blueprint/actions.ts additions** - `f3ad209` (feat)

## Files Created/Modified
- `src/lib/pages/slugify.ts` — D-06 slug üretici; `slugify(text, existingSlugs[])` export
- `src/lib/pages/slugify.test.ts` — 10 vitest test case (Türkçe char, max length, duplicate suffix, edge cases)
- `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts` — `generatePagesFromClusters` + `reorderPage` + `INTENT_TO_PAGE_TYPE` + `intentToPageType` + `GenerateRowInput` + `GenerateResult` eklendi; mevcut `addPage`/`deletePage`/`upsertMenu` korundu
- `src/app/(dashboard)/projeler/[id]/site-blueprint/AddPageModal.tsx` — worktree'ye kopyalandı (uncommitted dosya)
- `src/app/(dashboard)/projeler/[id]/site-blueprint/MenuEditor.tsx` — worktree'ye kopyalandı (uncommitted dosya)
- `src/app/(dashboard)/projeler/[id]/site-blueprint/page.tsx` — worktree'ye kopyalandı (uncommitted dosya)

## Decisions Made
- `slugify` pure function olarak `src/lib/pages/` altına alındı — server-only değil, test edilebilir
- `generatePagesFromClusters` cluster ownership'i çift katmanlı doğrular: `verifyProjectOwnership` (proje) + `.in('id', clusterIds).eq('user_id', user.id)` (cluster)
- `priority: 'orta'` (Türkçe) kullanıldı — mevcut `addPage` ile tutarlılık

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] site-blueprint/ dizini worktree'de commit edilmemiş durumda**
- **Found during:** Task 2 başlangıcı
- **Issue:** `site-blueprint/actions.ts`, `AddPageModal.tsx`, `MenuEditor.tsx`, `page.tsx` ana repoda modified (uncommitted) olduğundan worktree'de görünmüyordu
- **Fix:** Ana repo'dan dosyaları worktree dizinine kopyaladım; Task 2'de yeni action'ları bu kopyaya ekledim ve commit ettim
- **Files modified:** Tüm site-blueprint/ dosyaları worktree'ye eklendi
- **Verification:** `git status` onayladı; TypeScript compile başarılı
- **Committed in:** f3ad209

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Zorunlu workaround — worktree izolasyonu uncommitted dosyaları görmüyor. Site-blueprint dosyaları artık bu worktree'de commit edildi, 07-02 planı bunları doğrudan kullanabilir.

## Issues Encountered
- Git worktree'de uncommitted ana repo dosyalarına erişilemediği anlaşıldı — site-blueprint/ tüm dosyaları worktree'ye kopyalanarak çözüldü

## Known Stubs
None — bu plan UI bileşeni içermiyor; tüm Server Action'lar tam implementasyonla tamamlandı.

## Threat Flags
Yok — tüm threat_model T-07-01–T-07-06 mitigasyonları implement edildi.

## Next Phase Readiness
- `generatePagesFromClusters` ve `reorderPage` 07-02 planı için hazır
- `INTENT_TO_PAGE_TYPE` `GeneratePagesDialog` içinde ithal edilebilir
- `slugify` import'u `@/lib/pages/slugify` — 07-02 bileşenlerinden doğrudan kullanılabilir

---
*Phase: 07-site-blueprint-tree*
*Completed: 2026-04-24*
