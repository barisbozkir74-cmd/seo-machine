---
phase: 22-polish-carry-overs
reviewed: 2026-05-10T22:42:15Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/app/(dashboard)/projeler/[id]/izleme/page-metrics-table.tsx
  - src/app/(dashboard)/projeler/[id]/izleme/page.tsx
  - src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx
  - src/app/(dashboard)/projeler/[id]/sayfa-paketi/RevisionHistorySheet.tsx
  - src/app/(dashboard)/projeler/[id]/sayfa-paketi/RevisionPreviewDialog.tsx
  - src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts
  - src/components/ui/sheet.tsx
  - src/lib/monitoring/aggregation.ts
  - supabase/migrations/20260510000001_page_package_revisions.sql
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-05-10T22:42:15Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the Phase 22 Polish / Carry-Overs deliverables: the new `RevisionHistorySheet` + `RevisionPreviewDialog` pair, the updated `PagePackageEditor`, the supporting `actions.ts` (revision auto-snapshot + `getRevisions`), the `PageMetricsTable` / izleme `page.tsx`, the `sheet.tsx` component, the `aggregation.ts` library, and the migration SQL.

The overall quality is solid. Authorization is consistently applied through `verifyOwnership` + user-scoped queries throughout `actions.ts`. The migration correctly enables RLS with SELECT/INSERT policies. The aggregation logic is sound.

Five warnings were found — all bugs or logic errors that can produce incorrect behavior in specific edge cases. No critical (security) issues. Four info items flag dead code and minor quality concerns.

---

## Warnings

### WR-01: Race Condition in Auto-Snapshot Version Number

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts:308-324`

**Issue:** The `updatePagePackage` function computes `version_num` with a `COUNT` query and then immediately does an `INSERT` as two separate, non-atomic operations. If two saves fire in quick succession (e.g., user double-clicks Save, or two browser tabs), both reads get the same count, and both inserts write the same `version_num`. The index `(package_id, version_num DESC)` does not enforce uniqueness, so duplicates land silently.

**Fix:** Add a `UNIQUE` constraint on `(package_id, version_num)` in the migration (prevents duplicate writes at the DB level) and handle the `23505` conflict gracefully in the insert path — skip revision creation on duplicate rather than blocking the save:

```sql
-- In migration: add unique constraint
ALTER TABLE public.page_package_revisions
  ADD CONSTRAINT uq_package_revision UNIQUE (package_id, version_num);
```

```typescript
// In actions.ts: ignore conflict on revision insert
await supabase
  .from('page_package_revisions')
  .insert({ ... })
  .onConflict('package_id, version_num')
  .ignore()
```

---

### WR-02: `handleOpenChange` Fetches Revisions on Every Open — Stale State Not Reset on Close

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/RevisionHistorySheet.tsx:35-51`

**Issue:** When the Sheet is closed (`nextOpen === false`), the function returns early without resetting `state` to `'idle'` or clearing `revisions`. The next time the Sheet opens, the old list flashes briefly before the new fetch starts — this is a visible stale-data flicker. More importantly, if the first open ends in `'error'` state, re-opening shows the error text immediately before the new fetch resolves, which looks like a persistent error.

**Fix:** Reset state before triggering the fetch:

```typescript
async function handleOpenChange(nextOpen: boolean) {
  onOpenChange(nextOpen)
  if (!nextOpen) {
    // Reset so next open always starts clean
    setState('idle')
    setRevisions([])
    return
  }
  setState('loading')
  const result = await getRevisions(projectId, pageId)
  // ... rest unchanged
}
```

---

### WR-03: `isLoading` State in `RevisionPreviewDialog.handleLoadRevision` Is Immediately Reset

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/RevisionPreviewDialog.tsx:40-45`

**Issue:** `setIsLoading(true)` is called synchronously, then `onLoadRevision(revision.snapshot)` (a synchronous prop callback), then immediately `setIsLoading(false)` before React has committed the state update. Because React batches state updates in event handlers, the `true` and `false` cancel out — the button never actually shows `'Yükleniyor...'`. This is a harmless visual bug today, but if `onLoadRevision` ever becomes async the pattern will break silently.

**Fix:** Remove the `isLoading` state entirely since the operation is synchronous and the dialog closes immediately:

```typescript
const handleLoadRevision = () => {
  onLoadRevision(revision.snapshot)
  onClose()
}
```

And simplify the button:
```tsx
<Button size="sm" onClick={handleLoadRevision}>
  Bunu Yükle
</Button>
```

---

### WR-04: `getRevisions` Missing User-ID Filter on `page_package_revisions` Query

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts:803-811`

**Issue:** The `getRevisions` function correctly verifies project ownership and resolves `pkg.id` through a user-scoped query (`eq('user_id', user.id)`). However, the final SELECT on `page_package_revisions` only filters by `package_id` and does not repeat the `user_id` filter. If `package_id` is a UUID that another user somehow obtains (e.g., via URL manipulation outside of this code path), the RLS policy is the only guard — which is correct but is defence-in-depth. A belt-and-suspenders `eq('user_id', user.id)` on the final query is preferred given the pattern used elsewhere in this file.

