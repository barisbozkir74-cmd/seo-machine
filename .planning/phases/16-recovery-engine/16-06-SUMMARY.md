---
phase: 16-recovery-engine
plan: "06"
subsystem: api-route
tags:
  - api-route
  - n8n
  - webhook
  - recovery
  - decay-detection
dependency_graph:
  requires:
    - "supabase/migrations/20260430000001_recovery_tasks.sql (16-01 — table must exist)"
    - "public.projects table (ownership check FK target)"
    - "public.gsc_metrics table (decay scan source)"
    - "public.page_packages table (source_id resolution)"
    - "public.project_imported_pages table (weak-page scan source)"
  provides:
    - "POST /api/recovery/detect — n8n webhook endpoint for daily decay + weak-page recovery detection"
    - "middleware.ts /api/recovery/detect bypass"
  affects:
    - "Plans 16-02/16-03/16-04 (UI reads recovery_tasks rows inserted by this route)"
tech_stack:
  added: []
  patterns:
    - "Webhook-secret auth pattern (X-N8n-Webhook-Secret header, matches gsc/sync convention)"
    - "Service role client pattern (RLS bypass for INSERT — createClient from @supabase/supabase-js)"
    - "Parallel period fetch (Promise.all for current 7d + prior 7d gsc_metrics)"
    - "Aggregate-reduce per page_id (mirrors aggregation.ts reduceMetrics)"
    - "Duplicate-prevention via .maybeSingle() existence check before INSERT"
key_files:
  created:
    - "src/app/api/recovery/detect/route.ts"
  modified:
    - "middleware.ts"
decisions:
  - "ServiceClient typed as SupabaseClient<any, any, any> to avoid ReturnType<typeof createClient> generic mismatch with helper function signatures — no runtime impact"
  - "decayedPageIds.length returned as scanned.page_packages (not total gsc_metrics rows) — reports only candidate pages, matches plan spec"
  - "Pages without a page_package row increment skipped counter, not inserted — imported_pages pass handles those separately"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-30"
  tasks: 2
  files: 2
---

# Phase 16 Plan 06: Recovery Detect Webhook Summary

**One-liner:** n8n webhook endpoint at `/api/recovery/detect` — validates secret + ownership, scans gsc_metrics for 7d decay and project_imported_pages for weak pages, inserts recovery_tasks with duplicate prevention.

## What Was Built

### Task 1: POST /api/recovery/detect route handler

`src/app/api/recovery/detect/route.ts` — 362-line route handler implementing:

**Auth gate:**
- `X-N8n-Webhook-Secret` header checked against `process.env.N8N_WEBHOOK_SECRET`
- Returns 401 if secret mismatch; open if env var unset (matches gsc/sync convention)

**Body validation:**
- `request.json()` wrapped in try/catch → 400 on parse error
- `projectId` + `userId` presence check → 400 if missing

**Ownership check:**
- `projects.id = projectId AND user_id = userId` via service role client → 404 if not found

**Pass 1 — page_packages decay scan (REC-01):**
- Fetches `gsc_metrics` for last 7d and prior 7d in parallel (Promise.all)
- Reduces per `page_id`: clicks, impressions, avg_position weighted sum
- Decay condition: `delta_position >= 5 AND impressions > 10` (D-05/D-06)
- Resolves decayed page_ids → page_packages → title + wp_post_url
- Fetches pages table as fallback for title/slug
- Duplicate prevention: `.maybeSingle()` check for existing open|in_progress row (D-07)
- INSERT with `source='page_package'`, `source_id=page_packages.id`, positions to 2dp

**Pass 2 — imported_pages weak-page scan (REC-03):**
- SELECT `project_imported_pages WHERE flag_weak_page=true AND gsc_avg_position > 20` (D-14)
- Duplicate prevention: same pattern as Pass 1
- INSERT with `source='imported_page'`, `source_id=project_imported_pages.id`
- `position_before=null`, `position_after=gsc_avg_position` (no delta for imported pages)

**Response:** `{ inserted: number, skipped: number, scanned: { page_packages: number, imported_pages: number } }`

### Task 2: middleware.ts bypass

