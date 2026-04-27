# SEO Machine — Website Agency Operating System

## What This Is

Bir web tasarım & SEO ajansının yeni gelen her website projesini uçtan uca yöneten merkezi operasyon sistemi. Proje açılışından keyword stratejisine, sayfa paketi üretimine, SEO denetimine ve WordPress yayınına kadar tüm süreçleri tek bir platform üzerinden, stage bazlı ve hafıza destekli şekilde yürütür. Klasik bir AI içerik aracı değil; proje hafızası, kural motoru ve sayfa üretim motoruyla çalışan bir **Website Agency OS**.

## Core Value

Her website projesi için sıfırdan açılıp kurgulanan, tüm kararları kaydeden ve stage bazlı ilerleyen **tek merkezi proje yönetim sistemi** — ajans çalışanı sistemi yönetir, sistem kendi başına rastgele akmaz.

## Previous Milestone: v2.0 Page Package OS — COMPLETE (2026-04-25)

**Shipped features:**
- Schema Center — page_type'a göre JSON-LD üretimi (Organization, WebPage, Service, FAQPage, LocalBusiness) *(Phase 10)*
- Metadata Validator — title/meta/H1/slug tutarlılık kontrolü, kilitleme öncesi uyarı *(Phase 11)*
- Rules Engine — proje bazlı SEO kuralları, panelden değiştirilebilir *(Phase 3)*
- QA Scoring — SEO score, content score, human score, schema score, readiness score — Claude QA denetimi ile *(Phase 11)*

## Current Milestone: v3.0 Autonomous Growth Layer

**Goal:** Kilitlenen sayfa paketlerini içerikle doldur, WordPress'e yayınla, GSC ile izle ve performans düşüşlerini otomatik tespitle devir al.

**Target features:**
- Content Studio — heading yapısına göre bölüm bölüm AI içerik üretimi, insan onay akışı
- WordPress REST API publish — slug, title, content, meta, schema ile draft/publish gönderimi
- Google Search Console entegrasyonu — index durumu + performans verisi çekimi
- Recovery & Refresh Engine — ranking düşüşü tespiti, güncelleme görevi açma
- Monitoring Dashboard — cluster bazlı trafik, sayfa bazlı izleme
- Niche Selection Engine — volüm, rekabet, ticari değer, programmatic potansiyel skorlaması
- Cluster-to-Revenue Mapping — bilgi trafiği vs. ticari intent ayrımı

## Requirements

### Validated

#### Project Core (Validated in Phase 2: project-core — 2026-04-22)
- [x] Yeni proje oluşturma (ad, domain, sektör, hedef ülke/dil, iş modeli, site tipi, marka tonu, rakipler, notlar)
- [x] Proje bazlı hafıza — tüm kararlar, stage geçmişi ve kurallar kalıcı olarak kaydedilir
- [x] Tüm projelerin görüntülendiği merkezi proje paneli
- [x] Her proje için 10 aşamalı stage engine (Intake → Discovery → Keyword Strategy → Blueprint → Page Planning → Page Package → Content → Audit → Launch Prep → Post-Launch)

### Active

#### Research & Intelligence (Validated in Phase 4: competitor-intelligence — 2026-04-23)
- [x] Rakip toplama ve kaydetme (COMP-01, COMP-02)
- [x] Rakip sayfa yapısı, içerik, kategori analizi (COMP-03)
- [x] Pazar boşluğu ve fırsat tespiti (karar destek çıktısı) (COMP-04)
- [ ] Niche selection engine — volüm, rekabet, ticari değer, programmatic potansiyel skorlaması

#### Keyword Strategy (Validated in Phase 5-6 — 2026-04-24)
- [x] CSV ile keyword import veya manuel giriş (KEYW-01, KEYW-02)
- [x] DataForSEO ile keyword enrichment (hacim, intent, CPC, difficulty) (KEYW-03)
- [x] Keyword clustering (SERP similarity + intent mapping) (KEYW-04)
- [x] Opportunity scoring — traffic potential, commercial value, competition score (KEYW-06)
- [ ] Cluster-to-revenue mapping (bilgi trafiği vs. ticari intent ayrımı)
- [x] Cannibalization prevention — tek cluster için tek primary page zorunluluğu (KEYW-05)

#### Site Blueprint (Validated in Phase 7: site-blueprint-tree — 2026-04-24)
- [x] Keyword cluster'larından site tree üretimi (generatePagesFromClusters — BLUE-01)
- [x] Menü, kategori/servis/ürün/blog ilişkisi — D-02 intent→page_type mapping
- [x] Keyword-to-page mapping + conflict detection (BLUE-02)
- [x] Site tree reorder — ↑↓ sort_order swap (BLUE-03)
- [x] Tab switcher: Ağaç Görünümü + Keyword Eşleme
- [x] D-06 slugify: Türkçe normalize, max 60 char, -2/-3 duplicate suffix

