---
phase: 06-keyword-clustering-scoring
reviewed: 2026-04-24T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/lib/keywords/scoring.ts
  - src/lib/keywords/clustering.ts
  - src/lib/keywords/parser.ts
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterButton.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterDeleteButton.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/MoveKeywordDialog.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/PrimaryKeywordStar.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ViewToggle.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-04-24
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 6 delivers keyword clustering and scoring functionality: a pure-math scoring module, an intent-first hybrid clustering algorithm, five server actions, and seven UI components. The security posture is solid — every mutable server action validates ownership against both `user_id` and `project_id` before touching data, and UUID format checks guard all action entry points. The clustering and scoring logic is sound for the stated use-case.

Five warnings were found: two logic correctness issues (a silent data-loss path in `importKeywords` and a stale-data bug in `clusterAndScoreKeywords`), one missing error-state propagation in `ClusterDeleteButton`, one UUID regex that is overly permissive and will silently accept malformed IDs, and one dangerous spread-into-Math.max call that crashes on large inputs. Four informational items cover code duplication, a superfluous guard, a missing `useTransition`/pending state, and a misleading spinning icon.

---

## Warnings

### WR-01: Silent keyword data loss when cluster upsert fails in `importKeywords`

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts:56`

**Issue:** When the cluster `upsert` returns an error or no row (e.g. due to a constraint violation on a concurrent insert), the loop does `continue` and silently skips ALL keywords belonging to that cluster. The function returns `success: true` with a `keywordCount` that counts the original parsed list — not the keywords actually written — so the caller has no indication that rows were dropped. In the worst case every cluster fails and zero keywords are persisted while the action reports success.

**Fix:**
```typescript
// Accumulate failures and report them
let failedClusters = 0
for (const cluster of clusters) {
  const { data: clusterRow, error: clusterErr } = await supabase
    .from('keyword_clusters')
    .upsert(...)
    .select('id')
    .single()

  if (clusterErr || !clusterRow) {
    failedClusters++
    continue
  }
  // ... insert keywords
}

if (failedClusters > 0 && failedClusters === clusters.length) {
  return { success: false, error: 'Kümeler oluşturulamadı. Lütfen tekrar deneyin.' }
}
// partial success: include failedClusters in the return value so the UI can warn
return { success: true, clusterCount: clusters.length - failedClusters, keywordCount: parsed.length, enrichedCount }
```

---

### WR-02: `clusterAndScoreKeywords` does not clear stale `cluster_id` / `opportunity_score` before re-clustering

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts:238`

**Issue:** When the user triggers "Yeniden Kümeleme", enriched keywords are re-clustered and the new `cluster_id` + `opportunity_score` are written to each keyword row. However, keywords that are no longer enriched (e.g. their `enriched_at` was NULL and they were filtered out at line 217) retain their old `cluster_id` and `opportunity_score` from the previous run. This produces phantom keywords showing up in the old cluster panel even though the cluster may have been renamed or restructured.

Additionally, keywords in the new cluster set may be a different subset than the old set — keywords removed from `enriched_at` filter but still carrying a `cluster_id` will appear in cluster view under the wrong cluster header.

**Fix:** Before iterating over new clusters, reset `cluster_id` and `opportunity_score` to NULL for all project keywords (or at minimum for all previously enriched keywords):

```typescript
// Reset before re-clustering to avoid stale associations
await supabase
  .from('keywords')
  .update({ cluster_id: null, opportunity_score: null })
  .eq('project_id', projectId)
  .eq('user_id', user.id)
```

---

### WR-03: `Math.max(...array)` spread will throw `RangeError` for large keyword sets

**File:** `src/lib/keywords/scoring.ts:43-44`

**Issue:** `buildScoringContext` uses spread syntax to pass the full keyword array into `Math.max`. JavaScript call stacks have a maximum argument count (typically 65,536 in V8). For a project with more than ~65k keywords this throws `RangeError: Maximum call stack size exceeded`. The DoS guard in `clusterAndScoreKeywords` caps at 500 keywords today, but `buildScoringContext` is also exported and called from `importKeywords` (indirectly via `clusterKeywords`) and could be called without that guard by future code.

**Fix:** Use `Array.prototype.reduce` instead of spread:
```typescript
export function buildScoringContext(
  keywords: Array<{ volume: number | null; cpc: number | null }>
): { maxVolume: number; maxCpc: number } {
  let maxVolume = 0
  let maxCpc = 0
  for (const k of keywords) {
    if ((k.volume ?? 0) > maxVolume) maxVolume = k.volume ?? 0
    if ((k.cpc ?? 0) > maxCpc) maxCpc = k.cpc ?? 0
  }
  return { maxVolume, maxCpc }
}
```