**Fix:**
```typescript
const { data, error } = await supabase
  .from('page_package_revisions')
  .select('id, version_num, snapshot, created_at')
  .eq('package_id', pkg.id)
  .eq('user_id', user.id)   // add this
  .order('version_num', { ascending: false })
```

---

### WR-05: `buildDateRanges` Prior-Period Boundary Is Off by One Day

**File:** `src/lib/monitoring/aggregation.ts:46-62`

**Issue:** The current-period window is `[currentStart, today)` (open right bound — no `lte` filter in the query). The prior period is computed as:

```
priorEnd   = currentStart - 1 day
priorStart = priorEnd - period + 1 days
```

This is correct. But `currentStart` is set as `today - period` days. That means the current window covers exactly `period` days AND the prior window also covers exactly `period` days with no gap. However, `currentStart` uses `setDate(today.getDate() - period)` which mutates a Date object copied from `today` — this is correct. The subtle issue is that `priorEnd` is derived from the already-mutated `currentStart` object:

```typescript
const priorEnd = new Date(currentStart)         // copy of currentStart
priorEnd.setDate(currentStart.getDate() - 1)    // OK
const priorStart = new Date(priorEnd)
priorStart.setDate(priorEnd.getDate() - period + 1)  // OK
```

The `priorStart` window is `period - 1` days wide (inclusive `priorStart..priorEnd`), while the current window is `period` days wide. Example for `period=28`: current window is 28 days, prior window is 28 days — `priorEnd - priorStart + 1 = 28`. This is actually correct. **However**, the GSC query for the current period uses only `.gte('date', fmt(currentStart))` with no upper bound (`.lte`). This means if `gsc_metrics` contains rows for *today* (the sync runs the same day), those rows are included in the current period and the current window is actually `period + 1` days or more depending on sync timing.

**Fix:** Add an upper-bound filter to the current-period queries:

```typescript
// In getClusterMetrics and getPageMetrics current-period fetch:
supabase
  .from('gsc_metrics')
  .select(...)
  .eq('project_id', projectId)
  .gte('date', fmt(currentStart))
  .lte('date', fmt(today))   // add upper bound
```

---

## Info

### IN-01: `SheetPortal` Is Exported But Unused Outside `SheetContent`

**File:** `src/components/ui/sheet.tsx:23-25`

**Issue:** `SheetPortal` is defined and included in the barrel export but is only used internally inside `SheetContent`. External consumers have no documented reason to use it directly. It adds surface area without benefit.

**Fix:** Either remove it from the public export or document the intended use case with a comment.

---

### IN-02: Magic Number `meta_description` Length Inconsistency

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx:456,997-998`

**Issue:** `computeMetadataScore` at line 456 uses the hard-coded check `metaDescVal.length > 160 || metaDescVal.length < 120`. The `Field` component for `meta_description` at line 997-998 uses `maxLen={155}` and `maxLenWarning={140}`. The scoring threshold (160) and the UI hard-limit (155) are different numbers with no explanation, making it unclear which is authoritative. The placeholder text also says "155 karakter" (line 996).

**Fix:** Consolidate to a single constant:
```typescript
const META_DESC_MAX = 155
const META_DESC_SOFT = 140
const META_DESC_MIN = 120
```
And reference these in both `computeMetadataScore` and the `Field` props.

---

### IN-03: `applyRevision` Closes Sheet Directly Without Confirming Unsaved Changes

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx:338`

**Issue:** When `applyRevision` is called (loading a past snapshot), it unconditionally calls `setHistoryOpen(false)`. If the user had unsaved edits in the editor before opening the revision sheet, those changes are silently overwritten with no confirmation dialog. This can cause data loss from the user's perspective.

**Fix:** Before calling `applyRevision` (or inside the `RevisionPreviewDialog` "Bunu Yükle" handler), check if there are unsaved changes and display a warning:
```typescript
function applyRevision(snapshot: Record<string, unknown>) {
  // Optional: warn if there are unsaved changes
  // (requires a isDirty flag derived from comparing current state to pkg values)
  if (isDirty && !confirm('Kaydedilmemiş değişiklikler var. Devam etmek istiyor musun?')) return
  // ... apply fields
}
```

---

### IN-04: Migration Missing `page_id` and `project_id` Foreign Key Constraints

**File:** `supabase/migrations/20260510000001_page_package_revisions.sql:9-11`

**Issue:** The `page_package_revisions` table declares `page_id UUID NOT NULL` and `project_id UUID NOT NULL` as plain columns without foreign key constraints. Only `package_id` has a proper `REFERENCES` clause. If a `pages` or `projects` row is deleted outside the cascade chain (e.g., via a direct admin delete on the project), orphan revision rows will remain with no referential integrity guard.

**Fix:** Add FK constraints, or at minimum, document the intentional omission if denormalization is deliberate for snapshot immutability:
```sql
-- Option A: add FK with SET NULL on delete (preserves historical revisions)
page_id    UUID REFERENCES public.pages(id) ON DELETE SET NULL,
project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,

-- Option B: document explicitly if denormalized by design
-- page_id and project_id are denormalized snapshot references; cascade is handled via package_id FK above.
```

---

_Reviewed: 2026-05-10T22:42:15Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
