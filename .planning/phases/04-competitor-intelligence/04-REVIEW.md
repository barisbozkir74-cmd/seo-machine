---
phase: 04-competitor-intelligence
reviewed: 2026-04-23T12:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/app/(dashboard)/projeler/[id]/rakipler/actions.ts
  - src/app/(dashboard)/projeler/[id]/rakipler/OwnDomainAnalyzeButton.tsx
  - src/app/(dashboard)/projeler/[id]/rakipler/page.tsx
  - src/app/(dashboard)/projeler/[id]/rakipler/CompetitorDiscoveryDialog.tsx
  - src/app/(dashboard)/projeler/[id]/rakipler/CompetitorFetchButton.tsx
  - src/lib/competitors/url-categories.ts
  - src/lib/dataforseo/client.ts
  - src/lib/supabase/vault.ts
  - supabase/migrations/20260424000001_add_own_category_structure.sql
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-23
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

The competitor intelligence module is generally well-structured. Ownership checks are consistently applied across every write path (auth + `user_id` + `project_id` filters), Server Actions are properly guarded with `'use server'`, and the `url-categories.ts` pure function is clean and independently testable. The migration is correct and minimal.

Two critical issues were found: (1) `fetchOwnDomainData` silently discards the DB write error, so if the `own_category_structure` update fails the function returns a truthy result and the caller calls `window.location.reload()` — the user sees a blank gap analysis with no error message; (2) the Supabase service client in `vault.ts` is instantiated at module load time with a non-null assertion, causing a cryptic runtime failure rather than a clear startup error when the env var is absent. Four warnings cover a missing `project_id` filter on two `fetchCompetitor*` DB updates, missing domain format validation on the single-add path, the `CompetitorFetchButton` not refreshing the UI on success, and a keyword length check that operates on the untrimmed string. Three info items flag a `Set<string>` in a type that may be passed as a prop, a potential matrix key collision when a user adds their own domain as a competitor, and a duplicate `TopPageItem` type definition.

---

## Critical Issues

### CR-01: `fetchOwnDomainData` silently ignores DB write failure

**File:** `src/app/(dashboard)/projeler/[id]/rakipler/actions.ts:363-369`

**Issue:** The `supabase.update()` call for `own_category_structure` does not check its return value. If the DB write fails (column absent before migration runs, network error, RLS violation), the function still returns the in-memory `result` as if the operation succeeded. The caller `OwnDomainAnalyzeButton` then calls `window.location.reload()`, the SSR page re-fetches from DB, the column is empty, and the user sees the same "veri çekilmedi" banner with no indication that the write failed.

```ts
// Current — error silently discarded
await supabase
  .from('projects')
  .update({ own_category_structure: result })
  .eq('id', projectId)
  .eq('user_id', user.id)

return result  // returned regardless of whether update succeeded
```

**Fix:** Destructure the error and return `null` (the established failure signal for this function) on DB failure:

```ts
const { error: updateError } = await supabase
  .from('projects')
  .update({ own_category_structure: result })
  .eq('id', projectId)
  .eq('user_id', user.id)

if (updateError) {
  console.error('[fetchOwnDomainData] DB persist error:', updateError.message)
  return null
}

return result
```

`OwnDomainAnalyzeButton` already surfaces `null` as a failure by catching and calling `setError('Analiz başarısız...')`, so no UI change is needed once the action returns `null` correctly.

---

### CR-02: Supabase service client instantiated at module load with a non-null assertion

**File:** `src/lib/supabase/vault.ts:5-8`

**Issue:** The top-level `serviceClient` is constructed with `process.env.SUPABASE_SERVICE_ROLE_KEY!`. If the env var is absent (CI, test environment, misconfigured deployment), TypeScript's non-null assertion suppresses the compiler warning and `createClient` receives `undefined`. The Supabase client accepts `undefined` without throwing immediately, but the first vault query will fail with a confusing auth error rather than a clear "env var missing" message. Because the client is created at module import time, any Next.js build step or test runner that imports this module creates a broken client silently.

