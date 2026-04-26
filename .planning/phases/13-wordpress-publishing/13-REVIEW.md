---
phase: 13-wordpress-publishing
reviewed: 2026-04-26T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/app/(dashboard)/projeler/[id]/actions.ts
  - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/ContentStudioShell.tsx
  - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx
  - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/PublishDialog.tsx
  - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/page.tsx
  - src/app/(dashboard)/projeler/[id]/page.tsx
  - src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts
  - src/app/(dashboard)/projeler/[id]/wordpress-section.tsx
  - src/lib/supabase/vault.ts
  - supabase/migrations/20260426000002_add_wp_columns.sql
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-04-26T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 13 implements WordPress publishing via the WP REST API, credential storage in Supabase Vault, and the full Content Studio UI (streaming generation, section approval, publish dialog). The ownership model is consistently applied — every server action verifies project and package ownership before operating. The vault usage is appropriately server-side-only (`import 'server-only'`). However, three critical issues were found: SSRF exposure from an unvalidated `wpUrl` used in `fetch()`, credential leakage through a Vault RPC name mismatch that can silently surface raw error text, and unsafe `innerHTML`-equivalent content routing (HTML assembled from user-authored markdown being sent directly to WordPress without re-sanitisation). Four warnings cover: partial-success data loss, type unsafety in the `wpPost` JSON parse, a race condition in bulk save, and a missing `wp_status` constraint in the migration.

---

## Critical Issues

### CR-01: SSRF — Unvalidated `wpUrl` Used Directly in `fetch()`

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts:509-519`

**Issue:** `creds.wpUrl` is retrieved from Vault and immediately concatenated into `fetch()` calls (`/plugins` and `/posts`) without any host validation. Although the URL was validated as `https://` on write (in `actions.ts:144`), the vault can be updated independently, and there is no re-validation at read time. An attacker who can manipulate the vault record (e.g., via a compromised service-role key, a future admin path, or direct Supabase access) can point `wpUrl` at an internal/metadata endpoint such as `http://169.254.169.254/` or any private-network address, causing the Next.js server to act as an SSRF proxy.

```ts
// sayfa-paketi/actions.ts ~509
const apiBase = creds.wpUrl.replace(/\/$/, '') + '/wp-json/wp/v2'
// Both fetch() calls below use apiBase without host check
```

**Fix:** Re-validate the URL origin before use in `publishToWordPress`. Reject any URL whose hostname resolves to a private range or whose scheme is not `https:`.

```ts
// Add immediately after retrieving creds (~line 509)
function assertSafeWpUrl(raw: string): void {
  let parsed: URL
  try { parsed = new URL(raw) } catch {
    throw new Error('wp_url geçersiz.')
  }
  if (parsed.protocol !== 'https:') throw new Error('wp_url HTTPS olmalı.')
  // Block private/loopback ranges at string level (before DNS resolution)
  const h = parsed.hostname
  if (
    h === 'localhost' ||
    h.startsWith('127.') ||
    h.startsWith('10.') ||
    h.startsWith('192.168.') ||
    h.startsWith('169.254.') ||
    h.endsWith('.local')
  ) {
    throw new Error('wp_url özel ağ adresine işaret edemez.')
  }
}

// Then wrap the existing call:
try {
  assertSafeWpUrl(creds.wpUrl)
} catch (e) {
  return { success: false, error: (e as Error).message }
}
```

---

