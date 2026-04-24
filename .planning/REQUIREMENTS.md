# Requirements: SEO Machine — Website Agency Operating System

**Defined:** 2026-04-22
**Core Value:** Her website projesi için sıfırdan açılıp kurgulanan, tüm kararları kaydeden ve stage bazlı ilerleyen tek merkezi proje yönetim sistemi

---

## v1 Requirements (Faz 1 — Decision OS MVP)

### Infrastructure & Auth

- [x] **INFR-01**: Kullanıcı email ve şifre ile giriş yapabilir ve oturumu tarayıcı yenilemesinde devam eder *(completed in 01-04)*
- [x] **INFR-02**: Supabase Postgres şeması (projects, stages, competitors, keywords, keyword_clusters, pages, internal_links, rules, audits, workflow_runs) kurulur *(completed in 01-02)*
- [x] **INFR-03**: API key'ler (DataForSEO, Semrush, OpenAI) Supabase secrets üzerinden güvenli saklanır; hiçbiri frontend'e sızmaz *(completed in 01-03)*
- [x] **INFR-04**: Supabase RLS politikaları kullanıcıyı sadece kendi projelerine erişebilecek şekilde kısıtlar *(completed in 01-03)*

### Project Core

- [x] **PROJ-01
**: Kullanıcı yeni proje oluşturabilir (ad, domain, sektör, hedef ülke, hedef dil, iş modeli, site tipi, marka tonu, rakipler, notlar, özel kurallar)
- [x] **PROJ-02**: Kullanıcı tüm projelerini merkezi panelden görebilir (liste + durum bilgisi)
- [x] **PROJ-03
**: Her proje 10 aşamalı stage engine üzerinde ilerler: Intake → Discovery → Keyword Strategy → Site Blueprint → Page Planning → Page Package → Content Production → SEO Audit → Launch Prep → Post-Launch
- [x] **PROJ-04
**: Kullanıcı aktif stage'i görebilir ve bir sonraki stage'e geçiş aksiyonunu başlatabilir
- [x] **PROJ-05
**: Sistem proje bazlı kararları ve notları kalıcı olarak kaydeder (Decision Memory)

### Rules Engine

- [x] **RULE-01
**: Kullanıcı proje bazlı SEO kuralları tanımlayabilir (örn: SEO title focus keyword ile başlasın mı, H1 exact match olsun mu, slug exact match olsun mu)
- [x] **RULE-02
**: Kural seti panelden güncellenebilir; sistem güncel kuralları sonraki üretimlerde uygular
- [x] **RULE-03**: Global (tüm projeler) ve proje bazlı kurallar birbirinden ayrılır; proje kuralı global kuralı ezer

### Competitor Intelligence

- [x] **COMP-01
**: Kullanıcı bir projeye manuel rakip domain ekleyebilir ve listesini görebilir
- [x] **COMP-02
**: Sistem DataForSEO ile hedef keyword'ler için SERP'ten rakipleri otomatik tespit eder
- [x] **COMP-03
**: Rakip başına top sayfalar, kategori yapısı ve içerik alanları görüntülenir (Semrush/DataForSEO kaynaklı)
- [x] **COMP-04
**: Sistem rakip analizinden boşluk ve fırsat raporu çıkarır (rakiplerin zayıf olduğu alanlar, hızlı girilebilecek keyword boşlukları)

### Keyword Center

- [x] **KEYW-01
**: Kullanıcı CSV dosyasıyla keyword listesi yükleyebilir
- [x] **KEYW-02
**: Kullanıcı tekil keyword'leri manuel olarak ekleyebilir
- [x] **KEYW-03
**: Sistem DataForSEO ile her keyword için hacim, CPC, keyword difficulty ve search intent çeker (enrichment)
- [ ] **KEYW-04**: Sistem keyword'leri SERP similarity ve intent mapping ile otomatik cluster'lara böler
- [ ] **KEYW-05**: Her cluster için primary keyword atanır; tekil keyword başka cluster'a atanamaz (cannibalization prevention)
- [ ] **KEYW-06**: Sistem her keyword için opportunity score hesaplar (traffic potential, commercial value, competition score bileşimi)
- [ ] **KEYW-07**: Kullanıcı cluster'ları ve keyword'leri panelden görüntüleyebilir, düzenleyebilir, yeniden atayabilir

### Site Blueprint

- [ ] **BLUE-01**: Sistem keyword cluster'larından otomatik site tree üretir (menü grupları, kategori/servis/ürün/blog ayrımı, hub-spoke yapısı)
- [ ] **BLUE-02**: Her keyword tam olarak bir sayfaya map'lenir (keyword-to-page mapping); çakışma tespit edilir
- [ ] **BLUE-03**: Kullanıcı oluşturulan site tree'yi görüntüleyebilir, sayfa ekleyebilir/çıkarabilir/yeniden sıralayabilir
- [ ] **BLUE-04**: Sayfa planner: her sayfa için page type (homepage/category/service/product/blog/landing), focus keyword, intent ve öncelik atanır
- [ ] **BLUE-05**: Internal link haritası üretilir — pillar ve support sayfa ilişkileri, anchor text önerileri; orphan sayfa tespit edilir ve uyarı verilir

