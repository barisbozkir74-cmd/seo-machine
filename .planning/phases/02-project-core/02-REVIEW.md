---
phase: 02-project-core
reviewed: 2026-04-22T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/app/(dashboard)/dashboard/page.tsx
  - src/app/(dashboard)/projeler/[id]/actions.ts
  - src/app/(dashboard)/projeler/[id]/notes-section.tsx
  - src/app/(dashboard)/projeler/[id]/page.tsx
  - src/app/(dashboard)/projeler/[id]/stage-transition.tsx
  - src/app/(dashboard)/projeler/actions.ts
  - src/app/(dashboard)/projeler/new-project-modal.tsx
  - src/app/(dashboard)/projeler/page.tsx
  - src/components/ui/badge.tsx
  - src/components/ui/dialog.tsx
  - src/components/ui/separator.tsx
  - src/components/ui/table.tsx
  - src/components/ui/textarea.tsx
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the full project-core phase output: server actions for project/stage/note management, the project detail page, project list page, modal, and all referenced UI primitives. The UI components (badge, dialog, separator, table, textarea) are clean wrappers with no issues.

The primary concern is an authorization gap in the project detail page: the Supabase query that fetches project data does not filter by `user_id`, so any authenticated user who knows (or guesses) a project UUID can view another user's project details. The stages query on the same page has the same gap.

