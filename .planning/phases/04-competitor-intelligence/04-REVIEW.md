---
phase: 04-competitor-intelligence
reviewed: 2026-04-23T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/lib/supabase/vault.ts
  - src/lib/dataforseo/client.ts
  - src/lib/competitors/url-categories.ts
  - src/app/(dashboard)/projeler/[id]/page.tsx
  - src/app/(dashboard)/projeler/[id]/rakipler/actions.ts
  - src/app/(dashboard)/projeler/[id]/rakipler/page.tsx
  - src/app/(dashboard)/projeler/[id]/rakipler/CompetitorDiscoveryDialog.tsx
  - src/app/(dashboard)/projeler/[id]/rakipler/CompetitorFetchButton.tsx
  - src/app/(dashboard)/projeler/[id]/rakipler/OwnDomainAnalyzeButton.tsx
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This phase implements a competitor intelligence feature: SERP-based competitor discovery, top-pages fetching via DataForSEO, URL category extraction, and a gap-matrix table rendered server-side. The overall architecture is sound — ownership checks are consistently applied, server-only modules are correctly guarded, and authorization is layered at multiple points.

Two critical issues were found: one is an architectural design bug that causes `OwnDomainAnalyzeButton` to silently discard results, making the feature non-functional; the other is a missing input-length guard that allows unbounded domain inputs to reach the database. Four warnings cover logic correctness and missing error handling. Three info items flag dead code and minor code quality concerns.

---

## Critical Issues

### CR-01: `OwnDomainAnalyzeButton` discards the server action result — button has no effect

**File:** `src/app/(dashboard)/projeler/[id]/rakipler/OwnDomainAnalyzeButton.tsx:22-23`

**Issue:** `fetchOwnDomainData` is a Server Action that returns `Record<string, number> | null` but does NOT persist to the database. `OwnDomainAnalyzeButton` calls it, throws away the return value, and then calls `window.location.reload()`. On reload, `RakiplerPage` calls `fetchOwnDomainData` again server-side — but this is the same call that already happened. The result is identical to what was already shown before the button was clicked: if `ownCategoryData` was `null` before (e.g., because credentials are missing or the domain returned no data), it will still be `null` after the reload. The button produces no observable change in any failure or edge case, and even in the happy path the reload simply re-fetches — there is no caching difference between the initial SSR fetch and the reload.

The real bug is that the feature design requires the own-domain category data to be persisted somewhere (a `projects` column, a separate table row, or at minimum a `revalidatePath`-triggerable cache tag) so that a user action can make a lasting difference. As-is, the analyze button is a no-op widget.

**Fix:** Either persist `ownCategoryData` to the database (e.g., a `own_category_structure` JSONB column on `projects`) and `revalidatePath` after the update, or — for a lighter approach — convert `OwnDomainAnalyzeButton` to accept the result as a prop passed down from a parent `'use client'` wrapper that calls the action and updates local state without a page reload. The Server Action itself must be changed to write to the DB for any persistence across requests.

```typescript
// actions.ts — persist own category data
export async function fetchAndSaveOwnDomainData(
  projectId: string,
  domain: string
): Promise<ActionResult> {
  // ... auth + ownership checks ...
  const pages = await fetchTopPages(domain, credentials)
  const categoryStructure = extractCategories(pages)

  const { error } = await supabase
    .from('projects')
    .update({ own_category_structure: categoryStructure })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Kayıt başarısız.' }

  revalidatePath(`/projeler/${projectId}/rakipler`)
  return { success: true }
}
```

---

### CR-02: `addCompetitors` (bulk SERP add) applies no domain length or format validation

**File:** `src/app/(dashboard)/projeler/[id]/rakipler/actions.ts:136-149`

