---
phase: 24
slug: dataforseo-validation-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.5 |
| **Config file** | `vitest.config.ts` (or `package.json` scripts) |
| **Quick run command** | `npm test -- --run src/lib/dataforseo/` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run src/lib/dataforseo/`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | DFS-01 | T-24-01 | Migration adds strategy_decisions with UNIQUE(project_id,module,key) | migration | `supabase db push` | ❌ W0 | ⬜ pending |
| 24-01-02 | 01 | 1 | DFS-07 | — | dfs_fetched_at column added to keywords, no DEFAULT now() | migration | `supabase db push` | ❌ W0 | ⬜ pending |
| 24-02-01 | 02 | 1 | DFS-02 | T-24-02 | Cache hit returns cached response without DataForSEO call | unit | `npm test -- --run src/lib/dataforseo/cache.test.ts` | ❌ W0 | ⬜ pending |
| 24-02-02 | 02 | 1 | DFS-02 | T-24-02 | Cache miss triggers DataForSEO call then writes to cache | unit | `npm test -- --run src/lib/dataforseo/cache.test.ts` | ❌ W0 | ⬜ pending |
| 24-02-03 | 02 | 1 | DFS-02 | T-24-03 | buildCacheKey normalizes keyword (lowercase+trim) before SHA-256 | unit | `npm test -- --run src/lib/dataforseo/cache.test.ts` | ❌ W0 | ⬜ pending |
| 24-02-04 | 02 | 1 | DFS-02 | — | Expired cache entry (expires_at < now()) triggers re-fetch | unit | `npm test -- --run src/lib/dataforseo/cache.test.ts` | ❌ W0 | ⬜ pending |
| 24-03-01 | 03 | 2 | DFS-03 | T-24-04 | Light analysis Server Action rejects if analysis already running | unit | `npm test -- --run src/lib/dataforseo/analysis.test.ts` | ❌ W0 | ⬜ pending |
| 24-03-02 | 03 | 2 | DFS-04 | — | Standard analysis Server Action is cluster-scoped | unit | `npm test -- --run src/lib/dataforseo/analysis.test.ts` | ❌ W0 | ⬜ pending |
| 24-04-01 | 04 | 3 | DFS-05 | T-24-05 | Deep analysis posts to n8n webhook with correct secret header | manual | See Manual-Only below | — | ⬜ pending |
| 24-04-02 | 04 | 3 | DFS-06 | — | workflow_runs row transitions: pending→running→done/failed | manual | See Manual-Only below | — | ⬜ pending |
| 24-04-03 | 04 | 3 | DFS-08 | T-24-04 | Concurrent guard: second trigger blocked when workflow_runs status=running | unit | `npm test -- --run src/lib/dataforseo/analysis.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/dataforseo/cache.test.ts` — stubs for DFS-02 (getCachedOrFetch: hit, miss, expiry, normalization)
- [ ] `src/lib/dataforseo/analysis.test.ts` — stubs for DFS-03, DFS-04, DFS-08 (light/standard trigger, concurrent guard)
- [ ] Mock for `src/lib/vault.ts` — existing pattern from clustering-approval.test.ts
- [ ] Mock for Supabase client — existing pattern in codebase

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deep analysis n8n webhook delivery | DFS-05 | Requires live n8n instance + webhook secret | 1. Set N8N_WEBHOOK_URL in .env.local 2. Click "Derinlemesine Analizi Başlat" + confirm cost dialog 3. Verify workflow_runs row created with status=pending 4. Verify n8n webhook received POST with projectId+userId+workflowRunId |
| 5-second polling updates UI | DFS-06 | Browser polling behavior | 1. Start deep analysis 2. Observe workflow_runs status column in UI every 5s 3. Verify status transitions pending→running→done are reflected without page reload |
| dfs_fetched_at column display | DFS-07 | UI column visibility | 1. Fetch keywords via light analysis 2. Verify keyword list shows "DFS Tarihi" column 3. Verify NULL keywords show "Veri yok" badge 4. Verify enriched_at column is separate and distinct |
| Concurrent guard UI message | DFS-08 | Requires active analysis job | 1. Start light analysis 2. Immediately click any analysis button 3. Verify "Analiz devam ediyor" amber banner appears 4. Verify button is disabled |
| Cost approval dialog blocks API call | DFS-03 | User interaction required | 1. Click "Temel Verileri Al" 2. Verify cost dialog appears BEFORE any API call 3. Click "İptal" 4. Verify no DataForSEO request was made (check network tab) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