A secondary logic bug exists in `advanceStage`: the Supabase `.update()` call that marks a stage as completed will return no error even when zero rows are matched (e.g., the stage ID doesn't belong to the authenticated user, or the stage is already completed). The action then continues and returns `success: true`, meaning the caller receives a false success signal.

---

## Critical Issues

### CR-01: Project Detail Page Fetches Project Without User Ownership Check

**File:** `src/app/(dashboard)/projeler/[id]/page.tsx:46-54`
**Issue:** The Supabase query that fetches the project does not include `.eq('user_id', user.id)`. Any authenticated user who knows or can guess a project UUID can access the full project detail page — including name, domain, sector, notes, and all stage/audit data. Row-Level Security (RLS) on the `projects` table may mitigate this at the DB layer, but the application code should enforce ownership explicitly as a defense-in-depth measure. The stages query on lines 56-60 has the same omission.

**Fix:**
```typescript
// line 46 — add user_id filter to project fetch
const { data: project } = await supabase
  .from('projects')
  .select(
    'id, name, domain, sector, target_country, target_language, business_model, site_type, brand_tone, notes, created_at'
  )
  .eq('id', id)
  .eq('user_id', user.id)   // <-- add this
  .single()

// line 56 — add user_id filter to stages fetch
const { data: stages } = await supabase
  .from('stages')
  .select('id, stage_name, status, started_at, completed_at')
  .eq('project_id', id)
  .eq('user_id', user.id)   // <-- add this
  .order('created_at', { ascending: true })
```

Note: the `user` variable is already available at this point (line 43-45), so no additional auth call is needed. Also move the `notFound()` check to after the user auth check so an unauthenticated user gets a redirect rather than a 404.

---

## Warnings

### WR-01: `advanceStage` Returns Success When Zero Rows Are Affected

**File:** `src/app/(dashboard)/projeler/[id]/actions.ts:25-38`
**Issue:** The Supabase `.update()` call that marks a stage as `completed` does not use `.select()`, so it returns `{ error: null }` even when the `.eq()` filters match zero rows (i.e., the stage is already completed, or `currentStageId` does not belong to `user.id`/`projectId`). When this happens, `completeError` is `null`, execution falls through, no next stage is found, `isLastStage` becomes `true`, and the caller receives `{ success: true, isLastStage: true }` — a false positive. A user could supply an arbitrary `currentStageId` from another project and get a success response.

**Fix:** Use `.select('id')` on the update and verify that at least one row was returned:
```typescript
const { data: updated, error: completeError } = await supabase
  .from('stages')
  .update({
    status: 'completed',
    completed_at: new Date().toISOString(),
  })
  .eq('id', currentStageId)
  .eq('project_id', projectId)
  .eq('user_id', user.id)
  .eq('status', 'active')
  .select('id')

if (completeError || !updated || updated.length === 0) {
  return { success: false, error: 'Aşama tamamlanamadı. Lütfen tekrar deneyin.' }
}
```

### WR-02: Unhandled Promise Rejection in `NotesSection.handleSubmit`

**File:** `src/app/(dashboard)/projeler/[id]/notes-section.tsx:25-40`
**Issue:** The `handleSubmit` function uses `try/finally` but has no `catch` block. If the `addNote` server action throws (e.g., network failure, fetch abort), the exception propagates to the browser uncaught. The `isPending` state is correctly reset in `finally`, but the user sees no error message — the button just re-enables silently.

**Fix:** Add a `catch` block:
```typescript
const handleSubmit = async () => {
  setIsPending(true)
  setError(null)
  try {
    const result = await addNote(stageId, projectId, content)
    if (result.success) {
      setContent('')
    } else {
      setError(result.error)
    }
  } catch {
    setError('Bağlantı hatası. Lütfen tekrar deneyin.')
  } finally {
    setIsPending(false)
  }
}
```

### WR-03: `StageTransition` Shows Completion Banner When Project Has No Stages

**File:** `src/app/(dashboard)/projeler/[id]/stage-transition.tsx:47-55`
**Issue:** The early-return guard is `if (isLastStage || !activeStage)`. When a project has zero stages (`stageList` is empty), `activeStage` is `null` and `isLastStage` is `false` — so `!activeStage` is true and the "Tüm aşamalar tamamlandı" banner renders. This is semantically incorrect: a project with no stages has not completed anything. While the current data model always creates 10 stages, this is a fragile assumption.

**Fix:** Separate the two conditions with distinct UI:
```typescript
if (!activeStage && !isLastStage) {
  return null // or a neutral "no active stage" placeholder
}
if (isLastStage) {
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
      <p className="text-sm text-emerald-400">
        Tüm aşamalar tamamlandı. Proje yayın sonrası takibindedir.
      </p>
    </div>
  )
}
```

---

## Info

### IN-01: Zod Schema Duplicated Between Server Action and Client Form

**File:** `src/app/(dashboard)/projeler/actions.ts:20-33` and `src/app/(dashboard)/projeler/new-project-modal.tsx:30-43`
**Issue:** The validation schema (`name`, `domain`, and all optional fields with identical constraints) is defined twice — once in the server action file and once in the modal. If a constraint changes (e.g., `name` max length), it must be updated in both places.

**Fix:** Extract the shared schema to a co-located schema file (e.g., `src/app/(dashboard)/projeler/schema.ts`) and import it in both `actions.ts` and `new-project-modal.tsx`.

### IN-02: `getDurum` Returns 'Aktif' for Projects With No Stages

**File:** `src/app/(dashboard)/projeler/page.tsx:59-63`
**Issue:** When `stages.length === 0`, the function returns `'Aktif'`. This is an edge case tied to IN-01 above — the data model guarantees stages exist — but the label is misleading if it ever fires. Minor, but worth making the intent explicit.

**Fix:**
```typescript
function getDurum(stages: Stage[]): 'Aktif' | 'Tamamlandı' {
  if (stages.length === 0) return 'Aktif' // no stages — treat as in-progress
  return stages.every((s) => s.status === 'completed') ? 'Tamamlandı' : 'Aktif'
}
```
Alternatively, add a third status value `'Başlamadı'` to cover the empty case explicitly.

### IN-03: `StageTransition` Network Error Also Silently Discarded

**File:** `src/app/(dashboard)/projeler/[id]/stage-transition.tsx:30-44`
**Issue:** Same pattern as WR-02 — `try/finally` without `catch`. If `advanceStage` throws, `isPending` resets but `error` stays `null` and the user sees nothing.

**Fix:**
```typescript
} catch {
  setError('Bağlantı hatası. Lütfen tekrar deneyin.')
} finally {
  setIsPending(false)
}
```

---

_Reviewed: 2026-04-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
