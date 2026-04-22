# Phase 2: Project Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 02-project-core
**Areas discussed:** Proje Listesi, Proje Oluşturma, Stage Engine Gösterimi, Proje Detay Yapısı

---

## Proje Listesi

| Option | Description | Selected |
|--------|-------------|----------|
| Kart Grid | 2-3 sütunlu kart düzeni, mevcut Card bileşeni yeniden kullanılır | |
| Tablo / Liste | Sıralanabilir tablo: ad, domain, sektör, stage, durum, tarih | ✓ |

**User's choice:** Tablo / Liste

---

| Option | Description | Selected |
|--------|-------------|----------|
| Davetkar boş ekran | Ikon + mesaj + CTA butonu | ✓ |
| Direkt form | Boş state yerine doğrudan form açılır | |

**User's choice:** Davetkar boş ekran

---

## Proje Oluşturma

| Option | Description | Selected |
|--------|-------------|----------|
| Modal | Dashboard üzerinde açılan modal | ✓ |
| Ayrı Sayfa | /projeler/yeni tam sayfa form | |

**User's choice:** Modal

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sadece Ad + Domain | Minimum zorunlu, geri kalan opsiyonel | ✓ |
| Tam Intake Formu | Tüm alanlar başlangıçta zorunlu | |

**User's choice:** Sadece Ad + Domain

---

## Stage Engine Gösterimi

| Option | Description | Selected |
|--------|-------------|----------|
| Dikey Liste | Sol panelde dikey stage listesi, sağda içerik | ✓ |
| Aktif Stage + İlerleme | Sadece aktif stage büyük, üstte ilerleme çubuğu | |

**User's choice:** Dikey Liste

---

| Option | Description | Selected |
|--------|-------------|----------|
| Onay gerektiren buton | "Sonraki Aşamaya Geç" + onay dialogu | ✓ |
| Serbest geçiş | Herhangi bir stage'e tıklayarak aktif yapabilir | |

**User's choice:** Onay gerektiren buton

---

## Proje Detay Yapısı

| Option | Description | Selected |
|--------|-------------|----------|
| 2 Sütun: Stage + İçerik | Sol: stage listesi, sağ: aktif stage içeriği | ✓ |
| Tab'lı Yapı | Genel Bakış / Aşamalar / Kararlar / Ayarlar tab'ları | |

**User's choice:** 2 Sütun

---

| Option | Description | Selected |
|--------|-------------|----------|
| Serbest not algısı | Her stage için metin not alanı, audits tablosuna yazılır | ✓ |
| Yapılandırılmış kararlar | Tip + içerik alanlı karar formu | |

**User's choice:** Serbest not algısı

---

## Claude's Discretion

- Tablo varsayılan sıralama (en yeni üstte)
- Modal'daki opsiyonel alan listesi ve sırası
- Stage renk/ikon sistemi
- Proje bilgilerinin düzenleme akışı

## Deferred Ideas

- Proje arama/filtreleme
- Proje silme/arşivleme
- Proje bazlı özel kurallar (Phase 3)