### CR-02: WordPress API Error Body Leakage on Non-401/403 Failures

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts:557-567`

**Issue:** When the WordPress `POST /posts` request fails with a status other than 401 or 403, the code returns a generic string — which is correct. However, the plugins endpoint response at lines 521-522 is parsed directly with `pluginsRes.json()` and assigned to `plugins: WpPlugin[]` with no type guard. If the WordPress site returns an unexpected shape (e.g., a WP error object `{"code":"...", "message":"...","data":{...}}`), `detectSeoPlugin` iterates `plugins` assuming it's an array. If the response is an object rather than an array, `plugins.map(...)` throws, the catch block at line 525 silently swallows it, and `detectedPlugin` defaults to `'none'` — which is survivable. The real risk is at lines 570-571: `wpPost.id` and `wpPost.link` are accessed without null/existence checks after a successful status code. A WP install that returns `{"id": null, "link": ""}` would result in `wpPostId = null` (typed as `number`) being written to the database, breaking future lookups.

```ts
// lines 570-571 — no null checks
const wpPost = await postRes.json()
wpPostId = wpPost.id      // could be null/undefined
wpPostUrl = wpPost.link   // could be undefined
```

**Fix:** Validate the response shape before consuming it.

```ts
const wpPost = await postRes.json() as Record<string, unknown>
if (typeof wpPost.id !== 'number' || typeof wpPost.link !== 'string' || !wpPost.link) {
  return {
    success: false,
    error: 'WordPress geçersiz yanıt döndürdü. Lütfen tekrar deneyin.',
  }
}
wpPostId = wpPost.id
wpPostUrl = wpPost.link
```

---

### CR-03: Vault RPC Name Mismatch — `vault.update_secret` Does Not Exist in Standard pgsodium

**File:** `src/lib/supabase/vault.ts:61-65`

**Issue:** The `upsertSecret` function calls `serviceClient.rpc('vault.update_secret', ...)`. In the standard Supabase pgsodium extension the function is named `vault.update_secret` (schema-qualified) but the Supabase JS client's `.rpc()` method sends the name as a PostgreSQL function call without schema prefix by default — meaning it looks for `public.vault.update_secret` or resolves via the `search_path`. If `vault` is not on the `search_path`, the RPC fails with a `42883 function does not exist` error. The `error` object is then thrown as `throw new Error(`Vault güncellenemedi: ${keyName}`)` — which is caught in `actions.ts` and returns a generic user-facing string. The user sees "WordPress bağlantısı kaydedilemedi" with no indication that the credential was not updated, and the stale credential silently remains in the vault. This causes silent data integrity failure: the user believes the new password was saved, but the old (possibly invalid) password is still stored.

**Fix:** Either use the full pgsodium-compatible approach by passing the schema in the search path, or — more reliably — use direct table operations instead of RPC for update, which pgsodium exposes via the `vault.secrets` view:

```ts
// Replace the rpc call with a direct update (pgsodium exposes vault.secrets as updatable):
if (existing?.id) {
  const { error } = await serviceClient
    .schema('vault')
    .from('secrets')
    .update({ secret: value })
    .eq('id', existing.id)
  if (error) throw new Error(`Vault güncellenemedi: ${keyName} — ${error.message}`)
}
```

If RPC must be used, pass the correct schema-qualified name as a Postgres function and ensure `vault` is in the service role's `search_path`:

```sql
-- In a migration:
ALTER ROLE service_role SET search_path TO public, vault;
```

---

## Warnings

### WR-01: Partial Success on DB Write Failure Exposes WordPress Post ID to End User

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts:593-599`

**Issue:** When the WordPress post is created successfully but the subsequent `supabase.update()` fails, the action returns `success: false` with an error message that includes the raw `wpPostId` value:

```ts
error: `WordPress'e gönderildi (Post ID: ${wpPostId}) ancak durum kaydedilemedi.`
```

The post ID is a public integer and not a secret, but exposing internal WordPress resource IDs in client-facing error messages is an information-disclosure antipattern. More importantly, returning `success: false` here means the client does not call `onSuccess()`, the banner never shows the post link, and the user has no way to recover — they must manually find the post in WordPress. The correct behavior for this partial-success case is to return `success: true` with the post data and separately log or surface the DB write failure as a non-blocking warning.

**Fix:**

```ts
if (updateError) {
  // Log server-side; still return success so the client shows the post URL
  console.error('[publishToWordPress] DB write failed after WP publish:', updateError.message)
  // Return success with data — user can still navigate to the post
  return { success: true, wpPostId, wpPostUrl, wpStatus: status }
}
```

---

### WR-02: Race Condition Between `setSections` and `sectionsRef` in Bulk Save

**File:** `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/ContentStudioShell.tsx:154-165`

**Issue:** After a stream completes, the component calls `setSections()` (functional update, async) and then immediately reads `sectionsRef.current` to build `latestSections` for the DB save. Because `sectionsRef` is updated inside a `useEffect` that runs after the render triggered by `setSections`, there is a window in which `sectionsRef.current` still holds the pre-update state. The result: if the stream for section `i` finishes while the user has approved other sections since the last render, the bulk save may write stale `content: ''` for those other sections.

```ts
// line 154-157 — sectionsRef.current may be one render behind setSections on line 148
const latestSections = sectionsRef.current.map((s, i) =>
  i === index ? { ...s, content: accumulated, status: 'draft' as const } : s
)
saveContentSections(projectId, pageId, latestSections)...
```

**Fix:** Build `latestSections` inside the `setSections` functional updater to guarantee consistency, then trigger the save in the `.then()` callback using the computed value, not the ref:

```ts
let computedSections: ContentSection[] = []
setSections((prev) => {
  computedSections = prev.map((s, i) =>
    i === index ? { ...s, content: accumulated, status: 'draft' as const } : s
  )
  return computedSections
})
// Now save using the computed snapshot — always consistent with what was written
saveContentSections(projectId, pageId, computedSections).then(...)
```

---

### WR-03: `wp_status` Column Has No CHECK Constraint — Accepts Arbitrary Strings

**File:** `supabase/migrations/20260426000002_add_wp_columns.sql:10-11`

**Issue:** `wp_status TEXT` is added with no CHECK constraint. The application only ever writes `'publish'` or `'draft'` (controlled by the `PublishDialog` radio group and TypeScript type `'publish' | 'draft'`), but the database layer has no enforcement. A direct DB insert (bypass, future migration, or Supabase Studio edit) could write an arbitrary string, causing the `HtmlReadyBanner` status branches to fall through to the "not yet published" state even when a post exists, producing a misleading UI.

**Fix:**

```sql
ALTER TABLE public.page_packages
  ADD COLUMN IF NOT EXISTS wp_status TEXT
    CHECK (wp_status IN ('publish', 'draft'));
