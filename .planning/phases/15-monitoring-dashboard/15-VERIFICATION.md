---
phase: 15-monitoring-dashboard
verified: 2026-04-28T11:31:00Z
status: human_needed
score: 13/14 must-haves verified
overrides_applied: 0
deferred:
  - truth: "Monitoring dashboard imported page verilerini GSC metrikleriyle birleştirilmiş gösterebilir (MON-03)"
    addressed_in: "Phase 15.5"
    evidence: "ROADMAP.md Phase 15 SC-4: 'Eğer Phase 15.5 tamamlandıysa: imported page verileri GSC metrikleriyle birleştirilir' — açıkça Phase 15.5'e bağımlı"
human_verification:
  - test: "Period tab değişimi URL ve yeniden render'ı tetikliyor mu?"
    expected: "7G sekmesine tıklandığında URL ?period=7 olmalı ve tablo yeni dönem verileriyle render edilmeli"
    why_human: "router.push çağrısı statik analizle doğrulanabilir ama SSR sayfa yeniden render döngüsü çalışan uygulama gerektirir"
  - test: "GSC bağlı değilken izleme sayfası boş durum gösteriyor mu?"
    expected: "gsc_property_url null olan projede tablo yerine 'GSC verisi bulunamadı' mesajı ve 'Proje Bilgileri →' linki görünmeli"
    why_human: "Koşullu render branch'i kod incelemesiyle doğrulandı ancak gerçek Supabase verisiyle UI davranışı onaylanmalı"
  - test: "Decay badge doğru görünüyor mu?"
    expected: "deltaPosition >= +5 VE impressions > 10 olan sayfa satırında kırmızı 'Düşüş' badge görünmeli; eşiğin altındaki satırlarda '—' gösterilmeli"
    why_human: "Badge render mantığı kod incelemesiyle doğrulandı; gerçek GSC verisi veya seed data ile görsel doğrulama gerekiyor"
---

# Phase 15: Monitoring Dashboard — Doğrulama Raporu

**Phase Hedefi:** Kullanıcı tek sayfada hem cluster bazlı trafik özetini hem de sayfa bazlı GSC performans metriklerini görebilir; pozisyon düşüşü yaşayan sayfalar decay alert ile işaretlenir
**Doğrulama Tarihi:** 2026-04-28T11:31:00Z
**Durum:** human_needed
**Yeniden Doğrulama:** Hayır — ilk doğrulama

---

## Hedef Başarımı

### Gözlemlenebilir Gerçekler (Must-Have Truths)

**Plan 15-01 (Veri Katmanı):**

| # | Gerçek | Durum | Kanıt |
|---|--------|-------|-------|
| 1 | Server-side cluster aggregation clicks, impressions, weighted CTR, AVG(avg_position) döndürür | VERIFIED | `aggregation.ts:139` — `ctr = agg.impressions === 0 ? 0 : agg.clicks / agg.impressions`; 4 vitest testi geçiyor |
| 2 | Server-side page aggregation per-page clicks, impressions, avg_position ve delta_position döndürür | VERIFIED | `aggregation.ts:263-278` — tüm alanlar doldurulmuş; `getPageMetrics` tam implementasyon |
| 3 | Decay flag delta_position >= +5 VE impressions > 10 iken true | VERIFIED | `aggregation.ts:264-265` — `deltaPosition >= 5 && curr.impressions > 10`; vitest'te Test 2 bu iki senaryoyu kapsıyor |
| 4 | GET /api/monitoring/clusters?projectId=...&period=7\|28\|90 auth kontrolü ile çalışıyor | VERIFIED | `clusters/route.ts:6-55` — 400/401/404/500 tümü mevcut; getClusterMetrics çağrısı doğrulanmış |
| 5 | GET /api/monitoring/pages?projectId=...&period=7\|28\|90 auth kontrolü ile çalışıyor | VERIFIED | `pages/route.ts:6-55` — aynı guard pattern; getPageMetrics çağrısı doğrulanmış |
| 6 | Her iki endpoint kimlik doğrulanmamış kullanıcılara 401, yetkisiz projeye 404 döndürür | VERIFIED | Her iki route'ta `supabase.auth.getUser()` + `eq('user_id', user.id)` mevcut; 401 ve 404 response'ları doğrulandı |

**Plan 15-02 (UI Katmanı):**

