---
phase: 07-site-blueprint-tree
created: 2026-04-24
status: ready
---

# Phase 7 Context — Site Blueprint & Tree

## What's Already Built

`site-blueprint/page.tsx` already has:
- `flattenTree()` — recursive depth-indented page tree table
- `AddPageModal` — manual single-page add dialog
- `MenuEditor` — top/main/footer menu sections with `upsertMenu` action

`site-blueprint/actions.ts` already has:
- `addPage(projectId, data)` — inserts into `pages` table
- `deletePage(pageId, projectId)` — ownership-checked delete
- `upsertMenu(projectId, location, items)` — menu persistence

`sayfalar/page.tsx` already has:
- `PAGE_TYPE_LABELS` — full Turkish label map for all page types
- `PriorityBadge`, `AddPageDialog`, `PageDeleteButton`

`pages` table already has: `parent_id`, `cluster_id`, `focus_keyword_id`, `sort_order`, `page_type`, `slug`.

**Phase 7 builds on this foundation — no rebuilding of existing features.**

---

## Decisions

### D-01: Auto-generation algorithm — 1 cluster = 1 page

Each `keyword_cluster` row generates exactly one `pages` row. No grouping or hierarchy in Phase 7.

- `cluster_id` stored on the page for traceability
- Future phases can add hub-spoke grouping; the `parent_id` column already supports it
- Page name = cluster name (stripped of the intent suffix added by Phase 6, e.g. `"conservatory blinds (commercial)"` → `"Conservatory Blinds"`)
- `focus_keyword_id` = cluster's `primary_keyword_id`
- `slug` = slugified focus keyword (lowercase, spaces→hyphens, Turkish chars normalized)

**Duplicate/cannibalization check before generation:**
Before inserting, query `pages` where `cluster_id IN (cluster_ids_to_generate) AND project_id = ?`. If any cluster already has a page, show a warning list in the generation dialog. User can choose to skip those or regenerate (delete+recreate). Default: skip existing.

### D-02: Page type assignment — Hybrid (rule proposes, user confirms)

**Intent → page_type rule table:**
| Cluster intent | Default page_type |
|---|---|
| transactional | hizmet |
| commercial | hizmet |
| informational | blog |
| navigational | ana-sayfa |
| unknown | blog |

System applies this rule automatically. The generation dialog shows each proposed page with its type as an editable field (select dropdown). User reviews and edits before hitting "Oluştur".

**Rationale:** Pure auto-assign would create wrong types silently (e.g. a commercial cluster for a physical product being assigned `hizmet`). The dialog edit step costs ~30 seconds and prevents downstream errors in page package production.

### D-03: Keyword-to-page mapping — Site-blueprint inner tab

Add a second tab to `site-blueprint/page.tsx`:
- Tab 1: "Ağaç Görünümü" (existing tree table)
- Tab 2: "Keyword Eşleme" (new)

**Keyword Eşleme tab layout:**
- **Eşleşen Keywords** table: page name | focus keyword | all cluster keywords (comma-list) | cluster intent
- **Eşleşmeyenler** warning section: keywords with `cluster_id IS NULL` or cluster has no page yet — listed as amber warning cards with "Bu keyword henüz bir sayfaya bağlı değil"

Tab switching via `searchParams` (`?tab=mapping` / `?tab=tree`) — same URL-routing pattern as Phase 6 view toggle.

**Mapping conflict detection:**
A keyword "conflict" = same keyword text appearing in two different clusters that both have pages. Query: find duplicate `keyword` values across clusters that have pages. Show as red badge "⚠ Çakışma" on both pages.

### D-04: Page reordering — Up/down arrow buttons

Each page row in the tree table shows ↑ ↓ buttons (visible on hover, or always visible on narrow rows).

`reorderPage(pageId, direction: 'up' | 'down', projectId)` Server Action:
- Fetch sibling pages (same `parent_id`, same `project_id`) ordered by `sort_order`
- Swap `sort_order` values with adjacent sibling
- `revalidatePath` — page re-renders with new order

No drag-drop in Phase 7 (no extra dependencies). `@dnd-kit` deferred to a future milestone if requested.

### D-05: Generation dialog UX

The "Kümelerden Oluştur" button in site-blueprint header opens a dialog:

1. **Preview table**: cluster name | proposed page name (editable inline) | proposed type (select) | focus keyword | action (include/skip checkbox)
2. **Duplicate warning**: if clusters already have pages, those rows are pre-checked "skip" with amber "Zaten var" badge
3. **"Oluştur" button**: creates only checked rows, runs duplicate guard, `revalidatePath`
4. **Empty state guard**: if no enriched clusters exist, button is disabled with tooltip "Önce keyword kümeleme yapın"

### D-06: Slug generation rules

- Lowercase
- Spaces → hyphens
- Turkish char normalization: ç→c, ş→s, ğ→g, ü→u, ö→o, ı→i
- Remove special chars except hyphens
- Max 60 chars
- Duplicate slug within project → append `-2`, `-3`, etc.

---

## What Phase 7 Must Build

| Item | Type | Note |
|---|---|---|
| `generatePagesFromClusters` Server Action | New | Core generation logic with duplicate check |
| `reorderPage` Server Action | New | Swap sort_order with sibling |
| `GeneratePagesDialog` Client Component | New | Preview table + type select + include/skip |
| `GenerateFromClustersButton` Client Component | New | `useTransition` + opens dialog |
| Site-blueprint tab switcher | Edit | Add tab bar with searchParams routing |
| Keyword Eşleme tab | New | Mapped + unmapped keyword view |
| Tree table row reorder arrows | Edit | ↑↓ buttons on existing tree rows |
| Conflict detection query | New | SSR, shown as badge on conflicting pages |

---

## What Phase 7 Must NOT Touch

- `AddPageModal` — leave as-is, manual add still works
- `MenuEditor` — Phase 7 has no menu changes
- `sayfalar/` route — separate from site-blueprint, untouched
- `keyword-stratejisi/` route — Phase 6 code, untouched
- Existing `addPage` / `deletePage` / `upsertMenu` actions — extend, don't replace

---

## Open Questions (Resolved)

**Q: Should generation overwrite existing pages?**
A: No. Default behavior is skip. Dialog shows "Zaten var" badge on rows with existing cluster_id match. User can manually delete and regenerate if needed.

**Q: Should `sayfalar/` and `site-blueprint/` pages merge?**
A: Not in Phase 7. They serve different purposes — blueprint is the structural view, sayfalar is the production checklist. Keep separate.

**Q: What if a project has 0 clusters?**
A: "Kümelerden Oluştur" button disabled with tooltip "Önce keyword kümeleme yapın".
