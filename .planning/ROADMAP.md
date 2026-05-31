# Roadmap: SEO Machine — Website Agency Operating System

## Milestones

- ✅ **v3.0 Autonomous Growth Layer** — Phases 12–17 (shipped 2026-05-08)
- ✅ **v4.0 AI-Powered Project Intelligence Layer** — Phases 18–23 (shipped 2026-05-12)
- 📋 **v5.0 Keyword Strategy Command Center** — Phases 24–30 (planned)

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

<details>
<summary>✅ v4.0 AI-Powered Project Intelligence Layer (Phases 18–23) — SHIPPED 2026-05-12</summary>

- [x] **Phase 18: Project Launch Gate & Sector Research** - Proje bilgileri tamamlanınca "Projeyi Başlat" aktifleşir ve sektör araştırmasını otomatik tetikler (completed 2026-05-08)
- [x] **Phase 19: AI Keyword Data Acquisition** - DataForSEO ile rakip keywordleri çekme, CSV akışıyla birleştirme, birleşik keyword havuzu oluşturma (completed 2026-05-09)
- [x] **Phase 20: AI Keyword Clustering & Approval** - Keyword havuzunu AI ile gruplama, kullanıcı onay/red/düzenleme akışı, onaylananları sisteme işleme (completed 2026-05-10)
- [x] **Phase 21: Site Blueprint Auto-Generation Gate** - Onaylanan keyword stratejisinden "Sistemi Kur" tetiklenince site blueprint otomatik oluşturulması (completed 2026-05-10)
- [x] **Phase 22: Polish & Carry-overs** - Monitoring + imported pages entegrasyonu ve revision history (completed 2026-05-11)
- [x] **Phase 23: Keyword Strategy AI Intelligence Layer** - Proaktif SEO Strategist + Traffic Architect AI, cross-module context, Second Review AI sistemi, cluster decision memory propagation (completed 2026-05-12)

</details>

### 📋 v5.0 Keyword Strategy Command Center (Phases 24–30)

**Milestone Goal:** Keyword modülünü "keyword management screen"den tam anlamıyla SEO Strategy Command Center'a dönüştür. Her AI aksiyonu analyze→explain→diff→approve→apply döngüsünden geçer. DataForSEO cache-first ve cost-aware olur. strategy_decisions kilitleme katmanı insan kararlarını AI yeniden çalıştırmalarından korur. Hiçbir kritik işlem sessiz destructive update yapmaz.

- [ ] **Phase 24: DataForSEO Validation Layer** — Cache-first DataForSEO altyapısı + `keyword_data_cache` ve `strategy_decisions` tabloları + 3 seviyeli analiz tetikleyicileri
- [ ] **Phase 25: Competitor Keyword Intelligence** — `competitor_keywords` staging tablosu + keyword gap haritası + explicit "Strateji'ye Ekle" akışı
- [ ] **Phase 26: Autonomous Clustering Engine** — SERP-overlap clustering + `computeClusterDiff()` + `ClusterDiffPreview` overlay + transaction-safe apply (en yüksek karmaşıklık: 4-5 plan)
- [ ] **Phase 27: Keyword → Blueprint Architecture Engine** — Cluster→pages transfer + conflict detection + `BlueprintTransferOverlay` + topological INSERT sırası
- [ ] **Phase 28: Cluster Diff Preview & Governance UI** — Diff state machine + non-blocking banner + batch approve/reject + locked cluster awareness
- [ ] **Phase 29: Strategic Decision Locking System** — `StrategyDecisionPanel` + lock/unlock actions + cluster silme/merge/split'te otomatik retire
- [ ] **Phase 30: Traffic Opportunity & Priority Engine** — `is_starred` + `star_reason` kolonları + AI starred keyword önerisi + locked priority assignments

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
- [x] 19-01-PLAN.md — keywords.source CHECK constraint migration + ai-acquisition.ts servis iskeleti + Wave 0 test
- [x] 19-02-PLAN.md — DataForSEO fetchRelatedKeywords() wrapper extension + vitest mock testi
- [x] 19-03-PLAN.md — ai-acquisition.ts implementation + POST /api/keywords/acquire route + AiAcquireButton + page.tsx Kaynak sütunu

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
**Plans**: 4 plans
Plans:
- [x] 23-01-PLAN.md — ai_memory migration + supabase db push [BLOCKING]
- [x] 23-02-PLAN.md — /api/keywords/analyze streaming endpoint (Anthropic, Primary→Review AI, iki aşamalı pipeline)
- [x] 23-03-PLAN.md — KeywordChat extension (Stratejiyi Yenile butonu + auto-trigger + dual-message state machine)
- [x] 23-04-PLAN.md — approveStrategy propagation genişletmesi (4 modüle batch yayılma, non-fatal)
**UI hint**: yes

