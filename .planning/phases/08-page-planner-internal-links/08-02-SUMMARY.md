---
phase: 08-page-planner-internal-links
plan: "02"
subsystem: page-planner-ui
tags: [client-components, bulk-edit, internal-links, orphan-detection, dialog]
dependency_graph:
  requires:
    - "sayfalar/actions.ts: updatePageAttributes (08-01)"
    - "ic-link-haritasi/actions.ts: suggestInternalLinks + addLink (08-01)"
  provides:
    - "sayfalar/BulkEditPagesDialog.tsx: bulk page attribute editor dialog"
    - "sayfalar/page.tsx: Toplu Düzenle trigger wired to BulkEditPagesDialog"
    - "ic-link-haritasi/SuggestLinksDialog.tsx: link suggestion review dialog with checkboxes"
    - "ic-link-haritasi/SuggestLinksButton.tsx: fetch-and-open button for SuggestLinksDialog"
    - "ic-link-haritasi/page.tsx: orphan banner + SuggestLinksButton wired to page"
  affects:
    - "BLUE-04: bulk page attribute editing complete end-to-end"
    - "BLUE-05: internal link suggestion with orphan detection complete end-to-end"
tech_stack:
  added: []
  patterns:
    - "Map<pageId, Partial<PageAttributeUpdate>> for dirty-state tracking (only dirty rows sent)"
    - "useRef<HTMLInputElement> for master checkbox indeterminate state"
    - "useTransition for server action fetches with pending UI state"
    - "DialogTrigger render prop (not asChild — base-ui requirement)"
    - "SSR Set-based orphan computation (linkedPageIds from source + target page IDs)"
    - "Sequential addLink calls in loop for suggestion batch insertion"
key_files:
  created:
    - src/app/(dashboard)/projeler/[id]/sayfalar/BulkEditPagesDialog.tsx
    - src/app/(dashboard)/projeler/[id]/ic-link-haritasi/SuggestLinksDialog.tsx
    - src/app/(dashboard)/projeler/[id]/ic-link-haritasi/SuggestLinksButton.tsx
  modified:
    - src/app/(dashboard)/projeler/[id]/sayfalar/page.tsx
    - src/app/(dashboard)/projeler/[id]/ic-link-haritasi/page.tsx
decisions:
  - "BulkEditPagesDialog dirty state uses Map — only changed rows sent to updatePageAttributes, not all pages"
  - "SuggestLinksDialog opened programmatically via open prop (not DialogTrigger) — avoids asChild pattern"
  - "Orphan computation runs SSR via Set of linkedPageIds — no extra DB query needed"
  - "SuggestLinksButton shows inline text when no suggestions returned — no toast library needed"
metrics:
  duration_seconds: 420
  completed_date: "2026-04-24"
  tasks_completed: 2
  files_modified: 5
---

# Phase 8 Plan 02: Page Planner & Internal Links UI Summary

**One-liner:** All 5 Phase 8 client components built — BulkEditPagesDialog with Map-based dirty tracking, SuggestLinksDialog with indeterminate master checkbox, SuggestLinksButton with useTransition, and SSR orphan banner with amber styling.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | BulkEditPagesDialog.tsx (new) + sayfalar/page.tsx (Toplu Düzenle trigger + allKeywords query) | 68ebeb7 |
| 2 | SuggestLinksDialog.tsx + SuggestLinksButton.tsx (new) + ic-link-haritasi/page.tsx (orphan banner + SuggestLinksButton) | 74f9584 |

## Changes by File

### sayfalar/BulkEditPagesDialog.tsx (new)
- Client component with `Map<string, Partial<PageAttributeUpdate>>` dirty state
- 4-column scrollable table: Sayfa Adı (read-only), Tip (select), Focus Keyword (select), Öncelik (select)
- `DialogTrigger render={<Button>}` pattern — NOT asChild (base-ui requirement)
- Disabled trigger when `pages.length === 0` with `title="Düzenlenecek sayfa yok"`
- Footer: dirty count summary on left, "Düzenlemeyi Kapat" + "Değişiklikleri Kaydet" on right
- Only dirty rows (changed by user) sent to `updatePageAttributes` — unchanged rows excluded
- `max-h-[70vh] overflow-y-auto` on table container
- `font-medium` absent throughout (UI-SPEC constraint enforced)

### sayfalar/page.tsx (modified)
- Added `allKeywords` Supabase query (ordered by keyword text ascending)
- Import + render of `BulkEditPagesDialog` in header, left of `AddPageDialog`
- Header action area wrapped in `<div className="flex items-center gap-2">`

### ic-link-haritasi/SuggestLinksDialog.tsx (new)
- Opened programmatically via `open` prop — no `DialogTrigger` (avoids asChild pattern)
- Master checkbox with `indeterminate` state via `useRef<HTMLInputElement>`
- 5-column table: checkbox, Kaynak Sayfa, Hedef Sayfa, Anchor Text, Link Tipi (per-row select)
- "Tip Atanmamış" amber badge for pages with `page_type === null`
- Sequential `addLink` calls for each selected row in `startTransition`
- Closes + `router.refresh()` on success; error shown inline in footer

### ic-link-haritasi/SuggestLinksButton.tsx (new)
- `useTransition` for `suggestInternalLinks` server action fetch
- Button shows "Yükleniyor…" with `opacity-50 cursor-wait` during pending
- If empty result: renders inline `"Önerilecek yeni link bulunamadı."` text, no dialog
- If 1+ suggestions: opens `SuggestLinksDialog` via `dialogOpen` state

### ic-link-haritasi/page.tsx (modified)
- `linkedPageIds` Set computed from all `source_page_id` and `target_page_id` in links
- `orphanPages` = pages not in `linkedPageIds` (only when `links.length > 0`)
- Amber banner rendered above "Linkler" header when `orphanPages.length > 0 && links.length > 0`
- `SuggestLinksButton` imported and rendered in header action group alongside `AddLinkDialog`

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Compliance

| Threat ID | Status |
|-----------|--------|
| T-08-02-01 | Mitigated — updatePageAttributes (Wave 1) already verifies project ownership + user_id; RLS enforces at DB |
| T-08-02-02 | Accepted — dirty Map bounded by project page count; no amplification risk |
| T-08-02-03 | Mitigated — addLink (Wave 1) verifies project ownership + user_id on each sequential call |
| T-08-02-04 | Accepted — suggestions contain only the authenticated user's own project data |

## Known Stubs

None — all client components are fully wired to Wave 1 server actions. No placeholder data or hardcoded empty values present.

## Threat Flags

None — no new network endpoints or trust boundaries introduced beyond what the plan specified.

## Self-Check: PASSED

- `src/app/(dashboard)/projeler/[id]/sayfalar/BulkEditPagesDialog.tsx` — FOUND
- `src/app/(dashboard)/projeler/[id]/sayfalar/page.tsx` — FOUND (BulkEditPagesDialog import + render verified)
- `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/SuggestLinksDialog.tsx` — FOUND
- `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/SuggestLinksButton.tsx` — FOUND
- `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/page.tsx` — FOUND (orphanPages + SuggestLinksButton verified)
- Commit 68ebeb7 — FOUND
- Commit 74f9584 — FOUND
- `npx tsc --noEmit` — PASSED (zero errors)
