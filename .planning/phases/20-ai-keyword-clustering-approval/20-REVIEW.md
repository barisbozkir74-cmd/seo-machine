---
phase: 20-ai-keyword-clustering-approval
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - supabase/migrations/20260509000010_clustering_approval.sql
  - src/lib/keywords/clustering-approval.test.ts
  - src/lib/keywords/clustering.test.ts
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterButton.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/StatusBadge.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ApprovalKeywordRow.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ApprovalClusterRow.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusteringApprovalOverlay.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/StratejiOnaylaButton.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordStratejisiToolbar.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-05-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 20 adds a clustering approval workflow on top of the existing keyword strategy feature. The migration, server actions, and UI components are generally well-structured. Ownership checks (IDOR prevention) are consistently applied in all server actions, status values are whitelist-validated, and the optimistic-UI rollback pattern is correctly implemented in the overlay.

No critical security vulnerabilities were found. Six warnings cover real bugs or edge cases that can cause incorrect behavior in production: a silent rename that does not persist, a missing DB error check in `removeKeywordFromCluster`, a race condition in the bulk approval loop, a test mock that silently swallows a code path without asserting success, a type assertion that masks a missing Supabase column, and a missing `aria-label` on a destructive button. Five info items address dead/unused code, duplication, and magic strings.

---

## Warnings

### WR-01: Cluster rename in overlay is optimistic-only — changes are never persisted

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusteringApprovalOverlay.tsx:71-77`

**Issue:** `handleRename` updates local state (`setClusters`) but intentionally skips calling any server action. The comment acknowledges this ("D-02 sadece UI'da inline edit ister"), but the UI gives no indication to the user that the renamed cluster name will be lost when the overlay closes. `router.refresh()` in `handleOverlayClose` fetches fresh DB data, which overwrites the local rename silently.

**Fix:** Either (a) disable the rename input in the overlay and defer it to the existing `ClusterPanel` inline edit (which has a proper server action), or (b) surface a clear visual warning in the edit field — e.g., a "(kaydedilmez)" hint — so the user understands the change is ephemeral. The safest fix for now:

```tsx
// In ApprovalClusterRow, make the onRename prop optional and simply don't render the edit input:
// Remove the `onDoubleClick` handler on the cluster name span inside the overlay.
```

---

### WR-02: `removeKeywordFromCluster` does not check for DB error on `total_volume` update

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts:962-976`

**Issue:** After nullifying `cluster_id` on the keyword, the action fetches remaining keywords and updates `total_volume` on the cluster, but the result of that `update` call is never checked. If the update fails (e.g., transient DB error), the cluster's `total_volume` becomes stale and no error is surfaced. For contrast, the `cluster_id: null` update above it _is_ checked.

```ts
// current — no error capture:
await supabase
  .from('keyword_clusters')
  .update({ total_volume: newVolume })
  .eq('id', clusterId)
  .eq('user_id', user.id)
```

**Fix:**
```ts
const { error: volErr } = await supabase
  .from('keyword_clusters')
  .update({ total_volume: newVolume })
  .eq('id', clusterId)
  .eq('user_id', user.id)
// Volume update failure is non-fatal (keyword was already removed),
// but log it so stale state is detectable:
if (volErr) console.error('[removeKeywordFromCluster] volume update failed:', volErr)
```

---

### WR-03: Bulk approval (`handleBulkStatus`) is a sequential `for-await` loop — creates a race with optimistic state

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusteringApprovalOverlay.tsx:63-68`

**Issue:** `handleBulkStatus` calls `handleStatusChange` sequentially in a `for…of` loop. Each `handleStatusChange` call calls `setClusters` optimistically at the top, _then_ awaits the server action, _then_ optionally rolls back. Because each iteration is awaited before the next, the `prev` snapshot captured inside `handleStatusChange` on iteration N is already the optimistically-updated state from iteration N-1. If iteration N fails, the rollback reverts only to the post-N-1 optimistic state, not the true pre-bulk state. This means a partial failure can leave an inconsistent display.

Additionally, each iteration sets `pendingClusterId` to a single cluster ID, so only the last cluster appears "pending" visually.

**Fix:** Capture the pre-bulk state once, fire all server actions in parallel, and apply a single rollback if any fail:

```ts
const handleBulkStatus = async (newStatus: 'approved' | 'rejected') => {
  const draftClusters = clusters.filter((c) => c.status === 'draft')
  if (draftClusters.length === 0) return

  const prevClusters = clusters
  // Optimistic: update all at once
  setClusters((cs) => cs.map((c) => c.status === 'draft' ? { ...c, status: newStatus } : c))

  const results = await Promise.all(
    draftClusters.map((c) => updateClusterStatus(c.id, newStatus, projectId))
  )

  if (results.some((r) => !r.success)) {
    setClusters(prevClusters)
  }
}
```

---

### WR-04: `removeKeywordFromCluster` success test never asserts `result.success`

**File:** `src/lib/keywords/clustering-approval.test.ts:187-231`

**Issue:** The "succeeds and does not call revalidatePath" test builds a complex mock but never asserts `expect(result.success).toBe(true)`. The test only checks that `revalidatePath` was not called. If the action silently returns `{ success: false, error: '...' }` due to a mock mismatch, the test still passes — making it a false-positive green test.

**Fix:**
```ts
const result = await removeKeywordFromCluster(KEYWORD_ID, CLUSTER_ID, PROJECT_ID)
expect(result.success).toBe(true)  // add this line
expect(revalidatePath).not.toHaveBeenCalled()
```

---

### WR-05: `page.tsx` reads `status` from cluster rows using `as unknown as { status: string }` — masks missing Supabase column type

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx:124` and `page.tsx:176`

