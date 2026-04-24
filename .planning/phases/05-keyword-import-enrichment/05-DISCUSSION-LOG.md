# Phase 5: Keyword Import & Enrichment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 05-keyword-import-enrichment
**Areas discussed:** Import format değişimi, CSV upload ihtiyacı, Enrichment tetikleyici, Tablo & intent gösterimi

---

## Import Format Değişimi

| Option | Description | Selected |
|--------|-------------|----------|
| Sadece keyword adları | Kullanıcı sadece keyword listesi girer, DataForSEO tüm veriyi çeker | |
| Eski format korunur + enrichment opsiyonel | keyword+volume+KD paste çalışmaya devam eder, DataForSEO eksikleri doldurur | ✓ |
| Her iki format desteklensin | Parser her ikisini de anlar | |

**User's choice:** Mevcut format korunur. Kullanıcı keyword+volume+KD yapıştırır, DataForSEO verileri import sonrası hemen altında görünür.

**Notes:** Kullanıcı açıkladı: "anahtar kelimeleri bende vereceğim sana daha önceki verdiğim gibi ama ayrıca hemen altında DataForSEO'nun da verilerini görmek isterim." Çelişme durumunda DataForSEO üsteler.

### Kümeleme zamanlaması

| Option | Description | Selected |
|--------|-------------|----------|
| Import'ta hemen kümele | Kelime örtüşmesiyle kümeleme anında çalışır, volume 0 olsa bile | ✓ |
| Enrichment'tan sonra kümele | Volume gelince kümeleme çalışır | |

---

## CSV Upload İhtiyacı

| Option | Description | Selected |
|--------|-------------|----------|
| Text paste yeterli | Mevcut textarea kalır, CSV parse kodu eklenmez | ✓ |
| CSV file picker ekle | .csv dosya seçici + parse | |

**User's choice:** Text paste yeterli.

### Tekil keyword ekleme

| Option | Description | Selected |
|--------|-------------|----------|
| Bulk paste zaten kapsıyor | Tek kelime de paste alanına yazılıp import edilebilir | ✓ |
| Ayrı inline form ekle | Tablo başında tek satır input | |
| Sonraya bırak | Phase 6'ya veya sonrasına | |

---

## Enrichment Tetikleyici

**Karar:** Import sonrası otomatik — kullanıcı notu "hemen altında DataForSEO'nun da verilerini görmek isterim" ifadesinden çıkarıldı. Ayrı buton gerekmez.

---

## Tablo & Intent Gösterimi

| Option | Description | Selected |
|--------|-------------|----------|
| Accordion / collapsible grup | Baş keyword açılır-kapanır, altında kuyruklu kelimeler | |
| Düz tablo, küme badge'i ile | Tüm keyword'ler tek tabloda, Küme sütunu badge | ✓ |

**User's choice:** Düz tablo, küme badge'li.

### Intent gösterimi

| Option | Description | Selected |
|--------|-------------|----------|
| Renkli badge | Commercial=mavi, Informational=yeşil, Navigational=gri, Transactional=turuncu | ✓ |
| Metin sütunu | Sade metin | |
| Claude karar verir | — | |

### Keyword silme

| Option | Description | Selected |
|--------|-------------|----------|
| Satır başında × butonu | Tek tıkla siler | ✓ |
| Checkbox + toplu sil | Seçerek toplu silme | |
| Hover'da görünür eylemler | Mouse üzerinde çıkar | |

---

## Claude'un Takdirine Bırakılanlar

- DataForSEO API batch boyutu ve hata handling
- Enrichment loading state tasarımı
- `total_volume` güncelleme zamanlaması
- Intent değer normalizasyonu

## Deferred Ideas

- Ajans modu keyword analizi + blueprint önerisi — Phase 6
- Opportunity scoring — Phase 6
- Primary keyword seçimi — Phase 6
