---
phase: 14-gsc-integration
reviewed: 2026-04-27T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - .env.local.example
  - src/app/(dashboard)/projeler/[id]/actions.ts
  - src/app/(dashboard)/projeler/[id]/gsc-section.tsx
  - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx
  - src/app/(dashboard)/projeler/[id]/page.tsx
  - src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts
  - src/app/(dashboard)/projeler/[id]/sayfa-paketi/GscIndexBadge.tsx
  - src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx
  - src/app/api/gsc/callback/route.ts
  - src/app/api/gsc/properties/route.ts
  - src/app/api/gsc/sync/route.ts
  - src/components/ui/select.tsx
  - src/lib/gsc/__tests__/auth.test.ts
  - src/lib/gsc/__tests__/index-check.test.ts
  - src/lib/gsc/__tests__/search-analytics.test.ts
  - src/lib/gsc/auth.ts
  - src/lib/gsc/index-check.ts
  - src/lib/gsc/properties.ts
  - src/lib/gsc/search-analytics.ts
  - supabase/migrations/20260427000002_gsc_schema.sql
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-04-27
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 14 introduces Google Search Console OAuth2 integration: token storage, property selection, Search Analytics sync via n8n, and URL Inspection index-check. The CSRF protection, ownership guards, and service-role usage are correctly designed. Two critical issues were found: the sync endpoint bypasses authentication for `userId` entirely (it trusts the request body instead of the session), and the `gsc_oauth_state` cookie is deleted before the CSRF comparison is complete in the callback, creating a subtle but exploitable window. Four warnings cover token refresh not being atomic (race condition under concurrent requests), the empty `refresh_token` string being treated as valid by the Zod schema, an unvalidated URL passed directly to the URL Inspection API, and the sync endpoint's date range being set to today rather than the data's actual date. Three info items note minor quality improvements.

---

## Critical Issues

### CR-01: Sync endpoint trusts `userId` from request body — no session verification

**File:** `src/app/api/gsc/sync/route.ts:29-52`

**Issue:** The `/api/gsc/sync` endpoint accepts `userId` from the POST body and uses it directly for ownership checks and token retrieval. There is no call to `supabase.auth.getUser()` or any session validation. Because the endpoint's only protection is an optional webhook secret (`N8N_WEBHOOK_SECRET`), and that secret is explicitly allowed to be absent (line 18: `if (expectedSecret && secret !== expectedSecret)`), any unauthenticated caller who knows a valid `projectId` can supply an arbitrary `userId` value.

Even with the secret present, the secret is shared between the application and n8n — it is not per-user. An attacker who intercepts or guesses the webhook secret can read any project's GSC tokens by supplying a targeted `projectId`/`userId` pair.

**Fix:** Add session-based authentication for direct (non-n8n) calls, or — since this is an n8n-triggered sync — validate that the supplied `userId` matches the project owner by fetching the project with a service-client query scoped to `project_id` only, then separately asserting the returned `user_id` equals the body's `userId`. Additionally, make `N8N_WEBHOOK_SECRET` required (fail closed when absent):

```typescript
// At the start of POST handler, fail closed if secret not configured
const expectedSecret = process.env.N8N_WEBHOOK_SECRET
if (!expectedSecret) {
  return NextResponse.json({ error: 'Sync endpoint not configured' }, { status: 503 })
}
if (secret !== expectedSecret) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// After fetching the project, verify userId matches DB record:
const { data: project } = await serviceClient
  .from('projects')
  .select('gsc_property_url, user_id')
  .eq('id', projectId)
  .single()

if (!project || project.user_id !== userId) {
  return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
}
```

---

### CR-02: CSRF state cookie deleted before comparison — timing creates inconsistent state

**File:** `src/app/api/gsc/callback/route.ts:14-20`

**Issue:** `cookieStore.delete('gsc_oauth_state')` is called on line 15, **before** the comparison `savedState !== state` on line 17. If the deletion itself succeeds but the comparison fails (e.g., the request was replayed, or the state was tampered), the cookie is already gone. This is actually the intended "consume once" behaviour, but the ordering creates a subtle problem: if the route crashes after deletion but before `saveGscTokens`, the user is left in a state where the CSRF cookie is gone and the token was never saved — the user cannot retry without re-initiating the flow.

