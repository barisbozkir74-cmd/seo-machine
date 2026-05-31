---
phase: 24-dataforseo-validation-layer
reviewed: 2026-05-31T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/__tests__/lib/dataforseo/analysis.test.ts
  - src/__tests__/lib/dataforseo/cache.test.ts
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/AnalysisButtons.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/DeepAnalysisPoller.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx
  - src/app/api/dataforseo/deep-analysis/callback/route.ts
  - src/app/api/dataforseo/deep-analysis/route.ts
  - src/lib/dataforseo/cache.ts
  - src/lib/dataforseo/orchestrator.ts
  - src/lib/dataforseo/types.ts
  - supabase/migrations/20260606000001_strategy_decisions.sql
  - supabase/migrations/20260606000002_keywords_dfs_fetched_at.sql
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-05-31T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 24 introduces the DataForSEO validation layer: a three-tier analysis system (light / standard / deep), a cache-first orchestrator, two n8n API routes, and SSR polling for deep analysis. Overall the architecture is sound — auth, ownership, and UUID validation are applied consistently in server actions. Several issues were found that require attention before production:

- **3 critical**: webhook secret bypass (both n8n routes silently permit unauthenticated access when env var is absent), a concurrent-guard race condition that can let two simultaneous deep analysis jobs through, and unvalidated `keywordIds` array in the callback route allowing arbitrary keyword updates.
- **5 warnings**: including a `retry_count` select-then-update pattern that the code itself acknowledges as a race, orphaned workflow_run on n8n failure in `triggerDeepAnalysisAction`, `fetchSerpDomains` guard syntax that silently swallows errors at module level, insufficient poller stop condition when `currentStatus` transitions to `done`/`failed` late, and missing TTL for `onpage/crawl` endpoint breaking the DONE-write path.
- **3 info**: test assertions that are too loose, an unused import guard pattern that will trip linters, and undocumented `N8N_WEBHOOK_SECRET` optionality behaviour.

---

## Critical Issues

### CR-01: Webhook secret check is opt-in — both n8n routes are publicly accessible when env var is absent

**File:** `src/app/api/dataforseo/deep-analysis/route.ts:29-32` and `src/app/api/dataforseo/deep-analysis/callback/route.ts:34-37`

**Issue:** Both routes check the secret only when `expectedSecret` is truthy:
```ts
if (expectedSecret && secret !== expectedSecret) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```
If `N8N_WEBHOOK_SECRET` is missing or empty in any environment (staging, PR preview, developer machine), the routes accept every POST without authentication. An attacker who discovers either URL can:
- In `/deep-analysis`: create arbitrary `workflow_runs` rows for any `userId` they know.
- In `/callback`: mark any `workflow_run` as `done` or `failed`, and bulk-update `dfs_fetched_at` on arbitrary keyword rows (subject only to the IDOR ownership check in step 4).

**Fix:** Fail closed. If the secret is not configured, reject all requests immediately:
```ts
const expectedSecret = process.env.N8N_WEBHOOK_SECRET
if (!expectedSecret) {
  // Secret not configured — refuse all requests to prevent open access
  return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 })
}
if (secret !== expectedSecret) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```
Apply this identical pattern in both route files.

---

### CR-02: Concurrent guard in `triggerDeepAnalysisAction` has a TOCTOU race — two simultaneous deep analysis jobs can be created

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts:1297-1322`

**Issue:** The guard checks for an existing running job (step 4) and then inserts a new `workflow_runs` row (step 5) as two separate non-atomic operations. If two requests from the same user arrive within milliseconds (double-click, network retry, concurrent browser tabs), both can pass the `maybeSingle()` check before either INSERT completes. This creates two `workflow_runs` rows, firing two n8n executions for the same project simultaneously.

Note: The same pattern exists in `lightAnalysisAction` (line 1124) and `standardAnalysisAction` (line 1202), but those are synchronous server actions that are less likely to be parallelised by a browser. The `triggerDeepAnalysisAction` is the most exposed path because it spawns a long-running external job.

**Fix:** Enforce uniqueness at the database level with a partial unique index:
```sql
-- In a new migration:
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_runs_one_active_deep_per_project
  ON public.workflow_runs(project_id, workflow_type)
  WHERE status IN ('pending', 'running');