---

## v5.0 Keyword Strategy Command Center

### Milestone Overview

**Milestone goal:** Keyword modülünü tam bir SEO Strategy Command Center'a dönüştür. Temel prensipler: cache-first DataForSEO, analyze→explain→diff→approve→apply insan onay döngüsü, strategy_decisions kilitleme katmanı, ve hiçbir AI aksiyonunun sessiz destructive update yapmaması.

**Phase count:** 7 (Phases 24–30)
**Requirement coverage:** 40/40 v5.0 requirements mapped
**New npm packages:** `diff@9.0.0` + `@types/diff` (Phase 26 only)

**New DB objects summary:**

| Phase | New DB Objects |
|-------|---------------|
| 24 | `keyword_data_cache` table, `strategy_decisions` table, `keywords.dfs_fetched_at` column |
| 25 | `competitor_keywords` table |
| 26 | No new tables (reads from Phase 24–25 schema) |
| 27 | `pages.blueprint_source` column, `UNIQUE(project_id, slug)` constraint on `pages` |
| 28 | No new tables |
| 29 | No new tables (`strategy_decisions` table from Phase 24) |
| 30 | `keywords.is_starred` column, `keywords.star_reason` column |

**Build order rationale:**
Phase 24 must run first — it creates `keyword_data_cache` and `strategy_decisions`, which are dependencies for lock checks (Phase 26), competitor keyword persistence (Phase 25), and the decision locking UI (Phase 29). Phase 25 runs second to feed SERP overlap signals into Phase 26 clustering. Phase 26 is the highest-complexity phase (4–5 plans) and must confirm clusters before Phase 27 can transfer them to blueprint. Phases 28 and 29 are primarily UI assembly — all their data structures exist from Phases 24–27. Phase 30 runs last as a synthesizer that reads the full locked, approved state from all prior phases.

**Architectural constraints (non-negotiable across all phases):**
1. No AI action performs a silent destructive update — every chain is: analyze → explain → diff → approve → apply
2. DataForSEO calls are user-triggered, cache-first, and cost-aware (cost estimate shown before execution)
3. `strategy_decisions` table is authoritative over `keyword_clusters.status`, `arch_status`, and `keyword_strategy_approved` when a lock exists
4. Primary apply operations use Postgres transactions — partial success is not acceptable
5. Competitor keywords go to staging (`competitor_keywords` table) first — never directly into the `keywords` pool

---

### Phase 24: DataForSEO Validation Layer
**Goal**: Her DataForSEO çağrısı cache'den önce okunur, kullanıcı maliyet tahmini görür ve onaylar; `keyword_data_cache` ve `strategy_decisions` tabloları tüm v5.0 fazlarının temelini oluşturur
**Depends on**: Phase 23
**Requirements**: DFS-01, DFS-02, DFS-03, DFS-04, DFS-05, DFS-06, DFS-07, DFS-08
**Success Criteria** (what must be TRUE):
  1. Kullanıcı "Temel Verileri Al" butonuna bastığında önce maliyet tahmini görür, onaylamadan API çağrısı başlamaz
  2. Aynı keyword için ikinci kez analiz tetiklendiğinde sistem DataForSEO yerine cache'den döner (`fromCache: true`)
  3. Keyword listesinde her keyword'ün son DataForSEO fetch tarihi (`dfs_fetched_at`) ayrı bir sütunda görüntülenir — `enriched_at` ile karıştırılmaz
  4. Eş zamanlı analiz girişimi engellenir: aynı projede analiz çalışırken ikinci tetikleme "analiz devam ediyor" uyarısı gösterir
  5. Deep analiz tamamlandığında `workflow_runs` satırı `completed` statüsüne geçer ve UI 5 saniyelik polling ile güncellenir