**Issue:** `addCompetitors` receives an array of domain strings from the client (`Array.from(selectedDomains)`) and inserts them directly into the database after only stripping `www.` and calling `.trim()`. There is no maximum length check, no format validation, and no upper bound on the number of domains in the array. A malicious or misbehaving client could send: (a) arbitrarily long strings that overflow the `text` column; (b) arrays with hundreds of entries, causing a bulk insert of unbounded size; (c) strings containing special characters (newlines, null bytes) that could behave unexpectedly depending on Postgres column constraints.

By contrast, `addCompetitor` (the single-domain action) correctly normalizes and trims, and `discoverCompetitors` validates keyword count and length. The bulk insert action is the only path missing these guards.

**Fix:**
```typescript
// In addCompetitors, before constructing `rows`:
const MAX_DOMAINS = 50
const MAX_DOMAIN_LENGTH = 253 // RFC 1035 max

if (domains.length > MAX_DOMAINS) {
  return { success: false, error: `En fazla ${MAX_DOMAINS} domain eklenebilir.` }
}

const invalidDomain = domains.find(
  (d) => !d.trim() || d.length > MAX_DOMAIN_LENGTH
)
if (invalidDomain !== undefined) {
  return { success: false, error: 'Geçersiz domain girişi.' }
}
```

---

## Warnings

### WR-01: `addCompetitors` comment says `ignoreDuplicates: true` but the option is not passed

**File:** `src/app/(dashboard)/projeler/[id]/rakipler/actions.ts:144-145`

**Issue:** The comment on line 144 reads `// ignoreDuplicates: true — aynı domain tekrar eklenirse hata verme`, but the actual `.insert(rows)` call on line 145 does not pass `{ ignoreDuplicates: true }` (Supabase JS v2 option) or any `onConflict` clause. If the `competitors` table has a unique constraint on `(project_id, domain)`, inserting a duplicate will return an error, which is swallowed by the generic error handler and presented to the user as "Rakipler eklenemedi." — confusing UX and incorrect behaviour versus the stated intent. If there is no unique constraint, duplicates are silently inserted.

**Fix:**
```typescript
const { error } = await supabase
  .from('competitors')
  .insert(rows, { onConflict: 'project_id,domain', ignoreDuplicates: true })
```

If the Supabase JS version in use does not support the second-argument form, use `.upsert(rows, { onConflict: 'project_id,domain', ignoreDuplicates: true })` instead.

---

### WR-02: `fetchOwnDomainData` silently swallows all errors, including credential failures

**File:** `src/app/(dashboard)/projeler/[id]/rakipler/actions.ts:258-261`

**Issue:** The bare `catch { return null }` block masks all error conditions — network failures, DataForSEO API errors, and missing credential errors — with a silent `null` return. In `RakiplerPage`, a `null` result causes the UI to display the "veri çekilmedi" banner and offer the "Kendi Sitemi Analiz Et" button. If the underlying cause is missing credentials, clicking the button will always silently fail, with no actionable feedback to the user or developer. This also makes debugging impossible in production.

**Fix:** At minimum, log the error to server stderr so it is visible in server logs. Optionally, change the return type to `{ data: Record<string, number> | null; error?: string }` and propagate the message to the UI:
```typescript
} catch (err) {
  console.error('[fetchOwnDomainData]', err)
  return null
}
```

---

### WR-03: `RakiplerPage` calls `fetchOwnDomainData` unconditionally even when `project.domain` is null

**File:** `src/app/(dashboard)/projeler/[id]/rakipler/page.tsx:135`

**Issue:** `project` is selected with `select('id, name, domain')`. The `Project` type defined in `projeler/[id]/page.tsx` marks `domain` as `string | null`, meaning it can be null. In `RakiplerPage`, the Supabase query returns `domain` as `string | null` but line 135 passes `project.domain` directly to `fetchOwnDomainData`:

```typescript
const ownCategoryData = await fetchOwnDomainData(id, project.domain).catch(() => null)
```

