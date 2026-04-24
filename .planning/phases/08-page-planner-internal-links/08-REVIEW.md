---
phase: 08-page-planner-internal-links
reviewed: 2026-04-24T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts
  - src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx
  - src/app/(dashboard)/projeler/[id]/site-blueprint/MenuEditor.tsx
  - src/app/(dashboard)/projeler/[id]/sayfalar/actions.ts
  - src/app/(dashboard)/projeler/[id]/ic-link-haritasi/actions.ts
  - src/app/(dashboard)/projeler/[id]/sayfalar/BulkEditPagesDialog.tsx
  - src/app/(dashboard)/projeler/[id]/ic-link-haritasi/SuggestLinksDialog.tsx
  - src/app/(dashboard)/projeler/[id]/ic-link-haritasi/SuggestLinksButton.tsx
  - src/app/(dashboard)/projeler/[id]/sayfalar/page.tsx
  - src/app/(dashboard)/projeler/[id]/ic-link-haritasi/page.tsx
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-04-24
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 08 implements the Page Planner (Sayfa Listesi) and Internal Link Map (İç Link Haritası) features. The code is generally well-structured with consistent authorization patterns, input validation, and clear separation between server actions and client components.

One critical security vulnerability was found in `sayfalar/actions.ts`: the `updatePageAttributes` upsert can be exploited to overwrite pages belonging to other users by supplying foreign page IDs. Four warnings cover a sequential-insert pattern that partially applies on failure, a missing error display in `SuggestLinksButton`, a missing anchor text validation in `addLink`, and a stale-state bug when re-opening the `SuggestLinksDialog`. Three informational items cover code duplication and a minor UX gap.

## Critical Issues

### CR-01: `updatePageAttributes` upsert allows cross-user page ownership hijack

**File:** `src/app/(dashboard)/projeler/[id]/sayfalar/actions.ts:127-130`

**Issue:** The action verifies project ownership (line 109–115) but never verifies that each `page.id` in the `updates` array actually belongs to `projectId` and `user_id`. The Supabase `upsert` with `onConflict: 'id'` will update (or insert) any row whose `id` matches — regardless of the `project_id`/`user_id` values on the existing row. An authenticated user can pass IDs of pages owned by other users and overwrite their `page_type`, `focus_keyword_id`, or `priority`. Because `user_id` is included in the upsert payload, this effectively re-assigns ownership of the target row to the attacker.

**Fix:** Before upserting, verify that all supplied page IDs belong to the authenticated user and the given project:

```typescript
// After project ownership check, before building payload:
const suppliedIds = updates.map((u) => u.id)
const { data: ownedPages } = await supabase
  .from('pages')
  .select('id')
  .eq('project_id', projectId)
  .eq('user_id', user.id)
  .in('id', suppliedIds)

const ownedSet = new Set((ownedPages ?? []).map((p) => p.id))
if (ownedSet.size !== suppliedIds.length) {
  return { success: false, error: 'Bazı sayfalar bu projeye ait değil.' }
}
```

Alternatively, replace `upsert` with individual `update` calls that include `.eq('id', u.id).eq('project_id', projectId).eq('user_id', user.id)` to use the database as the authority.

---

## Warnings

### WR-01: Sequential `addLink` loop in `SuggestLinksDialog` partially applies on failure

**File:** `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/SuggestLinksDialog.tsx:66-81`

**Issue:** `handleAdd` calls `addLink` for each selected suggestion one-by-one inside a `for` loop. If any single call fails (e.g., a duplicate constraint on the 3rd of 10 selected links), the function returns early — leaving some links saved and some not. The user sees a generic error with no indication of which links were actually created, and has no way to retry only the failed ones.

**Fix:** Collect results for all calls, then report partial success or implement a bulk insert server action that inserts all selected links atomically:

```typescript
// Option A — collect results, report partial success:
const results = await Promise.all(
  selected.map((row) =>
    addLink(projectId, {
      source_page_id: row.suggestion.sourcePage.id,
      target_page_id: row.suggestion.targetPage.id,
      anchor_text: row.suggestion.anchorText,
      link_type: row.linkType,
    })
  )
)
const failed = results.filter((r) => !r.success).length
if (failed > 0) {
  setError(`${failed} link eklenemedi.`)
}
// Always refresh and close if at least some succeeded
```

Or, preferred: add a `bulkAddLinks` server action that does a single `insert(payloads)` with Supabase, which is atomic and avoids N round-trips.

---

### WR-02: `SuggestLinksButton` silently swallows server action errors

**File:** `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/SuggestLinksButton.tsx:22-23`

