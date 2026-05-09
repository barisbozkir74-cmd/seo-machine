---
phase: 20-ai-keyword-clustering-approval
plan: 02
subsystem: api
tags: [server-actions, supabase, typescript, tdd, vitest, keyword-clustering, approval-flow]

requires:
  - phase: 20-ai-keyword-clustering-approval/20-01
    provides: keyword_clusters.status column + updateClusterStatus + approveStrategy actions + 6 unit tests

provides:
  - DraftCluster export type in actions.ts (id, cluster_name, intent, total_volume, status:'draft', keywords[])
  - removeKeywordFromCluster server action: UUID validate → getUser → ownership → cluster_id=null → volume recalculate
  - clusterAndScoreKeywords extended: approved cluster protection (D-05), draft DELETE before re-cluster, INSERT with status='draft', DraftCluster[] return, revalidatePath removed
  - ClusterButton.tsx extended: onSuccess?: (draftClusters: DraftCluster[]) => void prop for overlay trigger (D-08)
  - 11 unit tests (3 new for removeKeywordFromCluster + 1 DraftCluster type check + 7 existing)

affects:
  - 20-03 (Wave 2 — ClusteringApprovalOverlay consumes DraftCluster[] from ClusterButton.onSuccess)
  - 20-03 (StratejiOnaylaButton calls approveStrategy after overlay closes)

tech-stack:
  added: []
  patterns:
    - "DraftCluster type: actions.ts'den export — overlay ve ClusterButton arasında type-safe data akışı"
    - "clusterAndScoreKeywords: upsert → INSERT (Pitfall 2 — approved cluster üzerine yazma önlemi)"
    - "D-05 approved cluster koruması: fetch approved IDs → filter keywords → skip approved"
    - "revalidatePath kaldırıldı clusterAndScoreKeywords'den — overlay lifecycle sonunda approveStrategy tetikler"
    - "TDD: RED commit d805972 → GREEN commit a82c384 sırası korundu"

key-files:
  created: []
  modified:
    - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts — DraftCluster type + removeKeywordFromCluster + clusterAndScoreKeywords update + ClusterAndScoreResult extension
    - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterButton.tsx — onSuccess callback prop
    - src/lib/keywords/clustering-approval.test.ts — removeKeywordFromCluster 4 tests + DraftCluster type test

key-decisions:
  - "clusterAndScoreKeywords upsert → INSERT değiştirildi: approved cluster'lar silme/overwrite edilmesin (D-05 + Pitfall 2)"
  - "revalidatePath clusterAndScoreKeywords'den kaldırıldı: overlay açıkken page refresh overlay state'i sıfırlar (Pitfall 3)"
  - "DraftCluster tipi actions.ts'de export edildi: Wave 2 bileşenleri aynı kaynaktan type import eder"
  - "removeKeywordFromCluster boş cluster silmez: kullanıcı ayrıca reddetmeli (Pitfall 4 — D-04 uyumu)"

patterns-established:
  - "Pattern 4: clusterAndScoreKeywords approved cluster koruması — approved IDs fetch → keywords filter → draft delete → INSERT"
  - "Pattern 5: onSuccess callback prop — ClusterButton result.clusters callback üzerinden overlay'e aktarılır"
  - "Pattern 6: DraftCluster array accumulator — for döngüsü içinde push, fonksiyon sonunda return"

requirements-completed: [KWST-03, KWST-04]

duration: 15min
completed: 2026-05-09
---

# Phase 20 Plan 02: Wave 1 — Backend Server Actions + ClusterButton Extension Summary

**removeKeywordFromCluster server action (IDOR-safe, no revalidatePath) + clusterAndScoreKeywords draft-aware INSERT + DraftCluster type + ClusterButton onSuccess callback — 11/11 tests green, 0 TypeScript errors**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-09T18:44:00Z
- **Completed:** 2026-05-09T18:50:00Z
- **Tasks:** 3 (+ 1 TDD RED commit)
- **Files modified:** 3

## Accomplishments