| # | Gerçek | Durum | Kanıt |
|---|--------|-------|-------|
| 7 | Kullanıcı ProjectNav'daki yeni 'İzleme' öğesiyle /projeler/[id]/izleme'ye erişiyor | VERIFIED | `ProjectNav.tsx:22` — son item olarak `{ label: 'İzleme', href: '/projeler/${projectId}/izleme', built: true }` |
| 8 | Kullanıcı 7G / 28G / 90G period tab bar görüyor, 28G varsayılan | VERIFIED | `period-tab-bar.tsx:16` — `const periods: Period[] = [7, 28, 90]`; `izleme/page.tsx:19` — `periodRaw === '7' ? 7 : periodRaw === '90' ? 90 : 28` |
| 9 | Period tab'a tıklamak URL'yi ?period=7\|28\|90 olarak güncelliyor ve sayfa yeniden render ediliyor | ? HUMAN | `router.push('/projeler/${projectId}/izleme?period=${p}')` kodu doğrulandı; SSR yeniden render döngüsü çalışan uygulama gerektirir |
| 10 | Kullanıcı clicks DESC sıralı cluster tablosunu görüyor | VERIFIED | `aggregation.ts:154` — `result.sort((a, b) => b.clicks - a.clicks)`; `cluster-summary-table.tsx` tüm kolonları render ediyor |
| 11 | Kullanıcı clicks DESC sıralı sayfa tablosunu görüyor | VERIFIED | `aggregation.ts:281` — aynı sıralama; `page-metrics-table.tsx` 6 kolon (Sayfa, Tıklama, Gösterim, Ort. Pozisyon, Değişim, Durum) render ediyor |
| 12 | delta_position >= +5 VE impressions > 10 olan sayfalar kırmızı 'Düşüş' decay badge gösteriyor | ? HUMAN | `page-metrics-table.tsx:67-70` — `p.isDecayed` flag'ine göre Badge render mantığı doğrulandı; görsel onay gerekiyor |
| 13 | project.gsc_property_url null iken sayfa UI-SPEC boş durum metnini render ediyor | VERIFIED | `izleme/page.tsx:33` — `gscConnected` kontrolü; `page.tsx:62-73` — tam boş durum metni ve linki mevcut |
| 14 | GSC bağlı ama dönem için metric yoksa her iki tablo 'GSC verisi bulunamadı' gösteriyor | VERIFIED | `cluster-summary-table.tsx:19-27` ve `page-metrics-table.tsx:23-29` — her ikisinde de `length === 0` boş durum branch'i mevcut |

**Skor: 12/14 otomatik doğrulandı (2 insan onayı bekliyor, MON-03 ertelenmiş)**

---

### Gereksinim Karşılama Durumu

| Gereksinim | Plan | Açıklama | Durum | Kanıt |
|------------|------|----------|-------|-------|
| MON-01 | 15-01, 15-02 | Cluster bazlı trafik özeti monitoring dashboard'da gösterilebilir | SATISFIED | `getClusterMetrics` + `ClusterSummaryTable` tam implementasyon; vitest geçiyor |
| MON-02 | 15-01, 15-02 | Sayfa bazlı GSC performansı ve decay alert'leri gösterilebilir | SATISFIED | `getPageMetrics` decay hesabı + `PageMetricsTable` Düşüş badge'i; 4 test geçiyor |
| MON-03 | 15-02 (kısmi) | Imported page verilerinin GSC metrikleriyle birleştirilmesi | DEFERRED | ROADMAP.md'de açıkça "Phase 15.5 bağımlı" olarak belirtilmiş; Phase 15.5 kapsamına ertelenmiş |

---

### Zorunlu Artifacts