Extended the existing single-route n8n bypass block to cover both endpoints:

```typescript
// Bypass auth for n8n server-to-server calls — each route handler does its own webhook-secret check
if (
  pathname.startsWith('/api/gsc/sync') ||
  pathname.startsWith('/api/recovery/detect')
) {
  return NextResponse.next({ request })
}
```

## Task Results

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Create POST /api/recovery/detect route | `29bfb53` | `src/app/api/recovery/detect/route.ts` (new) |
| 2 | Add /api/recovery/detect bypass to middleware.ts | `1f1f7b2` | `middleware.ts` (modified) |

## Verification Results

### Auth gate (3 cases)

| Test | Expected | Verified |
|---|---|---|
| No `X-N8n-Webhook-Secret` header, env set | 401 Unauthorized | Code path confirmed |
| Wrong secret value, env set | 401 Unauthorized | Code path confirmed |
| Correct secret | Proceeds to body parse | Code path confirmed |
| `N8N_WEBHOOK_SECRET` env unset | Open (any caller) — documented risk | Matches gsc/sync convention |

### Body validation

| Test | Expected | Verified |
|---|---|---|
| `not-json` body | 400 Invalid JSON | try/catch covers |
| Missing `projectId` | 400 projectId and userId required | Explicit guard |
| Missing `userId` | 400 projectId and userId required | Explicit guard |

### Ownership check

| Test | Expected | Verified |
|---|---|---|
| Random UUID pair | 404 Project not found | `.single()` returns null |

### Happy path / idempotency

- First run: inserts recovery_tasks for decayed pages + weak pages → `inserted: N`
- Second run: duplicate prevention skips all → `inserted: 0, skipped: N`
- Confirmed by code: `.maybeSingle()` returns existing row → `onSkipped()` called, INSERT skipped

### Middleware bypass

- Without bypass: Supabase SSR middleware redirects unauthenticated requests to `/login`
- With bypass: `return NextResponse.next({ request })` before Supabase client instantiation

## Deviations from Plan

**[Rule 1 - Bug] ServiceClient type alias changed from ReturnType to explicit SupabaseClient<any,any,any>**

- **Found during:** Task 1 TypeScript compile
- **Issue:** `type ServiceClient = ReturnType<typeof createServiceClient>` produced a complex generic type that TypeScript could not match against function parameters — TS2345 error with "Type 'public' is not assignable to type 'never'"
- **Fix:** Changed to `SupabaseClient<any, any, any>` imported from `@supabase/supabase-js`
- **Files modified:** `src/app/api/recovery/detect/route.ts`
- **Commit:** included in `29bfb53`

## Environment Variables Required

| Variable | Where | Purpose |
|---|---|---|
| `N8N_WEBHOOK_SECRET` | App `.env.local` + n8n HTTP Request node header | Authenticates n8n → detect route calls |
| `SUPABASE_SERVICE_ROLE_KEY` | App `.env.local` | Service role client for RLS-bypassed INSERT |
| `NEXT_PUBLIC_SUPABASE_URL` | App `.env.local` | Supabase project URL |

**Production note:** `N8N_WEBHOOK_SECRET` MUST be set in production. Without it, the route is open to any caller with knowledge of the URL. Minimum 32-character high-entropy value recommended (T-16-06-01).

## Operator Responsibility (Out of Scope)

n8n workflow cron schedule and the list of `(projectId, userId)` pairs to call are OPERATOR responsibility — not part of this codebase. The route accepts one `(projectId, userId)` pair per call; n8n should loop over all projects that need daily decay scanning.

## Known Stubs

None — route is fully wired. All DB reads and writes use real tables via service role client.

## Threat Flags

No new security surface beyond what the plan's threat model covers. All T-16-06-xx threats addressed by implementation (see plan threat model section).

## Self-Check: PASSED

- [x] `src/app/api/recovery/detect/route.ts` exists
- [x] `middleware.ts` contains `/api/recovery/detect` bypass
- [x] Commit `29bfb53` exists in git log
- [x] Commit `1f1f7b2` exists in git log
- [x] `npx tsc --noEmit` passes with zero errors on new/modified files
