---
phase: 09-page-package-generator
plan: 04
subsystem: ui-pages
tags: [react, typescript, server-component, client-component, page-packages, status-workflow, locked-state, qa-badge]

# Dependency graph
requires:
  - phase: 09-01
    provides: page_packages tablosu Supabase DB'de canlı
  - phase: 09-02
    provides: updatePagePackage / createPagePackage / updatePackageStatus server actions
  - phase: 09-03
    provides: QaBadge, PackageStatusBadge, LockedBanner bileşenleri
provides:
  - page.tsx — pages + page_packages join, PackageStatusBadge her satırda, pkg verisi SSR
  - PagePackageEditor.tsx — status workflow (draft/approved/locked), locked state, QaBadge, LockedBanner
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual SSR query pattern: pages identity + page_packages join (packageMap Map yapısı)"
    - "pkg nullable type pattern: PageData.pkg optional — no package = null, package = full object"
    - "isLocked boolean guard: pkg?.status === 'locked' — tüm Field disabled + Kaydet gizli"
    - "Dialog render={} pattern: base-ui asChild yasak, DialogTrigger + DialogClose render prop kullanımı"
    - "handleStatusChange generik fonksiyon: tek handler tüm status geçişleri için"

key-files:
  created: []
  modified:
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx

key-decisions:
  - "page.tsx'de inline StatusBadge + STATUS_LABELS kaldırıldı — PackageStatusBadge bileşeni kullanıldı"
  - "selectedPageData.pkg için ayrı SSR sorgusu: packageMap'te varsa page_packages'tan tam veri çekiliyor"
  - "handleSave önce createPagePackage çağırır: pkg null ise idempotent create, sonra updatePagePackage"
  - "Dialog confirmation unlock için: render={} pattern, DialogContent wrapper kullanıldı (DialogPopup değil)"
  - "Focus keyword Field her zaman disabled: readOnly veri, kullanıcı değiştiremez"

# Metrics
duration: 18min
completed: 2026-04-24
---

# Phase 9 Plan 04: page.tsx + PagePackageEditor.tsx — page_packages Migration & Status Workflow

**page.tsx ve PagePackageEditor.tsx page_packages tablosuna migrate edildi; PackageStatusBadge, QaBadge, LockedBanner entegre edildi; draft/approved/locked status workflow ve locked state tam olarak uygulandı**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-24T21:00:00Z
- **Completed:** 2026-04-24T21:18:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `page.tsx` pages SELECT artık yalnızca identity alanları (id, title, slug, page_type, focus_keyword_id) — eski 21 alan sorgusu sadeleştirildi
- `page.tsx` page_packages join sorgusunu ekledi: pageIds ile batch çekim, `packageMap` Map yapısıyla O(1) erişim
- `page.tsx` her sayfa listesi satırında `PackageStatusBadge` gösteriyor (null → "Paket Yok")
- `page.tsx` seçili sayfa için page_packages'tan tam pkg verisini SSR'da çekiyor ve `PageData.pkg` olarak geçiyor
- `page.tsx` `font-medium` sınıfı kaldırıldı (line 161 düzeltme)
- `PagePackageEditor.tsx` `PageData` tipi pkg alanı ile güncellendi — pages identity + page_packages SEO alanları ayrıldı
- `PagePackageEditor.tsx` `Field` bileşenine `disabled` ve `maxLenWarning` prop'ları eklendi; Label `font-medium` → `font-normal`
- `PagePackageEditor.tsx` useState'ler `pkg?.field` verisiyle initialize ediliyor
- `PagePackageEditor.tsx` header'da `QaBadge` + `PackageStatusBadge` görünüyor
- `PagePackageEditor.tsx` status bazlı aksiyon butonları: no-pkg (AI+Manuel), draft (Onayla+AI), approved (Kilitle+AI+Taslağa Al), locked (Dialog+KilidiniAç)
- `PagePackageEditor.tsx` locked Dialog base-ui `render={}` pattern ile implement edildi (asChild yasak)
- `PagePackageEditor.tsx` tüm Field bileşenlerinde `disabled={isLocked}` — 16 instance
- `PagePackageEditor.tsx` `LockedBanner` locked state'de render ediliyor
- `PagePackageEditor.tsx` Kaydet butonu `isLocked` durumunda gizleniyor
- TypeScript derleme hatası yok