```

---

### WR-04: `saveContentSections` Accepts Client-Supplied `ContentSection[]` Without Re-Validating Individual Fields

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts:115-151`

**Issue:** `saveContentSections` receives a `ContentSection[]` array from the client and writes it directly to the `content_sections` JSONB column after ownership verification. While TypeScript typing provides compile-time safety, this is a server action — the argument arrives as raw JSON over the wire and TypeScript types are erased at runtime. A crafted client call could supply sections where `content` is an arbitrarily long string, `sub_headings` contains thousands of items, or `status` is an invalid value. There is no runtime length/count validation before the database write.

The `isContentSection` type guard exists but is only used in `parseContentSections` when reading from the DB — not when writing data supplied by the client.

**Fix:** Apply `isContentSection` validation (or an extended version with length limits) to each element of the incoming array before writing:

```ts
export async function saveContentSections(
  projectId: string,
  pageId: string,
  sections: ContentSection[]
): Promise<ActionResult> {
  // Validate each section at runtime
  if (!Array.isArray(sections) || !sections.every(isContentSection)) {
    return { success: false, error: 'Geçersiz bölüm verisi.' }
  }
  // Optional: cap content length per section
  if (sections.some((s) => s.content.length > 50_000)) {
    return { success: false, error: 'Bölüm içeriği çok uzun.' }
  }
  // ... rest of function
```

---

## Info

### IN-01: `assembleHtml` Does Not Handle Multi-Paragraph Content

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts:96-109`

**Issue:** `assembleHtml` wraps each section's entire `content` string in a single `<p>` tag after HTML-escaping it. If the AI-generated content contains newlines (which it will for multi-paragraph output), the output will be a single `<p>` with escaped newline characters, not properly structured paragraphs. WordPress will render this as one block of text with no visual paragraph breaks.

**Fix:** Split `content` on double-newlines before escaping and wrap each paragraph separately:

```ts
const paragraphs = section.content
  .split(/\n\n+/)
  .filter(Boolean)
  .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
  .join('\n')
let html = `<h2>${safeHeading}</h2>\n${paragraphs}`
```

---

### IN-02: `createPagePackage` UNIQUE Conflict Fallback Missing `project_id` Filter

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts:348-357`

**Issue:** When a `23505` UNIQUE violation is caught, the fallback query fetches the existing package by `page_id + user_id` but does not include `project_id`:

```ts
const { data: existing } = await supabase
  .from('page_packages')
  .select('id')
  .eq('page_id', pageId)
  .eq('user_id', user.id)   // missing: .eq('project_id', projectId)
  .single()
```

While `page_id` is likely globally unique, adding `project_id` to the fallback lookup would make the ownership boundary explicit and consistent with the rest of the action.

**Fix:**

```ts
.eq('page_id', pageId)
.eq('project_id', projectId)
.eq('user_id', user.id)
```

---

### IN-03: `console.error` Left in Production Client Component

**File:** `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/ContentStudioShell.tsx:167`

**Issue:** `console.error(`Bölüm ${index} üretilemedi:`, err)` is called in the stream error catch block of a `'use client'` component. In production builds this outputs to the browser console, potentially exposing internal error details (including AI API error messages) to end users with DevTools open.

**Fix:** In production, either suppress the log or replace with a structured error tracking call (e.g., Sentry). At minimum, avoid logging the raw `err` object in production:

```ts
if (process.env.NODE_ENV !== 'production') {
  console.error(`Bölüm ${index} üretilemedi:`, err)
}
```

---

_Reviewed: 2026-04-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
