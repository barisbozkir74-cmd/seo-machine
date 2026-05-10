---
phase: 22-polish-carry-overs
plan: 01
subsystem: database, ui
tags: [shadcn, base-ui, sheet, drawer, supabase, migration, rls, postgresql, page-packages]

requires:
  - phase: 9-page-packages
    provides: page_packages table that page_package_revisions references via ON DELETE CASCADE

provides:
  - shadcn Sheet component (@/components/ui/sheet) using @base-ui/react/dialog primitives
  - page_package_revisions table in Supabase with append-only RLS policies
  - Wave 2 server actions (actions.ts revision insert) unblocked
  - Wave 3 RevisionHistorySheet component import unblocked

affects:
  - 22-02 (uses Sheet component for RevisionHistorySheet)
  - 22-03 (uses page_package_revisions INSERT in actions.ts)
  - 22-04 (PagePackageEditor revision UI depends on all above)

tech-stack:
  added: []
  patterns:
    - "base-mira shadcn preset: npx shadcn add uses @base-ui/react primitives, not @radix-ui"
    - "Supabase migration push from main project dir when worktree has no link config"
    - "Append-only RLS: SELECT + INSERT policies, no UPDATE/DELETE — revision immutability"

key-files:
  created:
    - src/components/ui/sheet.tsx
    - supabase/migrations/20260510000001_page_package_revisions.sql
  modified: []

key-decisions:
  - "Migration pushed from main project directory (not worktree) — worktree lacks supabase link config"
  - "Sheet installed via npx shadcn add sheet — base-mira generates @base-ui/react/dialog based implementation automatically"
  - "Composite index (package_id, version_num DESC) matches getRevisions query ORDER BY in Wave 2b"

patterns-established:
  - "Sheet component pattern: @base-ui/react/dialog used as primitive (same as Dialog component)"

requirements-completed:
  - PAGE-05

duration: 15min
completed: 2026-05-10
---

# Phase 22 Plan 01: Shadcn Sheet + page_package_revisions Migration Summary

**shadcn Sheet (138 lines, @base-ui/react) installed and page_package_revisions table created with append-only RLS — Wave 2 and Wave 3 unblocked**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-10T21:12:00Z
- **Completed:** 2026-05-10T21:27:48Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- shadcn Sheet component installed via `npx shadcn add sheet` — base-mira preset automatically generated `@base-ui/react/dialog`-based implementation (matching project's dialog.tsx pattern)
- `page_package_revisions` migration created with correct schema: UUID primary key, JSONB snapshot, append-only version numbering, ON DELETE CASCADE from page_packages
- RLS policies applied: `page_package_revisions_select_own` and `page_package_revisions_insert_own` — both enforce `auth.uid() = user_id`, no cross-user access (T-22-01 mitigated)
- `supabase db push` applied migration to remote database — table is live

## Task Commits

1. **Task 1: Install shadcn Sheet component** - `6b655d4` (chore)
2. **Task 2: Create migration file + supabase db push** - `c8d6dfd` (feat)

**Plan metadata:** (committed with SUMMARY below)

## Files Created/Modified

- `src/components/ui/sheet.tsx` — Sheet drawer component with SheetContent (side="right"), SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose exports (138 lines)
- `supabase/migrations/20260510000001_page_package_revisions.sql` — page_package_revisions DDL with 2 indexes + RLS

## Decisions Made

- **Migration push workaround:** `npx supabase db push` in the worktree returns "project ref not found" since worktrees don't inherit the linked Supabase config. Resolved by copying the migration file to the main project directory and pushing from there. The file remains committed in both locations (worktree tracks its own copy; main project migration dir updated for remote DB sync).
- **base-mira shadcn preset behavior confirmed:** `npx shadcn add sheet` with `style: "base-mira"` in components.json automatically generates `@base-ui/react/dialog`-based Sheet — no Radix dependency, fully consistent with project's dialog.tsx pattern.

## Deviations from Plan

None — plan executed exactly as written. The `supabase db push` workaround (pushing from main project dir) is an environment adaptation, not a deviation from intended behavior.

## Issues Encountered

- `supabase db push` in worktree context failed with "project ref not found" — worktrees don't carry Supabase link config. Resolution: copied migration file to main project's `supabase/migrations/` and ran `supabase db push` from `C:/Users/baris/Documents/seo-machine`. Push succeeded on first attempt (exit code 0).

## Known Stubs

None — this plan is infrastructure only (Sheet component + DB migration). No UI rendering, no data flow.

## Threat Surface Scan

No new endpoints, auth paths, or file access patterns introduced. The new `page_package_revisions` table is covered by T-22-01 (SELECT/INSERT RLS enforcing user_id = auth.uid()). No additional threat flags.

## User Setup Required

None — no external service configuration required beyond the migration already applied.

## Next Phase Readiness

- Wave 2a (22-02): RevisionHistorySheet can now `import { Sheet, SheetContent, ... } from '@/components/ui/sheet'`
- Wave 2b (22-03): actions.ts revision insert can now `INSERT INTO page_package_revisions` without schema error
- Wave 3 (22-04): PagePackageEditor wiring unblocked

---
*Phase: 22-polish-carry-overs*
*Completed: 2026-05-10*
