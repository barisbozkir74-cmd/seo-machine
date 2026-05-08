# SEO Machine — Website Agency Operating System

## What This Is

Bir web tasarım & SEO ajansının yeni gelen her website projesini uçtan uca yöneten merkezi operasyon sistemi. Proje açılışından keyword stratejisine, sayfa paketi üretimine, SEO denetimine ve WordPress yayınına kadar tüm süreçleri tek bir platform üzerinden, stage bazlı ve hafıza destekli şekilde yürütür. Klasik bir AI içerik aracı değil; proje hafızası, kural motoru ve sayfa üretim motoruyla çalışan bir **Website Agency OS**.

## Core Value

Her website projesi için sıfırdan açılıp kurgulanan, tüm kararları kaydeden ve stage bazlı ilerleyen **tek merkezi proje yönetim sistemi** — ajans çalışanı sistemi yönetir, sistem kendi başına rastgele akmaz.

## Previous Milestone: v3.0 Autonomous Growth Layer — COMPLETE (2026-05-08)

**Shipped features:**
- Content Studio — heading bazlı bölüm-bölüm AI içerik üretimi, onay akışı, HTML çıktısı *(Phase 12)*
- WordPress Publishing — REST API draft/publish/scheduled, slug, meta, JSON-LD schema *(Phase 13)*
- GSC Integration — OAuth, index durumu, keyword/sayfa bazlı performans verisi *(Phase 14)*
- Monitoring Dashboard — cluster bazlı trafik özeti, decay alert sistemi *(Phase 15)*
- WordPress Site Import Engine — WP crawl, hiyerarşik tree, AI intent, 6 audit flag *(Phase 15.5)*
- Recovery Engine — n8n webhook daily decay tespiti + recovery task açma *(Phase 16)*
- Keyword Intelligence — Niche score + cluster-to-revenue sınıflandırması *(Phase 17)*

## Current Milestone: v4.0 (Planning)

**Goal:** Sonraki milestone `/gsd-new-milestone` ile tanımlanacak.

**Known carry-overs from v3.0:**
- MON-03: Monitoring dashboard + imported pages entegrasyonu
- PAGE-05: Revision history
- 30 deferred audit items (UAT, verification, context questions)

## Requirements

### Validated

#### v1.0 — Decision OS MVP (Phases 1–9)
- ✓ Infrastructure & Auth (INFR-01–04) — v1.0
- ✓ Project Core — 10-stage engine, stage geçişi, karar hafızası (PROJ-01–05) — v1.0
- ✓ Rules Engine — global + proje bazlı SEO kuralları (RULE-01–03) — v1.0
- ✓ Competitor Intelligence — SERP rakip tespiti, gap analizi (COMP-01–04) — v1.0
- ✓ Keyword Center — CSV import, enrichment, clustering, opportunity score (KEYW-01–07) — v1.0
- ✓ Site Blueprint — keyword→sayfa tree, internal link haritası (BLUE-01–05) — v1.0

#### v2.0 — Page Package OS (Phases 10–11)
- ✓ Page Package Engine — tam SEO paketi üretimi (PAGE-01) — v2.0
- ✓ Schema Center — JSON-LD üretimi, editör, önizleme (PAGE-02, PAGE-02b) — v2.0
- ✓ Metadata Validator — rules engine entegrasyonu (PAGE-03) — v2.0
- ✓ Package Lock mekanizması (PAGE-04) — v2.0
- ✓ QA Scoring — LLM denetimi + 5 score seti (QUAL-01–02) — v2.0

#### v3.0 — Autonomous Growth Layer (Phases 12–17)
- ✓ Content Studio — bölüm bazlı AI içerik üretimi, onay/ret akışı (CONT-01–05) — v3.0
- ✓ WordPress Publishing — draft/publish/scheduled, tam payload (PUBL-01–04) — v3.0
- ✓ GSC Integration — OAuth, index durumu, performans verisi (GSC-01–03) — v3.0
- ✓ Monitoring Dashboard — cluster trafik özeti, decay alert (MON-01–02) — v3.0
- ✓ WordPress Site Import Engine — crawl, AI intent, 6 audit flag (IMP-01–05) — v3.0
- ✓ Recovery Engine — daily decay tespiti + recovery task (REC-01–03) — v3.0
- ✓ Keyword Intelligence — niche score + cluster-to-revenue (NICH-01–02, RVEN-01–02) — v3.0

### Active

#### v4.0 — Next Milestone (Planning)
- [ ] MON-03: Monitoring dashboard + imported pages entegrasyonu
- [ ] PAGE-05: Revision history — her sayfa paketinin geçmiş versiyonları

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
| Supabase merkez hafıza olarak seçildi | Auth, Postgres, Storage ve Edge Functions tek pakette; RLS ile proje izolasyonu sağlanır | ✓ Good — v1.0 |
| n8n orkestrasyon katmanı | Çok adımlı workflow, retry, schedule ve webhook desteği; API key'ler güvenli tutuluyor | ✓ Good — v3.0 (Recovery Engine) |
| Next.js frontend | SSR, modern ekosistem, Supabase ile iyi entegrasyon | ✓ Good — v1.0 |
| Human-directed sistem | Sistem kendi başına rastgele akmaz; her kritik aksiyon kullanıcı tarafından tetiklenir | ✓ Good — confirmed v3.0 |
| 3 fazlı uygulama stratejisi | Tüm sistemi tek seferde kurmak yerine MVP → Page Package OS → Growth Layer şeklinde inşa | ✓ Good — v3.0 complete |
| İkinci model QA katmanı (Claude) | Üretim modeli ile denetim modelini ayırmak kaliteyi artırır; OpenAI değil Claude tercih edildi | ✓ Good — v2.0/v3.0 |
| WordPress REST API entegrasyonu | Ajansın halihazırda WordPress kullanan müşterileri var; native publish akışı gerekli | ✓ Good — v3.0 |
| Phase 15.5 eklenmesi (WP Import Engine) | Recovery Engine imported pages bağımlılığını karşılamak için milestone sırasına eklendi | ✓ Good — kritik bağımlılık giderildi |
| calculateNicheScore 4-faktör model | Hacim, rekabet, CPC proxy, programmatic potential — ağırlıklı ortalama, normalize 0-100 | ✓ Good — v3.0 |

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

## Context

**Mevcut durum (v3.0 sonrası):**
- Codebase: ~22,827 TypeScript/TSX satırı
- Tech stack: Next.js + Supabase + n8n + Claude claude-sonnet-4-6 + DataForSEO + WordPress REST API + GSC API
- Tüm temel workflow tamamlandı: proje açılışından içerik üretimi → WordPress yayını → GSC izleme → decay tespiti → recovery döngüsü
- Keyword Intelligence (niche score + revenue classification) v3.0'da tamamlandı

**Bilinen teknik borç:**
- BL-01: null avg_position aggregation bug (monitoring/aggregation.ts) — orta öncelik
- BL-02: Unauthenticated izleme sayfası 404 yerine /login redirect — düşük öncelik
- 30 deferred UAT/verification items — STATE.md Deferred Items

---
*Last updated: 2026-05-08 after v3.0 milestone — Autonomous Growth Layer SHIPPED*
