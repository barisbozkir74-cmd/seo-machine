---
phase: 22-polish-carry-overs
plan: 04
subsystem: ui, revision-history
tags: [shadcn, sheet, dialog, base-ui, react, revision, page-packages, state-machine]

requires:
  - phase: 22-polish-carry-overs
    plan: 01
    provides: shadcn Sheet component (@/components/ui/sheet) via @base-ui/react/dialog
  - phase: 22-polish-carry-overs
    plan: 03
    provides: getRevisions server action + RevisionRow type from actions.ts

provides:
  - RevisionHistorySheet component with 5-state machine (idle/loading/loaded/empty/error)
  - RevisionPreviewDialog with read-only snapshot fields + Bunu Yukle CTA
  - PagePackageEditor wired with Gecmis toolbar button and applyRevision callback

affects:
  - PAGE-05 acceptance — UI layer for D-05 (sheet drawer) and D-06 (preview → load → manual save) now complete

tech-stack:
  added: []
  patterns:
    - "RevisionHistorySheet: fetch triggered on Sheet open, not on mount — avoids redundant server action calls"
    - "DialogClose with render prop pattern (not asChild) — base-ui @base-ui/react/dialog convention"
    - "applyRevision: snapshot → state setter mapping uses jsonString() helper for JSON fields, String() cast for text fields"
    - "RevisionHistorySheet and RevisionPreviewDialog mounted outside QA Dialog to avoid Portal nesting issues"

key-files:
  created:
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/RevisionHistorySheet.tsx
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/RevisionPreviewDialog.tsx
  modified:
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx

key-decisions:
  - "Sheet fetch triggered on open (handleOpenChange) rather than mount — avoids stale data when user opens sheet multiple times"
  - "applyRevision sets historyOpen=false as last step — sheet closes programmatically after revision loaded"
  - "RevisionPreviewDialog returns null when revision is null — prevents stale render on re-open"
  - "Build errors from other parallel wave worktrees are out-of-scope — no sayfa-paketi route errors"

patterns-established:
  - "Revision load pattern: preview → Bunu Yukle → state update only (D-06 honored) → user presses Kaydet to persist"

requirements-completed:
  - PAGE-05

duration: 25min
completed: 2026-05-10
---

# Phase 22 Plan 04: RevisionHistorySheet + RevisionPreviewDialog + PagePackageEditor Wiring Summary

**Revision history UI fully wired: Sheet drawer (5-state machine) + read-only preview dialog (Bunu Yukle → applyRevision → editor state) — D-05 and D-06 complete**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-10T22:00:00Z
- **Completed:** 2026-05-10T22:25:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `RevisionHistorySheet.tsx` created: shadcn `Sheet` side="right" w-[420px], `SheetTitle` "Revizyon Gecmisi", 5-state machine (idle/loading/loaded/empty/error), fetch triggered on `handleOpenChange`, revision list with version numbers (v{N}), tr-TR locale date formatting, "Onizle" buttons per row, spinner with `aria-label`
- `RevisionPreviewDialog.tsx` created: `Dialog` max-w-2xl, read-only `Textarea` fields (9 text + 8 JSON fields in font-mono), "Bunu Yukle" primary CTA, "Kapat" via `DialogClose render={...}` (base-ui render prop pattern, not asChild), graceful null guard when `revision === null`
- `PagePackageEditor.tsx` modified: import added, `historyOpen` state, `applyRevision` function (17 field setters using `jsonString()` for JSON fields), "Gecmis" ghost button in toolbar when `pkg !== null`, `RevisionHistorySheet` mounted alongside QA Dialog

## Task Commits

1. **Task 1: Create RevisionHistorySheet and RevisionPreviewDialog** - `121bd46` (feat)
2. **Task 2: Wire RevisionHistorySheet into PagePackageEditor** - `3fe80d0` (feat)

**Plan metadata:** (committed with SUMMARY below)

## Files Created/Modified

- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/RevisionHistorySheet.tsx` — Sheet drawer component, 124 lines, 5-state machine, revision list, Onizle buttons
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/RevisionPreviewDialog.tsx` — Preview dialog, 116 lines, read-only snapshot display, Bunu Yukle CTA
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` — +41 lines: import, historyOpen state, applyRevision (17 setters), Gecmis button, RevisionHistorySheet mount

## Decisions Made

- **Fetch on open, not on mount:** `handleOpenChange` triggers `getRevisions` only when `nextOpen === true`. This avoids stale data from the previous open and prevents unnecessary server action calls when the component first mounts.
- **applyRevision closes sheet:** The function sets `setHistoryOpen(false)` as its last operation, so the editor fields are updated before the sheet disappears — provides a clean transition per D-06.
- **RevisionPreviewDialog null guard:** `if (!revision) return null` at the top of the component prevents rendering with stale revision data between dialog opens.
- **Base-ui DialogClose render prop:** Used `<DialogClose render={<Button ...>Kapat</Button>} />` (not asChild) — consistent with project's MoveKeywordDialog and dialog.tsx patterns.

## Deviations from Plan

None — plan executed exactly as written. Both components match the plan's action sections verbatim. The `px-6` class was added to the Sheet content wrapper div for consistent padding (within the plan's spacing guidance), not a functional deviation.

## Issues Encountered

- **Build errors from other worktrees:** `npm run build` reports errors from `keyword-stratejisi`, `ic-link-haritasi`, `rakipler`, `sayfalar` routes — all from parallel wave agents' in-progress files. Zero errors from `sayfa-paketi` route. Out of scope per deviation rules (pre-existing/parallel work). Logged below.
- **TypeScript check:** `npx tsc --noEmit` shows zero errors in any `sayfa-paketi` file. All TS errors are from other routes (parallel wave WIP).

## Known Stubs

None — all components are fully wired. RevisionHistorySheet fetches live data from `getRevisions`, RevisionPreviewDialog renders actual snapshot fields, and `applyRevision` sets real state setters. No hardcoded empty values or placeholder text in data paths.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. All components are pure UI layers:
- `RevisionHistorySheet` → `getRevisions` (auth-guarded server action from Plan 03, T-22-06 already mitigated)
- `RevisionPreviewDialog` → `onLoadRevision` callback (UI state only, T-22-11 accepted per plan threat model)
- No new server-side surface added in this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- PAGE-05 requirement fully complete: D-04 (auto-snapshot on save, Plan 03) + D-05 (Sheet drawer, this plan) + D-06 (preview → load → manual save, this plan)
- Wave 3 is the final wave of Phase 22. MON-03 (Plans 02 + 05) handles the monitoring dashboard side.
- No blockers for Phase 22 acceptance.

---
*Phase: 22-polish-carry-overs*
*Completed: 2026-05-10*
