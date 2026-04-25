# Roadmap: SEO Machine — Decision OS MVP

## Overview

This roadmap delivers the Decision OS MVP in 8 focused phases. Starting from a bare Next.js + Supabase stack, each phase builds one coherent layer of the operating system: auth and database first, then project management, then the rules engine, then competitor intelligence, then keyword work (split into import/enrichment and clustering/scoring), and finally site blueprint (split into tree generation and page planning). By the end of Phase 8 the agency has a fully functional decision and planning OS — every website project has a structured, stage-tracked home with keyword strategy and a page-level blueprint ready to hand off to Phase 2 (Page Package OS).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Supabase schema, auth, RLS, and API key security (completed 2026-04-22)
- [x] **Phase 2: Project Core** - Project creation, central dashboard, stage engine, decision memory (completed 2026-04-22)
- [x] **Phase 3: Rules Engine** - Global and project-scoped SEO rules that govern all downstream production (completed 2026-04-23)
- [x] **Phase 4: Competitor Intelligence** - Manual and automated competitor tracking with gap/opportunity reports (completed 2026-04-23)
- [x] **Phase 5: Keyword Import & Enrichment** - CSV/manual keyword entry with DataForSEO enrichment (completed 2026-04-24)
- [x] **Phase 6: Keyword Clustering & Scoring** - SERP-based clustering, cannibalization prevention, opportunity scoring (completed 2026-04-24)
- [x] **Phase 7: Site Blueprint & Tree** - Auto-generated site tree from clusters with keyword-to-page mapping (completed 2026-04-24)
- [x] **Phase 8: Page Planner & Internal Links** - Page type assignment, focus keywords, internal link map, orphan detection (completed 2026-04-24)

## Phase Details

### Phase 1: Foundation
**Goal**: The application has a secure, authenticated base with all database tables, RLS policies, and API key storage in place — nothing can be built without this working
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04
**Success Criteria** (what must be TRUE):
  1. User can sign up, log in with email and password, and the session survives a browser refresh
  2. All core database tables exist (projects, stages, competitors, keywords, keyword_clusters, pages, internal_links, rules, audits, workflow_runs)
  3. API keys for DataForSEO, Semrush, and OpenAI are stored in Supabase secrets and are never exposed to the browser
  4. A logged-in user cannot read or modify another user's project data (RLS enforcement verified)
**Plans**: 4 plans
Plans:
- [x] 01-01-PLAN.md — Next.js scaffold, shadcn/ui dark theme, login/signup UI pages (completed 2026-04-22)
- [x] 01-02-PLAN.md — All 10 database tables migration (projects, stages, competitors, keywords, keyword_clusters, pages, internal_links, rules, audits, workflow_runs) (completed 2026-04-22)
- [x] 01-03-PLAN.md — RLS policies for all tables + supabase db push + Vault helper for API keys (completed 2026-04-22)
- [x] 01-04-PLAN.md — @supabase/ssr auth clients, middleware route protection, wire forms to Supabase auth (completed 2026-04-22)
**UI hint**: yes

### Phase 2: Project Core
**Goal**: Users can create projects, track all projects from a dashboard, move projects through stages, and rely on the system to remember decisions
**Depends on**: Phase 1
**Requirements**: PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-05
**Success Criteria** (what must be TRUE):
  1. User can create a new project filling all intake fields (name, domain, sector, target country/language, business model, site type, brand tone, competitors, notes, custom rules)
  2. User can see all their projects listed on a central dashboard with current stage and status visible
  3. Each project displays its current active stage from the 10-stage engine (Intake through Post-Launch)
  4. User can trigger a stage transition and the project advances to the next stage
  5. Notes and decisions entered during a project are retrievable in a later session
**Plans**: 6 plans
Plans:
- [x] 02-01-PLAN.md — shadcn bileşenleri kurulumu (dialog, table, badge, textarea, separator) (completed 2026-04-22)
- [x] 02-02-PLAN.md — Projeler listesi dashboard sayfası (/dashboard/projeler — tablo + boş durum) (completed 2026-04-22)
- [x] 02-03-PLAN.md — Yeni proje modal + Server Action + Zod validasyon (projects + 10 stages INSERT)
- [x] 02-04-PLAN.md — Proje detay sayfası 2 sütunlu layout + stage listesi (/dashboard/projeler/[id])
- [x] 02-05-PLAN.md — Stage geçiş mantığı + onay dialogu (advanceStage Server Action)
- [x] 02-06-PLAN.md — Karar hafızası — not formu + audits tablosu (addNote Server Action)
**UI hint**: yes

