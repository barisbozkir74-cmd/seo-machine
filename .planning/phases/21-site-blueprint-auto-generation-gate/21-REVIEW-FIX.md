---
phase: 21-site-blueprint-auto-generation-gate
fixed_at: 2026-05-10T16:26:00Z
review_path: .planning/phases/21-site-blueprint-auto-generation-gate/21-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 21: Code Review Fix Report

**Fixed at:** 2026-05-10T16:26:00Z
**Source review:** .planning/phases/21-site-blueprint-auto-generation-gate/21-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: Silent partial update failure — loop swallows errors without rolling back

**Files modified:** `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts`
**Commit:** 145a7fd
**Applied fix:** In the `generatePagesFromClusters` update loop, replaced `if (!error) updated++` with an early return `{ success: false, error: 'Bazı sayfalar güncellenemedi.' }` on any single update failure, followed by `updated++` on success. This ensures the caller is informed of any partial failure rather than receiving a silently lower `updated` count.

---

### WR-02: `successMsg` is set after `handleOpenChange(false)` which resets it to null

**Files modified:** `src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx`
**Commit:** 830aecb
**Applied fix:** Removed the `successMsg` state variable entirely (declaration, `setSuccessMsg(null)` in `handleOpenChange`, `setSuccessMsg(msg)` call in `startTransition`, and the `{successMsg && ...}` JSX render). Replaced the `handleOpenChange(false)` + `setSuccessMsg` pattern inside `startTransition` with a direct `onOpenChange(false)` + `router.push` call so navigation happens immediately after a successful server action without relying on an unreachable in-dialog message.

---

### WR-03: Unguarded `state[idx]` access — index can be out of bounds during re-render

**Files modified:** `src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx`
**Commit:** e79aa2b
**Applied fix:** Added a nullish coalescing fallback at the `state[idx]` read site: `const rowState = state[idx] ?? { pageName: r.proposedName, pageType: r.proposedType, include: !r.alreadyExists }`. This prevents a TypeError during the render window where `rows` has grown but the `useEffect`-driven state reset has not yet been committed.

---

### WR-04: `reorderPage` — Step 1 error not checked before proceeding

**Files modified:** `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts`
**Commit:** dff2ce4
**Applied fix:** Assigned the Step 1 sentinel update result to `r1` and added an explicit error check immediately after: `if (r1.error) { return { success: false, error: 'Sıralama güncellenemedi.' } }`. Steps 2 and 3 now only execute if Step 1 succeeded, preventing corrupt state if the sentinel write fails (e.g., due to a unique constraint on `sort_order`).

---

### WR-05: `hasApprovedCluster` prop computed with double `as unknown` cast

**Files modified:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx`
**Commit:** a757b56
**Applied fix:** Replaced `clusters.some((c) => (c as unknown as { status: string }).status === 'approved')` with `clustersWithKeywords.some((c) => c.status === 'approved')`. `clustersWithKeywords` is already typed as `ClusterWithKeywords[]` which includes `status: string | null`, so no cast is needed and type safety is fully preserved.

---

## Verification

- `npx tsc --noEmit`: passed (no errors)
- `npx vitest run src/lib/pages/generate-pages.test.ts`: passed (9/9 tests)

---

_Fixed: 2026-05-10T16:26:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
