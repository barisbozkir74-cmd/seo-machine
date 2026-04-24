---
phase: 07-site-blueprint-tree
reviewed: 2026-04-24T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts
  - src/app/(dashboard)/projeler/[id]/site-blueprint/page-utils.ts
  - src/app/(dashboard)/projeler/[id]/site-blueprint/page.tsx
  - src/app/(dashboard)/projeler/[id]/site-blueprint/GenerateFromClustersButton.tsx
  - src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx
  - src/app/(dashboard)/projeler/[id]/site-blueprint/ReorderButton.tsx
  - src/app/(dashboard)/projeler/[id]/site-blueprint/KeywordMappingTab.tsx
  - src/app/(dashboard)/projeler/[id]/site-blueprint/AddPageModal.tsx
  - src/app/(dashboard)/projeler/[id]/site-blueprint/MenuEditor.tsx
  - src/lib/pages/slugify.ts
  - src/lib/pages/slugify.test.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-04-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

This phase implements the Site Blueprint & Tree feature: bulk page generation from keyword clusters, a sortable tree view, menu editing, and a keyword-mapping tab. The server actions are well-structured with proper ownership verification, UUID input guards, and a DoS limit on bulk generation. The `slugify` utility is clean, fully tested, and correctly handles Turkish character normalization.

The main concerns are: (1) a non-atomic double-UPDATE swap in `reorderPage` that can leave `sort_order` in an inconsistent state on partial failure; (2) slug collision guard in `generatePagesFromClusters` only checking cluster-level de-duplication — not slug-level against existing pages' slugs already present in the batch table; (3) the `addPage` action does not deduplicate slugs at all, allowing duplicate slugs to be inserted; (4) `DialogTrigger` usage pattern in `AddPageModal` looks non-standard and may not render the button correctly; and (5) a stale-state issue in `GeneratePagesDialog` where `state` is not reset when the `rows` prop changes after the dialog is already mounted.

---

## Warnings

### WR-01: Non-atomic sort_order swap in `reorderPage` can cause data corruption

**File:** `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts:349-364`

**Issue:** The swap of `sort_order` values between two sibling pages is performed as two independent `UPDATE` statements run via `Promise.all`. If the first succeeds and the second fails, the database is left with two pages sharing the same `sort_order` value. The `if (r1.error || r2.error)` check detects this after the fact but cannot roll back the already-committed first update. Supabase's PostgREST does not expose multi-statement transactions directly, but this can be resolved by using a RPC (database function) or at minimum by setting one of them to a temporary sentinel value first.

**Fix:** Wrap the swap in a Postgres function called via `supabase.rpc()`. As a simpler alternative that avoids the conflict window, use a temporary sort_order value that cannot collide (e.g. a large negative number) for the intermediate step:

```typescript
// Step 1: move current to a safe sentinel
await supabase
  .from('pages')
  .update({ sort_order: -1 })
  .eq('id', current.id)
  .eq('user_id', user.id)

// Step 2: move neighbor to current's old position
const r2 = await supabase
  .from('pages')
  .update({ sort_order: current.sort_order })
  .eq('id', neighbor.id)
  .eq('user_id', user.id)

// Step 3: move current to neighbor's old position
const r3 = await supabase
  .from('pages')
  .update({ sort_order: neighbor.sort_order })
  .eq('id', current.id)
  .eq('user_id', user.id)

if (r2.error || r3.error) {
  return { success: false, error: 'Sıralama güncellenemedi.' }
}
```

The cleanest fix is a `SECURITY DEFINER` Postgres function that does both UPDATEs in one transaction.

---

### WR-02: `addPage` does not enforce slug uniqueness — duplicate slugs possible

**File:** `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts:64-74`

**Issue:** The `addPage` action inserts the slug as-is from `input.slug` with no deduplication check. If a user submits a slug that already exists in the same project, the insert may succeed (depending on whether there is a DB-level UNIQUE constraint on `(project_id, slug)`). If no such constraint exists, the database will contain duplicate slugs, which would produce incorrect canonical URL mapping and potentially break internal linking logic.