### Phase 3: Rules Engine
**Goal**: Users can define SEO rules at global and project scope, update them at any time, and the system applies the correct rule set for each project
**Depends on**: Phase 2
**Requirements**: RULE-01, RULE-02, RULE-03
**Success Criteria** (what must be TRUE):
  1. User can define project-level SEO rules (e.g., whether SEO title must start with focus keyword, whether H1 must be exact match, whether slug must be exact match)
  2. User can edit any rule from the dashboard and the change is persisted immediately
  3. A project-level rule overrides the global default for that project; projects without a custom rule fall back to the global rule
**Plans**: 3 plans
Plans:
- [x] 03-01-PLAN.md — Switch bileşeni + seedGlobalRules + toggleRule actions + global kurallar sayfası (/ayarlar/kurallar) (completed 2026-04-23)
- [x] 03-02-PLAN.md — RuleToggleRow Client Component + toggleProjectRule/resetProjectRule actions + global sayfa wire-up (completed 2026-04-23)
- [x] 03-03-PLAN.md — Proje kuralları sayfası (/projeler/[id]/kurallar) + dashboard nav + proje detay sol sütun linki (completed 2026-04-23)
**UI hint**: yes

### Phase 4: Competitor Intelligence
**Goal**: Users can build a competitor list per project — both manually and via automated SERP discovery — and view per-competitor page/category data plus a gap and opportunity report
**Depends on**: Phase 2
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04
**Success Criteria** (what must be TRUE):
  1. User can manually add a competitor domain to a project and see it in the competitor list
  2. After providing target keywords, the system automatically identifies competitors from SERP data via DataForSEO and adds them to the list
  3. For each competitor, user can view their top pages, category structure, and content topic areas
  4. System generates a gap and opportunity report showing where competitors are weak and which keyword areas can be entered quickly
**Plans**: 3 plans
Plans:
- [x] 04-01-PLAN.md — Lib katmanı: vault.ts + dataforseo/client.ts + url-categories.ts + proje detay sol sütun Rakipler linki (completed 2026-04-23)
- [x] 04-02-PLAN.md — Server Actions: addCompetitor, discoverCompetitors, addCompetitors, fetchCompetitorData (completed 2026-04-23)
- [x] 04-03-PLAN.md — Rakipler sayfası UI: page.tsx + CompetitorDiscoveryDialog + CompetitorFetchButton + gap raporu tablosu (completed 2026-04-23)
- [x] 04-04-PLAN.md — Gap closure: content_areas, own_category_structure persist, Fırsat Skoru, addCompetitors validasyon (completed 2026-04-23)
**UI hint**: yes

### Phase 5: Keyword Import & Enrichment
**Goal**: Users can populate a project's keyword list via CSV or manual entry, then enrich every keyword with live DataForSEO data (volume, CPC, difficulty, intent)
**Depends on**: Phase 2
**Requirements**: KEYW-01, KEYW-02, KEYW-03
**Success Criteria** (what must be TRUE):
  1. User can upload a CSV file of keywords and all rows are imported into the project's keyword list
  2. User can add individual keywords one at a time through a form
  3. After import, the system fetches and displays volume, CPC, keyword difficulty, and search intent for each keyword via DataForSEO
**Plans**: 2 plans
Plans:
- [x] 05-01-PLAN.md — fetchKeywordData (DataForSEO client) + importKeywords enrichment akışı + deleteKeyword Server Action (completed 2026-04-24)
- [x] 05-02-PLAN.md — keyword-stratejisi page.tsx düz tabloya dönüşüm + KeywordDeleteButton + IntentBadge bileşenleri (completed 2026-04-24)
**UI hint**: yes

### Phase 6: Keyword Clustering & Scoring
**Goal**: Users can let the system automatically cluster keywords by SERP similarity and intent, assign primary keywords to clusters with cannibalization prevention, and see opportunity scores for every keyword
**Depends on**: Phase 5
**Requirements**: KEYW-04, KEYW-05, KEYW-06, KEYW-07
**Success Criteria** (what must be TRUE):
  1. System automatically groups keywords into clusters based on SERP similarity and search intent
  2. Each cluster has a primary keyword assigned; no keyword belongs to more than one cluster (cannibalization prevention enforced)
  3. Every keyword has an opportunity score calculated from traffic potential, commercial value, and competition score
  4. User can view all clusters and keywords in a panel, edit cluster assignments, and move keywords between clusters
