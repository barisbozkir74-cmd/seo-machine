---
phase: 22-polish-carry-overs
fixed_at: 2026-05-11T00:00:00Z
review_path: .planning/phases/22-polish-carry-overs/22-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 22: Code Review Fix Report

**Fixed at:** 2026-05-11T00:00:00Z
**Source review:** .planning/phases/22-polish-carry-overs/22-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: Race Condition in Auto-Snapshot Version Number

**Files modified:** `supabase/migrations/20260510000001_page_package_revisions.sql`, `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts`
**Commit:** c2bce95
**Applied fix:** Added `CREATE UNIQUE INDEX IF NOT EXISTS uq_package_revision ON public.page_package_revisions(package_id, version_num)` to the migration. Converted the bare `insert` to `upsert` with `{ onConflict: 'package_id,version_num', ignoreDuplicates: true }` so that concurrent saves that compute the same `version_num` silently skip the duplicate instead of inserting conflicting rows.

---

### WR-02: Stale State on Sheet Re-open

**Files modified:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/RevisionHistorySheet.tsx`
**Commit:** 6d8ff51
**Applied fix:** In `handleOpenChange`, when `nextOpen === false`, added `setState('idle')` and `setRevisions([])` before the early return. This ensures the next open always starts from a clean loading state with no stale revision list or persisted error message.

---

### WR-03: Dead `isLoading` State in `RevisionPreviewDialog`

**Files modified:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/RevisionPreviewDialog.tsx`
**Commit:** 8e1d173
**Applied fix:** Removed the `useState` import, removed `const [isLoading, setIsLoading] = useState(false)`, simplified `handleLoadRevision` to call `onLoadRevision(revision.snapshot)` then `onClose()` directly, and simplified the button to `<Button size="sm" onClick={handleLoadRevision}>Bunu Yükle</Button>` with no disabled or conditional text.

---

### WR-04: Missing `user_id` Filter on `page_package_revisions` SELECT

**Files modified:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts`
**Commit:** 0d90569
**Applied fix:** Added `.eq('user_id', user.id)` to the final SELECT on `page_package_revisions` in `getRevisions`, consistent with the defence-in-depth pattern used throughout the rest of `actions.ts`.

---

### WR-05: GSC Query Missing Upper-Bound Date Filter

**Files modified:** `src/lib/monitoring/aggregation.ts`
**Commit:** 6fd3431
**Applied fix:** Added `today` to the `buildDateRanges` return value. Added `.lte('date', fmt(today))` to the current-period `gsc_metrics` SELECT in both `getClusterMetrics` and `getPageMetrics`. This caps the window at today's date, preventing rows synced on the current day from extending the current period beyond the intended `period` days.

---

_Fixed: 2026-05-11T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