**Plans**: 4 plans
Plans:
- [ ] 24-01-PLAN.md — strategy_decisions migration + keywords.dfs_fetched_at + supabase db push [BLOCKING]
- [ ] 24-02-PLAN.md — getCachedOrFetch() cache.ts wrapper + Wave 0 test stubs
- [ ] 24-03-PLAN.md — lightAnalysisAction + standardAnalysisAction + AnalysisButtons.tsx + dfs_fetched_at UI
- [ ] 24-04-PLAN.md — deep analysis n8n route + callback route + DeepAnalysisPoller

**Pitfalls to watch:**
- `dfs_fetched_at` sütunu migration'da `DEFAULT now()` ALMAMALI — mevcut keywordler NULL kalmalı, ilk kullanımda stale-data check'i tetiklenmelidir
- `strategy_decisions` tablosu migration comment'inde öncelik kuralı açıkça belgelenmelidir: bu tablo `keyword_clusters.status`, `arch_status` ve `keyword_strategy_approved`'dan önceliklidir
- Cache key, keyword normalize edilmeden (lowercase + trim) hash'lenirse "SEO" ve "seo" farklı cache satırları oluşturur — `buildCacheKey()` normalizasyonu zorunlu
- `keyword_data_cache` UNIQUE constraint `cache_key` üzerinde — conflict resolution `ON CONFLICT (cache_key) DO UPDATE` ile idempotent olmalı

**UI hint**: yes

---

### Phase 25: Competitor Keyword Intelligence
**Goal**: Rakip keywordleri ayrı bir staging tablosuna (`competitor_keywords`) yazılır, keyword gap haritası kullanıcıya sunulur ve kullanıcı explicit "Strateji'ye Ekle" aksiyonuyla seçtiği keywordleri havuza dahil eder
**Depends on**: Phase 24
**Requirements**: CMP-01, CMP-02, CMP-03, CMP-04, CMP-05, CMP-06
**Success Criteria** (what must be TRUE):
  1. Rakip keyword analizi çalıştırıldığında keywordler doğrudan `keywords` tablosuna değil, `competitor_keywords` staging tablosuna yazılır
  2. Keyword gap haritasında kullanıcı, rakibin sıralandığı ama projede bulunmayan keywordleri volume, intent ve rank_absolute kolonlarıyla filtreler
  3. Kullanıcı "Strateji'ye Ekle" butonuna basana kadar hiçbir keyword otomatik olarak keyword havuzuna eklenmez
  4. Minimum volume filtresi (varsayılan 50/ay) ve intent filtresi gap haritasında aktif olarak çalışır; zaten havuzda olan keywordler gizlenir
  5. Deep analiz tamamlandıktan sonra `competitor_keywords.in_our_pool` flag'i doğru şekilde güncellenir
**Plans**: TBD

**Pitfalls to watch:**
- Kullanıcı yeni keyword import ettikten sonra `competitor_keywords.in_our_pool` flag'i stale kalabilir — import sonrası ilgili satırları güncelleyen bir post-import action gerekli
- Deep analiz n8n route'u, mevcut `/api/recovery/detect/route.ts` pattern'ini tam olarak taklit etmeli: `X-N8n-Webhook-Secret` header + service role client, ownership validation
- `competitor_keywords` tablosunda UNIQUE constraint `(competitor_id, keyword)` üzerinde — upsert bu conflict key'i kullanmalı

**UI hint**: yes

---