**Plans**: 2 plans
Plans:
- [x] 06-01-PLAN.md — Backend core: clusterEnrichedKeywords (intent-first hibrid) + scoring.ts + clusterAndScoreKeywords / moveKeywordToCluster / setPrimaryKeyword Server Actions + vitest testleri
- [x] 06-02-PLAN.md — UI: ClusterButton + ViewToggle + ClusterPanel + MoveKeywordDialog + PrimaryKeywordStar + page.tsx Skor sütunu + searchParams view routing
**UI hint**: yes

### Phase 7: Site Blueprint & Tree
**Goal**: Users can generate a site tree automatically from keyword clusters, verify that every keyword maps to exactly one page, and manually adjust the tree structure
**Depends on**: Phase 6
**Requirements**: BLUE-01, BLUE-02, BLUE-03
**Success Criteria** (what must be TRUE):
  1. System generates a site tree from keyword clusters (menu groups, category/service/product/blog separation, hub-spoke structure) with one action
  2. Every keyword is mapped to exactly one page; the system detects and flags any mapping conflicts
  3. User can view the full site tree, add or remove pages, and reorder nodes through the dashboard
**Plans**: 2 plans
Plans:
- [x] 07-01-PLAN.md — slugify helper + generatePagesFromClusters + reorderPage Server Actions (completed 2026-04-24)
- [x] 07-02-PLAN.md — GeneratePagesDialog + ReorderButton + KeywordMappingTab + tab switcher + conflict detection (completed 2026-04-24)
**UI hint**: yes

### Phase 8: Page Planner & Internal Links
**Goal**: Every page in the site tree has a type, focus keyword, intent, and priority assigned, and the system produces an internal link map with orphan page detection
**Depends on**: Phase 7
**Requirements**: BLUE-04, BLUE-05
**Success Criteria** (what must be TRUE):
  1. Each page in the blueprint has a page type (homepage/category/service/product/blog/landing), focus keyword, search intent, and priority level assigned
  2. System generates an internal link map showing pillar–support relationships and anchor text suggestions for each link
  3. Pages with no incoming or outgoing links are flagged as orphans with a visible warning
**Plans**: 2 plans
Plans:
- [x] 08-01-PLAN.md — Phase 7 technical debt (WR-01/02/03/04/05) + updatePageAttributes + suggestInternalLinks server actions (completed 2026-04-24)
- [x] 08-02-PLAN.md — BulkEditPagesDialog + SuggestLinksButton + SuggestLinksDialog + orphan banner + page wiring (completed 2026-04-24)
**UI hint**: yes

### Phase 9: Page Package Generator
**Goal**: Her site blueprint sayfası için publish-ready SEO page package üretmek — AI destekli generation, manuel düzenleme, basit QA validator ve draft→approved→locked status workflow
**Depends on**: Phase 8
**Requirements**: BLUE-04 (evolved), PAGE-01 (partial)
**Success Criteria** (what must be TRUE):
  1. Her sayfa için ayrı `page_packages` tablosunda SEO paketi saklanır (seo_title, meta, H1, heading hierarchy, content blocks, CTA, FAQ, schema, secondary keywords)
  2. "AI ile Üret" butonu streaming ile package üretir ve draft olarak kaydeder
  3. Kullanıcı paketi manuel düzenleyip onaylayabilir (approved) ve kilitleyebilir (locked)
  4. Basit client-side QA validator: title ≤60, meta ≤155, H1 dolu, focus keyword title'da
  5. Sayfa listesinde her satırda package status badge (yok / draft / approved / locked) görünür
**Plans**: 4 plans
Plans:
- [x] 09-01-PLAN.md — page_packages migration SQL + supabase db push (BLOCKING) (completed 2026-04-24)
- [x] 09-02-PLAN.md — Server actions (updatePagePackage→page_packages, createPagePackage, updatePackageStatus) + AI route locked check
- [x] 09-03-PLAN.md — Yeni bileşenler: QaBadge + PackageStatusBadge + LockedBanner
- [x] 09-04-PLAN.md — page.tsx evolve (page_packages join, PackageStatusBadge) + PagePackageEditor.tsx migration (status workflow, locked state, font-medium cleanup)
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete | 2026-04-22 |
| 2. Project Core | 6/6 | Complete    | 2026-04-22 |
| 3. Rules Engine | 3/3 | Complete | 2026-04-23 |
| 4. Competitor Intelligence | 4/4 | Complete | 2026-04-23 |
| 5. Keyword Import & Enrichment | 2/2 | Complete | 2026-04-24 |
| 6. Keyword Clustering & Scoring | 2/2 | Complete | 2026-04-24 |
| 7. Site Blueprint & Tree | 2/2 | Complete | 2026-04-24 |
| 8. Page Planner & Internal Links | 2/2 | Complete | 2026-04-24 |
| 9. Page Package Generator | 1/4 | In Progress | - |

