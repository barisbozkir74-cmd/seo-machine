# Phase 9: Page Package Generator - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 09-page-package-generator
**Areas discussed:** Kapsam, Tablo Modeli, Versioning, QA, Package Doğuşu, Migration, Bulk, Status Flow, AI Provider

---

## Kapsam

| Option | Description | Selected |
|--------|-------------|----------|
| Mevcut üzerine geliştir | Tablo modeli kararını verip (pages vs ayrı tablo), versioning + lock + status workflow ekle | ✓ |
| Sıfırdan yeniden tasarla | Ayrı page_packages tablosu + versioning + yeni UI | |
| Sadece eksikleri tamamla | Lock + status workflow ekle, tablo modelini pages'de bırak | |

**User's choice:** Mevcut üzerine geliştir
**Notes:** Mevcut `sayfa-paketi` ekranı korunur ve evrimleştirilir.

---

## Tablo Modeli

| Option | Description | Selected |
|--------|-------------|----------|
| pages tablosunda kal | Mevcut durum — package alanlar pages columns | |
| Ayrı page_packages tablosu | pages.id → page_packages.page_id, versioning için temiz mimari | ✓ |

**User's choice:** Ayrı `page_packages` tablosu
**Notes:** pages sadece site blueprint/identity tutsun. page_packages SEO package, status, lock, QA ve versioning altyapısını taşısın. Relationship: pages.id → page_packages.page_id. Ileride: versioning, lock history, QA results, regenerate, publishing payload, audit trail için temiz ve ölçeklenebilir.

---

## Versioning

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 9'a dahil et | version_number + is_active, AI regenerate yeni version | |
| Phase 12'ye ertele | Tek aktif package per page, versioning locking ile gelir | ✓ |

**User's choice:** Phase 12'ye ertele

---

## QA Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Sadece basit kurallar | Title ≤60, meta ≤155, H1 dolu, focus keyword title'da | ✓ |
| Tam QA engine (Phase 10) | Rules engine + ikinci model, Phase 9'da placeholder | |
| Kurallar + rules engine | Basit uzunluk + proje SEO kuralları entegrasyonu | |

**User's choice:** Sadece basit kurallar (client-side, no second model)

---

## Package Doğuşu

| Option | Description | Selected |
|--------|-------------|----------|
| Generate tıklayınca oluşur | Kullanıcı aksiyonu gerekli, package yokken "Paket Yok" UI | ✓ |
| Sayfa oluşturunca otomatik | Her pages INSERT'inde page_packages otomatik draft | |

**User's choice:** Generate tıklayınca oluşur

---

## Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Kopyala + pages'ten sil | Package sütunlarını page_packages'a taşı, pages'ten drop | |
| pages'te bırak, page_packages'a tekrar koyma | Duplikasyon, migration riski sıfır | |
| pages'te dondur, package'ta canonical | UI artık page_packages okur, pages'teki alanlar fiziksel ama pasif | ✓ |

**User's choice:** pages'te dondur, package'ta canonical
**Notes:** Additive-only migration — sadece yeni tablo eklenir, pages'e dokunulmaz.

---

## Bulk Generation

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 9'a dahil et | Tüm sayfalarda üret dialog | |
| Phase 9'da tek sayfa, bulk sonra | Odaklı scope, bulk Phase 10+ | ✓ |

**User's choice:** Phase 9'da tek sayfa, bulk sonra

---

## Status Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| draft → approved → locked | 3 adım | ✓ |
| draft → reviewed → approved → locked | 4 adım | |
| draft → locked | 2 adım | |

**User's choice:** draft → approved → locked

---

## AI Provider

| Option | Description | Selected |
|--------|-------------|----------|
| Doğrudan Anthropic SDK | Mevcut durum korunur | ✓ |
| Thin adapter katmanı | src/lib/ai/provider.ts | |
| Mock generator | AI yok, sonraki fazda | |

**User's choice:** Doğrudan Anthropic SDK

---

## Deferred Ideas

- Versioning / diff — Phase 12
- Bulk generation — Phase 10+
- İkinci model QA — Phase 10
- Publishing payload / WordPress export — Phase 12
- Lock history audit trail — Phase 12
- Schema JSON-LD preview — Phase 11