---

### WR-04: UUID regex accepts invalid UUIDs (too permissive)

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts:195, 299, 359`

**Issue:** The UUID validation regex `/^[0-9a-f-]{36}$/i` accepts strings like `------------------------------------` (36 hyphens) or `000000000-0000-0000-0000-000000000000-` because it only validates character set and total length, not the UUID structural format (`8-4-4-4-12`). While the downstream Supabase query will ultimately reject a non-existent UUID, a malformed ID that happens to be 36 chars will pass validation and consume a round-trip to the database.

**Fix:** Use a proper UUID v4 regex:
```typescript
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
```

---

### WR-05: `ClusterDeleteButton` silently swallows errors — no user feedback on failure

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterDeleteButton.tsx:26-29`

**Issue:** The delete handler calls `deleteCluster` but does not check the result. If the server action returns `{ success: false, error: '...' }` the user sees no error message — the spinner stops and nothing happens. This leaves the user unable to distinguish between a silent no-op and a successful delete (since the cluster row will still appear until `revalidatePath` fires a successful refetch).

**Fix:**
```typescript
const [error, setError] = useState<string | null>(null)

onClick={() => {
  startTransition(async () => {
    const result = await deleteCluster(projectId, clusterId)
    if (!result.success) {
      setError(result.error)
    }
  })
}}

// Render error below the button when present
{error && <p className="text-xs text-destructive mt-1">{error}</p>}
```

---

## Info

### IN-01: `kdColor` and `formatVolume` are duplicated between `page.tsx` and `ClusterPanel.tsx`

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx:22-32` and `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx:31-41`

**Issue:** Both files define identical `kdColor` and `formatVolume` helper functions. Divergence over time (e.g. adding an "Orta-Zor" band) requires updating two places.

**Fix:** Extract both helpers to a shared `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/utils.ts` and import from both files.

---

### IN-02: `setPrimaryKeyword` redundantly checks `isPrimary` in both client and server

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/PrimaryKeywordStar.tsx:25` and `actions.ts:378`

**Issue:** The button is `disabled={isPrimary}` and the click handler also guards with `if (isPrimary) return` (line 33). The server action itself does not enforce this — it will happily overwrite `primary_keyword_id` with the same value if called directly. The double client-side guard is redundant; the `disabled` prop alone prevents the click. The client-side `if (isPrimary) return` guard on line 33 is dead code given the `disabled` prop.

**Fix:** Remove the `if (isPrimary) return` guard from the `onClick` handler — the `disabled` prop is sufficient on the client side.

---

### IN-03: `MoveKeywordDialog` uses `useState` + manual `setIsPending` instead of `useTransition`

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/MoveKeywordDialog.tsx:38, 53-54, 66`

**Issue:** All other action-invoking components in this feature (`ClusterButton`, `ClusterDeleteButton`, `PrimaryKeywordStar`) use `useTransition` for pending state, which integrates with React's concurrent model and prevents tearing. `MoveKeywordDialog` manually manages a `isPending` boolean via `useState`, which is inconsistent with the codebase pattern and can cause subtle issues if `revalidatePath` triggers a concurrent re-render mid-action.

**Fix:**
```typescript
const [isPending, startTransition] = useTransition()

const handleMove = () => {
  if (!selectedClusterId) return
  setError(null)
  startTransition(async () => {
    try {
      const result = await moveKeywordToCluster(keywordId, selectedClusterId, projectId)
      if (!result.success) {
        setError(result.error)
      } else {
        setOpen(false)
      }
    } catch {
      setError('Küme ataması başarısız. Lütfen tekrar deneyin.')
    }
  })
}
```

---

### IN-04: Spinning SVG icon in `page.tsx` for un-enriched keywords implies active background work

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx:279-298`

**Issue:** Un-enriched keywords (`enriched_at === null`) display an `animate-spin` SVG in the Intent column. Since enrichment runs synchronously during `importKeywords` and this is a server-rendered page, there is no active background process to indicate — the user is viewing a static snapshot. The spinner suggests a live operation is in progress, which is misleading. Users who revisit the page hours later will still see the spinner.

**Fix:** Replace the spinner with a static dash or "Beklemede" text badge to accurately convey that the keyword has not been enriched yet, without implying real-time progress:
```tsx
<span className="text-xs text-muted-foreground">Beklemede</span>
```

---

_Reviewed: 2026-04-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
