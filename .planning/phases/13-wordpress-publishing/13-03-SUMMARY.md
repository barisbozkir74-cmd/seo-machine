---
phase: 13-wordpress-publishing
plan: "03"
subsystem: wordpress-ui
tags: [wordpress, client-component, form, vault, credentials, ui]
dependency_graph:
  requires:
    - src/lib/supabase/vault.ts (hasWordPressCredentials — Plan 02)
    - src/app/(dashboard)/projeler/[id]/actions.ts (saveWordPressCredentials — Plan 02)
  provides:
    - src/app/(dashboard)/projeler/[id]/wordpress-section.tsx: WordPressConnectionSection client component
    - src/app/(dashboard)/projeler/[id]/page.tsx: integrated WordPress connection section
  affects:
    - 13-05-PLAN (PublishDialog — isConfigured prop pattern from this component)
tech_stack:
  added: []
  patterns:
    - Client form with useState: wpUrl, appPassword, showPassword, saving, error, saved
    - SSR connection status: hasWordPressCredentials(id) called in Server Component before return
    - Badge className color assignment (no variant prop) — project-wide convention
    - Password toggle with onMouseDown e.preventDefault() to preserve input focus
    - Hugeicons free tier: Eye01Icon / EyeOff01Icon via HugeiconsIcon wrapper
key_files:
  created:
    - src/app/(dashboard)/projeler/[id]/wordpress-section.tsx
  modified:
    - src/app/(dashboard)/projeler/[id]/page.tsx
decisions:
  - WordPressConnectionSection placed after NotesSection with Separators on both sides — preserves existing page flow while adding WP section
  - Badge uses className color assignment (not variant prop) per project-wide UI-SPEC constraint
  - Password toggle uses onMouseDown+preventDefault instead of onClick to keep input focus during toggle
metrics:
  duration_seconds: 120
  completed_date: "2026-04-26"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 13 Plan 03: WordPress Connection UI Summary

**One-liner:** WordPressConnectionSection client component with masked password field, Badge status, and Eye01/EyeOff01 toggle integrated into project detail page via SSR hasWordPressCredentials check.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | WordPressConnectionSection client component oluştur | 7c8f84e | src/app/(dashboard)/projeler/[id]/wordpress-section.tsx |
| 2 | projeler/[id]/page.tsx — WordPressConnectionSection entegre et | 201c5b9 | src/app/(dashboard)/projeler/[id]/page.tsx |

## What Was Built

### Task 1: wordpress-section.tsx

New `'use client'` component `WordPressConnectionSection` with:

- **Props:** `projectId: string`, `isConfigured: boolean` (SSR-checked from Vault)
- **State:** `wpUrl`, `appPassword`, `showPassword`, `saving`, `error`, `saved` (initialized from `isConfigured`)
- **isDirty guard:** "Kaydet" button disabled when both fields are empty
- **Client-side validation:** URL must start with `https://`, appPassword must be non-empty — matches server-side validation in Plan 02 action
- **Server action call:** `saveWordPressCredentials(projectId, wpUrl, appPassword)` — inputs cleared on success, `saved` flipped to `true`
- **Badge:** `aria-live="polite"`, `className` color only (no variant prop) — emerald-500/20 when Bağlı, slate-800 when Yapılandırılmadı
- **Password toggle:** `Eye01Icon` / `EyeOff01Icon` via `HugeiconsIcon`, absolute-positioned ghost Button with `onMouseDown(e.preventDefault())` to retain input focus
- **Touch target:** Kaydet button has `min-h-[44px]`
- **Accessibility:** `htmlFor`/`id` pairs on all labels, `aria-label` on password input and toggle button

### Task 2: page.tsx integration

Three changes applied to the Server Component:

1. **Import block:** Added `hasWordPressCredentials` from `@/lib/supabase/vault` and `WordPressConnectionSection` from `./wordpress-section`
2. **SSR fetch:** `const isWpConfigured = await hasWordPressCredentials(id)` — called before return, after stages/notes fetches
3. **JSX:** `<WordPressConnectionSection projectId={project.id} isConfigured={isWpConfigured} />` rendered between two `<Separator className="my-8" />` elements, after the Notes section and before StageTransition

## Verification Results

| Check | Result |
|-------|--------|
| `export function WordPressConnectionSection` in wordpress-section.tsx | 1 match — PASS |
| `WordPressConnectionSection` import + render in page.tsx | 2 matches — PASS |
| `hasWordPressCredentials` import + SSR call in page.tsx | 2 matches — PASS |
| Badge `variant` prop in wordpress-section.tsx | 0 matches — PASS |
| `font-medium` in wordpress-section.tsx | 0 matches — PASS |
| `min-h-[44px]` on Kaydet button | 1 match — PASS |

Note: `variant="ghost"` appears once in the file — on the password toggle `<Button>`, not on `<Badge>`. Ghost variant on Button is correct per UI-SPEC ("göster/gizle toggle: ghost Button").

## Security Verification

| Threat | Status |
|--------|--------|
| T-13-03-01: appPassword in DOM | MITIGATED — type="password" by default; state value never rendered as text |
| T-13-03-02: Spoofing | INHERITED from Plan 02 — server action has getUser() + ownership check |
| T-13-03-03: hasWordPressCredentials leaks credentials | SAFE — returns boolean only |
| T-13-03-04: projectId tampering | INHERITED from Plan 02 — eq('user_id', user.id) in server action |

## Deviations from Plan

None — plan executed exactly as written. The component code in the plan's `<action>` block was implemented verbatim with no structural changes.

## Known Stubs

None. The `isConfigured` prop flows from a real Vault check (`hasWordPressCredentials`). Badge text and color are data-driven. No hardcoded placeholder data.

## Threat Flags

None — no new security surface beyond what the plan's threat model covers. The component renders only boolean-derived UI state; credentials never flow back to the DOM beyond the masked input field.

## Self-Check

- [x] `src/app/(dashboard)/projeler/[id]/wordpress-section.tsx` — created and committed (7c8f84e)
- [x] `src/app/(dashboard)/projeler/[id]/page.tsx` — modified and committed (201c5b9)
- [x] `export function WordPressConnectionSection`: 1 match
- [x] `WordPressConnectionSection` in page.tsx: 2 matches (import + render)
- [x] `hasWordPressCredentials` in page.tsx: 2 matches (import + SSR call)
- [x] Badge variant prop: 0 matches
- [x] font-medium: 0 matches
- [x] min-h-[44px]: 1 match

## Self-Check: PASSED
