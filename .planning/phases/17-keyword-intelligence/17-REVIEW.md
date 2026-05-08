---
phase: 17-keyword-intelligence
reviewed: 2026-05-07T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/lib/keywords/niche-scoring.ts
  - src/lib/keywords/niche-scoring.test.ts
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/RevenueBadge.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/RevenueOverrideSelect.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-05-07T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 17 introduces cluster-level niche scoring and revenue classification. The core scoring logic (`niche-scoring.ts`) is clean and well-tested. Security posture is solid — all server actions validate ownership and use whitelists. The identified issues are logic bugs and missing error handling rather than security concerns.

Four warnings were found: a double-query bug in `deleteKeyword` that can make niche-score recalculation use stale cluster volumes, a `maxCpc` normalization scope error in `recalculateClusterNicheScore`, a missing error propagation gap for the primary keyword after cluster deletion, and an unhandled error return in `RevenueOverrideSelect`. Three info-level items cover code duplication, a test approximation tolerance that is too loose, and an unchecked `notFound()` redirect when the user is unauthenticated.

---

## Warnings

### WR-01: `recalculateClusterNicheScore` — `maxCpc` scoped to single cluster instead of project-wide

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts:461`

**Issue:** `maxCpc` is computed from the keywords of the single cluster being recalculated, not from all keywords in the project. This means the CPC component of the niche score is normalized against the cluster's own maximum rather than the global project maximum, producing inconsistent and incomparable scores between clusters. For example, a cluster with a single $5 CPC keyword will always score 100 on the CPC sub-component regardless of other clusters that may contain $10 CPC keywords.

The `maxClusterVolume` is correctly taken from `allClusterVolumes` (project-wide), but `maxCpc` is not given the same treatment.

```typescript
// Current (wrong):
const maxCpc = Math.max(...keywords.map((k) => k.cpc ?? 0), 0)

// Fix — pass allKeywords (or just maxCpc) from the call site, the same way maxClusterVolume is passed:
async function recalculateClusterNicheScore(
  clusterId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  allClusterVolumes: number[],
  maxProjectCpc: number           // <-- add this
): Promise<void> {
  // ...
  const nicheScore = calculateNicheScore(keywords, {
    maxClusterVolume: Math.max(...allClusterVolumes, 0),
    maxCpc: maxProjectCpc,        // <-- use project-wide value
  })
}
```

At call sites, compute `maxProjectCpc` once from all project keywords before launching the `Promise.all` loop:
```typescript
const { data: allKwForCpc } = await supabase
  .from('keywords')
  .select('cpc')
  .eq('project_id', projectId)
  .eq('user_id', user.id)
const maxProjectCpc = Math.max(...(allKwForCpc ?? []).map((k) => k.cpc ?? 0), 0)
```

---

### WR-02: `deleteKeyword` — niche-score recalculation uses stale `allClusterVolumes`

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts:169-183`

**Issue:** The niche-score recalculation at line 174-182 fetches `allClusterVolumes` from `keyword_clusters.total_volume`, but at this point the cluster's `total_volume` has not been updated to reflect the removed keyword. The `total_volume` column on the cluster is set during initial import/clustering but is not decremented on keyword delete. So `maxClusterVolume` can be stale, causing the recalculated score to be normalised against a higher ceiling than the actual current state.

If the project does not actively maintain `total_volume` on delete, the `allClusterVolumes` fetch is anyway picking up the old value for the affected cluster. This makes the score diverge from what `clusterAndScoreKeywords` would produce for the same data.

**Fix:** Either update `total_volume` on the affected cluster before recalculating, or document clearly that `total_volume` is a snapshot and scores will drift until the next full recluster. If the latter, surface a UI hint (already partially done via the enrichment banner pattern).

---

