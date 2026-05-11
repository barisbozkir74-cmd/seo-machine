# Roadmap: SEO Machine — Website Agency Operating System

## Milestones

- ✅ **v3.0 Autonomous Growth Layer** — Phases 12–17 (shipped 2026-05-08)
- 🚧 **v4.0 AI-Powered Project Intelligence Layer** — Phases 18–22 (in progress)

## Phases

<details>
<summary>✅ v3.0 Autonomous Growth Layer (Phases 12–17) — SHIPPED 2026-05-08</summary>

- [x] Phase 12: Content Studio (5/5 plans) — completed 2026-04-26
- [x] Phase 13: WordPress Publishing (5/5 plans) — completed 2026-04-27
- [x] Phase 14: GSC Integration (6/6 plans) — completed 2026-04-27
- [x] Phase 15: Monitoring Dashboard (2/2 plans) — completed 2026-04-28
- [x] Phase 15.5: WordPress Site Import Engine (8/8 plans) — completed 2026-05-02
- [x] Phase 16: Recovery Engine (6/6 plans) — completed 2026-05-06
- [x] Phase 17: Keyword Intelligence (3/3 plans) — completed 2026-05-08

Archive: `.planning/milestones/v3.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Page Package OS (Phases 10–11) — SHIPPED 2026-04-25</summary>

- [x] Phase 10: Schema Center
- [x] Phase 11: Metadata Validator & QA Scoring

</details>

<details>
<summary>✅ v1.0 Decision OS MVP (Phases 1–9) — SHIPPED 2026-04-25</summary>

- [x] Phase 1: Foundation
- [x] Phase 2: Project Core
- [x] Phase 3: Rules Engine
- [x] Phase 4: Competitor Intelligence
- [x] Phase 5: Keyword Import & Enrichment
- [x] Phase 6: Keyword Clustering & Scoring
- [x] Phase 7: Site Blueprint Tree
- [x] Phase 8: Page Planner & Internal Links
- [x] Phase 9: Page Package Generator

</details>

### 🚧 v4.0 AI-Powered Project Intelligence Layer (Phases 18–22)

**Milestone Goal:** Proje bilgilerinden otomatik başlayan, sektör araştırması yapan ve keyword stratejisi kuran AI-driven akış — site blueprint'e kadar uçtan uca.

- [x] **Phase 18: Project Launch Gate & Sector Research** - Proje bilgileri tamamlanınca "Projeyi Başlat" aktifleşir ve sektör araştırmasını otomatik tetikler (completed 2026-05-08)
- [x] **Phase 19: AI Keyword Data Acquisition** - DataForSEO ile rakip keywordleri çekme, CSV akışıyla birleştirme, birleşik keyword havuzu oluşturma (completed 2026-05-09)
- [x] **Phase 20: AI Keyword Clustering & Approval** - Keyword havuzunu AI ile gruplama, kullanıcı onay/red/düzenleme akışı, onaylananları sisteme işleme (completed 2026-05-10)
- [x] **Phase 21: Site Blueprint Auto-Generation Gate** - Onaylanan keyword stratejisinden "Sistemi Kur" tetiklenince site blueprint otomatik oluşturulması (completed 2026-05-10)
- [x] **Phase 22: Polish & Carry-overs** - Monitoring + imported pages entegrasyonu ve revision history (completed 2026-05-11)
- [ ] **Phase 23: Keyword Strategy AI Intelligence Layer** - Proaktif SEO Strategist + Traffic Architect AI, cross-module context, Second Review AI sistemi, cluster decision memory propagation

## Phase Details

### Phase 18: Project Launch Gate & Sector Research
**Goal**: Kullanıcı proje bilgilerini tamamladığında "Projeyi Başlat" aktif hale gelir ve tetiklenince sektör araştırması otomatik olarak başlar ve rapor üretilir
**Depends on**: Phase 17
**Requirements**: PROJ-06, PROJ-07, SRCH-01, SRCH-02, SRCH-03
**Success Criteria** (what must be TRUE):
  1. Kullanıcı zorunlu proje alanları eksikken "Projeyi Başlat" butonunu disabled olarak görür; tüm alanlar dolduğunda buton aktifleşir
  2. "Projeyi Başlat" tetiklenince sistem otomatik olarak Google arama sorguları oluşturur ve sektör araştırmasını başlatır (hem yeni proje hem WP import akışı için)
  3. Sistem, proje bilgilerindeki sektör + rakipler + ana keywordlerden otomatik arama sorguları üretir
  4. Araştırma tamamlandığında pazar özeti, rakip konumları, sektör açıkları ve fırsatlar içeren bir rapor oluşur
  5. Kullanıcı araştırma raporunu projeye ait dedicated bölümde görüntüler ve notlar ekleyebilir
**Plans**: 3 plans
Plans:
- [x] 18-01-PLAN.md — vault.ts getSerpApiKey() + src/lib/research/sector-research.ts servis katmanı
- [x] 18-02-PLAN.md — POST /api/research/trigger API route (IDOR korumalı)
- [x] 18-03-PLAN.md — ProjectInfoSection launch gate UI + ResearchRerunButton + arastirma/page.tsx güncellemesi
**UI hint**: yes

### Phase 19: AI Keyword Data Acquisition
**Goal**: Rakip keywordleri DataForSEO ile otomatik çekilir, mevcut CSV import akışıyla birleştirilir ve genişletilmiş keyword havuzu hazırlanır
**Depends on**: Phase 18
**Requirements**: KWST-01, KWST-02, KWST-05
**Success Criteria** (what must be TRUE):
  1. Sistem proje rakiplerinin kullandığı keywordleri DataForSEO API üzerinden otomatik çeker
  2. Çekilen rakip keywordleri + varsa CSV import keywordleri + ilişkili genişletmeler birleşik bir keyword havuzunda toplanır
  3. Mevcut CSV import akışı bozulmadan çalışmaya devam eder ve AI akışıyla paralel kullanılabilir
  4. Kullanıcı birleşik keyword havuzunun kaynaklarını (CSV vs rakip vs genişletme) ayırt edebilir
**Plans**: 3 plans
Plans:
- [ ] 19-01-PLAN.md — keywords.source CHECK constraint migration + ai-acquisition.ts servis iskeleti + Wave 0 test
- [ ] 19-02-PLAN.md — DataForSEO fetchRelatedKeywords() wrapper extension + vitest mock testi
- [ ] 19-03-PLAN.md — ai-acquisition.ts implementation + POST /api/keywords/acquire route + AiAcquireButton + page.tsx Kaynak sütunu

### Phase 20: AI Keyword Clustering & Approval
**Goal**: Keyword havuzu AI tarafından gruplandırılır, kullanıcı gruplama önerilerini inceleyip onaylar/reddeder/düzenler ve onaylananlar keyword tablosuna işlenir
**Depends on**: Phase 19
**Requirements**: KWST-03, KWST-04
**Success Criteria** (what must be TRUE):
  1. AI, keyword havuzunu anlamlı gruplara ayırır ve gruplama önerilerini kullanıcıya sunar
  2. Kullanıcı her grubu tek tek kabul veya reddedebilir; gruplar içindeki keywordleri düzenleyebilir
  3. Onaylanan gruplar keyword tablosuna işlenir ve mevcut keyword clustering akışıyla uyumlu çalışır
  4. Kullanıcı onay akışını tamamlamadan bir sonraki adıma geçemez (sistem blueprint gate'i kilitler)
**Plans**: 3 plans
Plans:
- [x] 20-01-PLAN.md — DB migration (keyword_clusters.status + projects.keyword_strategy_approved) + supabase db push + Wave 0 test iskeleti (completed 2026-05-09)
- [x] 20-02-PLAN.md — 3 yeni server action (updateClusterStatus, removeKeywordFromCluster, approveStrategy) + clusterAndScoreKeywords draft/DraftCluster güncelleme + ClusterButton onSuccess callback (completed 2026-05-09)
- [x] 20-03-PLAN.md — ClusteringApprovalOverlay + ApprovalClusterRow + ApprovalKeywordRow + StatusBadge + StratejiOnaylaButton + KeywordStratejisiToolbar + page.tsx & ClusterPanel güncellemeleri (completed 2026-05-10)
**UI hint**: yes

### Phase 21: Site Blueprint Auto-Generation Gate
**Goal**: Kullanıcı keyword stratejisini onayladıktan sonra "Sistemi Kur" tetiklenince site blueprint onaylanan gruplardan otomatik olarak oluşturulur
**Depends on**: Phase 20
**Requirements**: BLUE-06
**Status**: Complete (2026-05-10)
**Success Criteria** (what must be TRUE):
  1. Keyword stratejisi onaylanmadan "Sistemi Kur" butonu erişilemez (disabled) durumdadır
  2. "Sistemi Kur" tetiklenince onaylanan keyword gruplarından site blueprint otomatik oluşturulur
  3. Oluşturulan blueprint kullanıcı tarafından mevcut site blueprint arayüzünde görüntülenebilir ve düzenlenebilir
**Plans**: 2 plans
Plans:
- [x] 21-01-PLAN.md — generatePagesFromClusters overwrite desteği + GenerateResult.updated + vitest testleri (completed 2026-05-10)
- [x] 21-02-PLAN.md — GeneratePagesDialog alreadyExists interaktif + KeywordStratejisiToolbar "Sistemi Kur" + keyword-stratejisi/page.tsx approvedDialogRows (completed 2026-05-10)
**UI hint**: yes

### Phase 23: Keyword Strategy AI Intelligence Layer
**Goal**: Keyword strategy bölümünde proaktif çalışan, cross-module context'e sahip, SEO Strategist + Traffic Architect rolünde bir AI katmanı kurulur; Second Review AI sistemi ile cluster kararları tüm modüllere yayılır
**Depends on**: Phase 20
**Requirements**: KWST-06, KWST-07
**Success Criteria** (what must be TRUE):
  1. Keyword sayfası açılınca AI, tüm modül verilerini (research, rakipler, blueprint, monitoring, GSC) toplayarak soru sormadan proaktif stratejik analiz üretir
  2. AI 15 analiz sorumluluğunu aktif olarak yerine getirir: intent dağılımı, commercial gap, SERP zayıflığı, cannibalization riski, pillar/support map dahil
  3. Her cluster için 12-attribute structured output üretilir (page type, difficulty, traffic potential, blueprint impact, internal link map, topical authority contribution)
  4. Second Review AI sistemi: Primary AI öneri üretir → Review AI intent çakışması + cannibalization + missing commercial pages analizi yapar → karşılaştırma ekranı → human approval
  5. Keyword modülünde alınan cluster kararları decision memory'ye yazılır ve blueprint / page package / internal link modüllerine otomatik olarak yansır
**Plans**: TBD
**UI hint**: yes

### Phase 22: Polish & Carry-overs
**Goal**: Monitoring dashboard imported page verileriyle zenginleştirilir ve her sayfa paketinin geçmiş versiyonları revision history olarak izlenebilir hale gelir
**Depends on**: Phase 21
**Requirements**: MON-03, PAGE-05
**Success Criteria** (what must be TRUE):
  1. Monitoring dashboard'da imported pages verisi görüntülenir ve cluster bazlı özetlere dahil edilir
  2. Kullanıcı her sayfa paketi için geçmiş versiyonları listede görür ve herhangi bir versiyona geri dönebilir
  3. Yeni kayıt yapıldığında önceki versiyon otomatik olarak revision history'ye eklenir
**Plans**: 4 plans
Plans:
- [x] 22-01-PLAN.md — shadcn Sheet kurulumu + page_package_revisions migration + supabase db push [BLOCKING] (completed 2026-05-11)
- [x] 22-02-PLAN.md — MON-03: ImportedPageRow type + getImportedPageMetrics + PageMetricsTable importedPages + izleme/page.tsx GSC gate split (completed 2026-05-11)
- [x] 22-03-PLAN.md — PAGE-05: updatePagePackage revision insert + getRevisions server action + RevisionRow type (completed 2026-05-11)
- [x] 22-04-PLAN.md — PAGE-05 UI: RevisionHistorySheet + RevisionPreviewDialog + PagePackageEditor "Geçmiş" button wiring (completed 2026-05-11)
**UI hint**: yes

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Foundation | v1.0 | 4/4 | Complete | 2026-04-22 |
| 2. Project Core | v1.0 | 6/6 | Complete | 2026-04-22 |
| 3. Rules Engine | v1.0 | 3/3 | Complete | 2026-04-23 |
| 4. Competitor Intelligence | v1.0 | 4/4 | Complete | 2026-04-23 |
| 5. Keyword Import & Enrichment | v1.0 | 2/2 | Complete | 2026-04-24 |
| 6. Keyword Clustering & Scoring | v1.0 | 4/4 | Complete | 2026-04-24 |
| 7. Site Blueprint Tree | v1.0 | 4/4 | Complete | 2026-04-24 |
| 8. Page Planner & Internal Links | v1.0 | 2/2 | Complete | 2026-04-24 |
| 9. Page Package Generator | v1.0 | 4/4 | Complete | 2026-04-24 |
| 10. Schema Center | v2.0 | 4/4 | Complete | 2026-04-25 |
| 11. Metadata Validator & QA | v2.0 | 5/5 | Complete | 2026-04-25 |
| 12. Content Studio | v3.0 | 5/5 | Complete | 2026-04-26 |
| 13. WordPress Publishing | v3.0 | 5/5 | Complete | 2026-04-27 |
| 14. GSC Integration | v3.0 | 6/6 | Complete | 2026-04-27 |
| 15. Monitoring Dashboard | v3.0 | 2/2 | Complete | 2026-04-28 |
| 15.5. WP Site Import Engine | v3.0 | 8/8 | Complete | 2026-05-02 |
| 16. Recovery Engine | v3.0 | 6/6 | Complete | 2026-05-06 |
| 17. Keyword Intelligence | v3.0 | 3/3 | Complete | 2026-05-08 |
| 18. Project Launch Gate & Sector Research | v4.0 | 3/3 | Complete    | 2026-05-08 |
| 19. AI Keyword Data Acquisition | v4.0 | 3/3 | Complete | 2026-05-09 |
| 20. AI Keyword Clustering & Approval | v4.0 | 3/3 | Complete | 2026-05-10 |
| 21. Site Blueprint Auto-Generation Gate | v4.0 | 2/2 | Complete | 2026-05-10 |
| 22. Polish & Carry-overs | v4.0 | 4/4 | Complete | 2026-05-11 |
| 23. Keyword Strategy AI Intelligence Layer | v4.0 | 0/TBD | Not started | - |