More critically, the `projectId` is extracted from `savedState` (line 27) **after** the comparison but it is derived entirely from the cookie value, not from the URL state parameter. If an attacker can set the `gsc_oauth_state` cookie (e.g., via a subdomain cookie injection), the `projectId` redirect target is fully attacker-controlled. The code does verify `savedState === state`, but `state` came from the URL query param, which the attacker also controls in that scenario.

**Fix:** Extract and validate `projectId` from the cookie value independently; confirm it is a valid UUID before using it in any redirect:

```typescript
const projectId = savedState.split(':')[0]
// Validate UUID format before trusting it in redirects
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
  return NextResponse.redirect(new URL('/projeler?error=gsc_invalid_state', origin))
}
```

---

## Warnings

### WR-01: Token refresh is not atomic — concurrent requests can double-refresh

**File:** `src/lib/gsc/auth.ts:50-70`

**Issue:** `getValidGscToken` checks token expiry, fetches a new token from Google, then writes the new token back to Supabase. If two concurrent requests both observe an expired token before either writes the refresh, both will call the Google token endpoint with the same `refresh_token`. Google invalidates the old refresh token on first use; the second call will fail. The second call returns `null`, causing a spurious "GSC not connected" error for the user.

**Fix:** Add a database-level optimistic lock or use a short mutex. A practical approach for Next.js server-side: add a `gsc_token_refreshing_at` column (or use a conditional update) so only one process proceeds:

```typescript
// Before fetching from Google, try to "claim" the refresh slot with a conditional update
const { count } = await supabase
  .from('projects')
  .update({ gsc_token_refreshing_at: new Date().toISOString() })
  .eq('id', projectId)
  .eq('user_id', userId)
  .is('gsc_token_refreshing_at', null) // only claim if not already refreshing
  .select('id', { count: 'exact', head: true })

if (!count) {
  // Another request is refreshing — wait briefly and re-read
  await new Promise((r) => setTimeout(r, 500))
  return getValidGscToken(projectId, userId) // retry once
}
```

A lighter alternative is to widen the 5-minute tolerance window so concurrent requests are less likely to both see expiry.

---

### WR-02: Empty string `refresh_token` passes Zod schema validation — treated as valid

**File:** `src/lib/gsc/auth.ts:5-11` and `src/app/api/gsc/callback/route.ts:62`

**Issue:** The `GscTokensSchema` declares `refresh_token: z.string()`, which accepts an empty string `''`. The callback saves `refresh_token: tokens.refresh_token ?? ''` when Google does not return a refresh token (line 62 of callback). Later, `getValidGscToken` will attempt to use this empty string as the `refresh_token` in the refresh request, which will fail silently (Google returns an error), causing `getValidGscToken` to return `null`. The user must reconnect but receives no meaningful explanation.

**Fix:** Use `z.string().min(1)` for `refresh_token` in the schema, and in the callback, treat a missing refresh token as a hard error rather than saving an empty string:

```typescript
// In GscTokensSchema:
refresh_token: z.string().min(1),

// In callback/route.ts, after token exchange:
if (!tokens.access_token || !tokens.refresh_token) {
  return NextResponse.redirect(
    new URL(`/projeler/${projectId}?error=gsc_token_failed`, origin)
  )
}
```

---