```
Then handle the `23505` (unique violation) error in the action as a clean "already running" response:
```ts
if (insertError?.code === '23505') {
  return { success: false, error: 'Analiz devam ediyor. Tamamlanmasını bekleyin.' }
}
```
This makes the guard atomic and eliminates the race.

---

### CR-03: Callback route does not validate individual `keywordIds` — arbitrary UUID injection allows updating keywords from a different project

**File:** `src/app/api/dataforseo/deep-analysis/callback/route.ts:107-114`

**Issue:**
```ts
if (status === 'done' && Array.isArray(keywordIds) && keywordIds.length > 0) {
  await serviceClient
    .from('keywords')
    .update({ dfs_fetched_at: now })
    .in('id', keywordIds)
    .eq('project_id', projectId)   // ← only filter
```
The ownership check at step 4 confirms that `(projectId, userId)` is a valid pair, but it does not verify that the `workflowRunId` actually belongs to that project. More critically, the `keywordIds` array is taken verbatim from the request body. A caller who knows a valid `(projectId, userId, workflowRunId)` triple can pass keyword IDs from any other project. The `.eq('project_id', projectId)` filter mitigates this for keywords that truly belong to a different project, but an attacker who controls the `projectId` parameter can pollute `dfs_fetched_at` for all keywords under that project — including ones the current `workflowRunId` never actually processed.

Additionally, the route never verifies that `workflowRunId` belongs to `projectId`. A valid workflowRunId from project A could be submitted with project B's ID, passing the ownership check on project B while writing into it.

**Fix 1** — Verify `workflowRunId` belongs to the specified project before the update:
```ts
const { data: runRow } = await serviceClient
  .from('workflow_runs')
  .select('id')
  .eq('id', workflowRunId)
  .eq('project_id', projectId)
  .maybeSingle()
if (!runRow) {
  return NextResponse.json({ error: 'Workflow run not found' }, { status: 404 })
}
```

**Fix 2** — Validate each keyword ID is a UUID before the bulk update:
```ts
const validKeywordIds = (keywordIds ?? []).filter(id => uuidRegex.test(id))
if (validKeywordIds.length > 0) {
  await serviceClient
    .from('keywords')
    .update({ dfs_fetched_at: now })
    .in('id', validKeywordIds)
    .eq('project_id', projectId)
}
```

---

## Warnings

### WR-01: `retry_count` select-then-update is a documented race condition — concurrent error paths can lose increments

**File:** `src/lib/dataforseo/orchestrator.ts:251-268`

**Issue:** The code itself notes "race condition kabul edilebilir" (race condition accepted). When two concurrent calls for the same fingerprint both fail, both read `retry_count = 0`, both compute `0 + 1 = 1`, and both write `retry_count = 1`. The backoff threshold is never reached despite repeated errors, meaning the backoff guard (`isInBackoff`) can never trigger for this key. A repeatedly failing endpoint will keep spending budget on retries indefinitely.

**Fix:** Use a SQL atomic increment. With the Supabase JS client this requires a raw RPC, or switching the update to:
```ts
// Option A: use Postgres function via rpc()
await supabase.rpc('increment_retry_count', { p_project_id: projectId, p_fingerprint: fingerprint })

// Option B: avoid the pre-read entirely — use .update with a raw increment expression
// This requires a Supabase stored procedure or a migration adding a trigger.
```
If a raw RPC is not feasible, the comment should at minimum be upgraded to document the impact: the backoff guard is unreliable under concurrent load.

---

### WR-02: `triggerDeepAnalysisAction` leaves a `pending` workflow_run orphaned on n8n webhook failure

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts:1326-1344`

**Issue:** When the n8n webhook call fails, the action returns `{ success: false, error: 'n8n webhook tetiklenemedi.' }` but does **not** update the already-inserted `workflow_runs` row. That row stays in `status = 'pending'` indefinitely, blocking the concurrent guard for the project. The user cannot retry because every subsequent call hits "Analiz devam ediyor." The companion API route (`/api/dataforseo/deep-analysis/route.ts:127-132`) correctly updates to `failed` on webhook error — but the Server Action does not mirror this logic.

**Fix:**
```ts
} catch {
  // Mark the run as failed so the concurrent guard clears
  await supabase
    .from('workflow_runs')
    .update({ status: 'failed', error_message: 'n8n webhook ulaşılamadı.' })
    .eq('id', workflowRun.id)
    .eq('user_id', user.id)
  return { success: false, error: 'n8n webhook tetiklenemedi.' }
}
```

---

### WR-03: `onpage/crawl` has TTL = 0 — `DONE` write path sets `expires_at: null` and `freshness_label: null`, but cache hit check will never match it

**File:** `src/lib/dataforseo/orchestrator.ts:277-302` and `src/lib/dataforseo/types.ts:47`

**Issue:** When `ttl = 0`, `expiresAt` is `null` and `freshLabel` is `null`. In step [5] the cache-hit check is:
```ts
if (cached?.result && !isStale(cached.expires_at))
```
`isStale(null)` returns `true` (line 71 of orchestrator.ts), so a previously completed `onpage/crawl` task is always treated as stale and will be re-fetched on every call. This is wasteful (and potentially unintentional for the "user-triggered" semantics intended by TTL=0).

**Fix:** Either document that `onpage/crawl` intentionally bypasses cache (and use `forceRefresh: true` at the call site), or define a sentinel value (e.g., TTL = -1 for "cache forever, user must force-refresh") and adjust `isStale`:
```ts
// In isStale():
export function isStale(expiresAt: string | null): boolean {
  if (expiresAt === null) return false  // null = no expiry = never stale
  return new Date(expiresAt) < new Date()
}
// TTL = 0 would mean "no expiry" — document this clearly.
```

---

### WR-04: `DeepAnalysisPoller` stops the interval only when `phase` state catches up, but `currentStatus` prop arriving as `done`/`failed` does not stop the running interval

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/DeepAnalysisPoller.tsx:26-57`

**Issue:** The polling interval is started in the second `useEffect` with `[router, phase]` dependency. When SSR delivers `currentStatus = 'done'`, the first `useEffect` calls `setPhase('done')`. This triggers a re-render, which causes the second `useEffect` to re-run — and at that point `triggered.current` is already `true`, so the early-return fires and the old interval is never cleared in that effect's cleanup. The cleanup only executes when the component unmounts or when the effect re-runs due to a dependency change. Specifically:

1. `triggered.current = true` guard prevents the new effect body from setting a new interval.
2. The old `pollInterval` reference from the first run is closed over in the cleanup function of the first invocation.
3. React does call the cleanup of the **previous** effect before re-running — so the interval **is** cleared when `phase` changes.

On closer inspection, the cleanup `return () => clearInterval(pollInterval)` is inside the second `useEffect`, meaning React will clear the interval when `phase` changes. The logic is correct but depends on React's effect cleanup ordering. The `triggered.current` guard adds confusion: once the component remounts (e.g., after a page transition that does not fully unmount), `triggered.current` resets to `false` but `phase` re-initialises from `initialStatus`, which could be stale if the parent does not re-fetch.

**Fix:** Simplify by removing `triggered.current` and relying solely on the `phase` dependency stop condition, which is already present:
```ts
useEffect(() => {
  if (phase === 'done' || phase === 'failed' || phase === 'timeout') return

  let loopCount = 0
  const MAX_LOOPS = 144

  const pollInterval = setInterval(() => {
    loopCount++
    if (loopCount >= MAX_LOOPS) {
      clearInterval(pollInterval)
      setPhase('timeout')
      return
    }
    router.refresh()
  }, 5000)

  return () => clearInterval(pollInterval)
}, [router, phase])
```
This is cleaner: the interval is started only while `phase` is active, and each `setPhase('done')` call both stops the interval (via cleanup) and prevents it from restarting (via the early return check).

---

### WR-05: `fetchSerpDomains` import guard uses `void (x as unknown)` at module level — swallows TypeScript narrowing and will fail silently if the import is removed

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts:1267-1269`

**Issue:**
```ts
// fetchSerpDomains Phase 25'te kullanılacak (deep analysis SERP endpoint'i)
void (fetchSerpDomains as unknown)
```
This pattern exists to keep the import alive for tree-shaking but the `as unknown` cast silently hides type errors. More importantly, if the import is removed or renamed in `client.ts`, this line will produce a TypeScript compile error at runtime with a confusing message, not a clear import error. It also runs at module evaluation time, which means any future test that imports `actions.ts` will execute this expression.

**Fix:** Remove the import guard entirely. If `fetchSerpDomains` is needed in Phase 25, add a proper named export or a typed placeholder that Phase 25 will overwrite. Dead imports should not be kept alive with runtime expressions:
```ts
// Remove the import of fetchSerpDomains and this guard line.
// Re-add the import in Phase 25 when it is actually used.
```

---

## Info

### IN-01: Test assertions for "keyword yok" and "cluster yok" branches are too loose — they only check `success` exists, not its value

**File:** `src/__tests__/lib/dataforseo/analysis.test.ts:72-73` and `108-109`

**Issue:**
```ts
expect(result).toHaveProperty('success')   // passes even if success: true
```
Both the "keyword yoksa" and "cluster yoksa" tests assert only that `result.success` exists as a property, not that it is `false`. If the implementation accidentally returns `{ success: true, count: 0 }` in these branches, the tests pass silently. This provides no real protection.

**Fix:**
```ts
expect(result.success).toBe(false)
expect((result as { success: false; error: string }).error).toBeTruthy()
```

---

### IN-02: `strategy_decisions` migration has no `updated_at` auto-update trigger — manual updates will leave `updated_at` stale

**File:** `supabase/migrations/20260606000001_strategy_decisions.sql:27`

**Issue:** The `updated_at` column has `DEFAULT now()` for inserts but there is no `BEFORE UPDATE` trigger to keep it current on subsequent updates. Any application-layer UPDATE that does not explicitly set `updated_at` will leave the old value, making audit/ordering queries unreliable. Other tables in the project (e.g., `dataforseo_task_cache`) follow the pattern of always setting `updated_at` in application code, but this creates a maintenance burden.

**Fix:** Add a trigger consistent with the project's other tables:
```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_strategy_decisions_updated_at
  BEFORE UPDATE ON public.strategy_decisions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```
(Check if `set_updated_at()` already exists from a previous migration before creating it again.)

---

### IN-03: `N8N_WEBHOOK_SECRET` optionality is undocumented in `.env.local.example` — developers running without the secret get false confidence that routes are secured

**File:** `src/app/api/dataforseo/deep-analysis/route.ts:29` / `callback/route.ts:34`

**Issue:** Both routes silently skip authentication when `N8N_WEBHOOK_SECRET` is unset (current behaviour, separate from CR-01). Even after fixing CR-01, the fact that this env var is required for security should be prominently documented. If `.env.local.example` lists the variable as optional or omits it, developers may not set it and will deploy with open routes.

**Fix:** In `.env.local.example` mark the variable as required with a comment:
```env
# REQUIRED for n8n webhook security — routes return 503 if missing
N8N_WEBHOOK_SECRET=your-secret-here
```

---

_Reviewed: 2026-05-31T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
