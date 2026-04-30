---
phase: 16-recovery-engine
plan: "01"
subsystem: database
tags:
  - migration
  - supabase
  - recovery
  - schema
dependency_graph:
  requires:
    - "supabase/migrations/20260422000001_create_tables.sql (public.set_updated_at function)"
    - "supabase/migrations/20260422000001_create_tables.sql (public.projects table FK target)"
  provides:
    - "public.recovery_tasks table — schema, indexes, RLS, trigger"
  affects:
    - "Plans 16-02 through 16-06 (all depend on this table existing)"
tech_stack:
  added: []
  patterns:
    - "Polymorphic FK pattern: source_id references either page_packages.id or project_imported_pages.id based on source column (no DB-level FK)"
    - "RLS via EXISTS subquery on projects table (auth.uid() = projects.user_id)"
    - "Service-role-only INSERT/DELETE — user mutations routed through UPDATE policy"
key_files:
  created:
    - "supabase/migrations/20260430000001_recovery_tasks.sql"
  modified: []
decisions:
  - "Polymorphic source_id: no DB-level FK to allow either page_packages.id or project_imported_pages.id as parent — application-level integrity enforced in detect route (16-06)"
  - "UPDATE policy declared (not just SELECT) because updateRecoveryTaskStatus (16-04) uses anon-key client — RLS must permit user-initiated status changes"
  - "supabase CLI found at npx cache path: /c/Users/baris/AppData/Local/npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/bin/supabase.exe (not in PATH — ran directly)"
metrics:
  duration: "~2 minutes"
  completed: "2026-04-30"
  tasks: 2
  files: 1
---

# Phase 16 Plan 01: Recovery Tasks Migration Summary

**One-liner:** `recovery_tasks` tablosu canlı Supabase veritabanına uygulandı — 12 kolon, 3 index, updated_at trigger, SELECT + UPDATE RLS politikası.

## What Was Built

`supabase/migrations/20260430000001_recovery_tasks.sql` dosyası oluşturuldu ve `supabase db push` ile canlı veritabanına uygulandı.

### Table Schema

```
public.recovery_tasks (
  id               UUID PRIMARY KEY
  project_id       UUID FK → projects(id) ON DELETE CASCADE
  source           TEXT CHECK IN ('page_package', 'imported_page')
  source_id        UUID  [polymorphic — no DB FK]
  title            TEXT
  page_url         TEXT
  position_before  NUMERIC(5,2)
  position_after   NUMERIC(5,2)
  detected_at      TIMESTAMPTZ DEFAULT now()
  status           TEXT DEFAULT 'open' CHECK IN ('open','in_progress','resolved','dismissed')
  created_at       TIMESTAMPTZ DEFAULT now()
  updated_at       TIMESTAMPTZ DEFAULT now()
)
```

### Indexes Created

| Index Name | Columns | Purpose |
|---|---|---|
| `idx_recovery_tasks_project` | `(project_id)` | Project-level list queries |
| `idx_recovery_tasks_project_status` | `(project_id, status)` | Filtered status list queries in izleme UI |
| `idx_recovery_tasks_source_lookup` | `(source, source_id, status)` | Duplicate-prevention + auto-resolve UPDATE in publishToWordPress |

### Trigger

`set_recovery_tasks_updated_at` — BEFORE UPDATE, calls `public.set_updated_at()` (already exists).

### RLS Policies

| Policy | Operation | Rule |
|---|---|---|
| `recovery_tasks_select_own` | SELECT | EXISTS (projects WHERE id = project_id AND user_id = auth.uid()) |
| `recovery_tasks_update_own` | UPDATE (USING + WITH CHECK) | EXISTS (projects WHERE id = project_id AND user_id = auth.uid()) |

INSERT/DELETE: service role only (n8n detect route bypasses RLS).

## Task Results

| Task | Name | Commit | Result |
|---|---|---|---|
| 1 | Author recovery_tasks migration SQL | `bdc33fb` | DONE — all grep assertions passed |
| 2 | Apply migration via supabase db push | (no new commit — DB operation) | DONE — "Finished supabase db push." / dry-run: "Remote database is up to date." |

## Deviations from Plan

**None** — plan executed exactly as written.

**Note:** `supabase` CLI was not in PATH on this machine. Binary located at npx cache path and executed directly. This is not a deviation — the plan says "run supabase db push from project root" and the operation completed successfully.

## Known Stubs

None — this plan creates a DB schema only; no UI or service layer stubs.

## Threat Flags

All threats in the plan's `<threat_model>` were addressed in the migration:

| Threat ID | Mitigation Applied |
|---|---|
| T-16-01-01 | CHECK constraint on status column |
| T-16-01-02 | CHECK constraint on source column |
| T-16-01-03 | RLS SELECT policy via auth.uid() EXISTS subquery |
| T-16-01-04 | RLS UPDATE USING + WITH CHECK both reference auth.uid() |

## Self-Check: PASSED

- [x] `supabase/migrations/20260430000001_recovery_tasks.sql` exists
- [x] Commit `bdc33fb` exists in git log
- [x] `supabase db push` exited 0 ("Finished supabase db push.")
- [x] `supabase db push --dry-run` reports "Remote database is up to date."
