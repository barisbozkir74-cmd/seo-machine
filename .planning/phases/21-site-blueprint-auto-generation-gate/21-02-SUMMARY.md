---
phase: 21-site-blueprint-auto-generation-gate
plan: "02"
subsystem: site-blueprint-ui
tags: [ui, dialog, toolbar, ssr, router-push, overwrite]
requirements: [BLUE-06]

dependency_graph:
  requires:
    - 21-01 (generatePagesFromClusters overwrite UPDATE branch + GenerateResult.updated)
  provides:
    - GeneratePagesDialog interactive alreadyExists rows (D-08)
    - overwrite:true in dialog payload (D-03)
    - Oluştur / Güncelle footer + oluşturulacak / güncellenecek counter (UI-SPEC)
    - router.push to site-blueprint after success (D-04)
    - Sistemi Kur button in KeywordStratejisiToolbar (D-01)
    - approvedDialogRows SSR computation in keyword-stratejisi/page.tsx (D-02, D-06)
  affects:
    - keyword-stratejisi page user flow (strategy approval → dialog → blueprint)
    - site-blueprint page (navigation target after successful generation)

tech_stack:
  added: []
  patterns:
    - useRouter from next/navigation for client-side navigation after server action
    - successMsg inline state (no sonner dependency — project has no toast library)
    - Zero-query approach for keywordIdToText — reuse existing keywords[] array
    - alreadyExists computed server-side via pages Set (D-06)
    - SSR prop passing pattern: approvedDialogRows computed in page.tsx → passed to toolbar → dialog

key_files:
  created: []
  modified:
    - src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx
    - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordStratejisiToolbar.tsx
    - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx

decisions:
  - "successMsg inline state used instead of toast library (sonner not in package.json)"
  - "approvedDialogRows computed in page.tsx SSR — clusters already queried, zero extra network cost"
  - "keywordIdToText built from existing keywords[] — zero-query approach avoids N+1"
  - "sistemiKurOpen state in toolbar (not page) — keeps dialog lifecycle local to toolbar client component"

metrics:
  duration: "~20 minutes"
  completed: "2026-05-10T15:00:00Z"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 3
  files_created: 0
  status: awaiting-checkpoint
---

# Phase 21 Plan 02: UI Wave — Sistemi Kur + GeneratePagesDialog Update Summary

**One-liner:** Wired the complete "Sistemi Kur" end-to-end flow — GeneratePagesDialog updated with interactive alreadyExists rows and overwrite payload, KeywordStratejisiToolbar gains the "Sistemi Kur" button, and keyword-stratejisi/page.tsx computes approvedDialogRows SSR from approved clusters + DB pages query.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update GeneratePagesDialog — interactive rows, overwrite, footer, navigation | 3e95c5b | GeneratePagesDialog.tsx (+23/-9) |
| 2 | Add Sistemi Kur to toolbar + approvedDialogRows in page.tsx | 11179d2 | KeywordStratejisiToolbar.tsx, page.tsx (+75) |
| 3 | CHECKPOINT: human-verify | — | Awaiting human verification |

## What Was Built

### Task 1 — GeneratePagesDialog.tsx

**Change 1: alreadyExists rows no longer disabled (D-08)**
- Old: `const disabled = r.alreadyExists || isPending`
- New: Only `isPending` disables input/select elements
- Checkbox was already `disabled={isPending}` — unchanged

**Change 2: overwrite field in payload (D-03)**
```typescript
overwrite: rows[i].alreadyExists ? true : undefined
```

**Change 3: footer counter copy (UI-SPEC)**
```typescript
const hasOverwrite = state.some((r, i) => r.include && rows[i]?.alreadyExists)
// → "{N} sayfa {hasOverwrite ? 'oluşturulacak / güncellenecek' : 'oluşturulacak'}"
```

**Change 4: footer button label (D-08)**
- Always renders: `Oluştur / Güncelle`
- Pending state: `Oluşturuluyor…` (unchanged)

**Change 5: navigation after success (D-04)**
```typescript
router.push(`/projeler/${projectId}/site-blueprint`)
```
- successMsg inline state added (no sonner library in project)

**Change 6: empty state copy (D-02)**
- Old: "Kümelenmiş keyword bulunamadı..."
- New: "Onaylanmış küme bulunamadı. Önce keyword stratejisi sayfasından kümeleme yapın."

