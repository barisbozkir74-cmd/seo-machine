---
phase: 13-wordpress-publishing
plan: "05"
subsystem: wordpress-ui
tags: [wordpress, publish-dialog, client-component, ui, html-ready-banner, content-studio]
dependency_graph:
  requires:
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts (publishToWordPress + PublishResult — Plan 04)
    - src/lib/supabase/vault.ts (hasWordPressCredentials — Plan 02)
    - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx (existing — extended)
    - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/ContentStudioShell.tsx (existing — extended)
    - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/page.tsx (existing — extended)
  provides:
    - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/PublishDialog.tsx: PublishDialog client component
    - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx: 3-state WP publish banner
  affects:
    - Content Studio UI — users can now trigger WordPress publishing from HtmlReadyBanner
tech_stack:
  added: []
  patterns:
    - "PublishDialog: Dialog + fieldset/legend RadioGroup pattern (no asChild, no DialogTrigger)"
    - "HtmlReadyBanner 3-state: not-sent (buton + dialog) / publish (yayında link) / draft (taslak link)"
    - "localWpPostUrl/localWpStatus optimistic local state — updated on publishToWordPress success without revalidatePath"
    - "isWpConfigured SSR boolean from hasWordPressCredentials → disabled button with title tooltip"
    - "aria-busy on submit button, fieldset + legend sr-only for RadioGroup accessibility"
key_files:
  created:
    - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/PublishDialog.tsx
  modified:
    - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx
    - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/ContentStudioShell.tsx
    - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/page.tsx
decisions:
  - "localWpPostUrl/localWpStatus used for optimistic UI update — revalidatePath not called on success, banner updates instantly from onSuccess callback"
  - "PublishDialog resets to 'publish' default and clears error on every open cycle"
  - "isPending guard on handleOpenChange prevents dialog close during in-flight network call"
  - "isWpConfigured SSR call placed after resolvedRules computation, before locked-package guard — boolean passes through to ContentStudioShell regardless of lock state"
metrics:
  duration_seconds: 148
  completed_date: "2026-04-26"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 13 Plan 05: PublishDialog + HtmlReadyBanner WP Publish UI Summary

**One-liner:** PublishDialog client component with RadioGroup publish/draft selection and 3-state HtmlReadyBanner (not-sent/yayında/taslak) wired to publishToWordPress server action via isWpConfigured SSR gate.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | PublishDialog.tsx — yeni client component oluştur | 70bd947 | src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/PublishDialog.tsx |
| 2 | HtmlReadyBanner + ContentStudioShell + page.tsx güncelle | 63925e7 | HtmlReadyBanner.tsx, ContentStudioShell.tsx, icerik-studio/page.tsx |

## What Was Built

### Task 1: PublishDialog.tsx

New `'use client'` component `PublishDialog` with:

- **Props:** `projectId`, `pageId`, `open`, `onOpenChange`, `onSuccess(wpPostUrl, wpStatus)`
- **State:** `publishStatus` ('publish' default), `isPending`, `error`
- **RadioGroup:** `<fieldset>` + `<legend className="sr-only">Yayın seçeneği</legend>` for accessibility — native `<input type="radio">` elements inside `<label>` wrappers
- **Submit:** Calls `publishToWordPress(projectId, pageId, publishStatus)` — handles `result.success` discriminated union
- **Spinner:** `Loading03Icon` with `animate-spin` + "Gönderiliyor..." text in pending state
- **Error handling:** Error message as `text-xs text-destructive`, button label changes to "Tekrar Dene"
- **Close guard:** `handleOpenChange` returns early when `isPending` — dialog cannot be closed mid-flight
- **Reset on close:** `setError(null)` + `setPublishStatus('publish')` when dialog closes
- **Constraints respected:** No `asChild`, no `font-medium`, `aria-busy` on submit button

### Task 2: HtmlReadyBanner.tsx — 3-state extension

Fully rewritten with three conditional render paths:

