---
phase: 11-metadata-validator-qa-scoring
reviewed: 2026-04-25T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/app/api/ai/qa-audit/route.ts
  - src/app/(dashboard)/projeler/[id]/sayfa-paketi/QaBadge.tsx
  - src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx
  - src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-04-25
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four files implement the QA audit and metadata validation feature: the AI audit API route, the QA badge/rules engine, the page package editor, and the server-rendered page. The security fundamentals are solid — ownership is verified for both project and package before any AI call, prompt injection risk is mitigated with explicit field markers and length caps, and server actions enforce row-level ownership. The main concerns are a wrong-keyword bug in the API route (the focus keyword fetched does not belong to the package being audited), a non-null assertion that can reach client state unexpectedly, a locked-without-QA-scores inconsistency, and a rule overlap that silently inflates the error count and penalises the SEO score unfairly.

---

## Critical Issues

### CR-01: Non-null assertion on `pkg` in `proceedToQA` reachable without guard

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx:436`

**Issue:** `proceedToQA` constructs the fetch body with `pkg!.id`. The function is guarded indirectly in `handleLockClick` (line 472), but the same function is also wired to the "Anlıyorum, yine de kilitle" `<Button onClick={proceedToQA}>` rendered inside the rules-phase dialog (line 731). That button renders inside a `<Dialog open={qaDialogOpen}>` that was opened via `handleLockClick`, so `pkg` should normally be non-null at that point. However, the non-null assertion is structurally unsound: `pkg` is derived from `page.pkg ?? null` and typed as nullable. If a future refactor opens the dialog from another path, or if a rapid state transition races, the assertion will throw an unhandled runtime error rather than silently returning.

**Fix:**
```typescript
async function proceedToQA() {
  if (!pkg?.id) {
    setQaDialogPhase('error')
    return
  }
  setQaDialogPhase('loading')
  setQaDialogOpen(true)
  try {
    const res = await fetch('/api/ai/qa-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId: pkg.id, projectId }),
    })
    // ...rest unchanged
```

---

## Warnings

### WR-01: QA audit uses an arbitrary page's focus keyword, not the audited package's keyword

**File:** `src/app/api/ai/qa-audit/route.ts:48-62`

**Issue:** The route fetches a focus keyword by querying the `pages` table filtered only by `project_id` and `user_id`, with `.limit(1)`. There is no join to the `packageId` being audited. In a project with multiple pages the `.limit(1)` returns whichever page the database chooses (insertion order or random), which is almost certainly not the page owning the audited package. The QA prompt will evaluate keyword presence against the wrong keyword, producing misleading `intent_drift` and `entity_gap` notes.

**Fix:** Join through `page_packages` to find the page that owns the package:

```typescript
// Replace the standalone pages query with:
const { data: pkgPageRow } = await supabase
  .from('page_packages')
  .select('page_id')
  .eq('id', packageId)
  .single()

let focusKeyword = ''
if (pkgPageRow?.page_id) {
  const { data: pageRow } = await supabase
    .from('pages')
    .select('focus_keyword_id')
    .eq('id', pkgPageRow.page_id)
    .eq('user_id', user.id)
    .single()

  if (pageRow?.focus_keyword_id) {
    const { data: kw } = await supabase
      .from('keywords')
      .select('keyword')
      .eq('id', pageRow.focus_keyword_id)
      .single()
    if (kw) focusKeyword = kw.keyword
  }
}
```

---

### WR-02: Package can be locked with no QA scores persisted when AI audit fails

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx:491-505`

**Issue:** `handleConfirmLock` saves QA scores only `if (qaResult && qaScores)`. When the dialog is in `error` phase (the AI audit API returned an error), `qaResult` is null. The user can still click "Yine de Kilitle" which calls `handleConfirmLock`, which skips `updatePagePackage(…, { qa_scores })` and proceeds directly to `updatePackageStatus(…, 'locked')`. The package becomes locked with stale or missing `qa_scores`, inconsistent with the expected post-lock state.

**Fix:** In the error phase, either skip the score persistence explicitly (acceptable) or persist whatever partial scores are available before locking:
```typescript
async function handleConfirmLock() {
  if (!pkg?.id) return
  startTransition(async () => {
    // Always attempt to persist whatever scores are available
    const scoresToSave = qaScores ?? {
      last_qa_run: new Date().toISOString(),
    }
    await updatePagePackage(projectId, page.id, { qa_scores: scoresToSave })

    const result = await updatePackageStatus(projectId, pkg.id, 'locked')
    // ...rest unchanged
  })
}
```

---

### WR-03: `title_max_length_enforced` project rule overlaps with base `QA-01`, causing duplicate penalty

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/QaBadge.tsx:60-64`

**Issue:** The base check `QA-01` fires a `warning` when `seoTitle.length > 60` (line 29). The project rule `title_max_length_enforced` independently fires an `error` when `seoTitle.length > 60` (line 62). When both are active (default), a title of 65 characters produces two violations: `QA-01: warning` and `title_max_length_enforced: error`. `computeSeoScore` deducts 10 for the warning and 20 for the error, penalising 30 points when the actual violation is a single condition. The SEO score can reach 0 when only one or two real violations exist.

**Fix:** Skip the base `QA-01` warning when `title_max_length_enforced` is active, or make `title_max_length_enforced` replace rather than supplement `QA-01`:
```typescript
// QA-01: SEO Title length — skip if project rule covers this
if (!props.projectRules['title_max_length_enforced']) {
  if (props.seoTitle.length > 70) {
    rules.push({ id: 'QA-01', severity: 'error' })
  } else if (props.seoTitle.length > 60) {
    rules.push({ id: 'QA-01', severity: 'warning' })
  }
}
```

---

### WR-04: `computeSchemaScore` returns 50 for syntactically invalid JSON-LD

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx:399-407`

**Issue:** When `schemaJsonLd` is non-empty but fails `JSON.parse`, the function returns `50`. An invalid schema is non-functional (browsers and Google will reject it), yet it contributes 50 points to the readiness score, inflating it above what it should be.

**Fix:**
```typescript
function computeSchemaScore(schemaJsonLdVal: string): number {
  if (!schemaJsonLdVal.trim()) return 0
  try {
    JSON.parse(schemaJsonLdVal)
    return 100
  } catch {
    return 0   // invalid JSON-LD is not functional
  }
}
```

---

### WR-05: Missing `user_id` filter on `page_packages` query in list panel

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx:94-100`

**Issue:** The query that builds `packageMap` does not include `.eq('user_id', user.id)`. While `pageIds` are derived from a user-scoped `pages` query, the defence-in-depth layer at the `page_packages` level is absent. If a page_id were shared or leaked (e.g. through a DB misconfiguration or multi-tenant edge case), packages owned by another user could surface in the sidebar.

**Fix:**
```typescript
const { data } = await supabase
  .from('page_packages')
  .select('id, page_id, status, generated_by')
  .in('page_id', pageIds)
  .eq('user_id', user.id)   // add this
```

---

### WR-06: `ANTHROPIC_API_KEY` absence produces opaque 502 instead of startup error

**File:** `src/app/api/ai/qa-audit/route.ts:5`

**Issue:** `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` is evaluated at module load time. If `ANTHROPIC_API_KEY` is undefined, the SDK accepts `undefined` silently and the failure surfaces only at the first API call as a 502 with message "Claude API error", with no indication in logs that the API key is missing. This makes misconfigured deployments hard to diagnose.

**Fix:**
```typescript
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is not set')
}
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
```

---

## Info

### IN-01: `meta_desc_length_enforced` threshold (160) differs from `Field` maxLen (155)

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/QaBadge.tsx:99-104` and `PagePackageEditor.tsx:921`

