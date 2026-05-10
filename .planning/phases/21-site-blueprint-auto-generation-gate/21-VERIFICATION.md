---
phase: 21-site-blueprint-auto-generation-gate
verified: 2026-05-10T16:08:30Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Verify 'Sistemi Kur' disabled state — open a project where keyword_strategy_approved=false, navigate to /projeler/{id}/keyword-stratejisi, confirm the 'Sistemi Kur' button is ghost-styled, dimmed (opacity-40), and non-clickable"
    expected: "Button renders with ghost variant, opacity-40 class, disabled attribute, tooltip reads 'Önce stratejiyi onaylayın'"
    why_human: "CSS opacity and disabled state behavior cannot be verified without browser rendering"
  - test: "Verify 'Sistemi Kur' active state — approve the strategy (click StratejiOnaylaButton), then confirm the button becomes filled/primary"
    expected: "Button changes to variant=default (filled dark background, white text), becomes clickable"
    why_human: "Requires database state change and visual rendering verification"
  - test: "Click 'Sistemi Kur' and verify dialog opens with correct rows — only approved clusters with primary_keyword_id appear; clusters already having pages show 'Zaten var' amber badge AND checkbox is active (not disabled)"
    expected: "Dialog opens with 'Kümelerden Sayfa Oluştur' title; alreadyExists rows show amber bg + 'Zaten var' badge; checkbox and input are NOT disabled when not pending"
    why_human: "Requires browser interaction with real DB data to verify alreadyExists flag computation and interactive row state"
  - test: "Include an alreadyExists row (check its checkbox) and verify footer counter updates"
    expected: "Footer counter changes from 'N sayfa oluşturulacak' to 'N sayfa oluşturulacak / güncellenecek'"
    why_human: "Dynamic state-based copy change requires browser interaction"
  - test: "Submit dialog and verify success flow — click 'Oluştur / Güncelle', confirm pending state ('Oluşturuluyor...'), then after success confirm success message appears and page navigates to /projeler/{id}/site-blueprint"
    expected: "Button reads 'Oluşturuluyor...' while pending; after success a green success message appears; page navigates to site-blueprint; blueprint page shows the newly created/updated pages"
    why_human: "Server action execution, navigation, and post-creation page state require browser testing with real Supabase DB"
  - test: "Open dialog on a project with 0 approved clusters and verify empty state copy"
    expected: "Dialog shows: 'Onaylanmış küme bulunamadı. Önce keyword stratejisi sayfasından kümeleme yapın.'"
    why_human: "Requires a project in specific state (no approved clusters) to trigger empty state"
---

# Phase 21: Site Blueprint Auto-Generation Gate Verification Report