```ts
// Current — crashes obscurely at query time, not at startup
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

**Fix:** Lazy-initialize inside the function body so the validation and error occur at the call site with a useful message:

```ts
export async function getDataForSeoCredentials(): Promise<{ login: string; password: string }> {
  if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
    return { login: process.env.DATAFORSEO_LOGIN, password: process.env.DATAFORSEO_PASSWORD }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY (veya NEXT_PUBLIC_SUPABASE_URL) eksik. ' +
      'Vault okuma devre dışı. .env.local dosyasına ekleyin.'
    )
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey)
  // ... rest of existing vault query logic unchanged
}
```

---

## Warnings

### WR-01: `fetchCompetitorData` and `fetchCompetitorSeoData` DB updates missing `project_id` filter

**File:** `src/app/(dashboard)/projeler/[id]/rakipler/actions.ts:221-230` and `311-313`

**Issue:** Both update calls filter by `id` and `user_id` but not `project_id`. The ownership read at lines 186-192 correctly asserts `project_id`, but the subsequent write does not re-assert it. A logged-in user who guesses a `competitorId` from one of their other projects can trigger a data overwrite on it via a crafted request — both `fetchCompetitorData` and `fetchCompetitorSeoData` would comply because `user_id` matches. The `deleteCompetitor` action correctly adds `.eq('project_id', projectId)` to its delete call (line 263) — the same discipline should apply to these updates.

**Fix:** Add `.eq('project_id', projectId)` to both update calls:

```ts
// fetchCompetitorData (line 221):
const { error } = await supabase
  .from('competitors')
  .update({ top_pages: topPages, category_structure: categoryStructure, content_areas: contentAreas, updated_at: new Date().toISOString() })
  .eq('id', competitorId)
  .eq('project_id', projectId)   // add this
  .eq('user_id', user.id)

// fetchCompetitorSeoData (line 311):
const { error } = await supabase
  .from('competitors')
  .update({ ranked_keywords, backlinks_summary: backlinks, updated_at: new Date().toISOString() })
  .eq('id', competitorId)
  .eq('project_id', projectId)   // add this
  .eq('user_id', user.id)
```

---

### WR-02: `addCompetitor` (single-add path) has no domain format or length validation

**File:** `src/app/(dashboard)/projeler/[id]/rakipler/actions.ts:53-58`

**Issue:** After normalization, `addCompetitor` only checks `if (!normalizedDomain)` (empty string). It does not validate format or enforce a length cap. Strings such as `"not a domain"`, `"foo bar"`, or a 300-character string pass through and are inserted into the database. By contrast, the bulk `addCompetitors` path applies a 253-character RFC 1035 length guard at line 145. The single-add path is inconsistent and allows junk data.

**Fix:** Add length and basic format validation after the existing empty-string check:

```ts
if (normalizedDomain.length > 253) {
  return { success: false, error: 'Domain çok uzun (maks. 253 karakter).' }
}
const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/
if (!domainRegex.test(normalizedDomain)) {
  return { success: false, error: 'Geçersiz domain formatı. Örnek: ornek.com' }
}
```

---

### WR-03: `CompetitorFetchButton` does not refresh the UI after a successful fetch

**File:** `src/app/(dashboard)/projeler/[id]/rakipler/CompetitorFetchButton.tsx:17-28`

**Issue:** After a successful `fetchCompetitorData` call, the component sets `isPending(false)` and does nothing else. The Server Action calls `revalidatePath` (actions.ts line 235), but in a Client Component calling a Server Action directly (not via a `<form>`), `revalidatePath` only marks the cache as stale — it does not re-render the RSC tree until the router is told to refresh. Without `router.refresh()` or a full reload, the table row remains stale: the domain still shows as plain text (no link), competition level stays "—", and the last-fetched date does not update. The user sees no visible change after clicking "Veri Çek", leading them to believe the action failed. `OwnDomainAnalyzeButton` correctly calls `window.location.reload()` after success — `CompetitorFetchButton` needs an equivalent.

**Fix:**

```ts
import { useRouter } from 'next/navigation'

