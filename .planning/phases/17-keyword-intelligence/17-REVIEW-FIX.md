---
phase: 17-keyword-intelligence
fixed_at: 2026-05-07T00:00:00Z
review_path: .planning/phases/17-keyword-intelligence/17-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 17: Code Review Fix Report

**Fixed at:** 2026-05-07T00:00:00Z
**Source review:** .planning/phases/17-keyword-intelligence/17-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: `recalculateClusterNicheScore` — `maxCpc` scoped to single cluster instead of project-wide

**Files modified:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts`
**Commit:** 52910fe
**Applied fix:** Added `maxProjectCpc: number` parameter to `recalculateClusterNicheScore`. The function now uses the passed-in project-wide value instead of computing `maxCpc` from the single cluster's keywords. All three call sites (`clusterAndScoreKeywords`, `moveKeywordToCluster`, `deleteKeyword`) now query all project keywords for CPC before invoking the helper, ensuring CPC normalization is consistent across clusters.

---

### WR-02: `deleteKeyword` — niche-score recalculation uses stale `allClusterVolumes`

**Files modified:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts`
**Commit:** 52910fe
**Applied fix:** Replaced the `keyword_clusters.total_volume` snapshot query with a live query of `keywords (cluster_id, volume, cpc)` filtered by `project_id` and `user_id`. A `Map<string, number>` aggregates volume per cluster from live rows, producing an accurate `allClusterVolumes` array that reflects the state after deletion. The same live query also provides CPC values for the WR-01 fix.

---

### WR-03: `deleteKeyword` — keyword count queried twice against the database

**Files modified:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts`
**Commit:** 52910fe
**Applied fix:** The two separate `select('id', { count: 'exact', head: true })` calls are collapsed into one. The result (`remainingCount`) drives both branches: `remainingCount > 0` triggers niche-score recalculation; `remainingCount === 0` triggers cluster deletion. The second `if (kw.cluster_id)` block with its redundant count query is removed entirely.

---

### WR-04: `RevenueOverrideSelect` — server action error is silently swallowed

**Files modified:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/RevenueOverrideSelect.tsx`
**Commit:** f4e9184
**Applied fix:** The return value of `updateClusterRevenue` is now captured. On failure, `console.error` logs the error for development visibility and an `errorMsg` state variable is set. A `<span className="text-xs text-red-500">` renders the error message below the select element, giving the user clear feedback that the change was not persisted.

---

_Fixed: 2026-05-07T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
