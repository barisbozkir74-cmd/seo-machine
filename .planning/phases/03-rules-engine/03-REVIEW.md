---
phase: 03-rules-engine
reviewed: 2026-04-23T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/app/(dashboard)/ayarlar/kurallar/actions.ts
  - src/app/(dashboard)/ayarlar/kurallar/page.tsx
  - src/app/(dashboard)/layout.tsx
  - src/app/(dashboard)/projeler/[id]/kurallar/actions.ts
  - src/app/(dashboard)/projeler/[id]/kurallar/page.tsx
  - src/app/(dashboard)/projeler/[id]/page.tsx
  - src/components/rules/RuleToggleRow.tsx
  - src/components/ui/switch.tsx
  - src/lib/rules/rule-meta.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

The rules engine implementation is well-structured overall. Authorization is correctly enforced in all server actions (ownership checks before mutations), the inheritance model (project overrides global) is sound, and optimistic UI updates with rollback are implemented correctly in `RuleToggleRow`. No critical security vulnerabilities were found.

Five warnings were identified: a silent no-op on `toggleRule` when the rule row doesn't exist, an incorrect fallback boolean in the project rules resolver, a stale local state issue in `RuleToggleRow` after a reset, an unhandled seed upsert error, and a layout bug with the Switch alignment. Four info items cover semantic misuse of `notFound()`, missing Supabase error destructuring, a redundant auth call in seed guard, and a potential accessibility gap in the Switch component.

---

## Warnings

### WR-01: `toggleRule` silently succeeds when no row is updated

**File:** `src/app/(dashboard)/ayarlar/kurallar/actions.ts:64-77`

**Issue:** The `.update()` query has no row-existence check. If the target rule row does not exist for the user (e.g., seed failed or was bypassed), the Supabase update affects 0 rows and returns no error. The function then returns `{ success: true }` even though nothing changed. The caller receives a false success signal.

**Fix:** After the update, verify that at least one row was affected. Supabase returns `count` when you add `.select('id')` or use `.update(..., { count: 'exact' })`:

```typescript
const { error, count } = await supabase
  .from('rules')
  .update({ rule_value: String(newValue) }, { count: 'exact' })
  .eq('rule_key', ruleKey)
  .eq('user_id', user.id)
  .eq('scope', 'global')
  .is('project_id', null)

if (error || count === 0) {
  return { success: false, error: 'Kural güncellenemedi. Lütfen tekrar deneyin.' }
}
```

---

### WR-02: Global rules fallback defaults to `true` regardless of `RULE_META.recommended`

**File:** `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx:88`

