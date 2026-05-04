---
phase: 16-recovery-engine
reviewed: 2026-04-30T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - supabase/migrations/20260430000001_recovery_tasks.sql
  - src/lib/monitoring/recovery-tasks.ts
  - src/app/(dashboard)/projeler/[id]/izleme/content-tab-bar.tsx
  - src/app/(dashboard)/projeler/[id]/izleme/recovery-task-table.tsx
  - src/app/(dashboard)/projeler/[id]/izleme/actions.ts
  - src/app/(dashboard)/projeler/[id]/izleme/page.tsx
  - src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts
  - src/app/api/recovery/detect/route.ts
  - middleware.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-04-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the full Recovery Engine implementation: database migration, data-access layer, UI components, server actions, webhook route handler, and middleware. The overall structure is sound — auth, ownership checks, and RLS are layered correctly. Two critical issues were found: a missing `N8N_WEBHOOK_SECRET` enforcement guard that allows unauthenticated callers to trigger arbitrary decay scans when the env var is not set, and a potential for unbounded N+1 database queries inside the detect route's per-page duplicate-prevention loop. Four warnings cover silently swallowed Supabase errors in the data-access layer, a logic gap in the empty-state display, a missing `positionBefore` filter for weak-page tasks, and an incomplete SSRF check. Three info items note minor code quality points.

---

## Critical Issues

### CR-01: Webhook secret check fails open when `N8N_WEBHOOK_SECRET` is not set

**File:** `src/app/api/recovery/detect/route.ts:30-32`

**Issue:** The auth guard reads `process.env.N8N_WEBHOOK_SECRET` and only enforces the secret check when `expectedSecret` is truthy. If the environment variable is missing or empty in any deployment (staging, preview, CI), the entire route is unauthenticated. Any caller that knows the URL can POST `{ projectId, userId }` for any project and trigger a recovery scan that inserts rows into `recovery_tasks`. Because the route uses the service-role client (bypasses RLS), a successful call without auth can also probe project ownership by brute-forcing UUIDs and observing 404 vs 200 responses.

```typescript
// Current — fails open when env var absent:
if (expectedSecret && secret !== expectedSecret) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// Fix — fail closed:
const expectedSecret = process.env.N8N_WEBHOOK_SECRET
if (!expectedSecret) {
  // Route is inoperable without a configured secret — refuse all requests
  return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
}
if (secret !== expectedSecret) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

### CR-02: N+1 query pattern in the decay/weak-page detect loop — potential for DoS and timeout

**File:** `src/app/api/recovery/detect/route.ts:231-281` (Pass 1) and `318-359` (Pass 2)

**Issue:** For every decayed page and every weak imported page, the route issues a separate `SELECT` to `recovery_tasks` for duplicate-prevention and a separate `INSERT`. For a project with 100 decayed pages this becomes 200 sequential round-trips inside a serverless function with a 10-30 s execution timeout. Beyond the performance concern (out of v1 scope), the sequential structure is a correctness risk: a partial failure mid-loop (e.g., DB timeout on row 60) returns HTTP 200 with `inserted=59, skipped=0` while the remaining 40 pages are silently un-processed. The caller (n8n) has no way to distinguish a partial run from a full one.

**Fix:** Batch the duplicate-prevention check before the loop using an `IN` query, then batch-insert only the genuinely new rows.

```typescript
// Pass 1 — replace the per-page SELECT + INSERT loop with:

// Step A: collect all pkg.id candidates
const candidatePkgIds = [...packagesMap.values()].map((p) => p.id)

// Step B: one query for ALL existing open/in_progress tasks
const { data: existingTasks } = await serviceClient
  .from('recovery_tasks')
  .select('source_id')
  .eq('source', 'page_package')
  .in('source_id', candidatePkgIds)
  .in('status', ['open', 'in_progress'])

const alreadyOpen = new Set((existingTasks ?? []).map((t) => t.source_id))

