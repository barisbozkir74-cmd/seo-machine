---
phase: 17-keyword-intelligence
plan: "02"
subsystem: keywords
tags: [niche-scoring, server-action, revenue-override, security, wave-1]

requires:
  - phase: 17-01
    provides: calculateNicheScore, classifyRevenueType, ClusterKeywordData

provides:
  - recalculateClusterNicheScore (private helper — injected into 3 actions)
  - updateClusterRevenue (exported server action — revenue override)
  - UpdateClusterRevenueResult (exported type)
  - VALID_REVENUE_TYPES whitelist

affects:
  - 17-03 (Wave 2 UI — RevenueOverrideSelect imports updateClusterRevenue)
  - keyword_clusters.opportunity_score (written on cluster mutations)
  - keyword_clusters.revenue_type (written on cluster mutations + override)

tech-stack:
  added: []
  patterns:
    - "Cluster mutation → recalculate helper pattern (inject before revalidatePath)"
    - "Project-wide normalization context (Pitfall 3 solution)"
    - "VALID_REVENUE_TYPES whitelist as const array — T-17-02 mitigation"
    - "Dual ownership check: project_id + user_id in SELECT before UPDATE"

key-files:
  created: []
  modified:
    - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts

key-decisions:
  - "recalculateClusterNicheScore takes allClusterVolumes[] as parameter — proje geneli normalizasyon context dışarıdan verilir, her çağrıda DB'ye gidilmez"
  - "deleteKeyword injection: remaining > 0 kontrolü Phase 17 bloğunda ayrı yapılır, mevcut 'son keyword ise cluster sil' bloğuna dokunulmaz"
  - "updateClusterRevenue whitelist kontrolü DB erişiminden ÖNCE yapılır — erken return güvenlik sınırını kapıdan önce koyar"
  - "clusterAndScoreKeywords batch Promise.all — sequential değil, tüm cluster'lar paralel hesaplanır"

patterns-established:
  - "Pattern: Cluster mutation → allClusterVolumes çek → recalculate helper çağır → revalidatePath"
  - "Pattern: Whitelist → UUID validate → auth → ownership → UPDATE (güvenlik katmanları sıralı)"

requirements-completed: [NICH-01, RVEN-01]

duration: 9min
completed: "2026-05-07"
---

# Phase 17 Plan 02: Actions.ts Niche Score Entegrasyonu Summary

**actions.ts'e niche-scoring.ts import edildi, 3 cluster mutasyon action'ına recalculateClusterNicheScore inject edildi ve whitelist + ownership korumalı updateClusterRevenue server action eklendi.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-07T21:33:00Z
- **Completed:** 2026-05-07T21:43:37Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- `recalculateClusterNicheScore` private helper eklendi: cluster keyword'lerini SELECT eder, niche score + revenue type hesaplar, `keyword_clusters` tablosunu UPDATE eder
- Üç action'a injection: `moveKeywordToCluster` (hem eski hem yeni cluster — Pitfall 2), `deleteKeyword` (kalan keyword varsa), `clusterAndScoreKeywords` (proje geneli tek normalizasyon context — Pitfall 3)
- `updateClusterRevenue` exported action: VALID_REVENUE_TYPES whitelist, UUID format kontrolü, auth, ownership (T-17-01), geçersiz revenue_type erken return (T-17-02)

## Task Commits

Her task atomik olarak commit edildi:

1. **Task 1: recalculateClusterNicheScore + 3 injection** - `cfa5acd` (feat)
2. **Task 2: updateClusterRevenue action** - `d89bf20` (feat)

## Files Created/Modified

- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` — import + helper + 3 injection + 1 exported action eklendi

## Decisions Made

- `recalculateClusterNicheScore` helper imzası: `(clusterId, userId, supabase, allClusterVolumes[])` — allClusterVolumes dışarıdan parametre olarak alındı, her çağrıda tek DB round-trip yapılıyor (cluster değişikliği başında bir kez çekiliyor)
- `deleteKeyword` injection sırası: Phase 17 bloğu (`remaining > 0` kontrolü) mevcut "son keyword ise cluster sil" bloğundan ÖNCE eklendi — remaining > 0 garantisi her iki bloğun bağımsız çalışmasını sağlar
- Whitelist kontrolü action başında (DB erişimi olmadan) yapılır — güvenlik katmanı en dışta

## Deviations from Plan

None — plan tam olarak planlandığı şekilde execute edildi.

## Issues Encountered

`audit-flags.test.ts` içinde önceden var olan 1 test hatası tespit edildi (`flag_missing_metadata false` assertion). Bu hata bu plan'ın scope'u dışında — `src/lib/wp/audit-flags.ts` bu plan tarafından değiştirilmedi. Niche scoring testleri (18 test) ve keyword lib testleri green kaldı.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Wave 2 (17-03): `updateClusterRevenue` import edilmeye hazır — `RevenueOverrideSelect` client component bu action'ı çağıracak
- `keyword_clusters.opportunity_score` ve `revenue_type` artık cluster mutasyonlarında otomatik güncelleniyor
- `page.tsx` SELECT sorgusuna `opportunity_score, revenue_type` eklenmesi Wave 2'de yapılacak (ClusterPanel UI genişletme)

## Known Stubs

None — tüm action'lar gerçek DB yazma operasyonları yapıyor. Wave 2 UI bileşenleri henüz oluşturulmadı (plan scope'u dışı).

## Threat Flags

None — tüm threat register mitigation'ları (T-17-01, T-17-02, T-17-03) bu plan kapsamında implement edildi.

## Self-Check

### Files Exist

- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts`: FOUND
- `src/lib/keywords/niche-scoring.ts` (bağımlılık): FOUND

### Commits Exist

- cfa5acd: Task 1 — recalculateClusterNicheScore helper + 3 injection points
- d89bf20: Task 2 — updateClusterRevenue action

### Acceptance Criteria Verification

- `grep "import.*niche-scoring"` → FOUND: `import { calculateNicheScore, classifyRevenueType } from '@/lib/keywords/niche-scoring'`
- `grep "recalculateClusterNicheScore" | wc -l` → 5 (1 tanım + 4 çağrı)
- `grep "opportunity_score.*revenue_type"` → FOUND: `.update({ opportunity_score: nicheScore, revenue_type: revenueType })`
- `grep "export async function updateClusterRevenue"` → FOUND
- `grep "VALID_REVENUE_TYPES"` → FOUND: `const VALID_REVENUE_TYPES = ['bilgi', 'mixed', 'ticari'] as const`
- `grep "export type UpdateClusterRevenueResult"` → FOUND
- `npx tsc --noEmit | grep "error TS" | wc -l` → 0
- `npx vitest run src/lib/keywords/niche-scoring.test.ts` → 18 passed

## Self-Check: PASSED

---
*Phase: 17-keyword-intelligence*
*Completed: 2026-05-07*
