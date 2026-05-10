---
phase: 21-site-blueprint-auto-generation-gate
reviewed: 2026-05-10T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts
  - src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordStratejisiToolbar.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx
  - src/lib/pages/generate-pages.test.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-05-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

The Phase 21 implementation adds `generatePagesFromClusters` (server action with overwrite support), `GeneratePagesDialog` (client dialog), and wires the "Sistemi Kur" gate into `KeywordStratejisiToolbar`. The security model is solid: UUID validation, ownership checks, cluster ownership cross-check, and DoS guard are all in place. No critical security or data-loss issues were found.

Five warnings were identified: a silent update failure loop, a state/UI race condition after dialog close, an unguarded null access in the `rowState` lookup, a missing authentication check path-ordering issue (auth validated after UUID but before data access — fine, but close to a logic gap), and a success message that is rendered but unreachable in practice. Four informational items cover code quality and test coverage gaps.

---

## Warnings

### WR-01: Silent partial update failure — loop swallows errors without rolling back

**File:** `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts:302-310`

**Issue:** The UPDATE loop for overwrite rows increments `updated` only when no error occurs, but does not return a failure if one or more updates fail. The caller receives `success: true` with a lower-than-expected `updated` count, and the user sees no indication that some overwrites were silently dropped. Because there is also no transaction, the insert batch and the update loop can partially succeed independently — leaving the database in an inconsistent state relative to what the user requested.

```ts
for (const u of updatePayloads) {
  const { error } = await supabase
    .from('pages')
    .update(u.fields)
    .eq('id', u.id)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
  if (!error) updated++  // error branch: silent drop
}
```

**Fix:** Collect errors and surface them, or at minimum return a failure if any update fails:

```ts
for (const u of updatePayloads) {
  const { error } = await supabase
    .from('pages')
    .update(u.fields)
    .eq('id', u.id)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
  if (error) {
    return { success: false, error: 'Bazı sayfalar güncellenemedi.' }
  }
  updated++
}
```

---

### WR-02: `successMsg` is set after `handleOpenChange(false)` which resets it to null

**File:** `src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx:120-130`

**Issue:** `handleOpenChange(false)` is called on line 120, which immediately calls `setSuccessMsg(null)` (line 84). Then on line 129, `setSuccessMsg(msg)` is called. These two state updates are batched within the same `startTransition` callback. In React 18, both updates will be committed in the same batch, but `handleOpenChange` also calls `onOpenChange(false)` which may unmount the dialog before the success message render. The success message (`{successMsg && ...}`) is inside `DialogContent`, which will be unmounted when `open` becomes `false`. The user never sees the success toast.

```ts
// line 120 — dialog closes (and successMsg → null):
handleOpenChange(false)
// line 129 — sets msg on now-unmounted component:
setSuccessMsg(msg)
router.push(...)
```

**Fix:** Navigate without relying on the in-dialog success message. Pass the message via URL search param or use a toast library outside the dialog scope. For the minimal fix, remove `successMsg` state entirely and rely solely on `router.push` to convey success:

```ts
startTransition(async () => {
  const result = await generatePagesFromClusters(projectId, payload)
  if (!result.success) {
    setError(result.error)
    return
  }
  onOpenChange(false)
  router.push(`/projeler/${projectId}/site-blueprint`)
})
```

---

### WR-03: Unguarded `state[idx]` access — index can be out of bounds during re-render

**File:** `src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx:159`

**Issue:** `state` is initialised from `rows` via `useMemo`, but `rows` is a prop that can change between renders. The `useEffect` on line 76 resets `state` to `initialState` when `initialState` changes, but there is a render window where `rows` has been updated by the parent but `state` has not yet been reset (React batches effects after paint). During that window, `rows.map((r, idx) => ...)` at line 158 uses the new `rows.length` but `state[idx]` is read with the old `state` length. If `rows` grew, `state[idx]` is `undefined` and `rowState.pageName` throws.

```tsx
const rowState = state[idx]  // can be undefined if rows.length > state.length
// Line 175: rowState.pageName → TypeError: Cannot read properties of undefined
```

**Fix:** Add a null guard or derive `state` synchronously from `rows` instead of using `useEffect`:

```tsx
const rowState = state[idx] ?? { pageName: r.proposedName, pageType: r.proposedType, include: !r.alreadyExists }
```

Or replace the `useState` + `useEffect` pattern with a state key reset:

```tsx
// Re-key the dialog content when rows identity changes
<div key={rows.map(r => r.clusterId).join(',')}>
```

---

### WR-04: `reorderPage` — sentinel value `-1` is not guaranteed unique at the DB level

**File:** `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts:388-408`

