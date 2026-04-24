---
phase: 09-page-package-generator
plan: 03
subsystem: ui-components
tags: [react, typescript, client-components, qa-validator, status-badge, locked-banner]

# Dependency graph
requires:
  - phase: 09-02
    provides: server actions (updatePackageStatus) — LockedBanner onUnlockClick'in tetikleyeceği action
  - phase: 09-01
    provides: page_packages tablosu — PackageStatusBadge status alanını okur
provides:
  - QaBadge client component — 4 QA kuralı, 3 görsel durum
  - PackageStatusBadge client component — null/draft/approved/locked Türkçe badge
  - LockedBanner client component — amber uyarı banner, unlock trigger
affects:
  - 09-04 (PagePackageEditor.tsx — bu 3 bileşeni import edecek)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side QA compute: computeQaRules() pure function — sunucuya veri göndermez"
    - "Badge renk ataması className ile direkt CSS — variant prop kullanılmıyor (UI-SPEC zorunluluğu)"
    - "LockedBanner: sadece UI trigger sorumluluğu — asıl unlock logic server action'da"

key-files:
  created:
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/QaBadge.tsx
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/PackageStatusBadge.tsx
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/LockedBanner.tsx
  modified: []

key-decisions:
  - "QaBadge tamamen client-side çalışır — computeQaRules() pure function olarak ayrıldı (test edilebilir)"
  - "PackageStatusBadge null guard ile 'Paket Yok' gösterir — undefined/null ayrımı yok"
  - "LockedBanner yalnızca UI aksiyonu tetikler; gerçek unlock server action'da (T-09-03-02 mitigasyonu)"

# Metrics
duration: 7min
completed: 2026-04-24
---

# Phase 9 Plan 03: QaBadge, PackageStatusBadge, LockedBanner — UI Bileşenleri

**3 yeni client component oluşturuldu: QaBadge (4 QA kuralı, 3 görsel durum), PackageStatusBadge (null/draft/approved/locked Türkçe badge), LockedBanner (amber uyarı banner + unlock trigger)**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-24T20:47:00Z
- **Completed:** 2026-04-24T20:54:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `QaBadge` 4 QA kuralını (QA-01: SEO title uzunluğu, QA-02: meta description uzunluğu, QA-03: H1 boş kontrolü, QA-04: focus keyword başlıkta var mı) gerçek zamanlı olarak değerlendirir; hata/uyarı/geçti durumunu renkli badge ile gösterir
- `PackageStatusBadge` null durumu için "Paket Yok" (opacity-60), draft için "Taslak", approved için "Onaylandı" (mavi), locked için "Kilitli" (amber) Türkçe etiket ve renk gösterir
- `LockedBanner` amber arkaplan (`bg-amber-900/20 border-amber-700/40`) ile "Bu paket kilitli — düzenlemek için kilidini aç." metni ve "Kilidini Aç" tıklanabilir buton içerir
- Hiçbir bileşende `font-medium` sınıfı yok (UI-SPEC zorunluluğu)
- Hiçbir bileşen `variant` prop kullanmıyor — yalnızca `className` ile renk
- TypeScript hata yok

## Task Commits

1. **Task 1: QaBadge.tsx ve PackageStatusBadge.tsx oluştur** - `9895e3b` (feat)
2. **Task 2: LockedBanner.tsx oluştur** - `4c0cbee` (feat)

## Files Created/Modified

- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/QaBadge.tsx` — 4 QA kuralı, 3 görsel durum, pure computeQaRules() fonksiyonu
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PackageStatusBadge.tsx` — null/draft/approved/locked Türkçe badge
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/LockedBanner.tsx` — amber banner, onUnlockClick + isPending prop

## Decisions Made

- `computeQaRules()` pure function olarak ayrıldı — QaBadge bileşeninden bağımsız test edilebilir
- `PackageStatusBadge` null guard: `if (!status)` ile "Paket Yok" — undefined gelmesi durumunda da güvenli
- `LockedBanner` yalnızca UI trigger sorumluluğu taşır — confirmation Dialog ve server action 09-04 planında `PagePackageEditor.tsx` içinde tutulur

## Deviations from Plan

None — plan tam olarak yazıldığı şekilde uygulandı.

## Threat Surface Scan

Yeni network endpoint yok. Tüm tehdit mitigasyonları uygulandı:

| Threat ID | Durum |
|-----------|-------|
| T-09-03-01 | Accepted — QA sadece UX feedback; server-side zorlama yok (severity: low) |
| T-09-03-02 | Mitigated — LockedBanner sadece UI trigger; unlock `updatePackageStatus` server action'da auth + RLS korumasıyla |
| T-09-03-03 | Accepted — PackageStatusBadge yalnızca mevcut status gösterir; SSR'da kullanıcıya zaten açık |

## Known Stubs

None — tüm bileşenler tam implementasyon içeriyor.

## Next Phase Readiness

- Wave 3 son plan (09-04) bu 3 bileşeni `PagePackageEditor.tsx`'e entegre edebilir
- `QaBadge` → `PagePackageEditor.tsx` header'ına eklenir
- `PackageStatusBadge` → `page.tsx` sayfa listesinde inline `StatusBadge` ile değiştirilir
- `LockedBanner` → `PagePackageEditor.tsx`'e locked state koşullu render olarak eklenir

## Self-Check

- [x] `QaBadge.tsx` oluşturuldu ve commit edildi (9895e3b)
- [x] `PackageStatusBadge.tsx` oluşturuldu ve commit edildi (9895e3b)
- [x] `LockedBanner.tsx` oluşturuldu ve commit edildi (4c0cbee)
- [x] TypeScript hata yok
- [x] font-medium yok (tüm 3 bileşen)
- [x] variant= yok (tüm 3 bileşen)

## Self-Check: PASSED

---
*Phase: 09-page-package-generator*
*Completed: 2026-04-24*
