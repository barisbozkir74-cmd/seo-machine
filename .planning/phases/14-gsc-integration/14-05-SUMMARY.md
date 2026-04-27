---
phase: 14-gsc-integration
plan: "05"
subsystem: gsc-index-badge
tags: [gsc, badge, server-action, url-inspection, index-status, client-component]
dependency_graph:
  requires:
    - "14-02: checkUrlIndexStatus (index-check.ts), getValidGscToken (auth.ts)"
    - "14-03: initiateGscOAuth — isGscConnected kontrolü için OAuth flow tamamlanmış olmalı"
    - "14-04: page_packages.wp_post_url (checkIndexStatus'a inspectionUrl olarak geçilir)"
  provides:
    - GscIndexBadge client component — 3 renk state (indexed/not_indexed/crawled_not_indexed)
    - checkIndexStatus server action — triple-check, URL Inspection API, DB güncelleme
    - HtmlReadyBanner GSC entegrasyonu — "Index Durumunu Kontrol Et" butonu + badge
    - PagePackageEditor sol panel — her sayfa için GscIndexBadge
  affects:
    - plans: []
tech_stack:
  added: []
  patterns:
    - "D-06: Manuel index kontrolü — kullanıcı tetikler, server action URL Inspection API çağırır"
    - "D-07: Badge her iki yerde — Sayfa Paketi + İçerik Studio"
    - "D-08: gsc_index_status + gsc_index_checked_at kolonları page_packages'ta (Wave 1 migration ile eklendi)"
    - "T-14-03: Triple ownership — auth.getUser() → projects.eq(user_id) → page_packages.eq(project_id)"
key_files:
  created:
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/GscIndexBadge.tsx
  modified:
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts
    - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx
decisions:
  - "checkIndexStatus dosyanın başındaki 'use server' direktifini miras alır — ayrı 'use server' satırı gerekmez"
  - "HtmlReadyBanner'da gscSection ortak değişken olarak üretildi — 3 banner varyantında tekrar minimize edildi"
  - "gscSection: isGscConnected=false veya localWpPostUrl=null ise kontrol butonu gizlenir, badge hala gösterilir (mevcut cached status için)"
metrics:
  duration: "~3 min"
  completed: "2026-04-27"
  tasks_completed: 2
  files_created: 1
  files_modified: 3
requirements:
  - GSC-02
---

# Phase 14 Plan 05: GSC Index Badge + checkIndexStatus Summary

GscIndexBadge bileşeni (3 renk state), checkIndexStatus server action (triple-check + URL Inspection API) ve bu badge/action'ın HtmlReadyBanner ile PagePackageEditor'a entegrasyonu tamamlandı — D-06, D-07, D-08 kararları implemente edildi; GSC-02 gereksinimi kapatıldı.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | GscIndexBadge + checkIndexStatus server action | 2130765 | GscIndexBadge.tsx (yeni), actions.ts |
| 2 | HtmlReadyBanner + PagePackageEditor entegrasyonu | 1478846 | HtmlReadyBanner.tsx, PagePackageEditor.tsx |

## What Was Built

### src/app/(dashboard)/projeler/[id]/sayfa-paketi/GscIndexBadge.tsx (yeni)

**GscIndexBadge({ status }):**
- 3 renk state: `indexed` (bg-emerald-900/40 text-emerald-400), `not_indexed` (bg-red-900/40 text-red-400), `crawled_not_indexed` (bg-amber-900/40 text-amber-400)
- `status` null veya bilinmeyen değer ise `null` döner — badge gösterilmez
- `aria-live="polite"` ile erişilebilirlik
- PackageStatusBadge pattern ile tutarlı (direkt className, variant prop yok)

### src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts (güncellendi)

**checkIndexStatus(pagePackageId, projectId, inspectionUrl):**
- T-14-03 mitigasyonu: `auth.getUser()` → `projects.eq(user_id)` → `page_packages.eq(project_id)` triple-check
- `gsc_property_url` kontrolü: property seçilmemiş ise erken dönüş
- `getValidGscToken(projectId, user.id)` → otomatik token refresh
- `checkUrlIndexStatus(accessToken, inspectionUrl, siteUrl)` → `indexed | not_indexed | crawled_not_indexed | unknown`
- `unknown` durumunda hata döndürülür
- Başarı durumunda `page_packages.gsc_index_status` + `gsc_index_checked_at` güncellenir; `.eq('project_id', projectId)` ek güvenlik filtresi

### src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx (güncellendi)

**Yeni props:** `pagePackageId`, `gscIndexStatus`, `gscIndexCheckedAt`, `isGscConnected`

**GSC state:** `indexStatus`, `indexCheckedAt`, `checkingIndex`, `indexError`

**handleCheckIndex:** `checkIndexStatus` action çağrısı → başarı: state güncelleme; hata: `indexError` set

**GSC bölümü (3 banner varyantında):**
- `GscIndexBadge` — mevcut cached status gösterir
- "Index Durumunu Kontrol Et" butonu — `isGscConnected && localWpPostUrl` şartında görünür, `checkingIndex` disabled
- "Kontrol Ediliyor..." disabled state
- Son kontrol zamanı (tr-TR locale)
- Hata mesajı `role="alert" text-xs text-destructive`

### src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx (güncellendi)

**PageData.pkg tipine eklendi:** `gsc_index_status?: string | null`, `gsc_index_checked_at?: string | null`

**Sol panel badge alanında:** `<GscIndexBadge status={pkg?.gsc_index_status ?? null} />` — WP status badge'lerinin yanına eklendi; null ise görünmez

## Deviations from Plan

### Auto-fixed Issues

None — plan exactly as written.

### Implementation Notes

**'use server' direktifi:** `actions.ts` dosyası top-level `'use server'` ile başladığı için eklenen `checkIndexStatus` fonksiyonu ayrıca `'use server'` direktifi gerektirmez; plan taslağındaki fonksiyon gövdesi içindeki `'use server'` satırı kaldırıldı (action dosya düzeyinde zaten server).

**gscSection ortak değişken:** Plan, GSC bölümünü 3 banner varyantına ayrı ayrı eklenmesini istiyordu; kod tekrarını önlemek için `gscSection` JSX değişkeni oluşturuldu ve 3 varyanta `{gscSection}` ile enjekte edildi. Davranış aynı.

## Known Stubs

None — tüm fonksiyonel yollar tamamlandı. `checkIndexStatus` gerçek GSC URL Inspection API çağrısı yapar.

## Threat Surface Scan

Plan'ın `<threat_model>` bölümünde kayıtlı trust boundary'ler doğru implemente edildi:

| Flag | File | Description |
|------|------|-------------|
| T-14-03 mitigated | actions.ts checkIndexStatus | Triple ownership check uygulandı — başka kullanıcının page_package'ı güncellenemez |

Yeni tehdit yok — plan threat_model tüm yüzeyleri kapsıyor.

## Self-Check

### Created files exist:
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/GscIndexBadge.tsx` — FOUND

### Modified files exist:
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` — FOUND
- `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx` — FOUND
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` — FOUND

### Commits exist:
- `2130765` feat(14-05): add GscIndexBadge component + checkIndexStatus server action — FOUND
- `1478846` feat(14-05): integrate GscIndexBadge into HtmlReadyBanner + PagePackageEditor — FOUND

## Self-Check: PASSED
