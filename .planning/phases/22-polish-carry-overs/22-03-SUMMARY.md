---
phase: 22-polish-carry-overs
plan: 03
subsystem: server-actions, revision-history
tags: [page-packages, revision, server-action, supabase, non-fatal, auth, ownership]

requires:
  - phase: 22-polish-carry-overs
    plan: 01
    provides: page_package_revisions table (live in Supabase, append-only RLS)

provides:
  - revision auto-snapshot on every updatePagePackage call (D-04)
  - getRevisions server action for Wave 3 RevisionHistorySheet
  - RevisionRow type for Wave 3 component consumption

affects:
  - 22-04 (RevisionHistorySheet imports getRevisions + RevisionRow from ./actions)

tech-stack:
  added: []
  patterns:
    - "Non-fatal insert pattern: await without error destructuring — revision failure silently swallowed"
    - "Count-based version_num: SELECT count(*) + 1 per package_id before INSERT"
    - "maybeSingle() for optional row fetch — no crash when row absent"

key-files:
  created: []
  modified:
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts

key-decisions:
  - "Revision insert is non-fatal — await without error check, save continues regardless"
  - "version_num computed from live count of existing revisions (count+1), not a DB sequence"
  - "getRevisions returns success:true + empty array when no package exists (not an error)"
  - "RevisionRow type exported near ActionResult for co-location with other type exports"

requirements-completed:
  - PAGE-05

duration: 10min
completed: 2026-05-10
---

# Phase 22 Plan 03: Revision Insert in updatePagePackage + getRevisions Action Summary

**Non-fatal auto-snapshot on every save (D-04) and auth-guarded getRevisions server action — Wave 3 RevisionHistorySheet fully unblocked**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-10T21:30:00Z
- **Completed:** 2026-05-10T21:40:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- `updatePagePackage` extended with D-04 revision block: fetches current `page_packages` row via `maybeSingle()`, counts existing revisions to compute `version_num = count + 1`, inserts snapshot into `page_package_revisions` — all before the upsert. Revision INSERT is non-fatal (no error check).
- `RevisionRow` type exported near `ActionResult` (line 11) — `id`, `version_num`, `snapshot`, `created_at` fields.
- `getRevisions` server action exported at end of file — auth guard + `verifyOwnership` (T-22-06 mitigated), resolves `package_id` from `page_id`, orders results by `version_num DESC` (newest first), returns empty array when no package exists.

## Task Commits

1. **Task 1: Extend updatePagePackage with revision insert (D-04)** — `8aa7b0e` (feat)
2. **Task 2: Add RevisionRow type and getRevisions server action** — `6e44d6c` (feat)

## Files Created/Modified

- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` — +71 lines: revision insert block in `updatePagePackage` (31 lines) + `RevisionRow` type (7 lines) + `getRevisions` function (33 lines)

## Decisions Made

- **Non-fatal revision pattern:** `await supabase.from('page_package_revisions').insert(...)` without error destructuring — revision failure is silently swallowed. This matches the plan's explicit requirement and keeps the user's save from being blocked by a bookkeeping failure.
- **version_num from live count:** Used `SELECT count(*) WHERE package_id = X` rather than DB sequence. Simple, correct for append-only single-user scenario. Acceptable race condition risk per CONTEXT.md Out of Scope (single-agency use).
- **Empty array vs error on missing package:** `getRevisions` returns `{ success: true, revisions: [] }` when no `page_packages` row exists — Wave 3 can render "no revisions yet" without special-casing an error.

## Deviations from Plan

None — plan executed exactly as written. Both code blocks match the plan's action sections verbatim.

## TypeScript Status

`npx tsc --noEmit` reports zero errors in `sayfa-paketi/actions.ts`. Pre-existing errors in other files (parallel wave agents' in-progress work) are out of scope.

## Known Stubs

None — this plan adds pure server-side logic. No UI rendering, no data flow to components (Wave 3 handles that).

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| T-22-06 mitigated | actions.ts getRevisions | Auth + verifyOwnership guard before revision fetch — cross-user read prevented |
| T-22-07 mitigated | actions.ts updatePagePackage | user.id from server-side supabase.auth.getUser() — not from client input |

## Next Phase Readiness

- Wave 3 (22-04): Can now `import { getRevisions, RevisionRow } from './actions'` — both exported and TypeScript-clean
- RevisionHistorySheet can call `getRevisions(projectId, pageId)` and render the returned array
- RevisionPreviewDialog can type its `revision` prop as `RevisionRow`

---
*Phase: 22-polish-carry-overs*
*Completed: 2026-05-10*
