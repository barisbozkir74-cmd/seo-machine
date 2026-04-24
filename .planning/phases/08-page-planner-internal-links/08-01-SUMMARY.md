---
phase: 08-page-planner-internal-links
plan: "01"
subsystem: page-planner-actions
tags: [bug-fix, server-actions, site-blueprint, sayfalar, ic-link-haritasi]
dependency_graph:
  requires: []
  provides:
    - "site-blueprint/actions.ts: atomic 3-step sort_order swap (WR-01)"
    - "site-blueprint/actions.ts: slug uniqueness via slugify before insert (WR-02)"
    - "site-blueprint/actions.ts: clusterIds deduplication before ownership check (WR-03)"
    - "site-blueprint/GeneratePagesDialog.tsx: useEffect state reset when rows prop changes (WR-04)"
    - "site-blueprint/MenuEditor.tsx: stable _key per item via crypto.randomUUID() (WR-05)"
    - "sayfalar/actions.ts: updatePageAttributes bulk upsert server action"
    - "ic-link-haritasi/actions.ts: suggestInternalLinks pillar→support suggestion engine"
  affects:
    - "sayfalar/BulkEditPagesDialog.tsx (Wave 2 — imports updatePageAttributes)"
    - "ic-link-haritasi/SuggestLinksButton.tsx (Wave 2 — imports suggestInternalLinks)"
tech_stack:
  added: []
  patterns:
    - "3-step sentinel swap for sort_order uniqueness constraint avoidance"
    - "crypto.randomUUID() stable React key pattern"
    - "useEffect sync when useMemo identity changes"
    - "bulk upsert with onConflict: 'id' for partial attribute updates"
    - "pillar→support graph traversal with existing-pair deduplication via Set"
key_files:
  modified:
    - src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts
    - src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx
    - src/app/(dashboard)/projeler/[id]/site-blueprint/MenuEditor.tsx
    - src/app/(dashboard)/projeler/[id]/sayfalar/actions.ts
    - src/app/(dashboard)/projeler/[id]/ic-link-haritasi/actions.ts
decisions:
  - "Sentinel value -1 chosen for sort_order swap: valid sort_orders are >= 0, so -1 can never collide (T-08-01-05 accepted)"
  - "updatePageAttributes uses upsert with onConflict: 'id' — only provided fields are spread into payload, so missing fields are not overwritten"
  - "suggestInternalLinks does NOT write to DB — returns InternalLinkSuggestion[] for user approval (D-02)"
  - "PILLAR_TYPES: kategori, ana-sayfa; SUPPORT_TYPES: hizmet, blog, landing, urun (D-04)"
metrics:
  duration_seconds: 114
  completed_date: "2026-04-24"
  tasks_completed: 3
  files_modified: 5
---

# Phase 8 Plan 01: WR Fixes + New Server Actions Summary

**One-liner:** 5 Phase 7 code review warnings fixed (atomic sentinel swap, slug uniqueness, clusterIds dedup, useEffect sync, stable React keys) plus two new server actions for Wave 2 UI (updatePageAttributes bulk upsert, suggestInternalLinks pillar→support engine).

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | WR-01 (sentinel swap), WR-02 (safeSlug), WR-03 (Set dedup) in site-blueprint/actions.ts | 9c652eb |
| 2 | WR-04 (useEffect in GeneratePagesDialog), WR-05 (stable _key in MenuEditor) | 903a18b |
| 3 | updatePageAttributes in sayfalar/actions.ts, suggestInternalLinks in ic-link-haritasi/actions.ts | f8ff566 |

## Changes by File

### site-blueprint/actions.ts
- **WR-01:** `reorderPage` now uses a 3-step sequential sentinel approach. Step 1 sets `sort_order: -1` (sentinel, impossible value since valid sort_orders >= 0), Step 2 moves neighbor to current's old position, Step 3 moves current to neighbor's old position. The `Promise.all` double-UPDATE is removed.
- **WR-02:** `addPage` queries existing slugs for the project before insert, then calls `slugify(input.slug || input.title, existingSlugs)` to produce `safeSlug`. Insert now uses `safeSlug` instead of raw `input.slug`.
- **WR-03:** `generatePagesFromClusters` deduplicates clusterIds before the ownership size comparison: `[...new Set(rows.map((r) => r.clusterId))]`. This prevents false "bazı kümeler projeye ait değil" errors when the same clusterId appears multiple times in the input rows.

### site-blueprint/GeneratePagesDialog.tsx
- **WR-04:** Added `useEffect` to the React import. Inserted `useEffect(() => { setState(initialState) }, [initialState])` after the `useState` initializer. When `rows` prop identity changes (e.g., parent component re-fetches clusters), dialog row state resets instead of showing stale data.

### site-blueprint/MenuEditor.tsx
- **WR-05:** Defined `MenuItemWithKey` (extends MenuItem with `_key: string`). `useState` type changed to `MenuItemWithKey[]`; initial items mapped with `crypto.randomUUID()`. `handleAddItem` attaches `_key: crypto.randomUUID()`. `handleDeleteItem` now filters by `_key` string instead of array index. `handleSave` strips `_key` before passing to `upsertMenu`. JSX uses `key={item._key}` instead of `key={index}`.

### sayfalar/actions.ts
- **New:** `updatePageAttributes(projectId, updates: PageAttributeUpdate[])` — auth + project ownership check, then bulk upsert with `onConflict: 'id'`. Only provided fields (`page_type`, `focus_keyword_id`, `priority`) are spread into the payload. Returns `UpdatePageAttributesResult`. Revalidates `/projeler/${projectId}/sayfalar`.

### ic-link-haritasi/actions.ts
- **New:** `suggestInternalLinks(projectId)` — auth + ownership check, queries all pages + focus keywords + existing links. Builds pillar→support suggestions (PILLAR_TYPES = ['kategori', 'ana-sayfa'], SUPPORT_TYPES = ['hizmet', 'blog', 'landing', 'urun']). Deduplicates against existing `source_page_id:target_page_id` pairs. Returns `SuggestInternalLinksResult` with `InternalLinkSuggestion[]`. Does NOT write to DB.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Compliance

| Threat ID | Status |
|-----------|--------|
| T-08-01-01 | Mitigated — getUser() + project ownership check before updatePageAttributes upsert |
| T-08-01-02 | Mitigated — payload always includes user_id + project_id; RLS enforces at DB level |
| T-08-01-03 | Mitigated — getUser() + project ownership check before suggestInternalLinks queries |
| T-08-01-04 | Mitigated — all queries include .eq('user_id', user.id) |
| T-08-01-05 | Accepted — partial failure leaves sentinel -1; corrected on next swap or reload |

## Known Stubs

None — all server actions return real data from DB queries. Wave 2 UI components that consume these actions are not yet built (08-02).

## Threat Flags

None — no new network endpoints or trust boundaries introduced beyond what the plan specified.

## Self-Check: PASSED

- `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts` — FOUND
- `src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx` — FOUND
- `src/app/(dashboard)/projeler/[id]/site-blueprint/MenuEditor.tsx` — FOUND
- `src/app/(dashboard)/projeler/[id]/sayfalar/actions.ts` — FOUND
- `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/actions.ts` — FOUND
- Commit 9c652eb — FOUND
- Commit 903a18b — FOUND
- Commit f8ff566 — FOUND
- `npx tsc --noEmit` — PASSED (zero errors)
