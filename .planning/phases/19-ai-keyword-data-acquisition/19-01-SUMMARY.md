---
phase: 19-ai-keyword-data-acquisition
plan: "01"
subsystem: keywords
tags: [database, migration, typescript, vitest, tdd, scaffold]
dependency_graph:
  requires: []
  provides:
    - keywords.source CHECK constraint migration (supabase/migrations/20260509000001_keywords_source_check.sql)
    - AcquisitionInput / AcquisitionResult type contracts (src/lib/keywords/ai-acquisition.ts)
    - Wave 0 vitest test scaffold (src/lib/keywords/ai-acquisition.test.ts)
  affects:
    - Plan 02: fetchRankedKeywords / fetchRelatedKeywords implementers kullanacak
    - Plan 03: runKeywordAcquisition implementasyonu bu iskeleti doldurur
tech_stack:
  added: []
  patterns:
    - "TDD RED/GREEN scaffold — test önce, sonra minimum implementation"
    - "import 'server-only' credential guard (T-19-03)"
    - "DROP CONSTRAINT IF EXISTS idempotent migration pattern"
key_files:
  created:
    - supabase/migrations/20260509000001_keywords_source_check.sql
    - src/lib/keywords/ai-acquisition.ts
    - src/lib/keywords/ai-acquisition.test.ts
  modified: []
decisions:
  - "Task 2 (db push) manuel push gerektirir — SUPABASE_ACCESS_TOKEN ortam değişkeni set edilmemiş, Docker da çalışmıyor; migration dosyası hazır, kullanıcının 'npx supabase db push' çalıştırması gerekiyor"
  - "TDD flow: test (RED) → implementation (GREEN) iki ayrı commit ile belgelendi"
  - "Pre-existing TypeScript hataları (untracked dosyalar) bu plan kapsamı dışında bırakıldı"
metrics:
  duration: "~12 dakika"
  completed: "2026-05-08"
  tasks_completed: 2
  tasks_partial: 1
  files_created: 3
---

# Phase 19 Plan 01: DB Constraint + Service Skeleton Summary

**One-liner:** keywords.source CHECK constraint migration + AcquisitionInput/AcquisitionResult TypeScript iskelet kontratları ve Vitest Wave 0 scaffold'u oluşturuldu.

## Tasks

| # | Name | Status | Commit |
|---|------|--------|--------|
| 1 | Create source CHECK constraint migration | DONE | 1ada6a9 |
| 2 | Push schema migration to Supabase | PARTIAL — Manuel push gerekiyor | (dosya yok) |
| 3 | Scaffold ai-acquisition.ts + Wave 0 test (TDD) | DONE | 9818e6b (RED), ef92e62 (GREEN) |

## Task 2 Blocker — Manuel Push Gerekiyor

Migration dosyası hazır: `supabase/migrations/20260509000001_keywords_source_check.sql`

Push için şu adımları tamamlayın:

1. Supabase Dashboard'dan Personal Access Token alın: https://supabase.com/dashboard/account/tokens
2. Token'ı export edin: `export SUPABASE_ACCESS_TOKEN=<token>`
3. Projeyi link edin: `npx supabase link --project-ref jmailuedcajgidfzigof`
4. Push edin: `npx supabase db push`
5. Doğrulama: `npx supabase migration list` çıktısında `20260509000001_keywords_source_check` satırının `Applied` göründüğünü kontrol edin.

**Neden kritik:** `keywords.source = 'competitor'` INSERT'leri Plan 03'te runtime'da silently kabul edilir; constraint olmadan false-positive doğrulama riski oluşur (T-19-02).

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 1ada6a9 | feat | keywords.source CHECK constraint migration (Task 1) |
| 9818e6b | test | Wave 0 failing test scaffold — TDD RED (Task 3) |
| ef92e62 | feat | ai-acquisition.ts service skeleton — TDD GREEN (Task 3) |

## TDD Gate Compliance

- RED gate: `test(19-01)` commit 9818e6b mevcut
- GREEN gate: `feat(19-01)` commit ef92e62, RED sonrası mevcut
- REFACTOR gate: gereksiz — kod zaten temiz

## Verification Results

```
vitest run: 3 passed | 1 skipped
- export contract: runKeywordAcquisition is a function ✓
- skeleton throws "Not implemented" until Plan 03 lands ✓
- TODO Plan 03: upsertKeywordPool ... (skipped, Plan 03'te enable edilecek)
- AcquisitionResult shape sanity ✓

migration grep: keywords_source_check OK
migration grep: CHECK (source IN ('manual', 'competitor', 'expansion')) OK
migration grep: DROP CONSTRAINT IF EXISTS keywords_source_check OK
TypeScript (ai-acquisition.ts): no errors
```

## Deviations from Plan

### Auth Gate: Task 2 — supabase db push

**Found during:** Task 2
**Issue:** `npx supabase db push` için `SUPABASE_ACCESS_TOKEN` gerekiyor; ortam değişkeni set edilmemiş. Docker çalışmıyor (local mode yok). Management API 401 döndü.
**Action:** Migration dosyası oluşturuldu (Task 1), push için kullanıcıya manuel adımlar belgelendi (yukarıda).
**Impact:** Plan 03 başlamadan önce kullanıcı push'u tamamlamalı.
**Classification:** Auth gate — deviasiyon değil, beklenen auth gerekliliği.

### Pre-existing TypeScript Errors (Out of Scope)

Worktree'de untracked dosyalara referans veren mevcut TypeScript hataları tespit edildi (AddLinkDialog, SeoFetchButton vb.). Bu hatalar bu plan'ın değişikliklerinden kaynaklanmıyor; kapsam dışı bırakıldı. ai-acquisition.ts ve test dosyası TypeScript hatası üretmiyor.

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| src/lib/keywords/ai-acquisition.ts | `throw new Error('Not implemented — Plan 03')` | Kasıtlı — Plan 03'ün dolduracağı iskelet |
| src/lib/keywords/ai-acquisition.test.ts | `it.skip(...)` — ignoreDuplicates:true testi | Kasıtlı — Plan 03 implementasyonu sonrası enable edilecek |

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns beyond what the plan's threat model covers.

- T-19-01: CHECK constraint migration hazır (push bekliyor)
- T-19-02: Task 2 blocker — push henüz tamamlanmadı, manuel gerekiyor
- T-19-03: `import 'server-only'` iskelet dosyasında mevcut
- T-19-04: Wave 0 test scaffold + `it.skip` dokumentasyonu tamamlandı

## Self-Check

```bash
[ -f "supabase/migrations/20260509000001_keywords_source_check.sql" ] → FOUND
[ -f "src/lib/keywords/ai-acquisition.ts" ] → FOUND
[ -f "src/lib/keywords/ai-acquisition.test.ts" ] → FOUND
git log: 1ada6a9 → FOUND
git log: 9818e6b → FOUND
git log: ef92e62 → FOUND
```

## Self-Check: PASSED
