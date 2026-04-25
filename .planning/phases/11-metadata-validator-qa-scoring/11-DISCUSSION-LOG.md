# Phase 11: Metadata Validator & QA Scoring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 11-metadata-validator-qa-scoring
**Areas discussed:** Validator Tetikleyici, LLM QA Akışı, 5 Skor Mimarisi, Skor Gösterimi

---

## Validator Tetikleyici

| Option | Description | Selected |
|--------|-------------|----------|
| Her kaydetmede | Rules engine her save'de çalışır, QA badge güncellenir | |
| Sadece kilit öncesinde | Save serbest, lock öncesinde tam blok | |
| Her ikisinde ayrı skor | Kaydetmede hafif uyarı, kilit öncesinde tam onay diyaloğu | ✓ |
| Client-side, anlık | Kullanıcı yazarken canlı skor | |

**User's choice:** Her ikisinde ayrı skor
**Notes:** Kaydetme = hafif uyarı (QaBadge evrimi). Kilit = tam diyalog, ihlaller listelenir, "Anlıyorum, yine de kilitle" ile devam.

---

## Kaydetme Uyarı Gösterimi

| Option | Description | Selected |
|--------|-------------|----------|
| QaBadge evrim | Mevcut QaBadge rules engine sonuçlarını da toplar | ✓ |
| Ayrı RulesBadge | İki badge yan yana | |
| Inline alan altı uyarısı | Her alan altında spesifik uyarı satırı | |

**User's choice:** QaBadge evrim
**Notes:** Tek badge, sıfır yeni component.

---

## Kilit Öncesi Blok Davranışı

| Option | Description | Selected |
|--------|-------------|----------|
| Gör — onaylayarak devam | Diyalogda ihlaller, "Anlıyorum, yine de kilitle" butonu | ✓ |
| Sert blok | Kural ihlali varsa kilit tamamen engellenir | |

**User's choice:** Gör — onaylayarak devam

---

## LLM QA Tetikleyici

| Option | Description | Selected |
|--------|-------------|----------|
| Kilitle butonuna otomatik | Kilitle → Claude QA → diyalog → onay | ✓ |
| Ayrı 'QA Denetle' butonu | Bağımsız buton, kilitleme zorunlu değil | |
| Her ikisi (sekansör) | QA butonu + zorunlu geçiş kapısı | |

**User's choice:** Kilitle butonuna otomatik

---

## QA Kontrol Boyutları

| Option | Description | Selected |
|--------|-------------|----------|
| Intent drift | İçerik hedef intent ile uyuşuyor mu? | ✓ |
| Robotik dil | AI şablonculuğu fark edilebilir mi? | ✓ |
| Entity eksikliği | Beklenen entity'ler yazıya eklenmiş mi? | ✓ |
| Duplicate risk | Site içinde benzer içerik riski | ✓ |

**User's choice:** Tümü (4 boyut)

---

## Claude'a Gönderilen İçerik

| Option | Description | Selected |
|--------|-------------|----------|
| Core alanlar | seo_title, meta, h1, content_blocks, search_intent, strategic_purpose | ✓ |
| Tüm paket | Tüm page_package alanları dahil | |

**User's choice:** Core alanlar

---

## Kritik Sorun Davranışı (LLM QA)

| Option | Description | Selected |
|--------|-------------|----------|
| Gör — onaylayarak kilitle | Diyalogda sorunlar, "Anlayarak Kilitle" ile devam | ✓ |
| Sert blok | Kritik sorun varsa kilit tamamen engellenir | |

**User's choice:** Gör — onaylayarak kilitle

---

## 5 Skor Kaynağı

| Option | Description | Selected |
|--------|-------------|----------|
| Hibrid | SEO+metadata client-side/rules, content+human LLM, schema client-side | ✓ |
| Tamamen LLM'den | Claude her 5 skoru döndürür | |

**User's choice:** Hibrid

---

## Ağırlık Dağılımı

| Option | Description | Selected |
|--------|-------------|----------|
| Eşit ağırlık | Her skor 20 puan, readiness = (5 skor) / 5 | ✓ |
| SEO ağırlıklı | SEO 30, content 25, human 20, metadata 15, schema 10 | |
| Claude önersin | Claude QA dönüşünde ağırlıklı skor önerir | |

**User's choice:** Eşit ağırlık

---

## qa_scores Yazma Yöntemi

| Option | Description | Selected |
|--------|-------------|----------|
| Tek JSONB alan | Mevcut qa_scores JSONB kullanılır | ✓ |
| Ayrı skor sütunları | seo_score INT, content_score INT vb. migration | |

**User's choice:** Tek JSONB alan

---

## Skor Konum

| Option | Description | Selected |
|--------|-------------|----------|
| Header bölgesi | QaBadge + PackageStatusBadge yanına skor satırı | ✓ |
| Yeni 'Kalite' sekmesi | Tab bar'a üçüncü sekme | |
| Kilit dialog'unda | Sadece kilitleme sırasında görünür | |

**User's choice:** Header bölgesi

---

## Skor Format

| Option | Description | Selected |
|--------|-------------|----------|
| Sayısal etiket | SEO 85 \| İçerik 90 \| İnsan 80 \| Schema 60 \| Hazırlık 79 | ✓ |
| Sadece Hazırlık + tooltip | Yalnızca readiness gösterir, hover'da diğerleri | |
| Renk kodlu yuvarlak | Her skor için küçük renkli daire | |

**User's choice:** Sayısal etiket

---

## Claude's Discretion

- SEO Score formülü (ihlal başına puan düşüşü)
- Loading state UX (spinner + metin)
- QA diyaloğu severity renkleri
- `last_qa_run` gösterilip gösterilmeyeceği

## Deferred Ideas

- Bulk QA — Phase 12+
- QA geçmiş log — Phase 12
- Otomatik düzeltme önerileri — Phase 13+
- Schema JSON-LD schema.org validation — Phase 12