// Step C: build insert rows, excluding already-open
const toInsert = decayedPageIds
  .map((decay) => { /* ... build row ... */ })
  .filter((row) => !alreadyOpen.has(row.source_id))

// Step D: single batch insert
if (toInsert.length > 0) {
  const { error } = await serviceClient.from('recovery_tasks').insert(toInsert)
  // handle error once
}
```

Apply the same pattern to Pass 2 (`scanImportedPagesWeak`).

---

## Warnings

### WR-01: Supabase query errors silently ignored in `getRecoveryTasks`

**File:** `src/lib/monitoring/recovery-tasks.ts:64`

**Issue:** The query result is destructured as `const { data } = await query` — the `error` field is discarded. If the query fails (network, auth, schema mismatch), `data` is `null`, `rows` becomes `[]`, and the function returns an empty array without any indication of failure. The `izleme` page will show "Tespit edilen pozisyon düşüşü yok" even when the data layer is broken.

**Fix:**
```typescript
const { data, error } = await query
if (error) {
  // In a server component context, throwing is acceptable; the error boundary handles it.
  throw new Error(`getRecoveryTasks failed: ${error.message}`)
}
```

---

### WR-02: Empty-state logic in `RecoveryTaskTable` hides the table when all tasks are dismissed and `showDismissed` is false, but the toggle is never reachable

**File:** `src/app/(dashboard)/projeler/[id]/izleme/recovery-task-table.tsx:95-117`

**Issue:** When `activeCount === 0 && !showDismissed` the component renders the empty state card with an optional toggle button. If the user clicks "Dismissed görevleri göster" it calls `setShowDismissed(true)` — but the component returns early (the `return` at line 96 exits before reaching the main table render). After `setShowDismissed(true)` becomes true, `activeCount === 0 && !showDismissed` is false, so the component falls through to the main table path at line 161. This path renders the `visibleTasks` list filtered by `showDismissed`, and the second toggle at line 241 correctly allows hiding them again. The flow works but only accidentally; the render branch is non-obvious and the two toggle buttons (lines 109 and 246) can get out of sync if the dismissed-only state changes. More concretely: if `tasks` contains only dismissed rows and the user clicks the toggle in the empty state, `showDismissed` becomes `true`, the condition `activeCount === 0 && !showDismissed` is now false, the table renders with the dismissed rows visible, and the bottom toggle at line 241 appears — good. But if the user then clicks "Dismissed görevleri gizle" at line 248, `showDismissed` becomes `false` again, `activeCount` is still 0, and the component returns to the empty-state card. The toggle button in the empty state re-appears correctly. The round-trip works but the duplicate toggle state between the early-return branch and the main branch creates a maintenance trap.

**Fix:** Lift the empty-state check to exclude the case where `showDismissed` would reveal rows:
```typescript
const hasDismissed = tasks.some((t) => t.status === 'dismissed')
if (activeCount === 0 && !showDismissed && !hasDismissed) {
  return <EmptyState /> // no toggle needed — genuinely nothing to show
}
```
Then render a single unified layout that shows the empty-state text inline when `visibleTasks.length === 0`, with the single toggle rendered unconditionally when `hasDismissed`.

---

### WR-03: `formatPositionLoss` shows "−2.1 pozisyon" (position improved) without clear labeling

**File:** `src/app/(dashboard)/projeler/[id]/izleme/recovery-task-table.tsx:23-29`

**Issue:** The column header is "Pozisyon Kaybı" (position loss). The function returns a negative string (e.g., `"-2.1"`) when `after < before`, meaning the page's ranking actually improved since the task was created. Recovery tasks created from the detect route will always have `after > before` (delta >= 5 threshold), so for `page_package` tasks this value is always positive. However, for `imported_page` tasks `position_before` is always `null`, so the function returns `'—'`. But if a user manually observes a task after a fix, or if detect logic changes, a negative delta renders as `"-2.1 pozisyon"` in a column labeled "Pozisyon Kaybı" — confusing because negative position delta in GSC means improvement. The `deltaColorClass` function correctly colors negative as green (`text-emerald-400`), but the text label does not clarify direction.

**Fix:** Add a direction label or rename the cell value when negative:
```typescript
function formatPositionLoss(before: number | null, after: number | null): string {
  if (before === null || after === null) return '—'
  const delta = after - before
  if (delta > 0) return `+${delta.toFixed(1)}`
  if (delta < 0) return `${delta.toFixed(1)} (iyileşti)`
  return '0.0'
}
```

---

### WR-04: SSRF check in `publishToWordPress` does not cover `172.16.x.x`–`172.31.x.x` private range

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts:522-533`

