---
phase: 16-recovery-engine
plan: "02"
subsystem: monitoring-service
tags:
  - lib
  - monitoring
  - recovery
  - typescript
dependency_graph:
  requires:
    - "supabase/migrations/20260430000001_recovery_tasks.sql (public.recovery_tasks table — Plan 16-01)"
    - "@supabase/supabase-js (already in package.json)"
  provides:
    - "RecoveryTaskStatus type"
    - "RecoveryTaskSource type"
    - "RecoveryTaskRow type"
    - "getRecoveryTasks() function"
  affects:
    - "Plan 16-03 (recovery-task-table.tsx — imports RecoveryTaskRow)"
    - "Plan 16-04 (izleme/page.tsx — calls getRecoveryTasks)"
tech_stack:
  added: []
  patterns:
    - "Inject-client pattern: SupabaseClient passed as parameter (no internal createClient call) — same as aggregation.ts"
    - "Inline Raw type alias for snake_case DB row — no `as any` cast"
    - "Default-off flag for include-dismissed filter (includesDismissed=false)"
key_files:
  created:
    - "src/lib/monitoring/recovery-tasks.ts"
  modified: []
decisions:
  - "RecoveryTaskSource extracted as named type alias (not inlined in RecoveryTaskRow) — reusable in detect route (16-06)"
  - "updated_at excluded from SELECT — not consumed by UI, no need to ship to client"
  - ".neq('status', 'resolved') is unconditional — includesDismissed only controls dismissed filter"
metrics:
  duration: "~1 minute"
  completed: "2026-04-30"
  tasks: 1
  files: 1
---

# Phase 16 Plan 02: Recovery Tasks Service Layer Summary

**One-liner:** `getRecoveryTasks()` fonksiyonu `recovery_tasks` tablosunu RLS-bound supabase client ile sorgular; snake_case → camelCase mapping, resolved daima hariç, dismissed isteğe bağlı.

## What Was Built

`src/lib/monitoring/recovery-tasks.ts` dosyası oluşturuldu. `src/lib/monitoring/aggregation.ts` ile aynı inject-client pattern'ini uygular.

### Exported Surface

| Export | Kind | Description |
|--------|------|-------------|
| `RecoveryTaskStatus` | type alias | `'open' \| 'in_progress' \| 'resolved' \| 'dismissed'` |
| `RecoveryTaskSource` | type alias | `'page_package' \| 'imported_page'` |
| `RecoveryTaskRow` | type alias | camelCase row shape — 11 fields |
| `getRecoveryTasks` | async function | SELECT + filter + map |

### Filter Behavior

| Call | Statuses returned |
|------|-------------------|
| `getRecoveryTasks(supabase, id)` | `open`, `in_progress` |
| `getRecoveryTasks(supabase, id, true)` | `open`, `in_progress`, `dismissed` |
| Any call | `resolved` — NEVER returned |

### TypeScript Compilation

`npx tsc --noEmit` — sıfır hata `recovery-tasks.ts` içinde. Görülen 2 hata önceden var olan `HtmlReadyBanner.tsx` dosyasında, bu plan tarafından dokunulmamış.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create src/lib/monitoring/recovery-tasks.ts | `f2d3f4f` | `src/lib/monitoring/recovery-tasks.ts` |

## Deviations from Plan

None — plan exactly as written.

## Known Stubs

None — pure TypeScript service module, no UI rendering, no hardcoded data.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All threats in the plan's `<threat_model>` addressed:

| Threat ID | Mitigation |
|-----------|-----------|
| T-16-02-01 | RLS enforced at DB layer (Plan 16-01); caller must pass auth-bound client |
| T-16-02-02 | Supabase JS uses parameterized queries (PostgREST URL params) — no string concatenation |
| T-16-02-03 | Documented convention: cookie-bound client expected |
| T-16-02-04 | `.neq('status', 'resolved')` is unconditional — `includesDismissed=true` only flips dismissed filter |

## Self-Check: PASSED

- [x] `src/lib/monitoring/recovery-tasks.ts` exists
- [x] `export type RecoveryTaskStatus` present
- [x] `export type RecoveryTaskRow` present
- [x] `export async function getRecoveryTasks` present
- [x] `.neq('status', 'resolved')` present (unconditional)
- [x] `.neq('status', 'dismissed')` present (conditional on `!includesDismissed`)
- [x] `.order('detected_at', { ascending: false })` present
- [x] Commit `f2d3f4f` exists in git log
- [x] tsc --noEmit: zero errors in recovery-tasks.ts
