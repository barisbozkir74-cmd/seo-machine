---
phase: 6
slug: keyword-clustering-scoring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts — Wave 0 installs if absent |
| **Quick run command** | `npx vitest run src/lib/keywords/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/keywords/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | KEYW-06 | — | opportunity_score stays 0-100 | unit | `npx vitest run src/lib/keywords/scoring.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-01 | 01 | 1 | KEYW-06 | — | transactional > commercial score | unit | `npx vitest run src/lib/keywords/scoring.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | KEYW-04 | — | intent grouping correct | unit | `npx vitest run src/lib/keywords/clustering.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | KEYW-04 | — | text similarity assigns correct cluster | unit | `npx vitest run src/lib/keywords/clustering.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | KEYW-05 | — | keyword moved to cluster clears old cluster_id | unit | `npx vitest run src/lib/keywords/clustering.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | KEYW-05 | T-06-02 | ownership double-check: keyword + cluster both verified | unit | `npx vitest run src/lib/keywords/clustering.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | KEYW-07 | — | UI cluster panel renders, keyword move | manual | — | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/keywords/scoring.test.ts` — unit tests for KEYW-06 (opportunity score formula, range 0-100, intent multipliers)
- [ ] `src/lib/keywords/clustering.test.ts` — unit tests for KEYW-04 (intent grouping, text similarity), KEYW-05 (cluster_id uniqueness, cannibalization prevention)
- [ ] `npm install -D vitest` — if vitest not in package.json devDependencies

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cluster panel renders correctly | KEYW-07 | React UI rendering, shadcn Dialog interaction | 1. Run dev server. 2. Navigate to /projeler/[id]/keyword-stratejisi. 3. Click "Kümelere Böl". 4. Switch to "Küme Görünümü". 5. Verify cluster cards show, primary star interactive, "Taşı" dialog works. |
| MoveKeywordDialog moves keyword | KEYW-07 | Server Action + Dialog interaction | Hover keyword row in cluster panel → click "Taşı" → select different cluster → confirm → verify keyword appears in new cluster. |
| ViewToggle switches view | KEYW-07 | URL searchParams routing | Click "Düz Liste" / "Küme Görünümü" toggle — URL should update `?view=flat` / `?view=cluster` and view should change. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