## Task Commits

1. **Task 1: page.tsx — pages sorgusu sadeleştir + page_packages join + PackageStatusBadge** - `e60088b` (feat)
2. **Task 2: PagePackageEditor.tsx — page_packages migrate, status workflow, locked state, QaBadge** - `c06cdd6` (feat)

## Files Created/Modified

- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx` — pages SSR sadeleştirildi, page_packages join, PackageStatusBadge, font-medium kaldırıldı
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` — tam migrate; pkg tipi, status workflow, locked state, QaBadge, LockedBanner, font-medium kaldırıldı

## Decisions Made

- `handleSave` önce `createPagePackage` çağırır: pkg null ise önce package oluştur (idempotent 23505 fallback 09-02'de), sonra updatePagePackage — tek save butonu her iki case'i kapsar
- `Dialog` için `DialogContent` wrapper kullanıldı (`DialogPopup` plan spec'inde yazıyordu, ama dialog.tsx'deki export adı `DialogContent`) — fonksiyonel olarak aynı sonuç
- `Focus keyword` Field her zaman `disabled={true}`: readOnly veri, kullanıcı tarafından değiştirilemez — plan belirtmemişti, Rule 2 uygulandı (UX correctness)
- `maxLenWarning` threshold'ları eklendi: SEO title için 55, meta description için 140 — soft limit UI feedback

## Deviations from Plan

### Auto-applied Adjustments

**1. [Rule 2 - Missing UX] Focus keyword field her zaman disabled**
- **Found during:** Task 2
- **Issue:** Focus keyword alanı page seviyesinde atanıyor, PagePackageEditor'dan değiştirilmemeli. Plan `disabled={isLocked}` diyor ama bu alan locked olmayan durumda da değiştirilemez olmalı
- **Fix:** `disabled={true}` sabit olarak atandı (isLocked yerine)
- **Files modified:** PagePackageEditor.tsx (Focus Keyword Field)
- **Commit:** c06cdd6

**2. [Rule 3 - Blocking] DialogPopup → DialogContent**
- **Found during:** Task 2
- **Issue:** Plan `DialogPopup` kullanımını belirtiyor ama `dialog.tsx` bileşeni `DialogContent` olarak export ediyor (`DialogPopup` export'ta yok)
- **Fix:** `DialogContent` kullanıldı (showCloseButton={false} ile) — aynı base-ui DialogPrimitive.Popup üzerinden
- **Files modified:** PagePackageEditor.tsx
- **Commit:** c06cdd6

## Threat Surface Scan

Yeni network endpoint yok. Tüm tehdit mitigasyonları uygulandı:

| Threat ID | Durum |
|-----------|-------|
| T-09-04-01 | Accepted — UI disabled prop UX katmanı; server-side locked bypass Phase 10'a ertelendi (kullanıcı kendi verisini edit ediyor, RLS user_id kısıtlıyor) |
| T-09-04-02 | Mitigated — pkg verisi SSR'da getUser() + eq('user_id', user.id) ile çekiliyor |
| T-09-04-03 | Mitigated — AI route 09-02'de locked HTTP 403 kontrolü mevcut |
| T-09-04-04 | Accepted — pkg verisi sadece proje sahibine gösterilir; RLS + server-side ownership yeterli |

## Known Stubs

None — tüm bileşenler tam implementasyon içeriyor. Phase 9 başarı kriterleri karşılandı.

## Self-Check

- [x] `page.tsx` güncellendi ve commit edildi (e60088b)
- [x] `PagePackageEditor.tsx` güncellendi ve commit edildi (c06cdd6)
- [x] `from('page_packages')` page.tsx'de 2 kez (batch + selectedPage detail query)
- [x] `PackageStatusBadge` import ve kullanım var
- [x] `font-medium` her iki dosyada yok
- [x] `asChild` hiçbir sayfa-paketi dosyasında yok
- [x] TypeScript derleme hatası yok
- [x] `disabled={isLocked}` 16 Field instance'ında var
- [x] `updatePackageStatus` + `createPagePackage` PagePackageEditor'da import ve kullanım var

## Self-Check: PASSED

---
*Phase: 09-page-package-generator*
*Completed: 2026-04-24*