### WR-03: `deleteKeyword` — keyword count queried twice against the database

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts:169-198`

**Issue:** After deleting a keyword, the code queries `keywords` for `count` twice using two separate `select('id', { count: 'exact', head: true })` calls (lines 170-173 and 187-190), both with `.eq('cluster_id', kw.cluster_id)`. The first checks whether remaining keywords exist (to trigger niche-score recalculation), and the second checks whether the cluster is now empty (to auto-delete it). The second query always runs after the first, even though the result of the first query is already available.

This is a correctness edge case in addition to the extra round-trip: if `remaining` from the first query is `1`, the niche score is recalculated (correct) but the cluster is then also deleted (correct), while if `remaining` is `0` the niche score recalculation is skipped but the cluster is then deleted. However, between the two queries another concurrent request could change the count. More critically, the variable from the first query (`remaining`) is not reused for the second check.

**Fix:** Capture the count once and reuse it:
```typescript
const { count: remaining } = await supabase
  .from('keywords')
  .select('id', { count: 'exact', head: true })
  .eq('cluster_id', kw.cluster_id)

const remainingCount = remaining ?? 0

if (remainingCount > 0) {
  // recalculate niche score
  await recalculateClusterNicheScore(...)
} else {
  // delete empty cluster
  await supabase.from('keyword_clusters').delete().eq('id', kw.cluster_id).eq('user_id', user.id)
}
```

---

### WR-04: `RevenueOverrideSelect` — server action error is silently swallowed

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/RevenueOverrideSelect.tsx:26-28`

**Issue:** The `updateClusterRevenue` server action returns `{ success: false; error: string }` on failure, but the component ignores the return value entirely. If the update fails (network error, ownership check failure, etc.), the select will visually snap back to the old value on the next render (since the mutation did not persist), but no error is communicated to the user. This is a silent failure.

```typescript
// Current:
startTransition(async () => {
  await updateClusterRevenue(clusterId, newValue, projectId)
})

// Fix — handle the result:
startTransition(async () => {
  const result = await updateClusterRevenue(clusterId, newValue, projectId)
  if (!result.success) {
    // toast or console.error at minimum
    console.error('[RevenueOverrideSelect] update failed:', result.error)
  }
})
```

If the project uses a toast library, surface the error message to the user. If not, at least log it so failures are visible during development.

---

## Info

### IN-01: `kdColor` and `formatVolume` are duplicated across `page.tsx` and `ClusterPanel.tsx`

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx:22-32` and `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx:35-45`

**Issue:** Both files define identical `kdColor` and `formatVolume` functions. These are pure utilities that should live in a shared module (e.g., `./utils.ts` or `./formatters.ts`) and be imported by both components.

**Fix:** Extract to a co-located utility file:
```typescript
// keyword-stratejisi/utils.ts
export function kdColor(kd: number): { dot: string; label: string } { ... }
export function formatVolume(v: number): string { ... }
```

---

### IN-02: Test case tolerance for `calculateNicheScore` is too loose

**File:** `src/lib/keywords/niche-scoring.test.ts:19`

**Issue:** The test comment derives the expected score as `64.8` and asserts with `toBeCloseTo(64.8, 0)`. The second argument to `toBeCloseTo` is the number of decimal digits of precision, so `0` means the assertion only requires the value to be within `±0.5` of 64.8 (i.e., anything from 64.3 to 65.3 would pass). Since `calculateNicheScore` returns one decimal place, the test should use `toBeCloseTo(64.8, 1)` to verify the actual decimal rounding.

**Fix:**
```typescript
expect(score).toBeCloseTo(64.8, 1)  // ±0.05 tolerance
```

---

### IN-03: Unauthenticated user in `page.tsx` receives `notFound()` instead of a redirect to login

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx:70`

**Issue:** When `user` is null (unauthenticated), the page calls `notFound()` which renders a 404 page. This is misleading — the user is not missing, only their session is. The conventional pattern in Next.js server components is to `redirect('/login')` so the user understands they need to authenticate. This same pattern appears in the project codebase elsewhere (e.g., the project detail page).

**Fix:**
```typescript
import { redirect } from 'next/navigation'
// ...
if (!user) redirect('/login')  // or redirect('/giris')
```

---

_Reviewed: 2026-05-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