- `removeKeywordFromCluster` server action eklendi: UUID validation → auth → cluster ownership (IDOR) → keyword.cluster_id=null → total_volume recalculate; revalidatePath YOK (overlay state korunur)
- `DraftCluster` tipi export edildi: Wave 2 overlay bileşenleri için type-safe data contract
- `clusterAndScoreKeywords` güncellendi: approved cluster koruması (D-05), eski draft'ları sil, `status='draft'` ile INSERT, `DraftCluster[]` döner, revalidatePath kaldırıldı
- `ClusterButton` genişletildi: `onSuccess?: (draftClusters: DraftCluster[]) => void` prop ekli; başarıda overlay trigger hazır (D-08)
- TDD RED/GREEN sırası korundu: 4 failing test commit `d805972` → GREEN `a82c384`

## Task Commits

1. **TDD RED: removeKeywordFromCluster tests** - `d805972` (test) — 4 failing test + DraftCluster type check
2. **Task 1 GREEN: DraftCluster + removeKeywordFromCluster** - `a82c384` (feat) — 11/11 tests green
3. **Task 2: clusterAndScoreKeywords update** - `c0f9f47` (feat) — draft INSERT + DraftCluster[] return + approved protection
4. **Task 3: ClusterButton onSuccess prop** - `7098a1a` (feat) — overlay callback wired

## Files Created/Modified

- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` — DraftCluster type, removeKeywordFromCluster action, ClusterAndScoreResult extension, clusterAndScoreKeywords rewrite
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterButton.tsx` — onSuccess?: (draftClusters: DraftCluster[]) => void prop
- `src/lib/keywords/clustering-approval.test.ts` — removeKeywordFromCluster 4 tests + DraftCluster 1 type test

## Decisions Made

- `clusterAndScoreKeywords`'deki upsert INSERT ile değiştirildi: approved cluster'lar artık DELETE+INSERT akışında korunuyor (D-05). Eski upsert conflict key'i cluster_name'e göre çalışıyordu — approved cluster aynı isimde draft üretilirse overwrite riski vardı.
- `revalidatePath` clusterAndScoreKeywords'den kaldırıldı: overlay açıkken server revalidation UI'ı unmount edebilir. Wave 2'de `approveStrategy` çağrısı revalidation'ı tetikleyecek.
- `DraftCluster.status: 'draft'` literal type — overlay sadece draft cluster'ları işler; yanlışlıkla approved cluster gösterilmesini önler.

## Deviations from Plan

None — plan tam olarak uygulandı. TDD RED/GREEN protokolü korundu. Tüm must_haves truth'ları karşılandı.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Known Stubs

Yok — bu plan yalnızca server action'lar ve ClusterButton prop genişletmesi içeriyor; UI bileşeni henüz yok. Wave 2 (20-03) ClusteringApprovalOverlay ve StratejiOnaylaButton'ı oluşturacak.

## Threat Surface Scan

Plan'ın threat model'inde kayıtlı:
- T-20-01 (IDOR): `removeKeywordFromCluster`'da `.eq('user_id', user.id)` + `.eq('project_id', projectId)` ownership check uygulandı
- T-20-02 (Status whitelist): `updateClusterStatus`'da VALID_CLUSTER_STATUSES whitelist zaten mevcut (Wave 0)
- T-20-03 (Privilege escalation): `approveStrategy`'de project ownership check mevcut (Wave 0)

Ek tehdit yüzeyi yok.

## Next Phase Readiness

- Wave 1 tamamlandı — tüm server action'lar hazır: updateClusterStatus, removeKeywordFromCluster, approveStrategy
- clusterAndScoreKeywords artık DraftCluster[] döndürüyor — overlay veri kaynağı hazır
- ClusterButton onSuccess prop bekliyor — Wave 2 overlay bileşeni bu prop'u kullanacak
- Wave 2 (20-03) başlayabilir: ClusteringApprovalOverlay + ApprovalClusterRow + ApprovalKeywordRow + StatusBadge + StratejiOnaylaButton + page.tsx güncelleme

## Self-Check: PASSED

- FOUND: `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` (removeKeywordFromCluster + DraftCluster)
- FOUND: `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterButton.tsx` (onSuccess prop)
- FOUND: `src/lib/keywords/clustering-approval.test.ts` (11 tests)
- FOUND: commits d805972, a82c384, c0f9f47, 7098a1a
- TESTS: 11/11 passing
- TYPESCRIPT: 0 errors

---
*Phase: 20-ai-keyword-clustering-approval*
*Completed: 2026-05-09*