**Issue:** The field counter caps meta description at 155 characters (`maxLen={155}`), turning red at that point. But `meta_desc_length_enforced` only fires a warning at `> 160`. A user who stays under 155 (the field cap) will never see the project-rule warning, but the thresholds are inconsistent and could mislead users who read one without the other.

**Suggestion:** Align both thresholds to 155, or document the intent of the 160 limit explicitly.

---

### IN-02: New rules in `RULE_META` silently default to enabled for all users

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx:77`

**Issue:** `(globalValues[ruleKey] ?? 'true') === 'true'` means any rule key present in `RULE_META` but absent from the `rules` table defaults to active. Adding a new rule to `RULE_META` instantly enforces it on all users who have never seen or configured it. This is not a bug per se, but the silent opt-in behaviour is worth a comment in the code.

**Suggestion:** Add a comment noting the default-enabled design decision, or consider defaulting from `RULE_META` default values rather than a hardcoded `'true'` string.

---

### IN-03: Unsafe cast of `req.json()` result before field extraction

**File:** `src/app/api/ai/qa-audit/route.ts:21`

**Issue:** `body as { packageId?: string; projectId?: string }` casts `unknown` without structural validation. If the body contains `{ packageId: 123 }` (number instead of string), the subsequent Supabase queries will receive a number, which will silently return no rows and produce a 404 rather than a 400 with a meaningful error.

**Suggestion:**
```typescript
const packageId = typeof (body as Record<string, unknown>).packageId === 'string'
  ? (body as Record<string, unknown>).packageId as string
  : undefined
const projectId = typeof (body as Record<string, unknown>).projectId === 'string'
  ? (body as Record<string, unknown>).projectId as string
  : undefined
```

---

### IN-04: `handleAiGenerate` stream decoder may accumulate partial multi-byte characters

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx:334`

**Issue:** `decoder.decode(value, { stream: true })` is correct for streaming, but the final `decode()` call after the loop is missing. Without a final `decoder.decode()` (no arguments) after `done`, any incomplete multi-byte UTF-8 sequence at the very end of the stream is silently dropped. For ASCII-only AI responses this is harmless; for Turkish content (ş, ğ, ü etc.) in the last few bytes it could corrupt the final character.

**Suggestion:**
```typescript
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  accumulated += decoder.decode(value, { stream: true })
}
accumulated += decoder.decode() // flush remaining bytes
```

---

_Reviewed: 2026-04-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
