# Phase 17: Keyword Intelligence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 17-keyword-intelligence
**Areas discussed:** Skor hesaplama zamanı, Skor formülü, Revenue sınıflandırması, UI yerleşimi

---

## Skor Hesaplama Zamanı

| Option | Description | Selected |
|--------|-------------|----------|
| Kullanıcı tetikler | 'Skorları Hesapla' butonu — tüm cluster'lar için bir kerede | |
| Otomatik — cluster değişince | Keyword eklenip çıkarıldığında skor anında güncellenir | ✓ |
| Sayfa yüklenişinde | Her açılışta hesaplanır, DB'ye kaydedilmez | |

**User's choice:** Otomatik — cluster değişince
**Notes:** Keyword mutasyonlarında server action içinde tetiklenecek, DB'ye kaydedilecek.

---

## Skor Formülü

| Option | Description | Selected |
|--------|-------------|----------|
| Basit — hacim + KD + CPC | 3 bileşen, sabit ağırlıklar, mevcut veri | ✓ |
| Karmaşık — 6 bileşen | Ek DataForSEO verisi gerekebilir | |
| Opportunity score merkezli | Mevcut opportunity_score'ların ortalaması | |

**User's choice:** Basit — hacim + KD + CPC
**Notes:** Sabit ağırlıklar, kullanıcı arayüzden ayarlayamaz.

---

## Revenue Sınıflandırması

| Option | Description | Selected |
|--------|-------------|----------|
| Intent dağılımına göre otomatik | Keyword search_intent'leri sayılır, kullanıcı override edebilir | ✓ |
| Sadece otomatik — override yok | Intent belirler, değiştirilemez | |
| Kullanıcı manuel atar | Her cluster için dropdown seçimi | |

**User's choice:** Intent dağılımına göre otomatik (override mevcut)
**Notes:** revenue_type kolonu zaten var. Otomatik atama + kullanıcı dropdown override.

---

## UI Yerleşimi

| Option | Description | Selected |
|--------|-------------|----------|
| Mevcut sayfada yeni sütunlar | keyword-stratejisi cluster görünümüne sütun eklenir | ✓ |
| Ayrı Intelligence sayfası | Yeni /intelligence route | |

**User's choice:** Mevcut sayfada yeni sütunlar
**Notes:** Niche Skoru sütunu + Revenue rozeti. Ayrı sayfa açılmaz.

---

## Claude's Discretion

- Normalize etme algoritması (min-max vs. logaritmik)
- Revenue override dropdown component tipi
- Yüklenmemiş skor gösterimi
