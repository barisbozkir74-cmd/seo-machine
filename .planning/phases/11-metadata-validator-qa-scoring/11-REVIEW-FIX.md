---
phase: 11-metadata-validator-qa-scoring
fixed_at: 2026-04-25T00:00:00Z
review_path: .planning/phases/11-metadata-validator-qa-scoring/11-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-04-25
**Source review:** .planning/phases/11-metadata-validator-qa-scoring/11-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (1 Critical + 6 Warnings; Info findings excluded per fix_scope=critical_warning)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: Non-null assertion on `pkg` in `proceedToQA` reachable without guard

**Files modified:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx`
**Commit:** c51e251
**Applied fix:** Added `if (!pkg?.id) { setQaDialogPhase('error'); return }` guard at the top of `proceedToQA`, and replaced `pkg!.id` with `pkg.id` after the guard. Also removed the `setQaDialogOpen(true)` call that ran before the new early-return check so the dialog is not opened when pkg is absent.

---

### WR-01: QA audit uses an arbitrary page's focus keyword, not the audited package's keyword

**Files modified:** `src/app/api/ai/qa-audit/route.ts`
**Commit:** 3e7923e
**Applied fix:** Replaced the flat `pages` query (filtered by `project_id` + `user_id` with `.limit(1)`) with a two-step join: first fetch `page_id` from `page_packages` where `id = packageId`, then query `pages` for `focus_keyword_id` using that specific page ID. The keyword is now always the one belonging to the package being audited.

---

### WR-02: Package can be locked with no QA scores persisted when AI audit fails

**Files modified:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx`
**Commit:** a5e472e
**Applied fix:** Replaced the conditional `if (qaResult && qaScores)` score-save block with an unconditional save: `const scoresToSave = qaScores ?? { last_qa_run: new Date().toISOString() }` followed by `await updatePagePackage(...)`. This ensures `qa_scores` is always written before the package is locked, even when the AI audit failed and `qaScores` is null.

---

### WR-03: `title_max_length_enforced` project rule overlaps with base `QA-01`, causing duplicate penalty

**Files modified:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/QaBadge.tsx`
**Commit:** 5b8d668
**Applied fix:** Wrapped the `QA-01` length checks in `if (!props.projectRules['title_max_length_enforced'])`. When the project rule is active it fires its own `error`, so the base warning/error is skipped entirely, eliminating the double deduction from `computeSeoScore`.

---

### WR-04: `computeSchemaScore` returns 50 for syntactically invalid JSON-LD

**Files modified:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx`
**Commit:** 36973a7
**Applied fix:** Changed the `catch` branch of `computeSchemaScore` to `return 0` (was `return 50`). Invalid JSON-LD is non-functional and should not contribute any points to the readiness score.

---

### WR-05: Missing `user_id` filter on `page_packages` query in list panel

**Files modified:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx`
**Commit:** 680e285
**Applied fix:** Added `.eq('user_id', user.id)` to the `page_packages` bulk query that builds `packageMap`. Provides defence-in-depth ownership check at the package level, not only at the page level.

---

### WR-06: `ANTHROPIC_API_KEY` absence produces opaque 502 instead of startup error

**Files modified:** `src/app/api/ai/qa-audit/route.ts`
**Commit:** 9ab70ed
**Applied fix:** Added a module-level guard `if (!process.env.ANTHROPIC_API_KEY) { throw new Error('ANTHROPIC_API_KEY environment variable is not set') }` immediately before the `new Anthropic(...)` instantiation. Misconfigured deployments will now fail fast at startup with a clear error message instead of surfacing as an opaque 502 at runtime.

---

_Fixed: 2026-04-25_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
