---
phase: 14-gsc-integration
plan: "01"
subsystem: database
tags: [supabase, postgres, migration, gsc, rls, oauth-tokens, search-analytics]
dependency_graph:
  requires: []
  provides:
    - gsc_tokens JSONB column on projects (server-only OAuth token storage)
    - gsc_property_url TEXT column on projects
    - gsc_index_status TEXT column on page_packages (CHECK constraint)
    - gsc_index_checked_at TIMESTAMPTZ column on page_packages
    - gsc_metrics table with UNIQUE(page_id, date, keyword) + RLS
  affects:
    - plans: [14-02, 14-03, 14-04, 14-05]
      reason: all subsequent GSC plans depend on schema being applied
tech_stack:
  added: []
  patterns:
    - "ADD COLUMN IF NOT EXISTS — idempotent DDL"
    - "CREATE TABLE IF NOT EXISTS — idempotent DDL"
    - "RLS EXISTS subquery pattern for project ownership verification"
    - "service role bypass for n8n INSERT/UPDATE path"
key_files:
  created:
    - supabase/migrations/20260427000002_gsc_schema.sql
  modified: []
decisions:
  - "Timestamp changed from 20260427000001 to 20260427000002 — 20260427000001_add_wp_status_check.sql already existed (Phase 13 fix applied before this plan)"
  - "gsc_tokens JSONB column server-only: confirmed per STATE.md decision log"
  - "gsc_metrics RLS: SELECT policy only via gsc_metrics_select_own; INSERT/UPDATE via n8n service role (bypasses RLS)"
metrics:
  duration: "~5 min"
  completed: "2026-04-27"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
requirements:
  - GSC-01
  - GSC-02
  - GSC-03
---

# Phase 14 Plan 01: GSC Schema Migration Summary

GSC entegrasyonu için Supabase veritabanı altyapısı hazırlandı — OAuth token depolama, index durumu takibi ve Search Analytics metrikleri için tüm şema değişiklikleri tek migration dosyasında uygulandı.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | GSC migration SQL oluştur ve supabase db push çalıştır | f81b2fc | supabase/migrations/20260427000002_gsc_schema.sql |

## What Was Built

### Migration: `20260427000002_gsc_schema.sql`

**Block 1 — projects tablosu:**
- `gsc_tokens JSONB` — server-only; OAuth2 access/refresh token storage; SELECT sorgularına dahil edilmez
- `gsc_property_url TEXT` — GSC Sites.list API'den dönen property identifier (sc-domain: formatı dahil)

**Block 2 — page_packages tablosu:**
- `gsc_index_status TEXT` — CHECK constraint: `NULL | 'indexed' | 'not_indexed' | 'crawled_not_indexed'` (URL Inspection API verdict)
- `gsc_index_checked_at TIMESTAMPTZ` — son kontrol zamanı; rate limit yönetimi için kullanılır

**Block 3 — gsc_metrics tablosu (yeni tablo):**
- UUID primary key + project_id/page_id FK'ları (ON DELETE CASCADE)
- UNIQUE(page_id, date, keyword) constraint — duplicate metrics önlenir
- idx_gsc_metrics_page_date ve idx_gsc_metrics_project_date composite indexler
- RLS ENABLED + `gsc_metrics_select_own` policy (EXISTS subquery, projects.user_id = auth.uid())
- INSERT/UPDATE: n8n service role key ile — RLS bypass

### DB Push Result

```
Applying migration 20260427000002_gsc_schema.sql...
Finished supabase db push.
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migration timestamp çakışması**
- **Found during:** Task 1 pre-execution (migration dizini listelendi)
- **Issue:** Plan'da `20260427000001_gsc_schema.sql` filename belirtilmişti; ancak `20260427000001_add_wp_status_check.sql` (Phase 13 fix) aynı timestamp'i kullanıyordu
- **Fix:** Filename `20260427000002_gsc_schema.sql` olarak değiştirildi — Supabase migrations sıralı timestamp'e göre çalışır, çakışma migration hatasına yol açardı
- **Files modified:** supabase/migrations/20260427000002_gsc_schema.sql (yeni dosya; plan'daki 000001 yerine 000002)
- **Commit:** f81b2fc

## Self-Check

### Created files exist:
- `supabase/migrations/20260427000002_gsc_schema.sql` — FOUND

### Commits exist:
- `f81b2fc` feat(14-01): add GSC schema migration — FOUND

## Self-Check: PASSED