### Phase 26: Autonomous Clustering Engine
**Goal**: AI yalnızca draft/unassigned keywordleri kümeleme girdisi olarak alır; diff engine mevcut onaylı snapshot ile önerilen yeni kümeleme arasındaki farkı hesaplar; kullanıcı her değişikliği tek tek veya toplu onaylar; apply işlemi Postgres transaction ile atomik yapılır
**Depends on**: Phase 25
**Requirements**: CLU-01, CLU-02, CLU-03, CLU-04, CLU-05, CLU-06, CLU-07, CLU-08, CLU-09, CLU-10
**Success Criteria** (what must be TRUE):
  1. AI kümeleme motoru `status = 'approved'` olan keywordleri hiçbir zaman giriş havuzuna almaz — bu kural query seviyesinde uygulanır, prompt instruction ile değil
  2. Diff overlay, onaylı snapshot'ın tarihini ("Onaylanmış Strateji — 15 Nisan") ve AI önerisinin tarihini ("AI Önerisi — Bugün") açıkça etiketler
  3. Kullanıcı moved/new/deleted/merged/split/renamed badge'lerini görerek her değişikliği ayrı ayrı kabul veya reddeder
  4. Deleted veya merged cluster içeren diff'de ek onay adımı tetiklenir; kullanıcı destructive değişiklikleri ayrıca teyit etmeden apply çalışmaz
  5. Apply işlemi kısmen başarısız olursa tüm değişiklikler geri alınır — "Değişiklikler uygulanamadı" hatası gösterilir ve pending-approval state korunur
  6. Apply sonrası `ai_memory module='clusters'` snapshot atomik olarak yeniden oluşturulur
**Plans**: TBD (tahmini 4–5 plan — en yüksek karmaşıklık)

**Pitfalls to watch:**
- Clustering input query'si `WHERE status != 'approved'` filtresi olmadan çalışırsa approved cluster'lar AI tarafından yeniden kümelenir — bu kritik regresyondur
- Diff algorithm, cluster kimliğini isme göre değil keyword set intersection'a göre belirlemelidir — cluster yeniden adlandırıldığında diff "deleted + new" üretmemeli, "renamed" üretmeli
- `computeClusterDiff()` baseline'ı mevcut mixed draft+approved state'e değil, son `keyword_strategy_approved=true` eventindeki snapshot'a karşı hesaplamalıdır
- `applyClusteringUpdate()` non-fatal pattern kullanmamalı — tek bir Postgres transaction içinde tüm cluster mutations gerçekleşmelidir
- `diff@9.0.0` npm paketi bu fazda eklenir (`@types/diff` ile birlikte)
- strategy_decisions kilidi olan cluster için merge/delete operasyonu, kullanıcı önce kilidi açmadan engellenir

---

### Phase 27: Keyword → Blueprint Architecture Engine
**Goal**: Onaylanan keyword cluster'ları `pages` tablosuna conflict-aware ve transaction-safe biçimde aktarılır; mevcut sayfalara çarpışma olduğunda kullanıcı karar verir; page_package bağlantısı olan sayfalar asla sessizce geçersiz kılınmaz
**Depends on**: Phase 26
**Requirements**: BPT-01, BPT-02, BPT-03, BPT-04, BPT-05, BPT-06
**Success Criteria** (what must be TRUE):
  1. Transfer başlamadan önce `keyword_clusters.status = 'approved'` olmayan cluster'lar transfer kaynağı olamaz
  2. Slug eşleşmesi olan sayfalarda sistem otomatik merge önerir; cluster_id çakışmasında kullanıcı replace/keep/merge seçeneklerini görür
  3. Bağlı page_package veya wp_post_id'si olan sayfa, kullanıcı "replace" seçse dahi otomatik olarak force-keep'e döner; UI bunu açıkça bildirir
  4. Replace/merge önerisi varsa etkilenecek page_package ve internal_link sayısı dependency inspection ekranında görüntülenir; kullanıcı ek onay verir
  5. Apply işlemi parent sayfaları child'lardan önce ekler (topological INSERT sırası); self-referential parent_id döngüsü oluşmaz
  6. Tüm transfer işlemi tek bir Postgres transaction içinde gerçekleşir; kısmi INSERT'te tüm değişiklikler geri alınır
**Plans**: TBD

