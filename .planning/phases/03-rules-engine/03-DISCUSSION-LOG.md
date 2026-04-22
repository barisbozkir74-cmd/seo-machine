# Phase 3: Rules Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 03-rules-engine
**Areas discussed:** Kural tipleri & içerik, Navigasyon & sayfa yapısı, Düzenleme UX'i, Global vs proje scope gösterimi

---

## Kural Tipleri & İçerik

| Option | Description | Selected |
|--------|-------------|----------|
| SEO title kuralları | Title keyword ile başlasın, max karakter | ✓ |
| H1 & başlık kuralları | H1 exact match, tek H1 zorunlu | ✓ |
| Slug kuralları | Exact match, lowercase+tire, stopword | ✓ |
| Meta description kuralları | Zorunlu, keyword, karakter aralığı | ✓ |

**Kural değeri formatı:**

| Option | Description | Selected |
|--------|-------------|----------|
| Boolean toggle | Açık/Kapalı — basit, yanılmaya kapalı | ✓ |
| Üçlü seçenek | Zorunlu/Önerilen/Devre dışı | |
| Serbest text | Esnek ama tutarsız | |

**Kural listesi yöntemi:**

| Option | Description | Selected |
|--------|-------------|----------|
| Sen öner, ben onaylayım | Claude önerir, kullanıcı onaylar | ✓ |
| Ben listeleyeyim | Kullanıcı tek tek belirler | |

**User's choice:** 12 boolean kural, 4 kategori — liste onaylandı.

---

## Navigasyon & Sayfa Yapısı

| Option | Description | Selected |
|--------|-------------|----------|
| Ayrı /ayarlar sayfası | Global: /ayarlar/kurallar, Proje: /projeler/[id]/kurallar | ✓ |
| Proje detay içinde tab | Sağ sütunda tab, global için ayrı sayfa gene lazım | |
| Her ikisi proje detayında | Override görünümü tek sayfada | |

**Sol sütun eklentisi:**

| Option | Description | Selected |
|--------|-------------|----------|
| Proje Kuralları linki | Separator + link, ayrı sayfaya gider | ✓ |
| Hiçbir şey eklenmez | Sadece ayrı navigasyon | |

---

## Düzenleme UX'i

| Option | Description | Selected |
|--------|-------------|----------|
| Inline toggle, anında kayıt | Toggle tıklanınca Server Action, "Kaydet" yok | ✓ |
| Tablo + toplu Kaydet | Tüm değişiklikler tek submit | |

**Varsayılan değer mantığı:**

| Option | Description | Selected |
|--------|-------------|----------|
| Global kuralı miras alır | Proje oluşturulunca INSERT yok, global geçerli | ✓ |
| Tüm kurallar kopyalanır | Proje kuralları INSERT edilir — senkronizasyon riski | |

---

## Global vs Proje Scope Gösterimi

| Option | Description | Selected |
|--------|-------------|----------|
| Badge ile işaretleme | [Global] / [Proje] ✕ + Sıfırla | ✓ |
| Sadece farklılıkları göster | Override yoksa "tüm kurallar global" mesajı | |

**Sistem önerisi gösterimi:**

| Option | Description | Selected |
|--------|-------------|----------|
| Evet, sistem önerisi gösterilsin | "(Önerilen: Açık/Kapalı)" ipucu her satırda | ✓ |
| Hayır, yalnızca mevcut değer | Sade liste | |

---

## Deferred Ideas

- Kural doğrulama/uygulama motoru — Phase 7-8
- Kural değişikliği audit log'u — MVP sonrası
- JSON export/import — MVP sonrası
