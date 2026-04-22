---
phase: 02-project-core
plan: "04"
subsystem: ui
tags: [next.js, server-component, supabase, stage-list, 2-column-layout, hugeicons, badge]

# Dependency graph
requires:
  - phase: 02-01
    provides: "badge.tsx ve separator.tsx bileşenleri"
  - phase: 02-02
    provides: "projeler/page.tsx — [id] linki kaynak noktası"
  - phase: 02-03
    provides: "actions.ts — projenin Supabase'de mevcut olduğunu garantiler"
provides:
  - "src/app/(dashboard)/projeler/[id]/page.tsx — Server Component; proje + stages sorgusu, 2 sütunlu layout"
affects: [02-05-transition, 02-06-notes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "2-column detail layout: w-64 shrink-0 sol sütun + flex-1 min-w-0 sağ sütun"
    - "Hugeicons kullanımı: HugeiconsIcon wrapper (@hugeicons/react) + ikon data (@hugeicons/core-free-icons)"
    - "notFound() ile RLS-backed 404: başka kullanıcı UUID'si null döner, notFound() çağrılır"

key-files:
  created:
    - src/app/(dashboard)/projeler/[id]/page.tsx
  modified: []

key-decisions:
  - "Record01Icon hugeicons free paketinde yok — RadioButtonIcon ile değiştirildi (aktif stage için dolgu daire)"
  - "Circle01Icon mevcut değil — CircleIcon kullanıldı (bekliyor state için boş daire)"
  - "Stage listesi tıklanabilir değil — stage geçişi 02-05 planında transition button ile yapılacak"
  - "h-screen + flex flex-col yapısı seçildi; 2 sütun flex-1 min-h-0 ile kalan yüksekliği paylaşıyor"

patterns-established:
  - "Proje detay sayfası pattern: breadcrumb + heading + 2 sütun (stage list sol, içerik sağ)"
  - "Stage status badge: className ile direkt CSS — variant prop kullanılmıyor (UI-SPEC zorunluluğu)"

requirements-completed: [PROJ-03]

# Metrics
duration: 8min
completed: 2026-04-22
---

# Phase 2 Plan 04: Proje Detay Sayfası — 2 Sütunlu Layout + Stage Listesi Summary

**Supabase RLS-filtered proje + stage sorgusu ile /dashboard/projeler/[id] Server Component oluşturuldu: sol sütun 10 stage (status badge + ikon), sağ sütun proje bilgileri ve notlar/stage-transition placeholder'ları**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-22T22:10:00Z
- **Completed:** 2026-04-22T22:18:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `src/app/(dashboard)/projeler/[id]/page.tsx` Server Component oluşturuldu
- Supabase RLS sayesinde başka kullanıcının UUID'si null döner — `if (!project) notFound()` ile 404 verilir
- Sol sütun: stages tablosundan sıralı 10 stage, status badge (Aktif/Tamamlandı/Bekliyor), Hugeicons ikonları
- Aktif stage: `border-l-2 border-blue-500 bg-blue-500/5` vurgusu
- Sağ sütun: domain, sektör, hedef ülke/dil, iş modeli, site tipi, marka tonu alanları dl/dt/dd yapısında
- Notlar ve stage geçiş butonu bölümleri 02-06 ve 02-05 için placeholder olarak hazır
- `npx tsc --noEmit` hatasız geçti

## Task Commits

Her görev atomik olarak commit edildi:

1. **Task T-02-04-01: Proje detay sayfasını oluştur** - `411de98` (feat)

**Plan metadata:** (aşağıda final commit)

## Files Created/Modified

- `src/app/(dashboard)/projeler/[id]/page.tsx` — 2 sütunlu detay sayfası Server Component; proje ve stages Supabase sorgusu, stage listesi + badge'ler + ikonlar, proje bilgileri bölümü, notlar/stage-transition placeholder'ları

## Decisions Made

- `Record01Icon` hugeicons free paketinde mevcut değil — `RadioButtonIcon` kullanıldı (aktif stage göstergesi olarak dolgu daire ikonu; görsel etki eşdeğer)
- `Circle01Icon` mevcut değil — `CircleIcon` kullanıldı (bekliyor state için boş daire)
- Sayfa yüksekliği: `h-screen` + `flex flex-col` + sütunlar `flex-1 min-h-0` — tam ekran 2-sütun layout, her sütun bağımsız scroll

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Record01Icon ve Circle01Icon @hugeicons/core-free-icons paketinde mevcut değil**

- **Found during:** Task T-02-04-01 — ikon import kontrolü
- **Issue:** Plan'da `Record01Icon` (aktif) ve `Circle01Icon` (bekliyor) kullanılması önerilmişti. Bu ikonlar hugeicons free paketinde bulunmuyor.
- **Fix:** `Record01Icon` yerine `RadioButtonIcon` (dolgu daire, aktif gösterge olarak görsel açıdan eşdeğer), `Circle01Icon` yerine `CircleIcon` (boş daire, bekliyor state için uygun) kullanıldı.
- **Files modified:** `src/app/(dashboard)/projeler/[id]/page.tsx`
- **Verification:** `npx tsc --noEmit` hatasız geçti
- **Committed in:** `411de98`

---

**Total deviations:** 1 auto-fixed (1 ikon uyumsuzluğu)
**Impact on plan:** UI görsel çıktısı plan ile tutarlı — ikon şekilleri eşdeğer, renk ve anlam aynı. Scope dışı değişiklik yok.

## Issues Encountered

None — hugeicons ikon isimleri plan'da doğrulanmamış, pakette mevcut olanlarla eşleştirildi.

## Known Stubs

- **Notlar placeholder:** `src/app/(dashboard)/projeler/[id]/page.tsx` — "Bu aşama için henüz not eklenmemiş." statik metin — 02-06-PLAN tarafından not formu ve not geçmişi ile doldurulacak
- **Stage geçiş butonu placeholder:** aynı dosya — boş `<div>` — 02-05-PLAN tarafından StageTransitionButton ile doldurulacak

Bu stubs planın amacını (2 sütunlu layout + stage listesi görüntüleme) engellemez — 02-05 ve 02-06 gelecek planlarda tanımlanmış.

## Threat Flags

Yeni tehdit yüzeyi eklenmedi — tüm tehditler plan'ın threat_model'inde tanımlanmış ve mitigate edildi:
- T-02-04-01: RLS + notFound() ile bilgi sızdırma engellendi
- T-02-04-02: Supabase parametrize sorgu, SQL injection yok
- T-02-04-03: layout.tsx auth guard kapsamında

## User Setup Required

None — harici servis konfigürasyonu gerekmiyor.

## Next Phase Readiness

- 02-05 (Stage Transition): `/dashboard/projeler/[id]` sayfası hazır — StageTransitionButton'ın ekleneceği placeholder mevcut
- 02-06 (Notlar): Not formu ve not geçmişi için sağ sütunda yer ayrıldı
- Geçersiz UUID → 404 davranışı doğrulandı (RLS + notFound())

## Self-Check: PASSED

- FOUND: src/app/(dashboard)/projeler/[id]/page.tsx
- FOUND: commit 411de98
- FOUND: .planning/phases/02-project-core/02-04-SUMMARY.md

---
*Phase: 02-project-core*
*Completed: 2026-04-22*