export function CompetitorFetchButton({ competitorId, projectId, lastFetched }: Props) {
  const router = useRouter()
  // ...
  const handleFetch = async () => {
    setIsPending(true)
    setError(null)
    try {
      const result = await fetchCompetitorData(competitorId, projectId)
      if (!result.success) {
        setError(result.error)
      } else {
        router.refresh()   // triggers RSC re-render with revalidated data
      }
    } catch {
      setError('Veri çekme başarısız. Lütfen tekrar deneyin.')
    } finally {
      setIsPending(false)
    }
  }
```

---

### WR-04: `discoverCompetitors` keyword length check operates on the untrimmed string

**File:** `src/app/(dashboard)/projeler/[id]/rakipler/actions.ts:99`

**Issue:** The validation on line 99 is:

```ts
if (keywords.some((kw) => kw.trim().length === 0 || kw.length > 700))
```

The empty check trims (`kw.trim().length === 0`) but the length check does not (`kw.length > 700`). This is inconsistent: a 698-character keyword with leading/trailing whitespace would pass the length check even though it contains more than 700 bytes of actual content after the string is sent to the API (DataForSEO typically strips whitespace server-side). Conversely, a keyword padded with enough whitespace to exceed 700 characters total but with less than 700 non-whitespace characters would be incorrectly rejected.

**Fix:** Trim before both checks:

```ts
if (keywords.some((kw) => {
  const trimmed = kw.trim()
  return trimmed.length === 0 || trimmed.length > 700
})) {
  return { success: false, error: 'Keyword boş olamaz ve 700 karakterden uzun olamaz.' }
}
```

---

## Info

### IN-01: `GapMatrix.opportunityCategories` typed as `Set<string>` — not serializable as a prop

**File:** `src/app/(dashboard)/projeler/[id]/rakipler/page.tsx:44-51`

**Issue:** The `GapMatrix` type defines `opportunityCategories: Set<string>`. `Set` is not JSON-serializable. Currently `gapReport` is only consumed in SSR JSX within the same Server Component, so this does not crash today. However if this component is ever refactored to pass `gapReport` as a prop to a Client Component, Next.js will throw a serialization error at runtime. The type is misleading about the data's portability.

**Fix:** Change the type to `string[]` and update the one construction and usage point:

```ts
type GapMatrix = {
  categories: string[]
  opportunityCategories: string[]  // was Set<string>
  matrix: { [domain: string]: { [category: string]: { exists: boolean; pageCount: number } } }
}

// In buildGapReport, return:
return { categories, opportunityCategories: Array.from(opportunityCategories), matrix }

// In JSX, change:
gapReport.opportunityCategories.has(cat)
// to:
gapReport.opportunityCategories.includes(cat)
```

---

### IN-02: Gap matrix key collision when user adds their own domain as a competitor

**File:** `src/app/(dashboard)/projeler/[id]/rakipler/page.tsx:75-88`

**Issue:** `buildGapReport` uses the raw domain string as the key in the `matrix` object. If a user adds their own domain (`project.domain`) as a competitor — which the UI does not prevent — `matrix[userDomain]` and `matrix[comp.domain]` are the same key. The competitor loop at line 81 will overwrite the user's own entry, corrupting the gap matrix silently. The user column will show the competitor's data rather than their own.

**Fix:** Either filter out competitors whose domain matches `project.domain` before calling `buildGapReport`, or use a non-colliding sentinel key for the user row:

```ts
// Filter in page.tsx before building gap report:
const competitorsWithData = competitors.filter(
  (c) => c.category_structure !== null && c.domain !== project.domain
)
```

---

### IN-03: Duplicate `TopPageItem` type in two modules with diverging shapes

**File:** `src/lib/dataforseo/client.ts:3-11` and `src/lib/competitors/url-categories.ts:4-11`

**Issue:** `TopPageItem` is defined independently in both files. The `client.ts` version includes `metrics.organic.count`; the `url-categories.ts` version does not. The comment in `url-categories.ts` acknowledges this as intentional bundle separation. The risk is silent type drift: if a new field is added to the API response and the client type is updated, `url-categories.ts` may silently miss it, or vice versa.

**Suggestion:** Extract a shared type to `src/lib/competitors/types.ts` (no server-only import needed — it would be a pure type file) and import it in both places. If bundle separation is genuinely required, annotate both files with a comment pointing to the other definition so they are always updated together.

---

_Reviewed: 2026-04-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