#### Page Production (Validated in Phase 8: page-planner-internal-links — 2026-04-24)
- [x] Page planner — hangi sayfalar açılacak, tipi, önceliği, focus keyword'ü (BLUE-04)
- [x] Internal link map — pillar–support–bridge mantığı, orphan page kontrolü (BLUE-05)
- [x] Page Package Engine — her sayfa için: slug, SEO title, meta description, H1, heading yapısı, içerik blokları, CTA, görsel isimleri, alt text, iç link giriş/çıkışı, schema, canonical, FAQ (Validated in Phase 9: page-package-generator — 2026-04-24)
- [x] Schema üretimi (page type'a göre: Organization, WebPage, Service, FAQPage, LocalBusiness vb.) *(Validated in Phase 10 — 2026-04-25)*
- [x] Metadata validator — rules engine ile title/meta/H1/slug tutarlılığı kontrolü *(Validated in Phase 11 — 2026-04-25)*

#### Rules & Governance
- [x] Proje bazlı ve global SEO kuralları (SEO title keyword ile başlasın mı, H1 exact match mı, slug exact match mı, hangi schema zorunlu vb.) *(Validated in Phase 3)*
- [x] Kurallar panelden değiştirilebilir, sistem buna göre davranır *(Validated in Phase 3)*

#### Content & QA
- [x] Content Studio — sayfa paketi kilitlendikten sonra içerik üretimi *(Validated in Phase 12 — 2026-04-26)*
- [x] İkinci model ile QA — intent drift, robotik dil, entity eksikliği, duplicate risk kontrolü *(Validated in Phase 11 — 2026-04-25)*
- [x] SEO score, content score, human score, schema score, readiness score *(Validated in Phase 11 — 2026-04-25)*

#### Publishing & Monitoring
- [x] WordPress REST API ile draft/publish gönderimi (slug, title, content, meta, schema) *(Validated in Phase 13 — 2026-04-27)*
- [ ] Google Search Console entegrasyonu — performans takibi, index durumu
- [ ] Recovery & refresh engine — ranking düşüşü tespiti ve güncelleme görevi açma
- [ ] Monitoring dashboard — cluster bazlı trafik, sayfa bazlı dönüşüm desteği

### Out of Scope

- **Chatbot / serbest konuşma arayüzü** — Bu bir AI asistan değil, operasyon sistemi; sistem insan tarafından yönetilir
- **Otomatik yayın (onaysız)** — Her kritik aksiyon kullanıcı onayından geçer
- **Sosyal medya yönetimi** — Kapsam dışı, başka araçlar
- **Email pazarlama** — Kapsam dışı
- **Fatura/sözleşme yönetimi** — Kapsam dışı (CRM değil, üretim OS'i)
- **Multi-tenant SaaS** — Başlangıçta tek ajans kullanımı; SaaS dönüşümü sonraki milestone

## Context

**Ajans bağlamı:** Yeni gelen her website projesi için aynı süreç tekrar edilmekte — rakip analizi, keyword araştırması, site iskeletleme, sayfa planlama, içerik üretimi. Şu an bu süreçler dağınık araçlarla (spreadsheet, ayrı SEO araçları, ayrı içerik üretimi) yürütülmekte; tek merkezden yönetilemiyor.

**Teknik ekosistem:**
- **Frontend:** Next.js (merkezi dashboard)
- **Database & Auth:** Supabase (Postgres + Auth + Storage + Edge Functions)
- **Otomasyon:** n8n (self-hosted, webhook/schedule tabanlı workflow'lar)
- **SEO veri:** DataForSEO (keyword, SERP, enrichment) + Semrush (rakip, domain analizi)
- **LLM üretim:** OpenAI API
- **LLM denetim:** İkinci model (QA katmanı)
- **CMS:** WordPress REST API
- **İzleme:** Google Search Console API

**Uygulama faz planı (kullanıcı tarafından belirlenmiş):**
- **Faz 1 — Decision OS MVP:** Proje paneli, keyword import, clustering, opportunity scoring, site blueprint, page planner, internal link map
- **Faz 2 — Page Package OS:** Page package engine, schema center, metadata center, rule validator, QA scoring
- **Faz 3 — Autonomous Growth Layer:** Content studio, CMS export, monitoring dashboard, decay alerts, refresh/recovery

**Ana varlıklar:** Project, Competitor, Keyword Cluster, Keyword, Page, Page Package, Rule Set, Audit, Asset, Workflow Run

**Hafıza mimarisi:**
- *Structured Memory:* Kaydedilmiş proje verileri (Supabase)
- *Decision Memory:* Alınmış stratejik kararlar (kural seti ve proje kararları)
- *Working Memory:* O an aktif stage ve işlem bağlamı

## Constraints

- **Stack:** Next.js + Supabase + n8n + OpenAI + DataForSEO — bu seçimler kararlaştırılmış
- **Güvenlik:** API key'ler asla frontend'e gitmez; tüm harici çağrılar Edge Function veya n8n üzerinden geçer
- **Otonom çalışma yok:** Sistem human-directed; kritik kararlar kullanıcı onayı bekler
- **İlk versiyon sınırı:** Faz 3 (Content Studio + tam otomasyon) ilk versiyona dahil değil — önce karar ve planlama katmanı sağlam kurulur
- **Supabase Edge Functions:** Kısa ömürlü, idempotent; uzun ağır işler n8n üzerinden yürütülür

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase merkez hafıza olarak seçildi | Auth, Postgres, Storage ve Edge Functions tek pakette; RLS ile proje izolasyonu sağlanır | — Pending |
| n8n orkestrasyon katmanı | Çok adımlı workflow, retry, schedule ve webhook desteği; API key'ler güvenli tutuluyor | — Pending |
| Next.js frontend | SSR, modern ekosistem, Supabase ile iyi entegrasyon | — Pending |
| Human-directed sistem | Sistem kendi başına rastgele akmaz; her kritik aksiyon kullanıcı tarafından tetiklenir | — Pending |
| 3 fazlı uygulama stratejisi | Tüm sistemi tek seferde kurmak yerine MVP → Page Package OS → Growth Layer şeklinde inşa | — Pending |
| İkinci model QA katmanı | Üretim modeli ile denetim modelini ayırmak kaliteyi artırır, robotik dil ve intent drift riskini azaltır | — Pending |
| WordPress REST API entegrasyonu | Ajansın halihazırda WordPress kullanan müşterileri var; native publish akışı gerekli | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-25 — Milestone v3.0 started (Autonomous Growth Layer)*