**Issue:** The `assertSafeWpUrl` function blocks `10.x`, `127.x`, `192.168.x`, `169.254.x` and `.local` hostnames. The `172.16.0.0/12` private range (`172.16.x.x` through `172.31.x.x`) used by Docker default bridge networks and many cloud-internal VPCs is not blocked. An attacker-controlled `wp_url` value of `https://172.17.0.1/...` (Docker host from inside a container) or `https://172.31.x.x/...` (AWS VPC private IP) would pass this check.

**Fix:**
```typescript
// Add to the existing hostname checks:
const h = parsed.hostname
const h172Match = h.match(/^172\.(\d+)\./)
if (h172Match) {
  const second = parseInt(h172Match[1], 10)
  if (second >= 16 && second <= 31) {
    throw new Error('wp_url özel ağ adresine işaret edemez.')
  }
}
```

---

## Info

### IN-01: `updated_at` set to `new Date().toISOString()` in server actions rather than relying on DB trigger

**File:** `src/app/(dashboard)/projeler/[id]/izleme/actions.ts:66`, `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts:147,205,...`

**Issue:** Multiple server actions explicitly set `updated_at: new Date().toISOString()` in their UPDATE payloads. The migration defines a `set_recovery_tasks_updated_at` trigger that does this automatically. Setting it from application code is redundant and introduces a small clock-skew risk if the app server and DB server clocks drift. The trigger is the canonical source of truth; the app-level assignment adds noise without benefit.

**Suggestion:** Remove `updated_at` from all UPDATE payloads that touch tables with a `set_updated_at()` trigger. Let the trigger own it.

---

### IN-02: `decayCount` and `weakCount` return values from helpers are unused

**File:** `src/app/api/recovery/detect/route.ts:68-85`

**Issue:** `scanPagePackagesDecay` and `scanImportedPagesWeak` both return the number of pages scanned. These are captured in `decayCount` and `weakCount` but the variables are never used in the response body (the response uses `inserted` and `skipped` from the callbacks). The `scanned` field in the response object at line 88 correctly uses the return values, so this is not a bug — but the variable names shadow the semantic: `decayCount` is "pages scanned for decay", not "pages that decayed".

**Suggestion:** Rename to `scannedPackages` and `scannedImportedPages` for clarity, matching the response field names.

---

### IN-03: `middleware.ts` bypasses auth for `/api/recovery/detect` by pathname prefix — no path normalization

**File:** `middleware.ts:9-12`

**Issue:** The bypass uses `pathname.startsWith('/api/recovery/detect')`. This is fine for the exact route, but path normalization in Next.js (trailing slashes, query strings) is handled before `request.nextUrl.pathname` is set, so this is safe in practice. However, the comment "each route handler does its own webhook-secret check" relies on the CR-01 secret check being enforced. If CR-01 is not fixed, the middleware bypass combined with the fail-open secret check means the route is fully unauthenticated. This item is informational — it becomes critical only if CR-01 is not addressed.

**Suggestion:** No code change needed beyond fixing CR-01. Consider adding a comment noting that the bypass is safe only because the route enforces its own secret.

---

_Reviewed: 2026-04-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
