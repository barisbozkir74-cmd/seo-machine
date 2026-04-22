---
phase: 02-project-core
plan: "02"
subsystem: ui
tags: [next.js, server-component, supabase, table, badge, dashboard, projeler]

# Dependency graph
requires:
  - phase: 02-01
    provides: "table.tsx ve badge.tsx bileşenleri"
provides:
  - "src/app/(dashboard)/projeler/page.tsx — Supabase'den proje listesi çeken Server Component"
  - "src/app/(dashboard)/dashboard/page.tsx — /dashboard/projeler'e yönlendiren redirect"
affects: [02-03-modal, 02-04-detail]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component Supabase sorgusu — async page function + createClient() ile RLS-filtered veri çekme"
    - "Nested relation sorgusu — .select('*, stages(stage_name, status)') ile JOIN yerine Supabase ilişki sorgusu"
    - "Error maskeleme — Supabase hata mesajı kullanıcıya açılmaz, generic Türkçe mesaj gösterilir (T-02-02-03)"

key-files:
  created:
    - src/app/(dashboard)/projeler/page.tsx
  modified:
    - src/app/(dashboard)/dashboard/page.tsx

key-decisions:
  - "stages relation sorgusu tek sorguda JOIN mantığıyla çalıştırıldı: .select('id, name, ..., stages(stage_name, status)') — ayrı sorgu gerekmedi"
  - "Durum badge'i mantığı: tüm stages 'completed' ise Tamamlandı, aksi halde Aktif — Bekliyor durumu phase 2'de stage henüz oluşturulmamış projelere karşılık gelmez"
  - "Tablo satırı hover:bg-secondary cursor-pointer — tüm satır tıklanabilir görünümü verir; ancak navigasyon sadece Proje Adı Link'inden sağlanır (Server Component kısıtı)"
  - "Error mesajı maskeleme: supabase query hatası console'a loglanmaz (MVP); 'Projeler yüklenemedi' generic mesajı gösterilir"

patterns-established:
  - "Dashboard sayfası pattern: p-8 padding, flex justify-between header, koşullu boş/dolu render"
  - "Badge renk ataması: className ile direct CSS — variant prop kullanılmıyor (UI-SPEC'e göre)"

requirements-completed: [PROJ-02]

# Metrics
duration: 8min
completed: 2026-04-22
---

# Phase 2 Plan 02: Projeler listesi dashboard sayfası Summary

**Supabase'den RLS-filtered proje listesi çeken Server Component — 6 sütunlu tablo (Proje Adı, Domain, Sektör, Aktif Stage, Durum, Oluşturulma) ve boş durum ekranı ile /dashboard/projeler sayfası oluşturuldu**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-22T22:10:00Z
- **Completed:** 2026-04-22T22:18:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- `src/app/(dashboard)/projeler/page.tsx` Server Component oluşturuldu
- Supabase nested relation sorgusu ile stages JOIN'lendi — tek sorguda aktif stage adı alındı
- Boş durum: "Henüz proje yok" + "Yeni Proje Oluştur" butonu
- Dolu durum: 6 sütunlu tablo, Proje Adı `<Link>` ile `/dashboard/projeler/[id]`'e yönlendiriyor
- Durum badge'leri: Aktif (blue-500/20) / Tamamlandı (emerald-500/20) — UI-SPEC renk sistemi
- Hata durumunda generic Türkçe mesaj, stack trace kullanıcıya açılmıyor (T-02-02-03)
- `src/app/(dashboard)/dashboard/page.tsx` stub'ı `redirect('/dashboard/projeler')` ile değiştirildi
- `npx tsc --noEmit` hatasız geçti

## Task Commits

Her görev atomik olarak commit edildi:

1. **Task T-02-02-01: Projeler listesi Server Component sayfasını oluştur** - `e8aec0c` (feat)

**Plan metadata:** (aşağıda final commit)

## Files Created/Modified

- `src/app/(dashboard)/projeler/page.tsx` — Proje listesi Server Component; Supabase sorgusu, boş/dolu durum render, 6 sütunlu tablo, badge'ler, TR locale tarih formatı
- `src/app/(dashboard)/dashboard/page.tsx` — Eski stub yerine `redirect('/dashboard/projeler')` yönlendirmesi

## Decisions Made

- stages relation sorgusu tek `.select()` içinde çözüldü — ayrı sorgu yazmaya gerek kalmadı; `stages.find(s => s.status === 'active')?.stage_name ?? '—'` ile aktif stage adı alındı
- Badge'lerde `variant` prop yerine `className` ile direkt CSS yazıldı — UI-SPEC bu yaklaşımı zorunlu kılıyor ("No variant prop — apply CSS classes directly")
- dashboard/page.tsx'te `async` kaldırıldı — redirect sync olarak çalışıyor, Supabase çağrısı gereksiz

## Deviations from Plan

None — plan tam olarak yazıldığı gibi çalıştırıldı.

## Issues Encountered

None.

## User Setup Required

None — harici servis konfigürasyonu gerekmiyor.

## Next Phase Readiness

- 02-03 (Yeni Proje Modal): `/dashboard/projeler` sayfası hazır — "Yeni Proje Oluştur" butonu şu an işlevsiz (modal 02-03'te bağlanacak)
- 02-04 (Proje detay): `/dashboard/projeler/[id]` route'u için `href` bağlantısı tabloda mevcut
- Tablo ve badge bileşenleri çalışıyor, TypeScript hata yok

## Self-Check: PASSED

- FOUND: src/app/(dashboard)/projeler/page.tsx
- FOUND: src/app/(dashboard)/dashboard/page.tsx
- FOUND: .planning/phases/02-project-core/02-02-SUMMARY.md
- FOUND: commit e8aec0c

---
*Phase: 02-project-core*
*Completed: 2026-04-22*
