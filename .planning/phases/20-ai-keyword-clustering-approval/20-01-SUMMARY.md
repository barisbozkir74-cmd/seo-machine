---
phase: 20-ai-keyword-clustering-approval
plan: 01
subsystem: database
tags: [supabase, migration, vitest, tdd, server-actions, keyword-clustering]

requires:
  - phase: 19-ai-keyword-data-acquisition
    provides: keyword enrichment pipeline + keywords table with search_intent

provides:
  - supabase/migrations/20260509000010_clustering_approval.sql — keyword_clusters.status CHECK constraint + projects.keyword_strategy_approved
  - updateClusterStatus server action with VALID_CLUSTER_STATUSES whitelist, ownership check, no revalidatePath
  - approveStrategy server action with project ownership check and revalidatePath
  - 6 unit tests (mocked Supabase) in clustering-approval.test.ts — all passing

affects:
  - 20-02 (Wave 1 — overlay components read status column and call these actions)
  - 20-03 (Wave 2 — StratejiOnaylaButton reads keyword_strategy_approved)
  - 21 (Site Blueprint gate reads projects.keyword_strategy_approved)

tech-stack:
  added: []
  patterns:
    - "VALID_CLUSTER_STATUSES whitelist before UUID validation in server actions"
    - "vault.ts vi.mock in test files to prevent module-level Supabase crash"
    - "revalidatePath omitted from updateClusterStatus to preserve overlay state (Pitfall 3)"

key-files:
  created:
    - supabase/migrations/20260509000010_clustering_approval.sql
    - src/lib/keywords/clustering-approval.test.ts
  modified:
    - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts
    - src/lib/keywords/clustering.test.ts

key-decisions:
  - "vault.ts requires vi.mock in test files because it instantiates Supabase client at module level — test environment has no env vars"
  - "Test IDs must be valid UUID v4 format (36 chars) to pass UUID regex validation in server actions"
  - "updateClusterStatus omits revalidatePath to preserve overlay client state during approval flow"

patterns-established:
  - "Pattern 1: vault.ts mock — always mock @/lib/supabase/vault when testing server actions that import actions.ts"
  - "Pattern 2: UUID test IDs — use real UUID v4 format in test constants (e.g., 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')"
  - "Pattern 3: status whitelist before UUID check — input validation before DB interaction"

requirements-completed: [KWST-03, KWST-04]

duration: 3min
completed: 2026-05-09
---

# Phase 20 Plan 01: Wave 0 — DB Migration + Clustering Approval Actions Summary

**keyword_clusters.status CHECK constraint (draft/approved/rejected) + projects.keyword_strategy_approved migration, plus updateClusterStatus and approveStrategy server actions with 6 passing unit tests**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-09T15:38:25Z
- **Completed:** 2026-05-09T15:41:50Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Migration `20260509000010_clustering_approval.sql` oluşturuldu ve remote DB'ye başarıyla push edildi — `keyword_clusters.status` CHECK constraint (draft/approved/rejected) + `projects.keyword_strategy_approved BOOLEAN DEFAULT false` artık DB'de mevcut
- Mevcut cluster'lar `status='approved'` ile güncellendi (geriye dönük uyumluluk — D-07)
- `updateClusterStatus` ve `approveStrategy` server action'ları `actions.ts`'e eklendi — VALID_CLUSTER_STATUSES whitelist, UUID validation, ownership check pattern uygulandı
- `clustering-approval.test.ts` 6 unit test (mocked Supabase) yazıldı — TDD RED/GREEN tamamlandı, tüm testler yeşil
- `clustering.test.ts` Phase 20 smoke test eklendi — `clusterEnrichedKeywords` çıktısının status alanı taşımadığı belgelendi

## Task Commits

1. **Task 1: Migration SQL** - `85adf23` (feat) — `20260509000010_clustering_approval.sql` oluşturuldu
2. **Task 2: Migration push** - (DB operasyonu, commit yok — remote DB güncel)
3. **Task 3 RED: Failing tests** - `0a16f47` (test) — 6 failing test, vault mock ile RED gate
4. **Task 3 GREEN: Implementation** - `3350448` (feat) — actions eklendi, test ID'leri düzeltildi, tüm testler green

## Files Created/Modified