**Issue:** When `suggestInternalLinks` returns `{ success: false, error }`, the `handleClick` handler hits `if (!result.success) return` without showing any error to the user. The button simply stops spinning with no feedback, leaving the user unaware that something went wrong (e.g., auth error, DB error).

**Fix:**

```typescript
const [fetchError, setFetchError] = useState<string | null>(null)

function handleClick() {
  setNoResults(false)
  setFetchError(null)
  startTransition(async () => {
    const result = await suggestInternalLinks(projectId)
    if (!result.success) {
      setFetchError('Öneriler yüklenemedi. Lütfen tekrar deneyin.')
      return
    }
    // ... rest unchanged
  })
}

// In JSX, next to the button:
{fetchError && !isPending && (
  <span className="text-sm text-destructive">{fetchError}</span>
)}
```

---

### WR-03: `addLink` does not validate that `anchor_text` is non-empty before inserting

**File:** `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/actions.ts:17-53`

**Issue:** `addLink` calls `data.anchor_text.trim()` before inserting (line 46) but never checks whether the trimmed value is empty. An empty anchor text is inserted as an empty string `''` into the database. In the link table display, empty anchor text falls through to the italic "—" fallback (page.tsx line 237), which is a reasonable display — but storing an empty string rather than `null` is semantically incorrect and may break future queries that filter by anchor text.

**Fix:**

```typescript
if (!data.anchor_text?.trim()) {
  return { success: false, error: 'Anchor text boş olamaz.' }
}
```

If empty anchor text is intentionally valid, store `null` instead of an empty string:
```typescript
anchor_text: data.anchor_text.trim() || null,
```

---

### WR-04: `SuggestLinksDialog` row state is not reset when `suggestions` prop changes

**File:** `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/SuggestLinksDialog.tsx:34-35`

**Issue:** `rows` state is initialized once via a `useState` lazy initializer using `suggestions`. If the parent `SuggestLinksButton` fetches new suggestions and re-renders the dialog with a new `suggestions` array (currently prevented because `setSuggestions(null)` on close destroys the component, but the component is conditionally rendered based on `suggestions !== null`), the row state would be stale. More concretely: if a user opens the dialog, closes it without adding, and the parent keeps the old suggestions, a second open would show the old selection state.

The current flow destroys and recreates the component on each open (because `suggestions` is set to `null` on close), so this is not actively broken. However it is a latent bug — if the parent ever caches suggestions across opens, the dialog will show stale state.

**Fix:** Add a `useEffect` that synchronizes `rows` when `suggestions` changes, matching the pattern already used in `GeneratePagesDialog`:

```typescript
useEffect(() => {
  setRows(suggestions.map((s) => ({ suggestion: s, selected: true, linkType: 'contextual' })))
}, [suggestions])
```

---

## Info

### IN-01: `PAGE_TYPE_LABELS` is duplicated across three files

**File:** `src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx:15-26`, `src/app/(dashboard)/projeler/[id]/sayfalar/BulkEditPagesDialog.tsx:16-27`, `src/app/(dashboard)/projeler/[id]/sayfalar/page.tsx:18-29`

**Issue:** The `PAGE_TYPE_LABELS` record is defined identically in three separate files. Adding or renaming a page type requires updating all three locations.

**Fix:** Extract to a shared constant module, e.g. `src/lib/pages/page-types.ts`, and import from there.

---

### IN-02: `reorderPage` Step 1 DB error is not checked

**File:** `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts:358-362`

**Issue:** The sentinel swap Step 1 (`update sort_order to -1`) result is not captured, so if that write fails, Steps 2 and 3 still execute against the unmodified data — resulting in a corrupt sort order with both rows having the original `sort_order` of the neighbor. Only `r2.error` and `r3.error` are checked (line 378).

**Fix:**

```typescript
const r1 = await supabase
  .from('pages')
  .update({ sort_order: -1 })
  .eq('id', current.id)
  .eq('user_id', user.id)

if (r1.error) return { success: false, error: 'Sıralama güncellenemedi.' }
```

---

### IN-03: `ic-link-haritasi/page.tsx` guard condition is redundant

**File:** `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/page.tsx:144`

**Issue:** Line 144 checks `orphanPages.length > 0 && links.length > 0`, but `orphanPages` is already constructed as an empty array when `links.length === 0` (line 99–101), making the `links.length > 0` guard redundant. This causes no bug but adds unnecessary noise.

**Fix:** Simplify to `{orphanPages.length > 0 && (...)}`

---

_Reviewed: 2026-04-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
