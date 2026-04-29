# Phase 16: Recovery Engine — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 16-recovery-engine
**Areas discussed:** Recovery task DB şeması, Kullanıcı UX — nerede görür?, REC-03: Imported pages recovery

---

## Recovery task DB şeması

| Option | Description | Selected |
|--------|-------------|----------|
| Yeni recovery_tasks tablosu | Her decay olayı ayrı satır: source, source_id, detected_at, position_before, position_after, status. Tarihçe saklanabilir. | ✓ |
| page_packages üzerinde kolonlar | recovery_status + recovery_detected_at + position_drop kolonları eklenir. Daha az tablo, ama sadece page_packages kapsamında çalışır. | |

**User's choice:** Yeni recovery_tasks tablosu

---

| Option | Description | Selected |
|--------|-------------|----------|
| 3 durum: open → in_progress → resolved | Basit iş akışı. | |
| 2 durum: open → resolved | En basit. | |
| 4 durum: open / in_progress / resolved / dismissed | Kullanıcı "görmezden gel" diyebilir; recovery listesini temizleyebilir. | ✓ |

**User's choice:** 4 durum: open / in_progress / resolved / dismissed

---

| Option | Description | Selected |
|--------|-------------|----------|
| Manuel — kullanıcı 'Tamamlandı' butonuna basar | Kullanıcı onaylar. Her zaman doğru çalışır. | |
| Otomatik — WP'ye tekrar publish edildiğinde | wp_published_at güncellendiğinde recovery task otomatik resolved. Kullanıcı extra adım atmaz. | ✓ |

**User's choice:** Otomatik — WP'ye tekrar publish edildiğinde

---

## Kullanıcı UX — nerede görür?

| Option | Description | Selected |
|--------|-------------|----------|
| İzleme sayfasında | /projeler/[id]/izleme'ye eklenir. Yeni route gerekmez. | ✓ |
| Ayrı /recovery route | /projeler/[id]/recovery ayrı sayfa. ProjectNav'a eklenir. | |
| Sayfa listesinde (sayfalar) | Mevcut sayfa listesine 'Güncelleme Gerekli' badge eklenir. | |

**User's choice:** İzleme sayfasında

---

| Option | Description | Selected |
|--------|-------------|----------|
| 3. sekme: 'Recovery' | Mevcut 'Cluster Özeti' ve 'Sayfa Metrikleri' yanına 3. sekme. | ✓ |
| Decay alert sayfasının altında panel | Sayfa Metrikleri sekmesinde genişleyen panel. | |

**User's choice:** 3. sekme: 'Recovery'

---

| Option | Description | Selected |
|--------|-------------|----------|
| Page Package editor'a yönlendir | Task → in_progress, Page Package editor'a gönderir. Yeni ekran gerekmez. | ✓ |
| Paket içinde 'Recovery' banner göster | Editor'da banner çıkar, task editor'dan yönetilir. | |

**User's choice:** Page Package editor'a yönlendir (task in_progress)

---

## REC-03: Imported pages recovery

| Option | Description | Selected |
|--------|-------------|----------|
| Sadece flag — recovery_tasks'a kaydedilir | source='imported_page', source_id=id. Otomatik page_package draft yok. | ✓ |
| Otomatik draft page_package oluştur | Weak imported page için otomatik paket oluşturulur. Sınır bulanıklaşır. | |

**User's choice:** Sadece flag — recovery_tasks'a kaydedilir

---

| Option | Description | Selected |
|--------|-------------|----------|
| flag_weak_page=true VE gsc_avg_position > 20 | Phase 15.5 D-10 ile tutarlı. | ✓ |
| flag_weak_page=true VE gsc_avg_position > 15 | Daha agresif eşik. Daha fazla false positive. | |

**User's choice:** flag_weak_page=true VE gsc_avg_position > 20

---

## Claude's Discretion

- Decay eşiği (page_packages): delta_position >= +5, impressions > 10 (Phase 15 tutarlılığı — kullanıcı tartışmadı)
- n8n workflow implementasyon detayı: Supabase REST vs. custom endpoint
- Imported page resolved geçişi: ne zaman/nasıl tetikleneceği

## Deferred Ideas

- Decay eşiği UI'dan ayarlanabilir → Phase 17+
- Date range picker → Phase 16+ (Phase 15'ten ertelendi)
- Toplu dismiss/resolve → Phase 16 dışı
- Recovery e-posta bildirimi → Phase 17+
- Imported page → otomatik page_package draft → kullanıcı istemedi