---

## v2 Requirements (Faz 2 — Page Package OS)

### Page Package Engine

- **PAGE-01**: Her sayfa için tam SEO paketi üretilir: slug, SEO title, meta description, H1, heading yapısı (H2–H4), içerik blokları taslağı, CTA alanları, görsel isimleri, alt text önerileri, iç link giriş/çıkışları, schema tipi, canonical önerisi, FAQ
- **PAGE-02**: Schema üretimi sayfa tipine göre otomatik seçilir (Organization/WebSite, WebPage, Service, FAQPage, LocalBusiness, Product vb.) ve JSON-LD formatında çıktılanır
- **PAGE-03**: Metadata validator, rules engine kurallarına göre title/meta/H1/slug tutarlılığını otomatik kontrol eder
- **PAGE-04**: Sayfa paketi "kilitlenme" mekanizması — paket onaylanmadan içerik üretimine izin verilmez
- **PAGE-05**: Revision history — her sayfa paketinin geçmiş versiyonları saklanır

### QA Scoring

- **QUAL-01**: İkinci LLM modeli üretilen sayfa paketlerini denetler (intent drift, robotik dil, entity eksikliği, duplicate risk, iç link eksikliği)
- **QUAL-02**: Her sayfa için SEO score, content score, human score, schema score ve readiness score hesaplanır ve gösterilir

---

## v3 Requirements (Faz 3 — Autonomous Growth Layer)

### Content Studio

- **CONT-01**: Sayfa paketi kilitlendikten sonra tam sayfa içeriği üretimi (tüm proje verisi, kurallar ve sayfa paketi baz alınarak)
- **CONT-02**: İçerik versiyonları saklanır; kullanıcı versiyon karşılaştırabilir

### Publishing

- **PUBL-01**: Onaylanan sayfalar WordPress REST API ile taslak veya yayında olarak gönderilebilir (slug, title, content, excerpt, meta, schema)
- **PUBL-02**: Publish job durumu (başarılı/başarısız/beklemede) panelde takip edilir

### Monitoring & Recovery

- **MNTR-01**: Google Search Console entegrasyonu ile yayınlanan sayfaların query/impression/click verileri çekilir
- **MNTR-02**: Ranking düşüşü veya trafik kaybı tespit edildiğinde recovery task otomatik açılır
- **MNTR-03**: Refresh/recovery engine — düşen sayfaların güncellenmesi için neyin eksik olduğunu analiz eder

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Chatbot / serbest konuşma arayüzü | Bu bir AI asistan değil, operasyon sistemi; human-directed çalışır |
| Otomatik yayın (onaysız) | Her kritik aksiyon kullanıcı onayından geçer |
| Sosyal medya yönetimi | Kapsam dışı, başka araçlar |
| Email pazarlama | Kapsam dışı |
| Fatura / sözleşme yönetimi | CRM değil, üretim OS'i |
| Multi-tenant SaaS | Başlangıçta tek ajans; SaaS dönüşümü ilerleyen milestone'da |
| n8n kurulumu (Faz 1) | Faz 1'de n8n gerekmez; Edge Functions yeterli; n8n Faz 2-3'te eklenir |
| Mobil uygulama | Web-first; mobil ilerleyen versiyon |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | Phase 1 | Complete (01-04) |
| INFR-02 | Phase 1 | Complete (01-02) |
| INFR-03 | Phase 1 | Complete (01-03) |
| INFR-04 | Phase 1 | Complete (01-03) |
| PROJ-01 | Phase 2 | Complete |
| PROJ-02 | Phase 2 | Complete |
| PROJ-03 | Phase 2 | Complete |
| PROJ-04 | Phase 2 | Complete |
| PROJ-05 | Phase 2 | Complete |
| RULE-01 | Phase 3 | Complete |
| RULE-02 | Phase 3 | Complete |
| RULE-03 | Phase 3 | Complete |
| COMP-01 | Phase 4 | Pending |
| COMP-02 | Phase 4 | Pending |
| COMP-03 | Phase 4 | Pending |
| COMP-04 | Phase 4 | Pending |
| KEYW-01 | Phase 5 | Pending |
| KEYW-02 | Phase 5 | Pending |
| KEYW-03 | Phase 5 | Pending |
| KEYW-04 | Phase 6 | Pending |
| KEYW-05 | Phase 6 | Pending |
| KEYW-06 | Phase 6 | Pending |
| KEYW-07 | Phase 6 | Pending |
| BLUE-01 | Phase 7 | Pending |
| BLUE-02 | Phase 7 | Pending |
| BLUE-03 | Phase 7 | Pending |
| BLUE-04 | Phase 8 | Pending |
| BLUE-05 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28/28
- Unmapped: 0

---
*Requirements defined: 2026-04-22*
*Last updated: 2026-04-22 after 01-04 completion (INFR-01 marked complete — all Phase 1 requirements satisfied)*