**Phase Goal:** Kullanıcı keyword stratejisini onayladıktan sonra "Sistemi Kur" tetiklenince site blueprint onaylanan keyword gruplarından otomatik olarak oluşturulur
**Verified:** 2026-05-10T16:08:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | generatePagesFromClusters accepts overwrite field on each row and executes UPDATE instead of skip for matching rows | VERIFIED | actions.ts lines 250-269: if/overwrite branch builds updatePayloads[], executed after INSERT block (lines 301-310) with `.update(u.fields).eq('id').eq('project_id').eq('user_id')` |
| 2 | GenerateResult.updated field exists — success branch returns `{ success: true; created: number; updated: number; skipped: number }` | VERIFIED | actions.ts line 160: `\| { success: true; created: number; updated: number; skipped: number }` |
| 3 | When rows.length === 0, the early-return includes updated: 0 | VERIFIED | actions.ts line 180: `return { success: true, created: 0, updated: 0, skipped: 0 }` |
| 4 | Existing INSERT path and duplicate-skip path are unchanged for non-overwrite rows | VERIFIED | actions.ts lines 266-269: `else { skipped++ }` preserves original behavior; INSERT block (lines 271-298) unchanged |
| 5 | All overwrite UPDATE calls are guarded with .eq('user_id', user.id) and .eq('project_id', projectId) | VERIFIED | actions.ts lines 303-309: `.update(u.fields).eq('id', u.id).eq('project_id', projectId).eq('user_id', user.id)` |
| 6 | alreadyExists rows in GeneratePagesDialog are NOT disabled — only isPending disables inputs | VERIFIED | GeneratePagesDialog.tsx lines 177, 192: `disabled={isPending}` (not `r.alreadyExists \|\| isPending`) |
| 7 | When include=true and alreadyExists=true, overwrite:true is added to the payload | VERIFIED | GeneratePagesDialog.tsx line 110: `overwrite: rows[i].alreadyExists ? true : undefined` |
| 8 | Footer button always reads 'Oluştur / Güncelle'; footer counter reads 'oluşturulacak / güncellenecek' when any included row has alreadyExists=true | VERIFIED | Line 247: `'Oluştur / Güncelle'`; line 230: `{hasOverwrite ? 'oluşturulacak / güncellenecek' : 'oluşturulacak'}`; hasOverwrite computed line 94 |
| 9 | 'Sistemi Kur' button in KeywordStratejisiToolbar: disabled (ghost, opacity-40) when isStrategyApproved=false; variant=default when true; opens GeneratePagesDialog on click; keyword-stratejisi/page.tsx computes approvedDialogRows from approved clusters with primary_keyword_id and passes to toolbar | VERIFIED | Toolbar lines 55-78: conditional render with disabled ghost vs. active default variant; page.tsx lines 159-171: filter+map with `.filter((c) => c.status === 'approved' && c.primary_keyword_id !== null)`; line 223: `approvedDialogRows={approvedDialogRows}` |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts` | Extended generatePagesFromClusters with overwrite support | VERIFIED | File exists; contains `overwrite?: boolean` in GenerateRowInput (line 156), `updated: number` in GenerateResult (line 160), `updatePayloads` array (3 occurrences: declaration, push, loop), final return `{ success: true, created, updated, skipped }` (line 313) |
| `src/lib/pages/generate-pages.test.ts` | Vitest tests for the overwrite path | VERIFIED | File exists (237 lines); `describe('generatePagesFromClusters — overwrite support')` with 9 tests; all 9 pass (confirmed via `npx vitest run`) |
| `src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx` | Interactive alreadyExists rows, overwrite payload, updated footer, router.push, toast | VERIFIED | File exists; `useRouter` imported and used (line 4, 61, 130); `disabled={isPending}` only on inputs (lines 177, 192); overwrite payload (line 110); 'Oluştur / Güncelle' (line 247); hasOverwrite counter copy (line 230); `router.push` navigation (line 130); successMsg inline state (lines 60, 129) |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordStratejisiToolbar.tsx` | Sistemi Kur button + GeneratePagesDialog mount | VERIFIED | File exists; `approvedDialogRows: DialogRow[]` in props interface (line 17); `sistemiKurOpen` state (line 30); 'Sistemi Kur' appears 2 times in JSX (lines 62, 70); `GeneratePagesDialog` imported and mounted (lines 10, 73-78) |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` | approvedDialogRows SSR computation + pages alreadyExists query | VERIFIED | File exists; `pagesWithClusters` DB query (lines 122-131); `clusterIdsWithPages` Set (lines 129-131); `approvedDialogRows` computed (lines 159-171); prop passed to toolbar (line 223) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| keyword-stratejisi/page.tsx | KeywordStratejisiToolbar | approvedDialogRows prop | WIRED | Line 223: `approvedDialogRows={approvedDialogRows}` |
| KeywordStratejisiToolbar | GeneratePagesDialog | rows={approvedDialogRows} open={sistemiKurOpen} | WIRED | Lines 73-78: `<GeneratePagesDialog projectId={projectId} rows={approvedDialogRows} open={sistemiKurOpen} onOpenChange={setSistemiKurOpen} />` |
| GeneratePagesDialog handleSubmit | router.push | D-04: success → router.push('/projeler/${projectId}/site-blueprint') | WIRED | Line 130: `router.push(\`/projeler/${projectId}/site-blueprint\`)` after success check |
| GeneratePagesDialog handleSubmit | generatePagesFromClusters | overwrite: true in GenerateRowInput payload | WIRED | Line 110: `overwrite: rows[i].alreadyExists ? true : undefined` |
| generatePagesFromClusters | supabase pages table | .update(u.fields).eq('id').eq('project_id').eq('user_id') | WIRED | Lines 303-309: full IDOR-guarded UPDATE loop |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| keyword-stratejisi/page.tsx | approvedDialogRows | `supabase.from('pages').select('cluster_id').eq('project_id', id).eq('user_id', user.id)` + cluster query | Yes — real DB queries (lines 112-131) | FLOWING |
| GeneratePagesDialog | rows (DialogRow[]) | SSR prop from page.tsx (approvedDialogRows) | Yes — computed from real approved clusters filtered from DB | FLOWING |
| generatePagesFromClusters | updatePayloads / payloads | Supabase insert + update | Yes — real DB mutations with IDOR guards | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Empty rows early-return includes updated:0 | `npx vitest run src/lib/pages/generate-pages.test.ts` | 9/9 tests passed | PASS |
| TypeScript compiles with all new types | `npx tsc --noEmit` | No output (exit 0) | PASS |
| Commits exist for both waves | `git log --oneline \| grep e3fc77a\|c1ab3ff\|3e95c5b\|11179d2` | All 4 commits found | PASS |
| overwrite?: boolean in GenerateRowInput | grep in actions.ts line 156 | Match found | PASS |
| updated: number in GenerateResult | grep in actions.ts line 160 | Match found | PASS |
| updatePayloads 3+ occurrences | grep -c in actions.ts | 3 matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BLUE-06 | 21-01-PLAN.md, 21-02-PLAN.md | Onaylanan keyword stratejisinden "Sistemi Kur" tetiklenince site blueprint otomatik oluşturulur | SATISFIED | End-to-end flow implemented: disabled button gate (toolbar) → dialog with approved clusters → overwrite-aware server action → DB update/insert → router.push to blueprint |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

No TODO, FIXME, PLACEHOLDER, empty implementations, or hardcoded stub data found in any of the 5 modified/created files.

### Human Verification Required

#### 1. Sistemi Kur Disabled State

**Test:** Open a project where `keyword_strategy_approved = false`. Navigate to `/projeler/{id}/keyword-stratejisi`. Observe the "Sistemi Kur" button in the toolbar.
**Expected:** Button renders with ghost variant, dimmed appearance (opacity-40), disabled attribute set, title tooltip shows "Önce stratejiyi onaylayın". Clicking the button does nothing.
**Why human:** CSS visual state and disabled click-blocking requires browser rendering to confirm.

#### 2. Sistemi Kur Active State After Approval

**Test:** Click "Stratejiyi Onayla" button (or ensure `keyword_strategy_approved = true` in DB). Observe the "Sistemi Kur" button.
**Expected:** Button changes to variant=default (filled, dark background with white text), becomes clickable.
**Why human:** Requires database state change and visual rendering; conditional JSX rendering must be confirmed in live browser.

#### 3. Dialog Opens with Correct Rows + Interactive alreadyExists Rows

**Test:** Click "Sistemi Kur". Observe the GeneratePagesDialog.
**Expected:** Dialog opens titled "Kümelerden Sayfa Oluştur". Only approved clusters with primary keyword are listed. Clusters that already have pages show "Zaten var" amber badge AND amber row background. The checkbox and text input for alreadyExists rows are NOT grayed out — they are fully interactive.
**Why human:** Requires real DB data with approved clusters (some with existing pages) to verify alreadyExists flag computation and interactive row state.

#### 4. Footer Counter Updates Dynamically

**Test:** In the dialog, check the checkbox of an alreadyExists row.
**Expected:** Footer counter changes from "N sayfa oluşturulacak" to "N sayfa oluşturulacak / güncellenecek".
**Why human:** Dynamic React state-based copy change requires browser interaction to confirm.

#### 5. Submit Flow — Toast + Navigation + Blueprint Update

**Test:** Submit the dialog by clicking "Oluştur / Güncelle".
**Expected:** (a) Button label changes to "Oluşturuluyor..." while pending. (b) After success: green success message appears (e.g., "2 sayfa oluşturuldu, 1 güncellendi"). (c) Page navigates to `/projeler/{id}/site-blueprint`. (d) Blueprint page shows the newly created/updated pages.
**Why human:** Requires actual server action execution against Supabase, navigation lifecycle, and post-creation page rendering — not testable via static code analysis.

#### 6. Empty State Copy

**Test:** Open the dialog on a project that has no approved clusters (or clusters without primary_keyword_id).
**Expected:** Dialog body shows: "Onaylanmış küme bulunamadı. Önce keyword stratejisi sayfasından kümeleme yapın."
**Why human:** Requires a project in the specific state to trigger empty rendering path.

### Gaps Summary

No automated gaps found. All 9 must-haves verified in the codebase. Commits exist, TypeScript compiles clean, and 9 vitest tests pass.

The phase is pending human verification of the end-to-end browser flow (6 test scenarios). These tests cannot be automated as they require real Supabase data, browser rendering, and navigation lifecycle.

---

_Verified: 2026-05-10T16:08:30Z_
_Verifier: Claude (gsd-verifier)_
