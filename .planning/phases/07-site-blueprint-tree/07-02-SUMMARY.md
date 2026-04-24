---
phase: 07-site-blueprint-tree
plan: "02"
subsystem: site-blueprint-ui
tags: [site-blueprint, ui, client-components, dialog, tab-switcher, reorder, conflict-detection]
requirements: [BLUE-01, BLUE-02, BLUE-03]

dependency_graph:
  requires:
    - 07-01 (generatePagesFromClusters, reorderPage, intentToPageType server actions)
    - keyword-stratejisi/IntentBadge (reused component)
  provides:
    - GenerateFromClustersButton (cluster-to-page generation dialog trigger)
    - GeneratePagesDialog (5-col preview table, Zaten var badge)
    - ReorderButton (↑↓ page reorder)
    - KeywordMappingTab (keyword-to-page mapping view + conflict detection)
    - site-blueprint/page.tsx tab routing + full integration
  affects:
    - site-blueprint/page.tsx (tab switcher, cluster queries, conflict SSR)

tech_stack:
  added: []
  patterns:
    - searchParams tab routing (Link-based, SSR-friendly, same as Phase 6 ViewToggle)
    - Dialog open state in parent component, trigger prop passed down (no asChild)
    - useMemo for initialState in dialog (avoids stale closure on row changes)
    - Conflict detection via Map<keywordText, Set<clusterId>> SSR pattern
    - ReorderButton: useTransition, silent fail (revalidatePath handles refresh)
    - KeywordMappingTab as Server Component (no client state needed)
    - stripIntentSuffix: title-case + intent suffix removal (D-01)

key_files:
  created:
    - src/app/(dashboard)/projeler/[id]/site-blueprint/GenerateFromClustersButton.tsx
    - src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx
    - src/app/(dashboard)/projeler/[id]/site-blueprint/ReorderButton.tsx
    - src/app/(dashboard)/projeler/[id]/site-blueprint/KeywordMappingTab.tsx
  modified:
    - src/app/(dashboard)/projeler/[id]/site-blueprint/page.tsx

decisions:
  - "GeneratePagesDialog trigger via prop (not DialogTrigger) to handle disabled wrapper span"
  - "KeywordMappingTab is a Server Component — no client state, IntentBadge is pure render"
  - "Conflict detection done SSR via Map/Set — no extra Supabase query, uses already-fetched cluster data"
  - "stripIntentSuffix applied server-side before passing to dialogRows"

metrics:
  duration: "~25 minutes"
  completed: "2026-04-24T17:34:30Z"
  tasks_completed: 3
  tasks_pending: 1
  files_created: 4
  files_modified: 1
---

# Phase 7 Plan 02: Site Blueprint UI — Summary

## One-Liner

Tab-switched site-blueprint page with cluster-to-page generation dialog, ↑↓ reorder arrows, SSR conflict detection badges, and keyword mapping view.

## What Was Built

### Task 1: GenerateFromClustersButton + GeneratePagesDialog

- **GenerateFromClustersButton** (`use client`): renders disabled+tooltip span when `hasEnrichedClusters=false`; otherwise opens GeneratePagesDialog via `open` state
- **GeneratePagesDialog** (`use client`): 5-column preview table (`Küme Adı | Sayfa Adı (editable) | Tip (select) | Odak Keyword | Dahil Et`); `alreadyExists` rows show amber "Zaten var" badge with `bg-amber-500/10` row background; count summary "{N} sayfa oluşturulacak"; pending state "Oluşturuluyor…"; calls `generatePagesFromClusters` via `useTransition`; `max-w-2xl` dialog width; 10-entry `PAGE_TYPE_LABELS` select

### Task 2: ReorderButton + KeywordMappingTab

- **ReorderButton** (`use client`): ghost variant, `h-7 w-7 p-0`, disabled `opacity-30`, pending `opacity-50 cursor-wait`; calls `reorderPage(pageId, direction, projectId)` via `useTransition`
- **KeywordMappingTab** (Server Component, no `use client`): Section A "Eşleşen Keyword'ler" 4-col table (Sayfa Adı + conflict badge | Odak Keyword | Küme Keyword'leri | IntentBadge); Section B "Eşleşmeyen Keyword'ler" amber warning + list (only when count > 0)

### Task 3: page.tsx Integration

- `searchParams` destructure → `isMappingTab = tab === 'mapping'` tab routing
- `keyword_clusters` SSR query with `keywords!inner` join
- `hasEnrichedClusters` flag → GenerateFromClustersButton disabled prop
- `clusterIdsWithPages` Set → `alreadyExists` computation for dialog rows
- `stripIntentSuffix()` → title-case cluster name, strips `(commercial|informational|...)` suffix (D-01)
- `conflictPageIds` SSR detection: `Map<keywordText, Set<clusterId>>` → pages with duplicate keyword text across clusters both having pages
- `mappedPages` + `unmappedKeywords` data for KeywordMappingTab
- Focus keyword lookup via separate `keywords` query for `focus_keyword_id` fields
- Tree table grid updated to 6 columns: `grid-cols-[1fr_1fr_auto_auto_auto_auto]`
- `<ReorderButton>` (up + down) in each tree row; `isFirstSibling`/`isLastSibling` computed by filtering `flatPages` on same `parent_id`
- `⚠ Çakışma` badge inline in tree table Sayfa Adı cell
- `font-medium` → `font-normal` (UI-SPEC enforcement)
- Existing `AddPageModal`, `MenuEditor`, inline `deletePage` form preserved

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria met.

## Known Stubs

None — all data is wired from Supabase queries. `focusKeyword` may show `—` when `focus_keyword_id` is null, which is correct behavior (some pages may not have a focus keyword assigned).

## Threat Flags

No new threat surface beyond what was documented in the plan's `<threat_model>`. All SSR queries include `.eq('user_id', user.id)` + `.eq('project_id', id)` dual filter. No `dangerouslySetInnerHTML` used.

## Checkpoint Status

**Task 4 (human-verify) is pending.** This is a `checkpoint:human-verify` gate — the user must visually verify the 10-scenario checklist in a running dev environment before the plan can be marked complete.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| GenerateFromClustersButton.tsx | FOUND |
| GeneratePagesDialog.tsx | FOUND |
| ReorderButton.tsx | FOUND |
| KeywordMappingTab.tsx | FOUND |
| page.tsx (modified) | FOUND |
| Commit 9701262 (Task 1) | FOUND |
| Commit aa7ca5c (Task 2) | FOUND |
| Commit 8bcfbf2 (Task 3) | FOUND |