**Pitfalls to watch:**
- `pages` tablosunun self-referential `parent_id` FK'sı topological sort gerektiriyor — INSERT sırası yanlışsa FK violation oluşur ve tüm transaction rollback olur
- `pages.UNIQUE(project_id, slug)` constraint bu fazda ekleniyor — migration öncesi duplicate slug satırları temizlenmeli veya migration conditional yazılmalı
- `page_packages` count check'i apply action'ının başında çalışmalı, conflict resolution overlay'inde değil — kullanıcı overlay'de force-keep görmeden önce sayı hesaplanmalı
- `blueprint_source` kolonu enum check constraint ile (`manual`, `wp_import`, `blueprint_auto`, `keyword_transfer`) — INSERT'ler doğru değeri set etmeli

**UI hint**: yes

---

### Phase 28: Cluster Diff Preview & Governance UI
**Goal**: Diff state machine (idle→diff_generated→in_review→all_decided→applying→applied) kullanıcıya net görünürlük verir; non-blocking banner bekleyen değişiklikleri bildirir; per-change ve batch approve/reject desteklenir; locked cluster'lar overlay içinde devre dışı Reject butonuyla işaretlenir
**Depends on**: Phase 26, Phase 27
**Requirements**: GOV-01, GOV-02, GOV-03, GOV-04, GOV-05, GOV-06
**Success Criteria** (what must be TRUE):
  1. Diff overlay iki tarafı tarih etiketiyle gösterir — "Onaylanmış Strateji (15 Nisan)" sol, "AI Önerisi (Bugün)" sağ
  2. Bekleyen diff varken sayfanın üstünde "X değişiklik inceleme bekliyor — İncele" banner'ı görünür; banner overlay'i force-açmaz
  3. Kullanıcı her değişikliği tek tek onaylayabilir veya "Tüm taşınanları kabul et" ile batch approve yapabilir
  4. strategy_decisions kilidi olan cluster için Reject butonu disabled görünür ve "Kilitli" badge gösterilir
  5. Apply başarısız olduğunda "Değişiklikler uygulanamadı" hatası gösterilir, state in_review'e geri döner ve pending kararlar korunur
**Plans**: TBD

**Pitfalls to watch:**
- Governance UI birden fazla tabloyu okur (keyword_clusters, strategy_decisions, ai_memory) — tüm mutation route'ları `revalidatePath` çağırmalı, yoksa SSR data stale kalır
- Diff state machine'in error→in_review rollback'i explicit olarak implement edilmeli — UI error state'te takılı kalırsa kullanıcı değişikliklere ulaşamaz

**UI hint**: yes

---

### Phase 29: Strategic Decision Locking System
**Goal**: Kullanıcı herhangi bir cluster veya keyword kararını `strategy_decisions` tablosuna kilitler; lock/unlock akışı idempotent ve audit-friendly çalışır; cluster silme/merge/split işlemlerinde etkilenen kararlar otomatik olarak devre dışı bırakılır
**Depends on**: Phase 24 (strategy_decisions table), Phase 26
**Requirements**: STR-01, STR-02, STR-03, STR-04, STR-05
**Success Criteria** (what must be TRUE):
  1. Kullanıcı bir cluster veya keyword kararını kilitlendiğinde `strategy_decisions` tablosuna `is_locked=true` satırı yazılır; aynı karar zaten kilitliyse ikinci lock işlemi hata üretmez (no-op)
  2. Unlock işlemi kararı silmez — `is_locked=false`, `is_active=false` yapar ve bu değişiklik denetlenebilir şekilde izlenebilir
  3. Cluster silindiğinde, merge edildiğinde veya split'e uğradığında etkilenen cluster'ların `strategy_decisions` satırları aynı transaction'da `is_active=false` olur
  4. Kilitli bir cluster'a move/merge/delete operasyonu uygulanmak istendiğinde sistem açık hata mesajıyla reddeder; operasyon başlamadan engellenir
  5. `strategy_decisions.is_locked=true` satırları, `keyword_clusters.status` veya `keyword_strategy_approved` üzerindeki değerlerden her zaman önceliklidir
**Plans**: TBD

