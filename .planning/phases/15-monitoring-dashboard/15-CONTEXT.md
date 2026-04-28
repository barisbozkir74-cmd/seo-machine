# Phase 15: Monitoring Dashboard — Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Kullanıcı tek sayfada (/projeler/[id]/izleme) hem cluster bazlı trafik özetini hem de sayfa bazlı GSC performans metriklerini görebilir; pozisyon düşüşü yaşayan sayfalar decay alert ile işaretlenir.

**In scope:**
- `/projeler/[id]/izleme` route + ProjectNav "İzleme" item
- Zaman periyodu: 7G / 28G / 90G tab switch (varsayılan 28G)
- Cluster bazlı trafik: `gsc_metrics.page_id → pages.cluster_id → keyword_clusters` join, server-side SQL aggregation
- Metriks: SUM(clicks), SUM(impressions), weighted CTR = SUM(clicks) / NULLIF(SUM(impressions), 0), AVG(avg_position)
- Sayfa bazlı GSC liste: clicks, impressions, avg_position, delta_position
- Decay alert: `delta_position >= +5` (önceki eşit periyoda göre), minimum impression filtresi (örn: impressions > 10)

**Out of scope (Phase 15):**
- WordPress import sayfaları (Phase 15.5)
- Cluster-to-revenue sınıflandırma (Phase 17)
- Keyword seviyesinde forensic analiz (Phase 17)
- Kullanıcı ayarlanabilir decay eşiği (Phase 16)
- Date range picker (Phase 16+)

</domain>

<decisions>
## Implementation Decisions

### D1: Route ve Navigasyon
- **Route:** `/projeler/[id]/izleme`
- **ProjectNav:** "İzleme" item eklenir, `built: true`
- **Rationale:** Kullanıcı kararı — "izleme" Phase 15'in ötesine ölçeklenir (Phase 15.5 WP import, Phase 16 recovery, internal link sorunları). `/performans` fazla dar, dashboard proje sayfasını şişirir.

### D2: Zaman Periyodu
- **UI:** Sayfada "7G / 28G / 90G" tab switch
- **Varsayılan:** 28 gün
- **Implementation:** `?period=7|28|90` query param, server component fetch'i buna göre çalışır
- **Kapsam:** Hem cluster hem sayfa görünümü aynı periyot seçimini kullanır

### D3: Cluster Bazlı Aggregation
- **Yöntem:** Server-side SQL — `gsc_metrics.page_id → pages.cluster_id → keyword_clusters`
- **Metriks:**
  - `SUM(clicks)` → cluster toplam tıklama
  - `SUM(impressions)` → cluster toplam gösterim
  - `SUM(clicks) / NULLIF(SUM(impressions), 0)` → weighted CTR (düz AVG değil)
  - `AVG(avg_position)` → cluster ortalama pozisyon
- **Not:** Keyword seviyesinde eşleme yok — N+1 riski önlenir, Phase 17'ye ertelendi

### D4: Decay Alert
- **Eşik:** `delta_position >= +5` (pozisyon kötüleşmesi = daha büyük sayı)
- **Periyot karşılaştırması:** Seçili periyodun önceki eşit periyoduyla karşılaştır (örn: 28G seçiliyse son 28 gün vs önceki 28 gün)
- **Gürültü filtresi:** `impressions > 10` (düşük impression'lı sayfalar alert'e dahil edilmez)
- **Gösterim:** Decay alert olan sayfalar kırmızı badge / uyarı ikonu ile işaretlenir
- **Phase 16 notu:** Advanced scoring ve kullanıcı ayarlanabilir eşik Phase 16'ya ertelendi

</decisions>

<prior_context>
## Bağımlılıklar ve Mevcut Durum

- `gsc_metrics` tablosu Phase 14'te kuruldu: (project_id, page_id, date, keyword, clicks, impressions, avg_position)
- Index: `idx_gsc_metrics_page_date`, `idx_gsc_metrics_project_date`
- `pages` tablosu: `cluster_id` kolonu mevcut → `keyword_clusters` join için hazır
- GSC sync: n8n webhook veya manuel "Senkronize Et" butonuyla veriler Supabase'e yazılıyor
- ProjectNav: dark theme, Türkçe labels, `built` flag sistemi, shadcn/ui

## Deferred Ideas
- Date range picker → Phase 16
- Kullanıcı ayarlanabilir decay eşiği → Phase 16
- Keyword-level forensic → Phase 17
- WP imported pages entegrasyonu → Phase 15.5 (MON-03)
- MON-03 (imported pages + GSC birleşik görünüm) Phase 15.5'e bağımlı

</prior_context>
