---
phase: 09-page-package-generator
plan: 02
subsystem: server-actions
tags: [server-actions, supabase, page-packages, ai-route, auth, typescript]

# Dependency graph
requires:
  - phase: 09-01
    provides: page_packages tablosu Supabase DB'de canlı
  - phase: 08-page-planner-internal-links
    provides: pages tablosu (page_id FK kaynağı)
provides:
  - updatePagePackage server action (page_packages upsert)
  - createPagePackage server action (draft package oluşturur)
  - updatePackageStatus server action (draft/approved/locked geçişleri)
  - AI route locked package kontrolü (HTTP 403)
affects:
  - 09-03 (UI — bu action'ları import eder)
  - 09-04 (AI integration — locked check aktif)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "verifyOwnership() yardımcı fonksiyon — DRY ownership check pattern"
    - "upsert onConflict: 'page_id' — UNIQUE constraint üzerinde güvenli güncelleme"
    - "UNIQUE violation fallback (23505) — mevcut paketi döndürür, hata vermez"
    - "status-keyed timestamp güncellemesi — approved_at / locked_at alanları"

key-files:
  created: []
  modified:
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts
    - src/app/api/ai/generate-page-package/route.ts

key-decisions:
  - "actions.ts pages tablosuna yazmayı bıraktı — page_packages upsert'e geçildi (D-05 uygulandı)"
  - "verifyOwnership() helper: 3 action'da tekrar eden ownership check DRY pattern"
  - "createPagePackage UNIQUE violation fallback: 23505 hata kodu yakalanır, mevcut id döndürülür"
  - "AI route sayfa SELECT sadeleştirildi: 5 identity alanı — package SEO alanları artık page_packages'ta"

# Metrics
duration: 10min
completed: 2026-04-24
---

# Phase 9 Plan 02: Server Actions & AI Route — page_packages Veri Katmanı

**3 server action (updatePagePackage/createPagePackage/updatePackageStatus) page_packages tablosunu hedef alacak şekilde yeniden yazıldı; AI route locked package'lara HTTP 403 döndürür**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-24T20:41:00Z
- **Completed:** 2026-04-24T20:51:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `updatePagePackage` artık `pages` yerine `page_packages` tablosuna `upsert` eder; `onConflict: 'page_id'` UNIQUE constraint üzerinde güvenli güncelleme sağlar
- `createPagePackage` yeni draft package satırı oluşturur; UNIQUE violation (23505) durumunda mevcut paketi döndürür, hata vermez
- `updatePackageStatus` draft→approved→locked geçişlerini yapar; `approved_at` / `locked_at` timestamp alanlarını otomatik günceller
- `verifyOwnership()` yardımcı fonksiyonla 3 action'daki tekrar eden ownership kontrolü DRY hale getirildi
- AI route `page` SELECT'i 5 identity alanına sadeleştirildi (SEO alanları artık `page_packages`'ta)
- AI route `existingPkg.status === 'locked'` kontrolüyle kilitli package'lara HTTP 403 döndürür

## Task Commits

1. **Task 1: actions.ts — page_packages tablosuna yeniden yaz** - `5d95f40` (feat)
2. **Task 2: AI route — locked package kontrolü ekle** - `7d5d45a` (feat)

## Files Created/Modified

- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` — tam yeniden yazıldı; 3 server action + 3 tip export
- `src/app/api/ai/generate-page-package/route.ts` — locked check eklendi, sayfa sorgusu sadeleştirildi

## Decisions Made

- `pages` tablosuna yazan `updatePagePackage` → `page_packages` upsert'e geçildi (D-05 uygulaması)
- `verifyOwnership()` helper pattern: ic-link-haritasi/actions.ts'teki inline pattern DRY hale getirildi
- UNIQUE violation fallback (error.code === '23505'): hata fırlatmak yerine mevcut paketi döndürür — idempotent createPagePackage

## Deviations from Plan

None — plan tam olarak yazıldığı şekilde uygulandı.

## Threat Surface Scan

Plana uygun — yeni endpoint yok. Tüm tehdit mitigasyonları uygulandı:

| Threat ID | Durum |
|-----------|-------|
| T-09-02-01 | Mitigated — her 3 action'da getUser() + verifyOwnership() |
| T-09-02-02 | Mitigated — status server-side işlenir, RLS update policy aktif |
| T-09-02-03 | Mitigated — createPagePackage'da pages tablosunda user_id kontrolü |
| T-09-02-04 | Mitigated — AI route'da existingPkg.status === 'locked' → HTTP 403 |
| T-09-02-05 | Mitigated — project + page sorgularında eq('user_id', user.id) |

## Known Stubs

None — tüm action'lar tam implementasyon içeriyor.

## Next Phase Readiness

- Wave 3 UI bileşenleri (09-03) `updatePagePackage`, `createPagePackage`, `updatePackageStatus` action'larını import edebilir
- AI route locked package'ları reddeder — Wave 3 UI'da unlock flow gerekli (LockedBanner + dialog)

---
*Phase: 09-page-package-generator*
*Completed: 2026-04-24*