Additionally, no `slugify()` normalization is applied — a user can submit arbitrary slugs including uppercase letters, Turkish characters, or leading slashes.

**Fix:** Apply `slugify()` on the input and check for existing slugs, mirroring what `generatePagesFromClusters` already does:

```typescript
// After the ownership check, fetch existing slugs for this project
const { data: existingSlugRows } = await supabase
  .from('pages')
  .select('slug')
  .eq('project_id', projectId)
  .eq('user_id', user.id)

const existingSlugs = (existingSlugRows ?? []).map((r: { slug: string }) => r.slug)
const safeSlug = slugify(input.slug || input.title, existingSlugs)
// use safeSlug instead of input.slug in the insert
```

---

### WR-03: `generatePagesFromClusters` slug deduplication does not account for slugs that already exist but have no cluster_id

**File:** `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts:214-228`

**Issue:** `existingSlugs` is populated from ALL pages in the project (lines 214-228), which is correct. However, the `existingPages` query on line 214 selects only `id, cluster_id, slug, sort_order`. The slug set is built correctly from all existing pages. This is fine.

The real edge case is more subtle: the `slugify()` call at line 244 appends the generated slug to `existingSlugs` immediately (`existingSlugs.add(slug)`), but `existingSlugs` is a `Set<string>` constructed from `(existingPages ?? []).map((p) => p.slug)` on line 225. If `slugify()` resolves to `base` (no suffix needed) and then the same base slug is computed again for a different cluster in the same batch, the second call will correctly see the slug in `existingSlugs` and produce `base-2`. This part is actually correct.

The actual bug is in the `takenClusterIds` duplicate guard: it checks `cluster_id` but does NOT skip rows where the cluster has no `cluster_id` match — that is fine. The real issue is that `ownedClusterSet.size !== clusterIds.length` check on line 209 does not account for duplicate `clusterId` values in the `rows` input array. A caller with duplicate `clusterId` entries in `rows` will cause `clusterIds.length` to be larger than `ownedClusterSet.size` even when all IDs are valid, triggering a false "Bazı kümeler projeye ait değil" error.

**Fix:** Deduplicate `clusterIds` before the size comparison:

```typescript
const clusterIds = [...new Set(rows.map((r) => r.clusterId))]
// rest of the ownership check unchanged
```

---

### WR-04: `GeneratePagesDialog` state is not reset when `rows` prop changes while dialog is unmounted-but-still-mounted

**File:** `src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx:61-71`

**Issue:** `initialState` is derived from `rows` via `useMemo`. `state` is initialized from `initialState` via `useState`. However, `useState` only uses its initializer on first render — if the parent re-renders with a different `rows` array (e.g. after a page is generated), `state` will retain the old values because `useState` ignores subsequent `initialState` changes. The dialog close handler resets `state` to `initialState`, but `initialState` itself would already reflect the new `rows` at that point, so re-opening works correctly. The gap is when the dialog is opened immediately after the previous session without being closed (which closes and resets). This is a minor but real staleness risk if `rows` is mutated between dialog sessions without an explicit close.

**Fix:** Add a `useEffect` to sync `state` when `rows` identity changes:

```typescript
useEffect(() => {
  setState(initialState)
}, [initialState])
```

---

### WR-05: `MenuEditor` uses array index as React key — items rendered with wrong state after deletion

**File:** `src/app/(dashboard)/projeler/[id]/site-blueprint/MenuEditor.tsx:72`

**Issue:** `items.map((item, index) => <div key={index} ...>)` uses array index as key. When a menu item is deleted from the middle of the list, React reuses DOM nodes by index, which can cause visual glitches or incorrect state in controlled inputs if any row had local state (none currently, but this is a correctness risk for future edits). More practically, if the component is extended with per-row inputs, stale state will silently appear in the wrong row.

**Fix:** Use a stable key. Since `MenuItem` has `label + href` but no `id`, generate a stable key at the point of insertion:

