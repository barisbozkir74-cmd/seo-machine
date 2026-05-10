---
phase: 22-polish-carry-overs
plan: 02
subsystem: monitoring, ui
tags: [monitoring, imported-pages, gsc, badge, page-metrics-table, aggregation]

requires:
  - phase: 15-wp-import-engine
    provides: project_imported_pages table populated by WP Import Engine
  - plan: 22-01
    provides: Sheet component installed (not directly used here, but Wave 1 gate)

provides:
  - ImportedPageRow type in @/lib/monitoring/aggregation
  - getImportedPageMetrics function in @/lib/monitoring/aggregation
  - PageMetricsTable extended with importedPages prop + blue badge + updated empty state
  - izleme/page.tsx unconditional project_imported_pages fetch (D-02 honored)

affects:
  - 22-03 (page_package_revisions actions — unrelated)
  - 22-04 (PagePackageEditor — unrelated)

tech-stack:
  added: []
  patterns:
    - "ImportedPageRow discriminant: rowType: 'imported' literal for table rendering"
    - "GSC-independent fetch: project_imported_pages queried before gscConnected gate"
    - "Pages tab restructured: rendered outside !gscConnected block via activeTab === 'pages' guard first"

key-files:
  created: []
  modified:
    - src/lib/monitoring/aggregation.ts
    - src/app/(dashboard)/projeler/[id]/izleme/page-metrics-table.tsx
    - src/app/(dashboard)/projeler/[id]/izleme/page.tsx

key-decisions:
  - "ImportedPageRow uses literal null types (not number | null) for metric fields — prevents accidental arithmetic on imported rows"
  - "Pages tab moved outside gscConnected gate via activeTab === 'pages' first-branch pattern — cleanest way to honor D-02 without duplicating tab bar JSX"
  - "page.tsx maps imported pages inline (not via getImportedPageMetrics call) to avoid extra async call — both approaches valid per PATTERNS.md"

requirements-completed:
  - MON-03

duration: ~15min
completed: 2026-05-10
---

# Phase 22 Plan 02: MON-03 Imported Pages in Monitoring Dashboard Summary

**ImportedPageRow type + getImportedPageMetrics added to aggregation.ts; PageMetricsTable extended with blue 'İçe Aktarıldı' badge and GSC-independent pages tab**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-10T21:30:00Z
- **Completed:** 2026-05-10T21:33:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `ImportedPageRow` type added to `aggregation.ts` with literal null metric fields (clicks/impressions/avgPosition/deltaPosition all typed as `null`, not `number | null`), `isDecayed: false` literal, and `rowType: 'imported'` discriminant
- `getImportedPageMetrics` function exported from `aggregation.ts` — fetches `project_imported_pages` ordered by title, maps to `ImportedPageRow[]` with link || /slug fallback
- `PageMetricsTable` extended: new `importedPages?: ImportedPageRow[]` and `gscConnected?: boolean` props; imported rows render after GSC rows with em-dash (—) for all metric columns
- Blue "İçe Aktarıldı" badge applied to imported rows: `bg-blue-500/15 text-blue-400 border border-blue-500/30` — distinct from Düşüş red badge
- Empty state updated from "GSC verisi bulunamadı" to "Henüz sayfa verisi yok"; shows sub-text when `!gscConnected`
- `izleme/page.tsx` refactored: `project_imported_pages` fetch runs unconditionally before the `gscConnected` gate; pages tab rendered via `activeTab === 'pages'` first-branch (D-02: accessible via `?tab=pages` even without GSC)
- Cluster and recovery sections remain gated on `gscConnected` (D-03 honored)

## Task Commits

1. **Task 1: ImportedPageRow type + getImportedPageMetrics** - `770d5bd` (feat)
2. **Task 2: PageMetricsTable extension + izleme page.tsx GSC gate** - `a758f56` (feat)

## Files Created/Modified

- `src/lib/monitoring/aggregation.ts` — added `ImportedPageRow` type (lines 30–40) and `getImportedPageMetrics` function (lines 300–326)
- `src/app/(dashboard)/projeler/[id]/izleme/page-metrics-table.tsx` — updated signature, empty state, imported rows with blue badge
- `src/app/(dashboard)/projeler/[id]/izleme/page.tsx` — unconditional `project_imported_pages` fetch, pages tab outside gscConnected gate

## Decisions Made

- **Literal null types:** `ImportedPageRow` metric fields typed as `null` (not `number | null`) so TypeScript catches any accidental arithmetic in the table renderer — discriminant-based typing is safer than union types here.
- **activeTab === 'pages' first-branch pattern:** Rather than duplicating the entire tab bar or restructuring the gscConnected conditional, moving `activeTab === 'pages'` as the outer condition in the ternary is the cleanest approach to honor D-02 without touching cluster/recovery sections.
- **Inline mapping in page.tsx:** Per PATTERNS.md, both calling `getImportedPageMetrics` and doing a direct Supabase fetch are valid. Inline mapping avoids an extra async hop and keeps the unconditional fetch visible at the call site.

## Deviations from Plan

None — plan executed exactly as written. The `pages` tab restructuring (moving outside gscConnected block) was explicitly required by D-02 and documented in Task 2 action.

## Known Stubs

None — imported pages data is live from `project_imported_pages` table (populated by WP Import Engine). PageMetricsTable renders real rows when data exists.

## Threat Surface Scan

- `project_imported_pages` fetch in `izleme/page.tsx` always includes `.eq('project_id', id)` where `id` is validated server-side (user ownership confirmed via `projects` query with `.eq('user_id', user.id)`). T-22-04 mitigated per threat register.
- `gscConnected` prop is computed server-side from DB state — client cannot override (T-22-05 accepted per threat register).

No additional threat flags beyond what was registered in the plan.

## Self-Check: PASSED

- `src/lib/monitoring/aggregation.ts` — exists, contains `export type ImportedPageRow` and `export async function getImportedPageMetrics`
- `src/app/(dashboard)/projeler/[id]/izleme/page-metrics-table.tsx` — exists, contains "İçe Aktarıldı", "Henüz sayfa verisi yok", no "GSC verisi bulunamadı"
- `src/app/(dashboard)/projeler/[id]/izleme/page.tsx` — exists, contains "project_imported_pages", "importedPages={importedPages}"
- Commits `770d5bd` and `a758f56` exist in git log
- No TypeScript errors in monitoring/izleme files (`npx tsc --noEmit` shows no errors for these paths)

---
*Phase: 22-polish-carry-overs*
*Completed: 2026-05-10*