### WR-03: `inspectionUrl` passed to Google API without validation — path traversal risk

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts:650-700`

**Issue:** `checkIndexStatus` accepts `inspectionUrl` as a caller-supplied parameter (line 653) and passes it directly to `checkUrlIndexStatus` (line 682), which embeds it verbatim in the Google API POST body. Although the caller is a server action (so it requires an authenticated session), there is no validation that `inspectionUrl` is a well-formed HTTPS URL or that it belongs to the project's domain. A caller can supply `javascript:` or `file:` URIs, or a URL from a completely different domain than the project's `gsc_property_url`.

**Fix:** Validate that `inspectionUrl` is a valid URL and that its origin matches the project's `gsc_property_url`:

```typescript
// After retrieving project.gsc_property_url, validate inspectionUrl
try {
  const parsed = new URL(inspectionUrl)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { success: false, error: 'Geçersiz URL.' }
  }
  // Optionally: verify host matches gsc_property_url host
} catch {
  return { success: false, error: 'Geçersiz URL formatı.' }
}
```

---

### WR-04: Sync writes today's date as metric `date` — does not match GSC data's actual date

**File:** `src/app/api/gsc/sync/route.ts:94-110`

**Issue:** The sync fetches 28 days of Search Analytics data (`startDate` to `endDate`) but writes `date: today` (the sync execution day) for every row (line 94). This means all 28 days of historical click/impression data gets collapsed onto a single date in `gsc_metrics`. The `UNIQUE(page_id, date, keyword)` constraint (SQL migration line 31) will cause subsequent syncs to upsert the same single date row, silently discarding the multi-day data returned by the API.

The GSC Search Analytics API returns `keys: [page, query]` without a date dimension in the current query (dimensions: `['page', 'query']`), so per-day data is not available without adding `date` to the dimensions array.

**Fix (option A — aggregate mode, keep today's date):** This is acceptable if the intent is to store a weekly/monthly aggregate snapshot. Document this clearly and remove the 28-day loop implication.

**Fix (option B — per-day data):** Add `'date'` to the dimensions array and map `row.keys[2]` as the date:

```typescript
body: JSON.stringify({
  startDate,
  endDate,
  dimensions: ['page', 'query', 'date'],
  rowLimit: 25000,
  dataState: 'final',
}),
```

Then in the map:
```typescript
.map((r) => ({
  ...
  date: r.keys[2],  // actual GSC date instead of today
  keyword: r.keys[1],
  pageUrl: r.keys[0],
}))
```

---

## Info

### IN-01: `gsc_metrics` table has no RLS policy for DELETE — service role bypass is acceptable but undocumented

**File:** `supabase/migrations/20260427000002_gsc_schema.sql:41-52`

**Issue:** The `gsc_metrics` table enables RLS and defines a `SELECT` policy for authenticated users. There are no `INSERT`, `UPDATE`, or `DELETE` policies. The comment notes that INSERT/UPDATE use the service role key. However, the missing DELETE policy means authenticated users cannot delete their own metrics even if a future UI requires it. This is currently a non-issue but will require a migration to address later.

**Fix:** Add a DELETE policy now for future-proofing:

```sql
CREATE POLICY "gsc_metrics_delete_own"
  ON public.gsc_metrics FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = gsc_metrics.project_id
        AND p.user_id = auth.uid()
    )
  );
```

---

### IN-02: `handleSync` in `gsc-section.tsx` sends POST without `userId` — sync endpoint will reject it

**File:** `src/app/(dashboard)/projeler/[id]/gsc-section.tsx:92-96`

**Issue:** The `handleSync` function calls `/api/gsc/sync` with only `{ projectId }` in the body (line 95). The sync endpoint requires both `projectId` and `userId` (route.ts line 30). This request will fail with a 400 "projectId and userId required" error. The `userId` is not available in this client component, so the manual sync button is currently non-functional.

**Fix:** Either (a) obtain `userId` from Supabase client-side auth in the component and include it in the body, or (b) redesign the sync endpoint to derive `userId` from the session (the more secure approach), removing the `userId` body parameter entirely since `getValidGscToken` already takes both:

```typescript
// In sync/route.ts: replace body userId with session-derived userId
const supabase = createClient() // user-scoped client
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const userId = user.id
```

Note: this also resolves CR-01 if implemented with the user-scoped client instead of the service role client for authentication.

---

### IN-03: `auth.test.ts` mock chain does not fully cover `saveGscTokens` — update path untested

**File:** `src/lib/gsc/__tests__/auth.test.ts:24-27`

**Issue:** The `beforeEach` mock for `mockSupabase.update` chains only two `.eq()` calls, but `saveGscTokens` issues `.update().eq('id', ...).eq('user_id', ...)` — exactly two. This is correct for the current implementation. However, there is no assertion that `saveGscTokens` was actually called after a successful token refresh (test "süresi dolmuş token refresh tetikler", line 53). The test only checks the returned token value, not whether the new token was persisted. A regression that skips the `saveGscTokens` call would go undetected.

**Fix:** Add a spy/assertion in the refresh test:

```typescript
it('süresi dolmuş token refresh tetikler', async () => {
  // ... existing setup ...
  const token = await getValidGscToken('proj-1', 'user-1')
  expect(token).toBe('new-token')
  // Assert the new token was persisted
  expect(mockSupabase.update).toHaveBeenCalledWith(
    expect.objectContaining({ access_token: 'new-token' })
  )
})
```

---

_Reviewed: 2026-04-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