### Task 2 — KeywordStratejisiToolbar.tsx

**Sistemi Kur button (D-01, UI-SPEC):**
- `isStrategyApproved=false`: `variant="ghost"`, `disabled`, `opacity-40`, `title="Önce stratejiyi onaylayın"`
- `isStrategyApproved=true`: `variant="default"` (filled primary), `onClick={() => setSistemiKurOpen(true)}`

**GeneratePagesDialog mount:**
```tsx
<GeneratePagesDialog
  projectId={projectId}
  rows={approvedDialogRows}
  open={sistemiKurOpen}
  onOpenChange={setSistemiKurOpen}
/>
```

### Task 2 — keyword-stratejisi/page.tsx

**D-06: pages query for alreadyExists:**
```typescript
const { data: pagesWithClusters } = await supabase
  .from('pages')
  .select('cluster_id')
  .eq('project_id', id).eq('user_id', user.id)
  .not('cluster_id', 'is', null)
const clusterIdsWithPages = new Set(...)
```

**D-02: approvedDialogRows computation:**
```typescript
const approvedDialogRows: DialogRow[] = clustersWithKeywords
  .filter((c) => c.status === 'approved' && c.primary_keyword_id !== null)
  .map((c) => ({ ..., alreadyExists: clusterIdsWithPages.has(c.id) }))
```

**Zero-query keywordIdToText:** Built from existing `keywords[]` array (no additional DB query).

## Deviations from Plan

### Auto-resolved: Toast library not present

**Found during:** Task 1 verification (grep for sonner)

**Issue:** Plan indicated "check if sonner is used" — it is not in package.json and no imports found.

**Fix:** Used `const [successMsg, setSuccessMsg] = useState<string | null>(null)` inline state approach. Success message renders as `<p className="text-sm text-emerald-400">` below error line. Navigation still happens via `router.push`.

**Files modified:** GeneratePagesDialog.tsx

**Rule:** Rule 3 (auto-fix blocking issue) — chose one consistent approach per plan instructions.

## Threat Model Compliance

| Threat | Status |
|--------|--------|
| T-21-04: Tampering via clusterId | Mitigated — generatePagesFromClusters validates cluster ownership server-side (Plan 01) |
| T-21-05: alreadyExists spoofing | Accepted — informational only, actual authority in server action |
| T-21-06: approvedDialogRows info disclosure | Accepted — user-visible data on same page |

## Known Stubs

None — all data is wired from real DB queries.

## Self-Check

### Modified Files Exist
- [x] `src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx` — modified at 3e95c5b
- [x] `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordStratejisiToolbar.tsx` — modified at 11179d2
- [x] `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` — modified at 11179d2

### Commits Exist
- [x] 3e95c5b — feat(21-02): update GeneratePagesDialog — interactive alreadyExists rows, overwrite payload, footer, navigation
- [x] 11179d2 — feat(21-02): add Sistemi Kur button to toolbar + approvedDialogRows SSR computation

### Acceptance Criteria Met (Tasks 1-2)
- [x] `disabled={isPending}` only on input/select (alreadyExists no longer disables)
- [x] `overwrite: rows[i].alreadyExists ? true : undefined` in payload
- [x] Footer button: "Oluştur / Güncelle" (always)
- [x] Footer counter: "oluşturulacak / güncellenecek" when hasOverwrite
- [x] `router.push('/projeler/${projectId}/site-blueprint')` after success
- [x] Empty state: "Onaylanmış küme bulunamadı..."
- [x] `hasOverwrite` appears 2+ times
- [x] `approvedDialogRows: DialogRow[]` in toolbar interface
- [x] "Sistemi Kur" appears 2+ times in toolbar
- [x] `sistemiKurOpen` state declared + used in button + dialog
- [x] `GeneratePagesDialog` imported + used in toolbar
- [x] `approvedDialogRows` declared + passed to toolbar
- [x] `clusterIdsWithPages` Set declared + used in filter
- [x] `.filter((c) => c.status === 'approved' && c.primary_keyword_id !== null)`
- [x] `stripIntentSuffix` function defined + used
- [x] `intentToPageType` imported + used
- [x] TypeScript compilation: no errors (tsc --noEmit exits clean)

## Self-Check: PASSED

## Checkpoint Status

**Task 3 (human-verify):** AWAITING — requires browser testing of complete Sistemi Kur flow.