The `OwnDomainAnalyzeButton` receives the same `project.domain` prop (line 273). If `domain` is null, both the action call and the button will receive `null` where a `string` is expected. `fetchTopPages` will then call `cleanDomain` on `null`, producing the string `"null"` after `.replace()` operations, which will be sent as a target to the DataForSEO API — wasting an API credit and returning no useful data.

**Fix:** Guard the call with a null check:
```typescript
const ownCategoryData = project.domain
  ? await fetchOwnDomainData(id, project.domain).catch(() => null)
  : null
```
And conditionally render `OwnDomainAnalyzeButton` only when `project.domain` is non-null.

---

### WR-04: `discoverCompetitors` keyword validation checks `.length > 700` on the raw string before trimming

**File:** `src/app/(dashboard)/projeler/[id]/rakipler/actions.ts:99`

**Issue:** The validation checks `kw.trim().length === 0 || kw.length > 700` — the empty check uses `.trim()` but the length check uses the raw `kw` without trimming. This is an inconsistency: a keyword consisting of 701 spaces would pass the empty check but fail the length check, while a keyword with 699 spaces and 1 character would pass both. More practically, keywords should be trimmed before the length check to reflect the actual content being sent to the API.

**Fix:**
```typescript
if (keywords.some((kw) => {
  const trimmed = kw.trim()
  return trimmed.length === 0 || trimmed.length > 700
})) {
  return { success: false, error: 'Keyword boş olamaz ve 700 karakterden uzun olamaz.' }
}
```

---

## Info

### IN-01: Duplicate `TopPageItem` type definition across two modules

**File:** `src/lib/dataforseo/client.ts:3-11` and `src/lib/competitors/url-categories.ts:4-11`

**Issue:** `TopPageItem` is defined independently in both `client.ts` and `url-categories.ts`. The comment in `url-categories.ts` acknowledges this ("bağımsız tanım (bağımsız bundle)"). While the intent is to avoid coupling, the two definitions are structurally different: `client.ts` includes `metrics.organic.count` but `url-categories.ts` does not. If the API response shape changes or a new field is needed, both definitions must be updated in sync. This creates a maintenance burden and potential for silent type drift.

**Suggestion:** Extract a shared type into a third module (e.g., `src/lib/competitors/types.ts`) that is imported by both. If bundle separation is a genuine concern, the shared type file can be explicitly excluded from the client bundle boundary.

---

### IN-02: `buildGapReport` in `page.tsx` uses `project.domain` as a matrix key — collides if a competitor has the same domain

**File:** `src/app/(dashboard)/projeler/[id]/rakipler/page.tsx:76-81`

**Issue:** `buildGapReport` uses the raw domain string as the key in `matrix` (e.g., `matrix["example.com"]`). If a user manually adds their own domain as a competitor, `matrix[userDomain]` and `matrix[comp.domain]` will refer to the same key, corrupting the gap matrix — the competitor entry will overwrite the user entry silently.

**Suggestion:** Use a sentinel key for the user's own domain (e.g., `"__own__"`) rather than the domain string, or add a deduplication step that filters competitors whose domain matches `project.domain`.

---

### IN-03: `window.location.reload()` in `OwnDomainAnalyzeButton` is a brittle navigation pattern

**File:** `src/app/(dashboard)/projeler/[id]/rakipler/OwnDomainAnalyzeButton.tsx:24`

**Issue:** Using `window.location.reload()` as a mechanism to refresh server-rendered data bypasses Next.js's router cache and revalidation system, can cause issues in test environments, and does a full browser navigation instead of a soft client-side refresh. This is flagged as info because it is a code quality concern rather than a correctness bug in the current context — though the deeper fix is the persistence issue raised in CR-01.

**Suggestion:** Once the persistence issue (CR-01) is resolved and `revalidatePath` is in place, use `router.refresh()` from `useRouter()` instead of `window.location.reload()`. This performs a server component re-render without a full browser reload and respects the Next.js router cache.

---

_Reviewed: 2026-04-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
