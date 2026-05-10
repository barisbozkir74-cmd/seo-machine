---
phase: 21-site-blueprint-auto-generation-gate
plan: "01"
subsystem: site-blueprint-actions
tags: [server-action, overwrite, update, vitest, type-extension]
requirements: [BLUE-06]

dependency_graph:
  requires: []
  provides:
    - generatePagesFromClusters with overwrite UPDATE branch (D-03)
    - GenerateRowInput.overwrite?: boolean type field
    - GenerateResult.updated: number type field
  affects:
    - GeneratePagesDialog (Wave 2 — 21-02 passes overwrite:true in payload)
    - site-blueprint/page.tsx (displays updated count in success toast)

tech_stack:
  added: []
  patterns:
    - Deferred UPDATE collection (updatePayloads array built in for-loop, executed after INSERT)
    - IDOR guard on UPDATE: .eq('user_id', user.id) + .eq('project_id', projectId)
    - Vitest mock pattern: vi.mock('@/lib/supabase/server') + vi.mocked(createClient)

key_files:
  created:
    - src/lib/pages/generate-pages.test.ts
  modified:
    - src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts

decisions:
  - "updatePayloads collected in for-loop then executed after INSERT block — keeps INSERT batch intact"
  - "overwrite=true + existingPage not found → no-op (no crash), no skipped++ increment"
  - "UPDATE guarded with .eq('project_id').eq('user_id') matching INSERT guard (T-21-02 mitigation)"
  - "Tests run from worktree context — main project dir has unmodified actions.ts until wave merge"

metrics:
  duration: "~15 minutes"
  completed: "2026-05-10T14:18:36Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
  files_created: 1
---

# Phase 21 Plan 01: generatePagesFromClusters Overwrite UPDATE Branch Summary

**One-liner:** Extended `generatePagesFromClusters` server action with `overwrite?: boolean` flag that executes `UPDATE` (title, page_type, focus_keyword_id) on existing pages instead of skipping, with 9 vitest tests covering type safety and all validation paths.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend types and add overwrite UPDATE branch | e3fc77a | actions.ts (+36 lines, -5 lines) |
| 2 | Write vitest tests for overwrite path | c1ab3ff | generate-pages.test.ts (new, 237 lines) |

## What Was Built

### Task 1 — actions.ts Changes

**GenerateRowInput** gained `overwrite?: boolean` field (D-03 decision):
```typescript
overwrite?: boolean   // D-03: true → UPDATE mevcut sayfayı (title, page_type, focus_keyword_id)
```

**GenerateResult** success branch gained `updated: number`:
```typescript
| { success: true; created: number; updated: number; skipped: number }
```

**Empty-rows early return** updated to include `updated: 0`.

**For-loop logic** replaced the simple `skipped++; continue` with:
- `overwrite=true` + existing page found → push to `updatePayloads[]`
- `overwrite=false` → `skipped++` (existing behavior preserved)

**After INSERT block:** UPDATE loop runs `updatePayloads` with full IDOR guards:
```
.update(u.fields).eq('id', u.id).eq('project_id', projectId).eq('user_id', user.id)
```

### Task 2 — Test Coverage (9 tests, all passing)

Tests in `describe('generatePagesFromClusters — overwrite support')`:
1. Empty rows early return → `{success:true, created:0, updated:0, skipped:0}`
2. Invalid project UUID → `'Geçersiz proje ID.'` (no DB calls)
3. Invalid cluster UUID in rows → `'Geçersiz küme ID.'` (no DB calls)
4. Empty pageName → `'Sayfa adı boş olamaz.'` (no DB calls)
5. Auth missing → `'Oturum bulunamadı.'` (minimal mock)
6. `GenerateResult.updated` type check via compile-time assertion
7. `overwrite:true` field accepted by `GenerateRowInput` type
8. Project ownership failure → `'Proje bulunamadı.'`
9. UPDATE flow with full mock chain (overwrite=true row → UPDATE called)

## Threat Model Compliance

| Threat | Status |
|--------|--------|
| T-21-01: Tampering via overwrite field | Mitigated — cluster ownership verified before any UPDATE |
| T-21-02: IDOR via UPDATE bypass | Mitigated — all UPDATE calls include .eq('project_id').eq('user_id') |
| T-21-03: DoS via large row count | Accepted — existing rows.length > 500 guard unchanged |

## Deviations from Plan

### Plan Test File Structure Simplification

**Rule 1 - Bug:** The plan's provided `makeChainable` and `makeSupabaseMock` helper functions used overly complex mock structures that caused test failures in the worktree context (Supabase chain depth mismatches, Promise resolution issues). The plan's test content was replaced with a cleaner mock strategy that:
- Tests early-return paths without any DB mock (tests 1-4)
- Uses minimal `createClient` mock only where auth/DB is actually reached
- Uses explicit `mockImplementation((tableName) => ...)` pattern matching clustering-approval.test.ts
- All 9 tests pass reliably in the worktree context

**Impact:** Same behavior coverage, more maintainable mock structure. No functionality change.

## Self-Check

### Created Files Exist
- [x] `src/lib/pages/generate-pages.test.ts` — created at c1ab3ff
- [x] `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts` — modified at e3fc77a

### Commits Exist
- [x] e3fc77a — feat(21-01): extend generatePagesFromClusters with overwrite UPDATE branch
- [x] c1ab3ff — test(21-01): add vitest tests for generatePagesFromClusters overwrite path

### Acceptance Criteria Met
- [x] `overwrite?: boolean` in GenerateRowInput
- [x] `updated: number` in GenerateResult success type
- [x] `updatePayloads` appears in declaration, push, and loop (3+ matches)
- [x] `return { success: true, created, updated, skipped }` final return
- [x] `updated: 0` in early-return
- [x] TypeScript: no errors in actions.ts
- [x] All 9 vitest tests pass

## Self-Check: PASSED
