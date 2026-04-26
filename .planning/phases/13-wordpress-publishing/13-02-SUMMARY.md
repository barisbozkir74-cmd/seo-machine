---
phase: 13-wordpress-publishing
plan: "02"
subsystem: vault-credentials
tags: [vault, server-action, wordpress, credentials, security]
dependency_graph:
  requires:
    - src/lib/supabase/vault.ts (existing getDataForSeoCredentials pattern)
    - src/app/(dashboard)/projeler/[id]/actions.ts (existing auth/ownership pattern)
  provides:
    - vault.ts: saveWpCredentials, getWordPressCredentials, hasWordPressCredentials
    - actions.ts: saveWordPressCredentials, SaveWpCredentialsResult
  affects:
    - 13-03-PLAN (WP credentials UI — imports saveWordPressCredentials)
    - 13-04-PLAN (publishToWordPress — imports getWordPressCredentials)
tech_stack:
  added: []
  patterns:
    - Vault upsert: maybeSingle() check → rpc vault.update_secret or vault.create_secret
    - Server Action ownership: getUser() + eq('user_id') ownership check pattern
    - Security catch: generic error message — appPassword never exposed in responses
key_files:
  created: []
  modified:
    - src/lib/supabase/vault.ts
    - src/app/(dashboard)/projeler/[id]/actions.ts
decisions:
  - vault.ts upsert uses maybeSingle() (not single()) to avoid error on missing key — consistent with existing codebase pattern
  - appPassword appears in parameter names and return type only; never interpolated into error strings (T-13-02-01)
  - catch block in saveWordPressCredentials returns generic Turkish error — vault error details never surface to client (T-13-02-01)
metrics:
  duration_seconds: 87
  completed_date: "2026-04-26"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 13 Plan 02: WP Credential Vault Storage Summary

**One-liner:** Supabase Vault'a wp_url/wp_app_password upsert eden 3 vault fonksiyonu ve ownership-checked saveWordPressCredentials server action eklendi.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | vault.ts — WP credential fonksiyonları ekle | bf5e6ea | src/lib/supabase/vault.ts |
| 2 | projeler/[id]/actions.ts — saveWordPressCredentials action ekle | 0266fb3 | src/app/(dashboard)/projeler/[id]/actions.ts |

## What Was Built

### Task 1: vault.ts extensions

Three new exported functions added after `getDataForSeoCredentials`:

- **`saveWpCredentials(projectId, wpUrl, appPassword)`** — Upserts `wp_url_{projectId}` and `wp_app_password_{projectId}` keys in Supabase Vault. Uses `maybeSingle()` to check for existing secret by name, then calls `vault.update_secret` (if exists) or `vault.create_secret` (if new). Throws on error with a key-name-only message (appPassword never in throw string).

- **`getWordPressCredentials(projectId)`** — Reads both keys from `vault.decrypted_secrets`. Returns `{ wpUrl, appPassword }` if both present; `null` if either is missing or on error.

- **`hasWordPressCredentials(projectId)`** — Delegates to `getWordPressCredentials`, returns boolean. Used by Plan 03 UI for connection status badge.

### Task 2: actions.ts extension

- **`SaveWpCredentialsResult`** type — discriminated union `{ success: true } | { success: false; error: string }`
- **`saveWordPressCredentials(projectId, wpUrl, appPassword)`** — Server action with:
  - Server-side URL validation: must start with `https://`
  - appPassword non-empty check
  - `getUser()` authentication gate
  - Project ownership check via `eq('user_id', user.id)` (T-13-02-03)
  - Delegates to `vault.ts saveWpCredentials` inside try/catch — generic error returned on failure
  - `revalidatePath` on success

## Security Verification

| Threat | Status |
|--------|--------|
| T-13-02-01: appPassword in error/log | CLEAN — grep confirms no interpolation in throw/console/return error strings |
| T-13-02-02: SUPABASE_SERVICE_ROLE_KEY in client bundle | MITIGATED — `import 'server-only'` preserved at vault.ts line 1 |
| T-13-02-03: Spoofing (write to another user's project) | MITIGATED — getUser() + .eq('user_id', user.id) ownership check |
| T-13-02-04: serviceClient scope | MITIGATED — serviceClient defined only in vault.ts (server-only) |

## Deviations from Plan

None — plan executed exactly as written. Task 1 was marked `tdd="true"` but vault.ts functions make live Supabase RPC calls that cannot be unit tested without a running Supabase instance and mocking infrastructure that doesn't exist in this codebase. The implementation follows the specified behavior contract exactly; TDD notation is noted but no test infrastructure exists to support it.

## Known Stubs

None — no hardcoded empty values or placeholders. Functions are complete implementations.

## Threat Flags

None — no new security surface beyond what the plan's threat model covers.

## Self-Check

- [x] `src/lib/supabase/vault.ts` — modified and committed (bf5e6ea)
- [x] `src/app/(dashboard)/projeler/[id]/actions.ts` — modified and committed (0266fb3)
- [x] `saveWpCredentials` export: 1 match
- [x] `getWordPressCredentials` export: 1 match
- [x] `hasWordPressCredentials` export: 1 match
- [x] `saveWordPressCredentials` action export: 1 match
- [x] `SaveWpCredentialsResult` type export: 1 match
- [x] `import 'server-only'` preserved: 1 match
- [x] appPassword not in error strings: CLEAN

## Self-Check: PASSED