**Pitfalls to watch:**
- Lock guard, action katmanında uygulanmalı (DB FK enforcement ile değil) — her cluster-mutating server action, `strategy_decisions` check'ini action başında çalıştırmalı
- `lockStrategyDecision()` UPSERT kullanmalı (`onConflict: 'project_id,module,key'`) — duplicate UNIQUE violation yerine idempotent upsert
- Cluster silme/merge/split transaction'ı `STR-05` retire'ını aynı transaction içinde yapmalı — aksi takdirde race condition ile stale lock kalabilir

**UI hint**: yes

---

### Phase 30: Traffic Opportunity & Priority Engine
**Goal**: AI, cluster context + volume + difficulty + intent analizine dayanarak starred keyword önerileri üretir; kullanıcı önerileri inceler, kabul/reddeder ve onaylananlar `strategy_decisions` tablosuna kilitlenir; starred keyword'ün cluster'ının lock'u ile çelişiyorsa çakışma açıkça gösterilir
**Depends on**: Phase 25, Phase 26, Phase 29
**Requirements**: TRF-01, TRF-02, TRF-03, TRF-04, TRF-05
**Success Criteria** (what must be TRUE):
  1. AI, yıldız önerilerini analiz etmeden önce mevcut `strategy_decisions` kilitlerini okur ve kilitli kararlarla çelişen öneriler üretmez
  2. Starred keyword önerisi overlay'inde kullanıcı her önerilen yıldızı AI reasoning'i ile birlikte görür ve tek tek kabul veya reddeder
  3. Kullanıcının kendi seçtiği keywordlere yıldız eklemesi için manuel seçim yolu da mevcuttur (AI önerisine bağımlı değil)
  4. Onaylanan starred keyword `strategy_decisions` tablosunda `module='starred_keywords', key=keyword_id` olarak kilitlenir
  5. Kilitli starred keyword için "Kilidi Gözden Geçir" butonu mevcuttur; tıklandığında aynı analyze→approve döngüsü başlar — kalıcı kilit yoktur
  6. Starred keyword'ün cluster'ı farklı priority lock taşıyorsa kullanıcıya çakışma uyarısı gösterilir; sessiz override yapılmaz
**Plans**: TBD

**Pitfalls to watch:**
- `keywords.is_starred` ve `keywords.star_reason` sütunları bu fazda migration ile ekleniyor — migration olmadan server action'lar çalışmaz
- Starred keyword AI önerileri kullanıcı onayından önce `strategy_decisions`'a yazılmamalı — onay overlay'ini atlayan bir kod path'i açık kilit bırakır
- "Kilidi Gözden Geçir" unlock flow'u `STR-04` pattern'ini (`is_locked=false, is_active=false`) takip etmeli — kayıt silinmemeli

**UI hint**: yes

---

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
| 18. Project Launch Gate & Sector Research | v4.0 | 3/3 | Complete | 2026-05-08 |
| 19. AI Keyword Data Acquisition | v4.0 | 3/3 | Complete | 2026-05-09 |
| 20. AI Keyword Clustering & Approval | v4.0 | 3/3 | Complete | 2026-05-10 |
| 21. Site Blueprint Auto-Generation Gate | v4.0 | 2/2 | Complete | 2026-05-10 |
| 22. Polish & Carry-overs | v4.0 | 4/4 | Complete | 2026-05-11 |
| 23. Keyword Strategy AI Intelligence Layer | v4.0 | 4/4 | Complete | 2026-05-12 |
| 24. DataForSEO Validation Layer | v5.0 | 0/TBD | Not started | - |
| 25. Competitor Keyword Intelligence | v5.0 | 0/TBD | Not started | - |
| 26. Autonomous Clustering Engine | v5.0 | 0/TBD | Not started | - |
| 27. Keyword → Blueprint Architecture Engine | v5.0 | 0/TBD | Not started | - |
| 28. Cluster Diff Preview & Governance UI | v5.0 | 0/TBD | Not started | - |
| 29. Strategic Decision Locking System | v5.0 | 0/TBD | Not started | - |
| 30. Traffic Opportunity & Priority Engine | v5.0 | 0/TBD | Not started | - |