1. **Yayında** (`localWpStatus === 'publish'` + `localWpPostUrl` truthy): Emerald banner with "Sayfayı Görüntüle" link + `Link03Icon`, `aria-label` on anchor
2. **Taslak** (`localWpStatus === 'draft'` + `localWpPostUrl` truthy): Slate banner with "Sayfayı Görüntüle" link
3. **Henüz gönderilmemiş** (default): Emerald banner + "WordPress'e Gönder" button (disabled when `!isWpConfigured`, tooltip via `title`) + `PublishDialog` rendered alongside

Local state (`localWpPostUrl`, `localWpStatus`) initialized from SSR props — updated optimistically via `handlePublishSuccess` callback from `PublishDialog.onSuccess`.

### ContentStudioShell.tsx — 3 changes

- `PackageData` type: added `wp_post_url: string | null`, `wp_status: string | null`
- `ContentStudioShellProps`: added `isWpConfigured: boolean`
- Function signature: destructures `isWpConfigured`; `HtmlReadyBanner` render updated to pass `projectId`, `pageId`, `wpPostUrl={pkg.wp_post_url}`, `wpStatus={pkg.wp_status}`, `isWpConfigured`

### icerik-studio/page.tsx — 3 changes

- `PackageData` type: added `wp_post_url`, `wp_status`, `wp_post_id`
- SELECT query: extended with `, wp_post_url, wp_status, wp_post_id`
- SSR: `import { hasWordPressCredentials }` + `const isWpConfigured = await hasWordPressCredentials(id)` before locked-guard; `isWpConfigured` passed to `ContentStudioShell`

## Verification Results

| Check | Result |
|-------|--------|
| `export function PublishDialog` in PublishDialog.tsx | 1 match — PASS |
| `Loading03Icon` in PublishDialog.tsx | 2 matches (import + usage) — PASS |
| `fieldset` in PublishDialog.tsx | 3 matches (open + legend + close) — PASS |
| `asChild` in PublishDialog.tsx | 0 matches — PASS |
| `font-medium` in HtmlReadyBanner.tsx | 0 matches — PASS |
| `wp_post_url` in page.tsx SELECT string | 1 match — PASS |
| `isWpConfigured` in ContentStudioShell.tsx | 3 matches (type + destructure + prop pass) — PASS |
| `hasWordPressCredentials` in page.tsx | 2 matches (import + SSR call) — PASS |

## Security Verification

| Threat | Status |
|--------|--------|
| T-13-05-01: credentials in client bundle | CLEAN — PublishDialog passes only projectId/pageId/status to server action |
| T-13-05-02: localState tampering | ACCEPTED — optimistic update, risk accepted per threat register |
| T-13-05-03: wp_post_url disclosure | ACCEPTED — public WP URL, no risk |
| T-13-05-04: projectId/pageId spoofing | INHERITED from Plan 04 — verifyOwnership + getUser() guard in server action |

## Deviations from Plan

None — plan executed exactly as written. All component code matches the plan's `<action>` blocks verbatim with no structural changes.

## Known Stubs

None. `isWpConfigured` flows from a real Vault check. `localWpPostUrl`/`localWpStatus` are initialized from SSR-fetched `pkg.wp_post_url`/`pkg.wp_status` and updated from real `publishToWordPress` response. No hardcoded empty values or placeholder data.

## Threat Flags

None — no new security surface beyond what the plan's threat model covers. The only outbound call is via `publishToWordPress` server action (Plan 04), which has its own threat mitigations.

## Self-Check

- [x] `PublishDialog.tsx` — created and committed (70bd947)
- [x] `HtmlReadyBanner.tsx` — rewritten and committed (63925e7)
- [x] `ContentStudioShell.tsx` — updated and committed (63925e7)
- [x] `icerik-studio/page.tsx` — updated and committed (63925e7)
- [x] `export function PublishDialog`: 1 match
- [x] `Loading03Icon`: 2 matches
- [x] `fieldset`: 3 matches
- [x] `asChild`: 0 matches
- [x] `font-medium` in HtmlReadyBanner: 0 matches
- [x] `wp_post_url` in SELECT: 1 match
- [x] `isWpConfigured` in ContentStudioShell: 3 matches
- [x] `hasWordPressCredentials` in page.tsx: 2 matches

## Self-Check: PASSED
