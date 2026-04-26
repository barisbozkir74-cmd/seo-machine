---
phase: 12-content-studio
plan: "01"
subsystem: database
tags: [supabase, postgres, migration, content-studio, page-packages]

# Dependency graph
requires:
  - phase: 09-page-package-generator
    provides: page_packages tablosu (CREATE TABLE + RLS politikaları)
  - phase: 10-schema-center
    provides: schema_jsonld sütunu ekleme migration pattern
provides:
  - content_sections JSONB sütunu (page_packages tablosunda — bölüm dizisi)
  - html_content TEXT sütunu (page_packages tablosunda — WordPress-ready HTML)
  - Migration dosyası: supabase/migrations/20260426000001_add_content_studio_columns.sql
affects:
  - 12-02 (section-by-section content generation — bu sütunlara yazar)
  - 12-03 (approve & assemble flow — html_content'i doldurur)
  - 12-04 (UI — content_sections'ı okur/günceller)
  - 12-05 (export — html_content'i kullanır)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ADD COLUMN IF NOT EXISTS pattern — idempotent migration; var olan sütunu silmez"
    - "Tek ALTER TABLE'da birden fazla sütun ekleme (virgülle ayrılmış)"

key-files:
  created:
    - supabase/migrations/20260426000001_add_content_studio_columns.sql
  modified: []

key-decisions:
  - "content_sections JSONB seçildi: esnek bölüm array'i — heading, level, sub_headings, content, status alanlarını barındırır"
  - "html_content TEXT: tüm bölümler onaylandığında birleştirilen WordPress-ready HTML — ayrı sütun tutuldu (denormalization bilinçli)"
  - "RLS değişikliği yapılmadı: mevcut page_packages UPDATE policy (USING + WITH CHECK) yeni sütunları otomatik kapsar"
  - "supabase db push kullanıcı tarafından çalıştırılmalı: worktree ortamında SUPABASE_ACCESS_TOKEN yok"

patterns-established:
  - "Migration pattern: mevcut add_schema_jsonld.sql ile birebir aynı ALTER TABLE yapısı"

requirements-completed:
  - CONT-04
  - CONT-05

# Metrics
duration: 5min
completed: 2026-04-26
---

# Phase 12 Plan 01: Content Studio DB Migration Summary

**page_packages tablosuna content_sections (JSONB) ve html_content (TEXT) sütunları eklendi — ADD COLUMN IF NOT EXISTS ile idempotent migration**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-26T00:00:00Z
- **Completed:** 2026-04-26T00:05:00Z
- **Tasks:** 1 tamamlandı, 1 beklemede (auth gate)
- **Files modified:** 1

## Accomplishments

- Migration SQL dosyası oluşturuldu: `supabase/migrations/20260426000001_add_content_studio_columns.sql`
- `ADD COLUMN IF NOT EXISTS content_sections JSONB` — bölüm dizisi (heading, level, sub_headings, content, status)
- `ADD COLUMN IF NOT EXISTS html_content TEXT` — WordPress-ready assembled HTML
- Mevcut `add_schema_jsonld.sql` migration pattern'ı birebir izlendi
- Dosya commit edildi: `50f96ab`

## Task Commits

1. **Task 1: content_sections + html_content migration SQL dosyasını oluştur** — `50f96ab` (feat)
2. **Task 2: supabase db push** — AUTH GATE (kullanıcı terminalde çalıştırmalı)

## Files Created/Modified

- `supabase/migrations/20260426000001_add_content_studio_columns.sql` — content_sections JSONB + html_content TEXT ekleme migration'ı

## Decisions Made

- `content_sections JSONB` seçildi: esnek bölüm array'i — heading, level, sub_headings, content, status alanlarını barındırır
- `html_content TEXT`: tüm bölümler onaylandığında birleştirilen WordPress-ready HTML — ayrı sütun bilinçli denormalization
- RLS politikasında değişiklik yapılmadı: mevcut `page_packages_update_own` policy USING + WITH CHECK ile yeni sütunları otomatik kapsar
- Tek ALTER TABLE'da çoklu ADD COLUMN — atomic migration, yarım kalmaz

## Deviations from Plan

None — plan Task 1 için tam olarak belirlenen SQL içeriğiyle yazıldı.

Task 2 (supabase db push) auth gate nedeniyle duraklatıldı — bu, plan'da öngörülmüş beklenen durumdur, deviation değildir.

## Auth Gate — Kullanıcı Aksiyonu Gerekli

**Task 2: `supabase db push`**

Worktree ortamında `SUPABASE_ACCESS_TOKEN` env var mevcut değil. Supabase CLI interaktif TTY gerektiriyor.

**Kullanıcının yapması gereken:**

Proje kökünden terminalde:

```bash
supabase db push
```

**Beklenen çıktı:**
```
Applying migration 20260426000001_add_content_studio_columns.sql...done
```

**Doğrulama:**
```bash
supabase migration list
```
`20260426000001_add_content_studio_columns` satırı `applied` olarak görünmeli.

**Tamamlandığında:** Phase 12 Plan 02 (content generation) başlayabilir.

## Threat Surface Scan

Yeni network endpoint, auth path veya dosya erişim pattern'ı eklenmedi. Yalnızca DB schema değişikliği.

| Flag | Durum |
|------|-------|
| T-12-01-01 (Tampering) | Mitigate — `IF NOT EXISTS` idempotent; var olan sütunu silmez |
| T-12-01-02 (DoS) | Accept — sadece 2 sütun ekleme; table lock ihmal edilebilir |

## Known Stubs

Yok — bu plan sadece DB migration; UI/data yoktu.

## Next Phase Readiness

- Migration dosyası hazır ve commit edildi
- `supabase db push` kullanıcı tarafından çalıştırıldıktan sonra canlı DB'de `content_sections` ve `html_content` sütunları mevcut olacak
- Phase 12 Plan 02 (section-by-section AI content generation) bu iki sütuna yazar — DB push tamamlanmadan Plan 02 runtime'da "column does not exist" hatası verir

## Self-Check: PASSED

- [x] `supabase/migrations/20260426000001_add_content_studio_columns.sql` mevcut
- [x] Dosya `ADD COLUMN IF NOT EXISTS content_sections JSONB` satırını içeriyor
- [x] Dosya `ADD COLUMN IF NOT EXISTS html_content` satırını içeriyor
- [x] Commit `50f96ab` mevcut

---
*Phase: 12-content-studio*
*Completed: 2026-04-26*
