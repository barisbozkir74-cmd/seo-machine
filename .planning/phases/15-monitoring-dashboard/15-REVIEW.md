---
phase: 15-monitoring-dashboard
reviewed: 2026-04-28T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/app/(dashboard)/projeler/[id]/ProjectNav.tsx
  - src/app/(dashboard)/projeler/[id]/izleme/cluster-summary-table.tsx
  - src/app/(dashboard)/projeler/[id]/izleme/page-metrics-table.tsx
  - src/app/(dashboard)/projeler/[id]/izleme/page.tsx
  - src/app/(dashboard)/projeler/[id]/izleme/period-tab-bar.tsx
  - src/app/api/monitoring/clusters/route.ts
  - src/app/api/monitoring/pages/route.ts
  - src/lib/monitoring/aggregation.test.ts
  - src/lib/monitoring/aggregation.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-04-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 15 introduces the monitoring dashboard: a server-rendered page (`izleme/page.tsx`), two table components, a period tab bar, two API route handlers, and a core aggregation library with unit tests. The overall architecture is sound — parallel data fetching, proper ownership checks in both the page and the API routes, and a clean separation between aggregation logic and presentation.

Two correctness issues were found. The more impactful one is in `aggregation.ts`: when `avg_position` is `null` in the database, the code substitutes `0` before accumulating the sum. Because GSC positions range from 1–100+, treating null as `0` pulls the computed average below 1, producing a nonsensical position value that will surface directly in the UI. The second warning is an auth/UX issue in the page: unauthenticated users receive a 404 rather than being redirected to login.

The remaining five findings are informational: an unbounded upper-date query, auth-by-404 pattern, fragile test mocks, a missing fallback filter in cluster metadata, and missing accessibility attributes on the tab bar.

No critical security vulnerabilities (injection, hardcoded secrets, privilege escalation) were found. The API routes correctly enforce user-project ownership before returning data.

---

## Warnings

### WR-01: `null` avg_position substituted with `0` corrupts position averages

**File:** `src/lib/monitoring/aggregation.ts:116` and `src/lib/monitoring/aggregation.ts:229`

**Issue:** When a `gsc_metrics` row has `avg_position = null`, the code does `row.avg_position ?? 0` and then adds `0` to `posSum` while still incrementing `posCount`. GSC positions are always >= 1, so `0` is an impossible value that drags the computed average downward. A cluster or page with even one null-position row will show an artificially low `avgPosition` (e.g., 0.5 instead of 3.0).

**Fix:** Skip null-position rows from the position accumulation entirely — only update `posSum`/`posCount` when `avg_position` is non-null:

```typescript
// aggregation.ts — getClusterMetrics, inside the for (const row of metrics) loop
const posValue = row.avg_position  // keep as number | null
if (existing) {
  existing.clicks += row.clicks
  existing.impressions += row.impressions
  if (posValue !== null) {
    existing.posSum += posValue
    existing.posCount += 1
  }
} else {
  clusterAgg.set(clusterId, {
    clicks: row.clicks,
    impressions: row.impressions,
    posSum: posValue ?? 0,
    posCount: posValue !== null ? 1 : 0,
  })
}
```

Apply the identical change to the `reduceMetrics` inner function in `getPageMetrics` (lines 224–244).

---

### WR-02: Unauthenticated users receive 404 instead of login redirect

**File:** `src/app/(dashboard)/projeler/[id]/izleme/page.tsx:23`

**Issue:** `if (!user) notFound()` returns an HTTP 404 to users who are not logged in. This has two problems: it gives a confusing dead end instead of directing the user to log in, and it leaks that the route exists (an unauthenticated attacker learns valid project IDs produce 404 while invalid IDs also produce 404, which is a mild information difference depending on the error page). Other dashboard pages should be checked for consistency.

**Fix:** Replace `notFound()` with a redirect to the login page for unauthenticated sessions:

```typescript
import { redirect } from 'next/navigation'

// …
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')   // or wherever the auth page lives
```

---

## Info

### IN-01: Current-period query has no upper date bound

**File:** `src/lib/monitoring/aggregation.ts:64-69`

**Issue:** The current-period query uses `.gte('date', fmt(currentStart))` without a corresponding `.lte`. If the GSC sync ever writes rows dated in the future (e.g., a sync bug, timezone issue, or partial forward-fill), those rows will be silently included in the current-period aggregation, inflating clicks and impressions.

**Fix:** Add an upper bound capped at today:

```typescript
const { data: metricsData } = await supabase
  .from('gsc_metrics')
  .select('page_id, clicks, impressions, avg_position')
  .eq('project_id', projectId)
  .gte('date', fmt(currentStart))
  .lte('date', fmt(today))          // add this line; `today` is already in scope
```

---

### IN-02: Unknown cluster name surfaces in UI when cluster metadata is missing

**File:** `src/lib/monitoring/aggregation.ts:145`

**Issue:** `clusterName: meta?.name ?? 'Unknown'` means that if a cluster has GSC hits but its row was deleted from `keyword_clusters`, the UI will render a row labelled "Unknown". This can confuse users who see a cluster they cannot identify or manage.

**Fix:** Filter out clusters whose metadata is missing before building the result, the same way pages with no current data are dropped:

```typescript
const meta = clusterMeta.get(clusterId)
if (!meta) continue   // cluster deleted or belongs to another project — skip
```

---

### IN-03: Test mock couples call order to table name — fragile for future refactors

**File:** `src/lib/monitoring/aggregation.test.ts:103-126` (and lines 150-176)

**Issue:** The decay tests use a shared `callIndex` variable that increments every time `gsc_metrics` is hit. If `getPageMetrics` is ever refactored to issue the two GSC queries in a different order (e.g., prior before current, or merged into one), the mock will silently feed wrong fixtures to the wrong query, making tests pass incorrectly.

**Fix:** Key mock responses on the actual query parameters (e.g., inspect the `gte`/`lte` argument passed to the chain) rather than on positional call order. Alternatively, use two separate `supabase` instances for the two scenarios and explicitly seed current vs. prior data per test.

---

### IN-04: Test mocks ignore `.eq('project_id', ...)` filter

**File:** `src/lib/monitoring/aggregation.test.ts:51-68` (and other mock factories)

**Issue:** All mock `.eq()` calls return `this` regardless of arguments, so the mocks return full fixture arrays without scoping to the test's `projectId`. This means tests cannot catch a regression where `projectId` filtering is removed from the aggregation queries — the tests would still pass.

**Fix:** For the ownership-critical `.eq('project_id', projectId)` call, assert it is invoked with the expected value:

```typescript
eq: vi.fn((col: string, val: string) => {
  if (col === 'project_id') expect(val).toBe('project-1')
  return chain
}),
```

---

### IN-05: Active period tab has no accessible state indicator

**File:** `src/app/(dashboard)/projeler/[id]/izleme/period-tab-bar.tsx:23-36`

**Issue:** The active period is communicated only through CSS classes (`bg-secondary`, `font-medium`). Screen readers have no way to determine which period is currently selected.

**Fix:** Add `aria-pressed` to each button:

```tsx
<button
  key={p}
  type="button"
  aria-pressed={isActive}
  onClick={() => router.push(`/projeler/${projectId}/izleme?period=${p}`)}
  …
>
```

---

_Reviewed: 2026-04-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