---

# Roadmap: SEO Machine — v2.0 Page Package OS

## Overview

v2.0 adds the quality control layer on top of the page package engine built in Phase 9. Two phases deliver this: Phase 10 builds the Schema Center (JSON-LD generation + editor tab), and Phase 11 completes the quality gate (metadata validator + LLM QA audit + 5-dimensional scoring). Together they ensure no page package can be locked without passing schema validation, rule-based metadata checks, and an AI-driven content audit.

## Phases

- [x] **Phase 10: Schema Center** - page_type'a göre JSON-LD üretimi ve editörde Schema sekmesi (completed 2026-04-25)
- [x] **Phase 11: Metadata Validator & QA Scoring** - Rules engine destekli metadata kontrolü, LLM QA denetimi ve 5-boyutlu scoring (completed 2026-04-25)

## Phase Details

### Phase 10: Schema Center
**Goal**: Her sayfa paketi için page_type'a uygun JSON-LD schema otomatik üretilir ve kullanıcı bunu editördeki ayrı Schema sekmesinden önizleyebilir, düzenleyebilir ve kopyalayabilir
**Depends on**: Phase 9
**Requirements**: PAGE-02, PAGE-02b
**Success Criteria** (what must be TRUE):
  1. Kullanıcı "Schema Üret" aksiyonunu tetiklediğinde sistem page_type'a göre doğru schema tipini seçer (Organization/WebSite, WebPage, Service, FAQPage, LocalBusiness, Product) ve JSON-LD formatında çıktı üretir
  2. Üretilen JSON-LD page_packages tablosundaki schema sütununa kaydedilir ve sayfa yenilemesinde korunur
  3. PagePackageEditor'da ayrı bir "Schema" sekmesi görünür; sekme açıldığında mevcut JSON-LD önizleme olarak gösterilir
  4. Kullanıcı schema metnini editörde manuel olarak değiştirebilir ve değişiklikler kaydedilebilir
  5. Kullanıcı schema içeriğini panoya kopyalayabilir (tek tıkla kopyala butonu)
**Plans**: 3 plans
Plans:
- [x] 10-01-PLAN.md — schema_jsonld JSONB migration + supabase db push [BLOCKING] (completed 2026-04-25)
- [x] 10-02-PLAN.md — actions.ts PagePackageData tip genişletmesi + page.tsx SELECT sorgusu genişletmesi (completed 2026-04-25)
- [x] 10-03-PLAN.md — PagePackageEditor.tsx — Tab bar + generateSchemaJsonLd + Schema sekmesi UI (tam implementasyon) (completed 2026-04-25)
**UI hint**: yes

### Phase 11: Metadata Validator & QA Scoring
**Goal**: Kullanıcı paketi kaydettiğinde veya kilitlemeden önce sistem rules engine kurallarına göre metadata tutarlılığını kontrol eder, Claude ile tam QA denetimi çalıştırır ve 5 boyutlu score hesaplayıp editörde gösterir
**Depends on**: Phase 10
**Requirements**: PAGE-03, QUAL-01, QUAL-02
**Success Criteria** (what must be TRUE):
  1. Kullanıcı paketi kaydederken sistem rules engine'daki aktif kurallara göre title/meta/H1/slug tutarlılığını otomatik kontrol eder ve kural ihlali varsa görünür uyarı gösterir
  2. Kullanıcı paketi kilitlemeden (lock) önce sistem Claude claude-sonnet-4-6 ile QA denetimi çalıştırır: intent drift, robotik dil, entity eksikliği ve duplicate risk kontrol edilir; sonuçlar kullanıcıya gösterilir
  3. Her sayfa için SEO score, content score, human score, schema score ve readiness score hesaplanır ve editörde sayısal olarak gösterilir
  4. Readiness score 100 üzerinden hesaplanır; tüm skorlar paket kilitleme öncesinde görünürdür
  5. QA denetimi geçemeyen (kritik sorun bulunan) paket kilitlenemiyor; kullanıcı sorunları gördükten sonra manuel olarak devam etmeyi onaylayabilir
**Plans**: 2 plans
Plans:
- [x] 11-01-PLAN.md — QaBadge rules engine entegrasyonu + /api/ai/qa-audit endpoint (completed 2026-04-25)
- [x] 11-02-PLAN.md — page.tsx rules sorgulama + PagePackageEditor QA dialog flow + score row (completed 2026-04-25)
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 10 → 11

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 10. Schema Center | 3/3 | Complete | 2026-04-25 |
| 11. Metadata Validator & QA Scoring | 0/2 | In Progress | - |
