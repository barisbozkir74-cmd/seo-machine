---
phase: 01-foundation
plan: 03
subsystem: database/security
tags: [supabase, rls, postgres, security, vault, api-keys, server-only]
status: partial — awaiting Task 2 (supabase db push by user)

# Dependency graph
requires:
  - 01-02 (all 10 core tables with user_id FK to auth.users)
provides:
  - RLS enabled on all 10 tables (per-user row isolation)
  - Server-only Vault secret retrieval helper for API keys
affects: [all future phases — data access now gated by RLS, API key retrieval pattern established]

# Tech tracking
tech-stack:
  added:
    - "server-only npm package (build-time guard against client imports)"
  patterns:
    - "RLS per-user isolation: auth.uid() = user_id on all 4 policy types (D-08)"
    - "UPDATE policies use both USING and WITH CHECK to prevent user_id tampering (T-03-04)"
    - "Vault secret retrieval via vault.decrypted_secrets with service role key (D-09)"
    - "server-only import guard in lib/supabase/vault.ts — throws at build time if imported in Client Component (T-03-01, T-03-03)"

key-files:
  created:
    - "supabase/migrations/20260422000002_rls_policies.sql — RLS enable + 4 policies per table × 10 tables"
    - "lib/supabase/vault.ts — Server-only Vault helper for API key retrieval"
  modified:
    - ".env.local.example — Added SUPABASE_SERVICE_ROLE_KEY placeholder"
    - "package.json — Added server-only dependency"

key-decisions:
  - "Single migration file for all 10 tables' RLS policies (maintainability over granularity)"
  - "UPDATE policies enforce both USING (existing row ownership) and WITH CHECK (new row ownership) — prevents user_id hijacking"
  - "Service role key in vault.ts uses NEXT_PUBLIC_SUPABASE_URL (safe per T-03-05) but SUPABASE_SERVICE_ROLE_KEY is never NEXT_PUBLIC_"

# Metrics
duration: 8min
completed: 2026-04-22
---

# Phase 01 Plan 03: RLS Policies and Vault Helper Summary

**STATUS: PARTIAL — Task 1 complete and committed; Task 2 (supabase db push) awaits user action**

**RLS enabled on all 10 tables with 4 per-user isolation policies each; server-only Vault helper created for secure API key retrieval using Supabase service role key**

## Performance

- **Duration:** ~8 min (Task 1 only)
- **Started:** 2026-04-22
- **Completed (Task 1):** 2026-04-22
- **Tasks:** 1 of 2 complete (Task 2 is human-action checkpoint)
- **Files modified:** 2 created, 2 modified

## Accomplishments

- Created `supabase/migrations/20260422000002_rls_policies.sql` with RLS enabled on all 10 tables
- 40 total policy statements (4 per table × 10 tables): SELECT, INSERT, UPDATE, DELETE
- UPDATE policies use dual check: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` — prevents user from changing user_id to steal rows (T-03-04)
- Created `lib/supabase/vault.ts` as a server-only module using `import 'server-only'`
- Vault helper queries `vault.decrypted_secrets` via service role key — API keys never reach the browser
- Added `SUPABASE_SERVICE_ROLE_KEY` to `.env.local.example` with clear documentation
- Installed `server-only` npm package
- Build passes: `npm run build` exits 0

## Task Commits

1. **Task 1: RLS migration and Vault helper** — `65a0321` (feat)
2. **Task 2: Push migrations to hosted Supabase** — PENDING (human-action checkpoint)

## Files Created/Modified

- `supabase/migrations/20260422000002_rls_policies.sql` — 10 × ENABLE RLS + 10 × 4 policies
- `lib/supabase/vault.ts` — Server-only Vault secret retrieval with TypeScript SecretName union type
- `.env.local.example` — Added SUPABASE_SERVICE_ROLE_KEY placeholder
- `package.json` / `package-lock.json` — server-only dependency added

## Decisions Made

- Single migration file for all 10 tables' RLS (easier to audit all security policies in one place)
- UPDATE policies use both USING and WITH CHECK clauses — USING guards existing row ownership check, WITH CHECK ensures new row values can't change ownership
- `NEXT_PUBLIC_SUPABASE_URL` is safe in vault.ts (anon/public per Supabase architecture, T-03-05 accepted); `SUPABASE_SERVICE_ROLE_KEY` is intentionally not NEXT_PUBLIC_

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan is pure security infrastructure (SQL DDL + server utility). No UI, no stubs.

## Threat Flags

None. All threat mitigations from the plan's threat model are implemented:
- T-03-01: Service role key server-only (vault.ts + `import 'server-only'` guard)
- T-03-02: SUPABASE_SERVICE_ROLE_KEY in .env.local (gitignored), only placeholder in .env.local.example
- T-03-03: vault.decrypted_secrets only accessible via service role key; server-only import guard
- T-03-04: UPDATE policies use USING + WITH CHECK (both sides of the update check user ownership)
- T-03-05: Accepted — anon key NEXT_PUBLIC_ is safe per Supabase architecture

## Self-Check: PASSED

- FOUND: `supabase/migrations/20260422000002_rls_policies.sql`
- FOUND: `lib/supabase/vault.ts`
- FOUND: commit `65a0321` (feat(01-03): add RLS policies for all 10 tables and Vault secret helper)
- FOUND: SUPABASE_SERVICE_ROLE_KEY in .env.local.example
- FOUND: `grep -c "ENABLE ROW LEVEL SECURITY"` = 10
- FOUND: `grep -c "auth.uid() = user_id"` = 41 (≥ 40 threshold met)
- FOUND: `import 'server-only'` in vault.ts
- FOUND: `vault.decrypted_secrets` in vault.ts
- BUILD: npm run build exits 0