```typescript
type MenuItem = { label: string; href: string; _key?: string }

function handleAddItem() {
  if (!newItem.label.trim() || !newItem.href.trim()) return
  setItems((prev) => [
    ...prev,
    { label: newItem.label.trim(), href: newItem.href.trim(), _key: crypto.randomUUID() },
  ])
  setNewItem(EMPTY_ITEM)
}
// Then: key={item._key ?? `${item.label}-${item.href}`}
```

---

## Info

### IN-01: `DialogTrigger` render prop usage in `AddPageModal` is non-standard

**File:** `src/app/(dashboard)/projeler/[id]/site-blueprint/AddPageModal.tsx:91-95`

**Issue:** `<DialogTrigger render={<Button variant="outline" size="sm" />}>` uses a `render` prop pattern that is not part of the standard shadcn/ui `DialogTrigger` API (which uses `asChild`). This will likely render the button with no accessible trigger behavior and the text "Sayfa Ekle" may not appear inside the button. The standard pattern is `<DialogTrigger asChild>`.

**Fix:**
```tsx
<DialogTrigger asChild>
  <Button variant="outline" size="sm">+ Sayfa Ekle</Button>
</DialogTrigger>
```

---

### IN-02: `flattenTree` has no cycle-detection guard — infinite loop if circular `parent_id`

**File:** `src/app/(dashboard)/projeler/[id]/site-blueprint/page.tsx:49-73`

**Issue:** `flattenTree` recursively walks `childrenMap` via `walk()`. If the database ever contains a page whose `parent_id` points to a descendant (circular reference), the function will recurse infinitely and crash the server-side render. While this cannot happen through the current UI (parent selection is limited to existing pages), it is possible through direct DB manipulation or a future bug in `addPage`.

**Fix:** Add a `visited` set to the walk function:

```typescript
function walk(parentKey: string, depth: number, visited = new Set<string>()): PageWithDepth[] {
  if (visited.has(parentKey)) return []  // cycle guard
  visited.add(parentKey)
  const children = sortPages(childrenMap[parentKey] ?? [])
  const result: PageWithDepth[] = []
  for (const child of children) {
    result.push({ ...child, depth })
    result.push(...walk(child.id, depth + 1, new Set(visited)))
  }
  return result
}
```

---

### IN-03: `page.tsx` inline server action closure captures `id` from outer scope

**File:** `src/app/(dashboard)/projeler/[id]/site-blueprint/page.tsx:439-442`

**Issue:** The inline `'use server'` action inside the delete `<form>` closes over `id` (the project ID from `params`) and `page.id` (the page row ID). Next.js serializes these closures but this pattern can be unexpected: if the variable `id` were replaced by a prop or the closure captured something mutable, it would be silently stale. The current usage is safe, but extracting the form to a named server action with explicit arguments (as done elsewhere in `actions.ts`) is more maintainable.

**Fix:** Use the already-exported `deletePage` action with a hidden input pattern or pass `projectId` and `pageId` explicitly, consistent with how other actions are called in this codebase.

---

### IN-04: `slugify` suffix counter has no upper bound — theoretical infinite loop

**File:** `src/lib/pages/slugify.ts:41-43`

**Issue:** The `while (used.has(...)) n++` loop has no maximum iteration guard. In practice this is bounded by the number of existing slugs, but if `existingSlugs` contains a very large set of `base-2`, `base-3`, ..., `base-N` entries, the loop will run for N iterations synchronously. This is unlikely to matter in practice but adding a bound (`n > 10000`) with a fallback to a UUID suffix makes the function robust against adversarial inputs.

**Fix:**
```typescript
const MAX_SUFFIX = 10_000
while (used.has(`${base}-${n}`) && n <= MAX_SUFFIX) n++
if (n > MAX_SUFFIX) return `${base}-${crypto.randomUUID().slice(0, 8)}`
return `${base}-${n}`
```

---

_Reviewed: 2026-04-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
