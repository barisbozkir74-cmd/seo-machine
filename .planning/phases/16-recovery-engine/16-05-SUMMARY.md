---
phase: 16-recovery-engine
plan: "05"
subsystem: server-action
tags:
  - recovery
  - publish
  - server-action
  - integration
  - supabase

dependency_graph:
  requires:
    - phase: 16-01
      provides: "public.recovery_tasks table with RLS UPDATE policy and idx_recovery_tasks_source_lookup index"
  provides:
    - "publishToWordPress action with D-04 auto-resolve hook — open/in_progress recovery_tasks rows resolved on successful WP publish"
  affects:
    - "16-02 (recovery-tasks service — getRecoveryTasks will show resolved rows filtered out)"
    - "16-03 (izleme UI — resolved rows disappear from Recovery tab after publish)"

tech_stack:
  added: []
  patterns:
    - "Non-fatal side-effect pattern: wrap optional bookkeeping in try/catch; log console.warn on failure; never block primary action success"
    - "Polymorphic source filter: always pair source_id with source='page_package' to prevent cross-table UUID collision on updates"
    - "Status guard pattern: .in('status', ['open', 'in_progress']) prevents overwriting dismissed/resolved rows on idempotent re-publish"

key_files:
  created: []
  modified:
    - "src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts"

key_decisions:
  - "D-04 implementation: recovery auto-resolve injected between page_packages UPDATE success and revalidatePath calls (lines 640-677)"
  - "console.warn (not console.error) chosen for recovery failure logging — publish is fine, only bookkeeping hiccup"
  - "No project_id filter needed on recovery_tasks UPDATE — pkg.id (UUID) is globally unique; RLS UPDATE policy is defence-in-depth"
  - "revalidatePath for /izleme added so users navigating from publish → izleme see resolved state immediately without manual refresh"

requirements-completed:
  - REC-02

duration: 5min
completed: "2026-04-30"
---

# Phase 16 Plan 05: Recovery Auto-Resolve Hook Summary

**`publishToWordPress` server action now auto-transitions open/in_progress recovery_tasks to resolved on successful WP publish, via a non-fatal try/catch hook using cookie-bound Supabase client and three-filter UPDATE.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-30T (session start)
- **Completed:** 2026-04-30
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Injected D-04 recovery auto-resolve block at the correct location in `publishToWordPress` — after `page_packages` UPDATE succeeds, before `revalidatePath` calls
- Block uses three-filter UPDATE: `source_id=pkg.id`, `source='page_package'`, `status IN ('open','in_progress')` — prevents cross-table collisions and dismissed-row overwrites
- Both error paths (Supabase client error + uncaught exception) funnel to `console.warn` and continue — publish success is never blocked
- Added `revalidatePath('/projeler/${projectId}/izleme')` so Recovery tab shows resolved state immediately after publish

## Task Commits

1. **Task 1: Inject recovery auto-resolve block into publishToWordPress** - `1361c0d` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` — Recovery auto-resolve block inserted at lines 640-677; `/izleme` revalidatePath added at line 681; pre-existing revalidatePath calls preserved at lines 679-680

## Insertion Location

| Region | Lines |
|--------|-------|
| Recovery auto-resolve try/catch block | 640–677 |
| Pre-existing revalidatePath — icerik-studio | 679 (preserved) |
| Pre-existing revalidatePath — sayfa-paketi | 680 (preserved) |
| New revalidatePath — izleme | 681 |
| Return statement (unchanged) | 683 |

## Decisions Made

- Used `console.warn` not `console.error` — recovery update failure on every publish would generate alarmist log noise; publish itself is fine
- No `project_id` filter on `recovery_tasks` UPDATE — `pkg.id` is a UUID PK, globally unique across tables; adding project_id would be redundant and could mask bugs where pkg.id is wrong
- `try/catch` is belt-and-suspenders: Supabase JS SDK returns errors as `{ error }` (handled by `if (recoveryUpdateError)`), but network exceptions also need capturing

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan modifies a server action only; no UI stubs introduced.

## Threat Flags

All threats in plan's `<threat_model>` mitigated:

| Threat ID | Mitigation Applied |
|-----------|--------------------|
| T-16-05-01 | RLS UPDATE policy on recovery_tasks + source='page_package' + source_id=pkg.id filters |
| T-16-05-02 | `.in('status', ['open', 'in_progress'])` excludes 'dismissed' and 'resolved' |
| T-16-05-04 | Recovery error never surfaces in function return value — only in console.warn |

T-16-05-03, T-16-05-05, T-16-05-06 accepted (documented in plan threat register).

## Issues Encountered

Two pre-existing TypeScript errors in `HtmlReadyBanner.tsx` (Cannot find module `../../sayfa-paketi/GscIndexBadge` and `../../sayfa-paketi/actions`) were present before this plan and are out of scope. `sayfa-paketi/actions.ts` itself is TypeScript-clean.

## User Setup Required

None — no external service configuration required. The recovery_tasks table was already created in Plan 16-01; the cookie-bound Supabase client (createClient) is already wired. No new env vars needed.

## Next Phase Readiness

- D-04 auto-resolve hook is live; Plans 16-03 (izleme UI) and 16-04 (updateRecoveryTaskStatus action) can rely on this path for the resolved transition
- Manual end-to-end verification flow documented in plan `<verification>` section — test by inserting a recovery_task row with status='open' and a valid page_packages.id, then triggering publish

---
*Phase: 16-recovery-engine*
*Completed: 2026-04-30*