| Artifact | Beklenti | Durum | Detay |
|----------|----------|-------|-------|
| `src/lib/monitoring/aggregation.ts` | getClusterMetrics, getPageMetrics, 3 tip export | VERIFIED | 5 export doğrulandı; 286 satır gerçek implementasyon |
| `src/lib/monitoring/aggregation.test.ts` | 3+ vitest testi geçiyor | VERIFIED | 4 test, 4 geçiyor (weighted CTR, decay true, decay false, cluster exclusion) |
| `src/app/api/monitoring/clusters/route.ts` | Auth guard ile GET handler | VERIFIED | 55 satır; auth + ownership + GSC check + getClusterMetrics çağrısı |
| `src/app/api/monitoring/pages/route.ts` | Auth guard ile GET handler | VERIFIED | 55 satır; aynı pattern; getPageMetrics çağrısı |
| `src/app/(dashboard)/projeler/[id]/ProjectNav.tsx` | 'İzleme' nav item | VERIFIED | Satır 22'de son item olarak eklendi |
| `src/app/(dashboard)/projeler/[id]/izleme/page.tsx` | Auth + GSC check ile SSR monitoring sayfası | VERIFIED | 93 satır; getClusterMetrics + getPageMetrics parallel fetch |
| `src/app/(dashboard)/projeler/[id]/izleme/period-tab-bar.tsx` | 'use client' ile period tabs | VERIFIED | 40 satır; sadece client component; router.push entegrasyonu |
| `src/app/(dashboard)/projeler/[id]/izleme/cluster-summary-table.tsx` | Server component tablo | VERIFIED | 53 satır; server component (use client yok); ClusterMetricRow[] kabul ediyor |
| `src/app/(dashboard)/projeler/[id]/izleme/page-metrics-table.tsx` | Decay badge ile server component tablo | VERIFIED | 80 satır; server component; p.isDecayed'a göre Badge render ediyor |

---

### Key Link Doğrulaması

| From | To | Via | Durum | Detay |
|------|-----|-----|-------|-------|
| `clusters/route.ts` | `aggregation.ts` | `import { getClusterMetrics }` | WIRED | `route.ts:3` — pattern tam eşleşiyor |
| `pages/route.ts` | `aggregation.ts` | `import { getPageMetrics }` | WIRED | `route.ts:3` — pattern tam eşleşiyor |
| `aggregation.ts` | gsc_metrics + pages + keyword_clusters | Supabase select | WIRED | `.from('gsc_metrics')` `aggregation.ts:65`'te; pages:80'de; keyword_clusters:92'de |
| `izleme/page.tsx` | `aggregation.ts` | `import { getClusterMetrics, getPageMetrics }` | WIRED | `page.tsx:4` — her iki fonksiyon import edilip çağrılıyor |
| `izleme/page.tsx` | `ProjectNav.tsx` | `<ProjectNav activePath=...>` | WIRED | `page.tsx:57` — `<ProjectNav projectId={id} activePath={...} />` |
| `period-tab-bar.tsx` | `next/navigation` | `useRouter().push` | WIRED | `period-tab-bar.tsx:3,15,26` — import + kullanım |
| `ProjectNav.tsx` | izleme route | href `/projeler/${projectId}/izleme` | WIRED | `ProjectNav.tsx:22` — `/izleme` pattern mevcut |

---

### Veri Akışı İzlemesi (Level 4)

| Artifact | Veri Değişkeni | Kaynak | Gerçek Veri Üretiyor mu | Durum |
|----------|----------------|--------|--------------------------|-------|
| `ClusterSummaryTable` | `clusters` prop | `getClusterMetrics(supabase, id, period)` — Supabase'den gsc_metrics + pages + keyword_clusters | Evet — gercek DB sorguları | FLOWING |
| `PageMetricsTable` | `pages` prop | `getPageMetrics(supabase, id, period)` — paralel gsc_metrics sorguları (current + prior) | Evet — gerçek DB sorguları | FLOWING |
| `PeriodTabBar` | `active` prop | SSR page'den geçiriliyor; searchParams.period'dan | Evet — URL kaynaklı | FLOWING |

---

### Anti-Pattern Taraması

| Dosya | Satır | Pattern | Ciddiyet | Etki |
|-------|-------|---------|----------|------|
| `aggregation.ts` | 116, 229 | `row.avg_position ?? 0` — null pozisyon değeri sıfır olarak işleniyor | Uyarı | avgPosition ortalamasını aşağı çekiyor; REVIEW.md WR-01 bulgusu |
| `izleme/page.tsx` | 23 | `if (!user) notFound()` — kimlik doğrulanmamışlara 401 yerine 404 | Bilgi | Login yönlendirmesi yerine kafa karıştırıcı 404; REVIEW.md WR-02 bulgusu |

**Stub yok** — hiçbir dosyada hardcoded placeholder, `return []` stub, veya `return null` bulunamadı. Tüm veri akışları gerçek Supabase sorgularından geçiyor.

---

### Davranışsal Spot-Check'ler

