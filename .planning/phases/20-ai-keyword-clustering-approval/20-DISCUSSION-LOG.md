# Phase 20: AI Keyword Clustering & Approval - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 20-ai-keyword-clustering-approval
**Areas discussed:** Öneri Arayüzü, Onay Granularitesi, Mevcut Cluster'larla Çakışma, Gate Mekanizması

---

## Öneri Arayüzü

| Option | Description | Selected |
|--------|-------------|----------|
| Full-page overlay | Mevcut sayfa üzerinde tam ekran panel. Sol: cluster listesi. Sağ: seçilen cluster'daki keyword'ler. | ✓ |
| Dialog / Modal | Butona basınca açılan geniş modal, tüm cluster önerilerini liste halinde gösterir. | |
| Ayrı onay sayfası | Yeni route: /keyword-stratejisi/onay | |

**User's choice:** Full-page overlay
**Notes:** —

---

| Option | Description | Selected |
|--------|-------------|----------|
| Evet, isim düzenlenebilir | Cluster adına tıklayınca inline edit | ✓ |
| Hayır, isim sabittir | AI'nın verdiği isimle kaydedilir | |

**User's choice:** Evet, isim düzenlenebilir
**Notes:** —

---

## Onay Granularitesi

| Option | Description | Selected |
|--------|-------------|----------|
| Cluster düzeyinde | Her cluster için Onayla / Reddet | |
| Keyword düzeyinde | Her keyword tek tek işaretlenebilir | |
| Her ikisi de | Cluster onayla + cluster içinden bireysel keyword kaldırma | ✓ |

**User's choice:** Her ikisi de
**Notes:** —

---

| Option | Description | Selected |
|--------|-------------|----------|
| Silinsin | Reddedilen cluster keyword'leri cluster_id=null olur | |
| Arşivlensin | status='rejected' ile DB'de kalır, geri alınabilir | ✓ |

**User's choice:** Arşivlensin
**Notes:** —

---

## Mevcut Cluster'larla Çakışma

| Option | Description | Selected |
|--------|-------------|----------|
| Var olanlar korunur | Onaylı cluster'lara dokunulmaz, sadece draft'lar güncellenir | ✓ |
| Hepsini sıfırla | Tüm cluster'lar iptal, AI baştan gruplar | |
| Kullanıcıya sor | AI öncesinde tercih sorulur | |

**User's choice:** Var olanlar korunur, sadece onaysızlar güncellenir
**Notes:** —

---

## Gate Mekanizması

| Option | Description | Selected |
|--------|-------------|----------|
| En az 1 onaylı cluster | Kısmi onay yeterli | |
| Tüm cluster'lar onaylı | Hiç pending kalmayana kadar gate açılmaz | |
| Manuel "Stratejiyi Onayla" butonu | Ayrı butonla kullanıcı kilitler | ✓ |

**User's choice:** Manuel "Stratejiyi Onayla" butonu
**Notes:** —

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keyword stratejisi sayfasında | Toolbar'a eklenir | ✓ |
| Onay overlay'inin sonunda | Overlay'in altında butona basılarak tamamlanır | |

**User's choice:** Keyword stratejisi sayfasında
**Notes:** —

---

| Option | Description | Selected |
|--------|-------------|----------|
| projects tablosuna alan ekle | projects.keyword_strategy_approved boolean | ✓ |
| keyword_clusters status kolonu | Her cluster'da approved/draft/rejected | |

**User's choice:** projects tablosuna alan ekle
**Notes:** İki karar birleştirildi: keyword_clusters.status AYRICA eklenecek (onay takibi için), projects.keyword_strategy_approved da eklenecek (BLUE-06 gate için).

---

| Option | Description | Selected |
|--------|-------------|----------|
| Evet — "Tümünü Onayla" kısayolu | Overlay üstünde toplu onay/red | ✓ |
| Hayır, tek tek onaylansın | Her cluster bireysel karar | |

**User's choice:** Evet
**Notes:** —

---

## Claude's Discretion

- Overlay animasyonu / geçiş efekti
- Tümünü Onayla sonrası overlay açık/kapalı davranışı
- Yeniden kümelendirmede eski draft'ların replace mantığı
- Migration'da mevcut cluster'lara `status = 'approved'` atama

## Deferred Ideas

- Cluster'lar arası drag & drop — gelecek UX iyileştirme
- Strateji versiyon geçmişi — Phase 22 carry-over ile birleştirilebilir
- AI öneri gerekçesi / açıklama — gelecek milestone