**Issue:** When a global rule is missing from the DB (e.g., global seed hasn't run), the resolver falls back to the hardcoded string `'true'`:

```typescript
const value = hasOverride
  ? projectOverrides[ruleKey] === 'true'
  : (globalValues[ruleKey] ?? 'true') === 'true'  // ← always defaults to true
```

Rules like `title_includes_brand`, `h1_exact_match`, `slug_exact_match`, and `slug_no_stopwords` have `recommended: false` in `RULE_META`. If global rules are absent, those will incorrectly display as enabled in the project rules page, misleading the user.

**Fix:** Fall back to `RULE_META[ruleKey].recommended` instead of a hardcoded `'true'`:

```typescript
import { RULE_META } from '@/lib/rules/rule-meta'

const value = hasOverride
  ? projectOverrides[ruleKey] === 'true'
  : globalValues[ruleKey] !== undefined
    ? globalValues[ruleKey] === 'true'
    : RULE_META[ruleKey].recommended
```

---

### WR-03: `localValue` state stale after `resetAction` succeeds

**File:** `src/components/rules/RuleToggleRow.tsx:52-67`

**Issue:** After `resetAction()` succeeds, `revalidatePath` on the server triggers a page refresh. However, `localValue` in the component state is not updated on success — it retains whatever value was last set by the user. If React performs a partial hydration (without full unmount) after the server revalidation, the Switch will display the stale overridden value rather than the inherited global value.

The toggle handler does an optimistic update and rollback (correct), but the reset handler has no equivalent state update:

```typescript
const handleReset = async () => {
  // ...
  const result = await resetAction()
  if (!result.success) {
    setError(...)
  }
  // On success: localValue is NOT updated. Parent must remount to fix this.
}
```

**Fix:** Accept the global fallback value as a prop and reset `localValue` to it on success:

```typescript
// Add prop:
globalValue?: boolean

// In handleReset on success:
if (result.success && globalValue !== undefined) {
  setLocalValue(globalValue)
}
```

Alternatively, add a `key` prop on `RuleToggleRow` at the parent level tied to `resolved.scope` so React remounts on scope change.

---

### WR-04: `seedGlobalRules` upsert errors are silently swallowed

**File:** `src/app/(dashboard)/ayarlar/kurallar/actions.ts:37-48`

**Issue:** The upsert call result is not checked for errors. If the DB upsert fails (constraint violation, network error, RLS policy rejection), the function returns void silently. The page's seed guard then re-fetches and still finds 0 rules, rendering an empty table without any user-visible error.

**Fix:** Check and surface the error:

```typescript
const { error } = await supabase.from('rules').upsert(
  GLOBAL_RULES_SEED.map((rule) => ({ ... })),
  { onConflict: 'user_id,rule_key,scope' }
)
if (error) {
  console.error('[seedGlobalRules] upsert failed:', error.message)
  // Optionally throw so the page can catch and show an error state
}
```

---

### WR-05: Switch not right-aligned inside `<td>` — layout bug

**File:** `src/components/rules/RuleToggleRow.tsx:107-113`

**Issue:** The `<td>` has `text-right` applied but `Switch` renders as `inline-flex`. Tailwind's `text-right` sets `text-align: right` on the cell, which does not affect flex or inline-flex children — only inline text nodes. The Switch will be left-aligned inside the cell rather than right-aligned as intended.

**Fix:** Use flexbox on the `<td>` to push the switch right:

```tsx
<td className="w-16 px-4 py-3">
  <div className="flex justify-end">
    <Switch
      checked={localValue}
      onCheckedChange={handleToggle}
      disabled={isPending}
      className={isPending ? 'opacity-50 cursor-wait' : ''}
    />
  </div>
</td>
```

---

## Info

### IN-01: `notFound()` used for unauthenticated users — incorrect semantic

**File:** `src/app/(dashboard)/ayarlar/kurallar/page.tsx:20`, `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx:36`, `src/app/(dashboard)/projeler/[id]/page.tsx:46`

**Issue:** All three pages call `notFound()` when `!user`. This returns an HTTP 404, which is semantically wrong — the resource exists but the user is not authenticated. The dashboard layout already handles this case with `redirect('/login')`, so in practice this path is unreachable. However, if someone accesses these pages directly (e.g., middleware bypass in tests), they'll see a 404 instead of being redirected.

**Fix:** Use `redirect('/login')` for auth guard consistency, matching the layout's behavior:

```typescript
import { redirect } from 'next/navigation'
if (!user) redirect('/login')
```

---

### IN-02: Supabase query errors not destructured in page data fetches

**File:** `src/app/(dashboard)/ayarlar/kurallar/page.tsx:23-28`, `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx:57-70`

**Issue:** Only `data` is destructured from Supabase query results — `error` is ignored. If any query fails (network issue, RLS policy, schema mismatch), the code silently falls back to null/empty arrays and proceeds, potentially showing an empty or incorrect UI with no indication of failure.

**Fix:** Destructure and log errors at minimum:

```typescript
const { data: globalRules, error: globalRulesError } = await supabase
  .from('rules')
  .select('rule_key, rule_value')
  .eq('user_id', user.id)
  .eq('scope', 'global')
  .is('project_id', null)

if (globalRulesError) {
  console.error('[ProjeKurallarPage] globalRules fetch failed:', globalRulesError.message)
}
```

---

### IN-03: Redundant `getUser()` call inside `seedGlobalRules` when called from page

**File:** `src/app/(dashboard)/ayarlar/kurallar/actions.ts:31-35`, `src/app/(dashboard)/ayarlar/kurallar/page.tsx:31-40`

**Issue:** The page already fetches the authenticated user (line 18-20), then calls `seedGlobalRules()` which creates a new Supabase client and calls `getUser()` again. This is a redundant network round-trip.

**Fix:** Refactor `seedGlobalRules` to accept `userId` as a parameter, eliminating the redundant auth call:

```typescript
export async function seedGlobalRules(userId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('rules').upsert(
    GLOBAL_RULES_SEED.map((rule) => ({
      user_id: userId,
      // ...
    })),
    { onConflict: 'user_id,rule_key,scope' }
  )
  revalidatePath('/ayarlar/kurallar')
}
```

---

### IN-04: Switch `disabled` prop may not apply native HTML `disabled` attribute

**File:** `src/components/ui/switch.tsx:15-22`

**Issue:** `disabled` is passed via `...props` to `SwitchPrimitive.Root` from base-ui. The base-ui Switch component uses `data-disabled` for CSS styling but may render the underlying element as a `<span>` rather than a `<button>`, meaning the native `disabled` attribute may not be applied. Keyboard users could potentially still activate the switch during a pending server action if base-ui doesn't honor `disabled` semantically.

**Fix:** Verify base-ui's `Switch.Root` renders a `<button>` element and applies `aria-disabled` or `disabled` natively. If not, add `aria-disabled={props.disabled}` explicitly. Also consider adding `tabIndex={props.disabled ? -1 : undefined}` as a fallback for keyboard navigation prevention.

---

_Reviewed: 2026-04-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