**Issue:** The 3-step sentinel swap uses `sort_order = -1` as a temporary placeholder. This works only if there is no `UNIQUE` constraint on `(project_id, sort_order)` or `(user_id, sort_order)`. If the database has such a constraint (which is a common design for ordered lists), Step 1 will fail. Step 1's error is currently not checked — the code proceeds to Steps 2 and 3 regardless, leaving the rows in a corrupt state.

```ts
// Step 1 — error not checked:
await supabase
  .from('pages')
  .update({ sort_order: -1 })
  .eq('id', current.id)
  .eq('user_id', user.id)

// Steps 2 & 3 run unconditionally even if Step 1 failed
```

**Fix:** Check the Step 1 result:

```ts
const r1 = await supabase
  .from('pages')
  .update({ sort_order: -1 })
  .eq('id', current.id)
  .eq('user_id', user.id)

if (r1.error) {
  return { success: false, error: 'Sıralama güncellenemedi.' }
}
```

---

### WR-05: `hasApprovedCluster` prop computed with `as unknown` cast masking a type gap

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx:221`

**Issue:** The `status` field is fetched in the Supabase select at line 114 (`...status`) but the TypeScript type for the cluster rows does not include `status`, requiring an `as unknown as { status: string }` cast to access it for `hasApprovedCluster`. The same field is used below at line 148 with another `as unknown` cast. This double-cast pattern suppresses type safety and could silently break if the column name or shape changes. `clustersWithKeywords` already has `status` typed at line 71, but the raw `clusters` array (used for `hasApprovedCluster`) does not.

**Fix:** Derive `hasApprovedCluster` from `clustersWithKeywords` (which is already fully typed with `status`) rather than from the raw `clusters` array:

```ts
// Replace line 221:
hasApprovedCluster={clustersWithKeywords.some((c) => c.status === 'approved')}
```

This eliminates the cast entirely.

---

## Info

### IN-01: `approvedDialogRows` filter excludes clusters with `primary_keyword_id === null`

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx:159-171`

**Issue:** The filter `.filter((c) => c.status === 'approved' && c.primary_keyword_id !== null)` silently hides approved clusters that have no primary keyword assigned. The user sees the "Sistemi Kur" button enabled (because `isStrategyApproved` is true) but the dialog may show fewer rows than expected with no explanation. If all approved clusters lack a primary keyword, the dialog shows the empty state message intended for "no approved clusters at all."

**Fix:** Either remove the `primary_keyword_id !== null` guard and allow rows without a focus keyword (passing `focusKeywordId: null`), or add a visible indicator in the dialog explaining why some clusters are absent. The server action already handles `focusKeywordId: null` correctly.

---

### IN-02: Test for `update flow` makes a weak assertion

**File:** `src/lib/pages/generate-pages.test.ts:166-236`

**Issue:** The test named "update flow: overwrite=true rows are sent to UPDATE, not skipped" does not assert `result.updated === 1`. Instead it only asserts `typeof result.updated === 'number'`, which passes even when `updated` is `0` (i.e., when the update path was not exercised at all). The test comment acknowledges this ("at minimum verify the call didn't crash") but this means the core behaviour being tested — that overwrite rows reach the UPDATE query — is not actually verified.

**Fix:** Assert `updateMock` was called and that `result.updated` equals the expected value:

```ts
if (result.success) {
  expect(result.updated).toBe(1)
  expect(result.created).toBe(0)
  expect(result.skipped).toBe(0)
  expect(updateMock).toHaveBeenCalledTimes(1)
}
```

---

### IN-03: `stripIntentSuffix` in page.tsx lowercases all words unconditionally

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx:33-40`

**Issue:** The title-case transform at lines 38-39 lowercases every word and then capitalises only the first character. This produces incorrect casing for proper nouns and brand names embedded in cluster names (e.g., "iPhone Tamiri" becomes "Iphone Tamiri"). The function is marked as an "inline copy" per design note D-05, so it is intentionally simplified, but the behavior is worth flagging.

**Fix:** If exact cluster names must be preserved, only strip the intent suffix without title-casing. If title-casing is desired, preserve words that are already fully uppercase (acronyms) or use a locale-aware approach.

---

### IN-04: `GeneratePagesDialog` — missing `aria-label` on native checkbox and input controls

**File:** `src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx:173-216`

**Issue:** The `<input type="checkbox">` (line 211) and `<input type="text">` (line 173) inside the table rows have no `aria-label` or `aria-labelledby`. Screen readers will announce them without context. This is a usability issue for accessibility.

**Fix:** Add `aria-label` attributes referencing the cluster name:

```tsx
<input
  type="checkbox"
  aria-label={`${r.clusterName} dahil et`}
  ...
/>
<input
  type="text"
  aria-label={`${r.clusterName} sayfa adı`}
  ...
/>
```

---

_Reviewed: 2026-05-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