**Issue:** Two separate `as unknown as` casts are used to access `status` on cluster rows:

```ts
// line 124
status: (c as unknown as { status: string | null }).status ?? null,

// line 176
clusters.some((c) => (c as unknown as { status: string }).status === 'approved')
```

This pattern indicates the generated Supabase types (from `supabase gen types`) have not been regenerated after the migration was added. If the migration has not been applied or the types are not regenerated, the `status` field would silently be `undefined` at runtime — causing `hasApprovedCluster` to always be `false` and the "Stratejiyi Onayla" button to remain permanently disabled.

**Fix:** Regenerate Supabase TypeScript types after running the migration (`supabase gen types typescript`) and remove the casts. The `select` string in the `clustersRaw` query (line 102) already includes `status`, so the type gen update is the only missing step.

---

### WR-06: `ApprovalKeywordRow` "Kaldır" button lacks `aria-label` with keyword context

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ApprovalKeywordRow.tsx:22-29`

**Issue:** The remove button has `aria-label="Keyword'ü kümeden kaldır"` which is generic — it does not identify _which_ keyword will be removed. Screen readers announce all remove buttons identically, making keyboard navigation through the list ambiguous.

**Fix:**
```tsx
aria-label={`"${keyword.keyword}" keyword'ünü kümeden kaldır`}
```

---

## Info

### IN-01: `formatVolume` is duplicated across four files

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ApprovalKeywordRow.tsx:9-13`, `ApprovalClusterRow.tsx:7-11`, `ClusterPanel.tsx:49-53`, `page.tsx:30-34`

**Issue:** Identical `formatVolume` function is copy-pasted into four files. Any future rounding/formatting change must be updated in all four places.

**Fix:** Extract to a shared utility, e.g., `src/lib/format.ts`, and import from there.

---

### IN-02: `ClusterButton.tsx` — button `disabled` state uses `isPending` but `opacity-50` is redundant with shadcn `disabled` styles

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterButton.tsx:37`

**Issue:** `className={`h-9 ${isPending ? 'opacity-50' : ''}`}` adds opacity manually while the `disabled={isPending}` prop on the Button already applies a `disabled:opacity-50` Tailwind utility via shadcn's default Button styles. The result is `opacity-25` when pending (two layers of 50% opacity).

**Fix:** Remove the conditional `opacity-50` from the className, or remove the `disabled` prop and rely solely on the class.

---

### IN-03: `StatusBadge` — `'use client'` directive is unnecessary

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/StatusBadge.tsx:1`

**Issue:** `StatusBadge` is a pure presentational component with no hooks, event handlers, or browser APIs. Marking it `'use client'` forces it to be included in the client bundle unnecessarily. `ClusterPanel.tsx` is a Server Component that imports `StatusBadge`; this `'use client'` boundary means the badge renders on the client rather than the server.

**Fix:** Remove the `'use client'` directive. The `Badge` component from `@/components/ui/badge` does not require client-side rendering.

---

### IN-04: `updateClusterStatus` accepts `'draft'` as a valid status but clusters should not be reverted to `draft` via this action

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts:836`

**Issue:** `VALID_CLUSTER_STATUSES` includes `'draft'`. No UI currently calls `updateClusterStatus` with `'draft'`, but the API allows it. If a caller (or future UI) calls this action to reset a cluster to `draft`, it could reopen an already-approved strategy without resetting the `keyword_strategy_approved` gate on the project. This is a latent logic inconsistency rather than a current bug.

**Fix:** Either (a) remove `'draft'` from `VALID_CLUSTER_STATUSES` (approved/rejected clusters can only be toggled, never reverted to draft via this action), or (b) add logic: if status transitions to `'draft'`, also set `projects.keyword_strategy_approved = false` for consistency.

---

### IN-05: `clustering.test.ts` — test helper `kw()` uses `Math.random()` for IDs

**File:** `src/lib/keywords/clustering.test.ts:6`

**Issue:** `id: Math.random().toString()` produces non-deterministic IDs in test fixtures. While this does not affect the current test assertions, it makes test output logs harder to read and could mask ID-collision bugs if deduplication logic is tested in future.

**Fix:**
```ts
let idCounter = 0
function kw(overrides: ...): ClusterInput {
  return { id: `kw-${++idCounter}`, ... }
}
```

---

_Reviewed: 2026-05-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
