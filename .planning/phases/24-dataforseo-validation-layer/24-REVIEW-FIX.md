---
phase: 24-dataforseo-validation-layer
fixed_at: 2026-05-31T00:00:00Z
review_path: .planning/phases/24-dataforseo-validation-layer/24-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 24: Code Review Fix Report

**Fixed at:** 2026-05-31T00:00:00Z
**Source review:** .planning/phases/24-dataforseo-validation-layer/24-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (3 Critical + 5 Warning; Info findings excluded per fix_scope)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: Webhook secret fail-closed in both n8n routes

**Files modified:** `src/app/api/dataforseo/deep-analysis/route.ts`, `src/app/api/dataforseo/deep-analysis/callback/route.ts`
**Commit:** 4369228
**Applied fix:** Changed both routes from opt-in (`if (expectedSecret && secret !== expectedSecret)`) to fail-closed. Now reads `N8N_WEBHOOK_SECRET` first; if absent returns 503 immediately. If present, checks the header and returns 401 on mismatch.

---

### CR-02: Atomic concurrent guard for workflow_runs

**Files modified:** `supabase/migrations/20260606000003_workflow_runs_unique_active.sql`, `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts`
**Commit:** 6e8e655
**Applied fix:** Created partial unique index `workflow_runs_one_active_per_project` on `(project_id, workflow_type) WHERE status IN ('pending', 'running')`. In `triggerDeepAnalysisAction`, split the `if (insertError || !workflowRun)` check so that error code `23505` (unique_violation) returns the clean "already running" user message instead of a generic error. This makes the concurrent guard atomic at the DB level.

---

### CR-03: Callback ownership check and keywordIds UUID validation

**Files modified:** `src/app/api/dataforseo/deep-analysis/callback/route.ts`
**Commit:** 7f35da5
**Applied fix:**
- Fix 1: Added step 4b after the project ownership check — queries `workflow_runs` filtering by both `id` and `project_id` via `maybeSingle()`; returns 404 if the run does not belong to the project.
- Fix 2: Before the bulk `dfs_fetched_at` update, filters `keywordIds` through a strict UUID regex (`/^[0-9a-f]{8}-[0-9a-f]{4}-...-[0-9a-f]{12}$/i`) and only proceeds if `safeKeywordIds.length > 0`.

---

### WR-02: Mark workflow_run failed on n8n webhook unreachable

**Files modified:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts`
**Commit:** 93320fe
**Applied fix:** In the `catch` block of the n8n fetch call in `triggerDeepAnalysisAction`, added a Supabase update to set `status='failed'` and `error_message='n8n webhook ulaşılamadı.'` on the already-inserted `workflow_runs` row before returning the error. This mirrors the existing logic in the API route and unblocks the concurrent guard so the user can retry.

---

### WR-05: Remove fetchSerpDomains dead import guard

**Files modified:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts`
**Commit:** fab7d79
**Applied fix:** Removed the `void (fetchSerpDomains as unknown)` module-level expression and the `fetchSerpDomains` named import. Replaced the comment block with a single `// TODO(Phase 25)` comment. This eliminates the silent runtime expression and the linter-triggering unused import.

---

### WR-01: Document known benign race in orchestrator retry_count path

**Files modified:** `src/lib/dataforseo/orchestrator.ts`
**Commit:** efded27
**Applied fix:** Expanded the existing "race condition kabul edilebilir" comment to document the concrete impact (concurrent errors write the same incremented count, backoff threshold reached later than expected) and note that an atomic RPC increment should be addressed in a future phase if budget bleed becomes an issue.

---

### WR-03: Clarify TTL=0 semantics in types.ts

**Files modified:** `src/lib/dataforseo/types.ts`
**Commit:** efded27
**Applied fix:** Replaced the short `// user-triggered, TTL yok` comment on `onpage/crawl` with a multi-line comment clarifying that TTL=0 means `isStale(null) === true` so every call bypasses cache. Call sites must use `forceRefresh:true` or accept repeated fetches. This is intentional behaviour.

---

### WR-04: Remove redundant triggered.current guard in DeepAnalysisPoller

**Files modified:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/DeepAnalysisPoller.tsx`
**Commit:** efded27
**Applied fix:** Removed `useRef` import, the `triggered` ref declaration, and the `if (triggered.current) return` / `triggered.current = true` lines from the polling `useEffect`. The `phase` dependency already provides the correct stop condition; React's effect cleanup clears the interval before each re-render. Added a comment explaining the design.

---

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-05-31T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