- `supabase/migrations/20260509000010_clustering_approval.sql` — status CHECK constraint + keyword_strategy_approved kolon migration
- `src/lib/keywords/clustering-approval.test.ts` — updateClusterStatus (4 test) + approveStrategy (2 test), mocked Supabase
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` — updateClusterStatus + approveStrategy fonksiyonları eklendi
- `src/lib/keywords/clustering.test.ts` — Phase 20 smoke test: clusterEnrichedKeywords output has no status field

## Decisions Made

- `vault.ts` modül seviyesinde Supabase client oluşturuyor; test dosyasında `vi.mock('@/lib/supabase/vault', ...)` zorunlu oldu
- Test ID'leri UUID regex'ini geçmesi için gerçek UUID v4 formatında sabitler olarak tanımlandı
- `updateClusterStatus` revalidatePath çağırmıyor — D-08 / PATTERNS.md Pitfall 3: overlay state korunmalı

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vault.ts modül-seviyesi Supabase crash — test env mock eklendi**
- **Found during:** Task 3 (clustering-approval.test.ts ilk çalıştırma)
- **Issue:** `vault.ts` modül seviyesinde `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, ...)` çağırıyor; test ortamında env var yok → crash
- **Fix:** Test dosyasına `vi.mock('@/lib/supabase/vault', ...)` eklendi; tüm vault export'ları mock'landı
- **Files modified:** src/lib/keywords/clustering-approval.test.ts
- **Verification:** `npx vitest run src/lib/keywords/clustering-approval.test.ts` — 6/6 pass
- **Committed in:** 3350448 (Task 3 GREEN commit)

**2. [Rule 1 - Bug] Test ID'leri UUID regex'ini geçmiyordu**
- **Found during:** Task 3 GREEN (ilk test çalıştırması)
- **Issue:** Plan'daki örnek test ID'leri (`'proj-abc-12345678901234567890'`) 30 karakter — `/^[0-9a-f-]{36}$/i` regex fail; 5 test fail oldu
- **Fix:** UUID v4 formatında sabitler tanımlandı: `CLUSTER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'`, `PROJECT_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'`
- **Files modified:** src/lib/keywords/clustering-approval.test.ts
- **Verification:** `npx vitest run src/lib/keywords/clustering-approval.test.ts` — 6/6 pass
- **Committed in:** 3350448 (Task 3 GREEN commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 - Bug)
**Impact on plan:** Zorunlu düzeltmeler; test altyapısı ve UUID validation uyumu. Kapsam değişikliği yok.

## Issues Encountered

- `clustering-approval.test.ts` başlangıçta sadece `@/lib/supabase/server` mock'lanmıştı; `actions.ts` import zinciri `vault.ts`'e kadar gidip modül-seviyesinde crash yapıyordu. Mevcut `clustering.test.ts` bu sorunla karşılaşmıyor çünkü `clustering.ts`'i test ediyor (vault bağımlılığı yok).

## Threat Surface Scan

Yeni fonksiyonlar (`updateClusterStatus`, `approveStrategy`) plan'ın threat model'inde kayıtlı:
- T-20-01: `keyword_clusters.status` CHECK constraint — migration'da uygulandı
- T-20-02: Status whitelist validation — `VALID_CLUSTER_STATUSES` whitelist eklendi
- T-20-03: `projects.keyword_strategy_approved` — ownership check `approveStrategy`'de uygulandı

Ek tehdit yüzeyi yok.

## Known Stubs

Yok — bu plan yalnızca DB migration ve server action'lar içeriyor; UI bileşeni yok.

## Next Phase Readiness

- Wave 0 tamamlandı — `keyword_clusters.status` ve `projects.keyword_strategy_approved` kolonları remote DB'de mevcut
- `updateClusterStatus` ve `approveStrategy` action'ları test edildi ve hazır
- Wave 1 (20-02) başlayabilir: ClusteringApprovalOverlay, ApprovalClusterRow, ApprovalKeywordRow bileşenleri bu action'ları kullanacak
- `removeKeywordFromCluster` action'ı Wave 1 planında oluşturulacak (bu planda kapsam dışı)

## Self-Check: PASSED

- FOUND: `supabase/migrations/20260509000010_clustering_approval.sql`
- FOUND: `src/lib/keywords/clustering-approval.test.ts`
- FOUND: `.planning/phases/20-ai-keyword-clustering-approval/20-01-SUMMARY.md`
- FOUND: commits 85adf23, 0a16f47, 3350448
- TESTS: 6/6 passing

---
*Phase: 20-ai-keyword-clustering-approval*
*Completed: 2026-05-09*