| Davranış | Komut | Sonuç | Durum |
|----------|-------|-------|-------|
| Aggregation lib 5 symbol export ediyor | `grep -E "^export (async function\|type)" aggregation.ts` | 5 satır döndü | PASS |
| Service role client monitoring'de kullanılmıyor | `grep -r "createServiceClient\|SERVICE_ROLE" src/app/api/monitoring/` | 0 eşleşme | PASS |
| Vitest aggregation testleri geçiyor | `npx vitest run aggregation.test.ts` | 4 passed, 0 failed | PASS |
| TypeScript monitoring/izleme dosyalarında hata yok | `npx tsc --noEmit \| grep "monitoring\|izleme"` | 0 hata (pre-existing hatalar başka dosyalarda) | PASS |
| Decay eşiği UI'da çoğaltılmamış | `grep -E "deltaPosition >= 5" page-metrics-table.tsx` | 0 eşleşme | PASS |
| variant prop kullanılmamış (Badge kuralı) | `grep -E "variant=['\"]" page-metrics-table.tsx` | 0 eşleşme | PASS |

---

### İnsan Doğrulaması Gerekiyor

#### 1. Period Tab Değişimi — URL + SSR Yeniden Render

**Test:** Projeye giriş yap, `/projeler/{id}/izleme` sayfasına git. 7G sekmesine tıkla.
**Beklenti:** URL `?period=7` olmalı; tablo farklı dönem aggregation'ı ile yeniden render edilmeli (28G varsayılan değerinden farklı satır sayısı/değerleri)
**Neden insan:** `router.push` çağrısı kod incelemesiyle doğrulandı; SSR yeniden render döngüsü (Next.js searchParams SSR) canlı uygulama gerektirir

#### 2. GSC Bağlı Değil — Boş Durum Görünümü

**Test:** `gsc_property_url = null` olan bir proje için izleme sayfasına git.
**Beklenti:** Tablo yerine "GSC verisi bulunamadı" mesajı, yardımcı açıklama metni ve "Proje Bilgileri →" linki görünmeli
**Neden insan:** Koşullu render mantığı doğrulandı; Supabase'deki gerçek proje verisiyle UI davranışı onaylanmalı

#### 3. Decay Badge — Görsel Doğrulama

**Test:** delta_position >= +5 ve impressions > 10 olan sayfa metriklerine sahip bir proje için izleme sayfasını aç.
**Beklenti:** İlgili satırda "Düşüş" kırmızı badge görünmeli; eşiğin altındaki satırlar "—" göstermeli
**Neden insan:** Badge render mantığı (p.isDecayed) kod incelemesiyle doğrulandı; görsel doğrulama gerçek GSC verisi veya seed data gerektirir

---

### Ertelenmiş Öğeler

Phase 15.5'te ele alınacak öğeler — bu phase için boşluk değil.

| # | Öğe | Ele Alındığı Phase | Kanıt |
|---|-----|-------------------|-------|
| 1 | MON-03: Imported page verileri GSC metrikleriyle birleştirilmiş gösteriliyor | Phase 15.5 | ROADMAP.md Phase 15 SC-4: "Eğer Phase 15.5 tamamlandıysa: imported page verileri GSC metrikleriyle birleştirilir" |

---

### Genel Değerlendirme

Phase 15 hedefini büyük ölçüde gerçekleştirdi. Aggregation kütüphanesi gerçek Supabase sorgularıyla tam olarak implemente edilmiş, 4 vitest testi geçiyor ve doğru weighted CTR + decay hesabı yapılıyor. API route'ları doğru auth + ownership guard'larına sahip. UI katmanı 5 yeni dosyayla tamamlanmış: SSR sayfası, client-only period tabs ve iki server component tablo. ProjectNav düzgün güncellendi.

REQUIREMENTS.md'den MON-03, Phase 15.5 bağımlılığı yüzünden bilinçli olarak ertelendi — bu bir boşluk değil.

Kod incelemesinden iki not:
1. `aggregation.ts`'te null avg_position değerleri sıfır olarak işleniyor ve ortalama pozisyonu yapay olarak düşürüyor (REVIEW.md WR-01). Bu doğruluk sorunu ama blocker değil.
2. `izleme/page.tsx`'te kimlik doğrulanmamış kullanıcılar `/login`'e yönlendirilmek yerine 404 alıyor (REVIEW.md WR-02). UX sorunu ama güvenlik açığı değil.

Her iki bulgu da ilerleyen bir plan veya hotfix olarak düzeltilebilir.

---

_Doğrulandı: 2026-04-28T11:31:00Z_
_Doğrulayan: Claude (gsd-verifier)_
