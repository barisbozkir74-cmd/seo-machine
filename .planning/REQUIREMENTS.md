---
milestone: v5.0
milestone_name: Keyword Strategy Command Center
status: active
created: "2026-05-12"
---

# Requirements — v5.0 Keyword Strategy Command Center

## Scope

Keyword modülünü "keyword management screen"den tam anlamıyla SEO Strategy Command Center'a dönüştür.
Temel prensipler: cache-first DataForSEO, analyze→explain→diff→approve→apply insan onay döngüsü,
strategy_decisions kilitleme katmanı, ve herhangi bir AI aksiyonunun sessiz destructive update yapmaması.

---

## DFS — DataForSEO Validation Layer

| REQ-ID | Requirement | Priority | Notes |
|--------|------------|----------|-------|
| DFS-01 | `keyword_data_cache` Supabase tablosu: cache_key (SHA-256 hash), endpoint, keyword, location_code, language_code, analysis_level, response_data JSONB, expires_at | Must | TTL per level: light=7d, standard=3d, deep=1d |
| DFS-02 | `getCachedOrFetch()` util — cache-first: cache hit → return; miss → DataForSEO call → write cache → return | Must | `'server-only'`, `src/lib/dataforseo/cache.ts` |
| DFS-03 | Light analiz tetikleyici: "Temel Verileri Al" butonu — cluster veya keyword bazlı, maliyet tahmini gösterilir, kullanıcı onaylar | Must | Synchronous Server Action, max ~50 kw batch |
| DFS-04 | Standard analiz tetikleyici: "Standart Analiz" — cluster bazlı, SERP overlap + related keywords, 5-8s | Must | Synchronous Server Action veya chunked streaming |
| DFS-05 | Deep analiz tetikleyici: "Derinlemesine Analiz" — project bazlı, maliyet uyarısı + onay gerekli, async | Must | n8n webhook pattern (Phase 16 kopyası) |
| DFS-06 | `workflow_runs` tablosu wiring — deep analiz job tracking (pending/running/done/failed), 5s polling | Must | Tablo zaten mevcut (Phase 1), sadece wire up |
| DFS-07 | UI stale-data uyarısı: analiz başlatılmadan önce keyword'lerin son DFS fetch tarihi gösterilir | Must | `dfs_fetched_at` column — `enriched_at`'den ayrı |
| DFS-08 | Concurrent analiz guard: proje başına tek analiz — çift tıklama veya race condition önlenir | Must | workflow_runs status check veya proje flag |

---

## CLU — Autonomous Clustering Engine

| REQ-ID | Requirement | Priority | Notes |
|--------|------------|----------|-------|
| CLU-01 | Clustering input pool filtering: `WHERE status != 'approved'` — sadece draft/unassigned keywordler AI'a gönderilir | Must | Query level — AI prompt instruction yeterli değil |
| CLU-02 | Approved cluster read-only reference: AI clustering prompt, onaylı cluster'ları bağlam olarak alır (cannibalization detection için) ama bunları değiştiremez | Must | |
| CLU-03 | SERP-overlap clustering: Phase 25'ten gelen competitor SERP verisini kullanarak keyword çifti overlap hesaplaması | Should | ≥0.3 overlap → same cluster candidate; union-find |
| CLU-04 | `proposeClusteringUpdate()` Server Action: mevcut approved snapshot vs AI önerisi diff hesaplanır, ai_memory'ye taslak yazılır | Must | `module='proposed_clustering', key='draft'` |
| CLU-05 | `computeClusterDiff()` lib fonksiyonu: moved/new/deleted/merged/split/renamed operasyon tipleri | Must | `src/lib/keywords/cluster-diff.ts`, 'server-only' |
| CLU-06 | Diff baseline = son approved snapshot: mixed draft+approved state'e karşı değil, en son `keyword_strategy_approved=true` eventindeki snapshot'a karşı diff | Must | Pitfall 5 önlemi |
| CLU-07 | `ClusterDiffPreview` overlay: moved/new/deleted/merged/split badge'leri, her değişiklik için kabul/reddet, AI reasoning tooltip | Must | Phase 20 `ClusteringApprovalOverlay` pattern'inden türetilmiş |
| CLU-08 | Destructive change uyarısı: deleted veya merged cluster varsa ek onay adımı | Must | `hasDestructiveChanges` flag |
| CLU-09 | `applyClusteringUpdate()` Server Action: Postgres transaction içinde — kısmi başarı yoktur | Must | Pitfall 8 önlemi |
| CLU-10 | Apply sonrası `ai_memory module='clusters'` snapshot rebuild: her governance cycle sonrası atomik güncelleme | Must | Pitfall 9 önlemi |

---

## CMP — Competitor Keyword Intelligence

| REQ-ID | Requirement | Priority | Notes |
|--------|------------|----------|-------|
| CMP-01 | `competitor_keywords` tablosu: keyword, rank_absolute, search_volume, cpc, search_intent, in_our_pool BOOLEAN, opportunity_score, fetched_at | Must | Queryable tablo — `competitors` üzerinde JSONB değil |
| CMP-02 | Competitor keyword staging: intelligence keywordler direkt `keywords` tablosuna eklenmez — ayrı staging alan | Must | Pitfall 6 önlemi — pool pollution önlenir |
| CMP-03 | "Strateji'ye Ekle" explicit user action: staging'deki keyword'ü `keywords` tablosuna ekler, `in_our_pool=true` yapar | Must | |
| CMP-04 | Keyword gap map UI: competitor rank'ı olan ama projede olmayan keywordler — volume, intent, rank_absolute kolonları | Must | |
| CMP-05 | Gap map filtreleme: minimum volume (default 50/mo), intent filter, zaten pool'da olanlar gizlenir | Must | Pitfall 12 önlemi |
| CMP-06 | Manual competitor URL ekleme: project competitors dışında analiz-only rakip domain ekleme | Should | Analysis context genişletmek için |

---

## TRF — Traffic Opportunity & Priority Engine

| REQ-ID | Requirement | Priority | Notes |
|--------|------------|----------|-------|
| TRF-01 | `keywords` tablosuna `is_starred BOOLEAN DEFAULT false`, `star_reason TEXT` kolonları | Must | Migration |
| TRF-02 | AI starred keyword önerisi: cluster context + volume + difficulty + intent analizi → öneri listesi + per-keyword reasoning | Must | strategy_decisions'a yazılmadan önce kullanıcı onayı |
| TRF-03 | Starred keyword approval overlay: AI önerilen yıldızları incele, kabul/reddet, kendi seçimlerini ekle | Must | |
| TRF-04 | Priority locking: onaylandıktan sonra `strategy_decisions` tablosuna kayıt — `module='starred_keywords'`, `key=keyword_id` | Must | Boolean flag değil strategy_decisions row |
| TRF-05 | Lock review yolu: locked yıldızın reasoning'i + "Kilidi Gözden Geçir" butonu — aynı analyze→approve döngüsünden geçer | Must | Pitfall 7 önlemi — kalıcı kilit yok |

---

## BPT — Keyword → Blueprint Architecture Engine

| REQ-ID | Requirement | Priority | Notes |
|--------|------------|----------|-------|
| BPT-01 | `pages` tablosuna `UNIQUE(project_id, slug)` constraint + `blueprint_source` kolonu (manual/wp_import/blueprint_auto/keyword_transfer) | Must | Pitfall 11 önlemi — migration |
| BPT-02 | `proposeArchitectureTransfer()` Server Action: approved clusters vs mevcut blueprint diff — safe inserts, merge proposals, conflicts | Must | |
| BPT-03 | Conflict detection: slug match (auto-merge), cluster_id collision (user decides), page_package/wp_post_id varlığı (force-keep) | Must | Pitfall 3 önlemi |
| BPT-04 | Dependency inspection UI: replace/merge önerisi varsa etkilenecek page_package, internal_link sayısı gösterilir | Must | Ek onay required |
| BPT-05 | `applyArchitectureTransfer()` Server Action: Postgres transaction, parent-before-child topological INSERT sırası | Must | Pitfall 3 + self-referential parent_id |
| BPT-06 | Transfer gate: sadece `keyword_clusters.status='approved'` olan cluster'lar transfer kaynağı olabilir | Must | Phase 20 approval gate korunur |

---

## STR — Strategic Decision Locking System

| REQ-ID | Requirement | Priority | Notes |
|--------|------------|----------|-------|
| STR-01 | `strategy_decisions` tablosu: user_id, project_id, module, key, value JSONB, reason, locked_at, locked_by, is_locked, is_active, UNIQUE(project_id,module,key) | Must | Modules: cluster_priority, primary_keyword, page_type, cannibalization, authority_structure, target_url, starred_keywords |
| STR-02 | Lock precedence tanımı: `strategy_decisions.is_locked=true` → `keyword_clusters.status`, `arch_status`, `keyword_strategy_approved`'dan öncelikli | Must | Pitfall 4 önlemi — migration comment'inde belgelenmiş |
| STR-03 | `lockStrategyDecision()` Server Action: auth + ownership + UPSERT — idempotent (zaten kilitli ise no-op) | Must | |
| STR-04 | `unlockStrategyDecision()` Server Action: `is_locked=false` + `is_active=false` — silme değil, devre dışı bırakma | Must | |
| STR-05 | Cluster delete/merge/split işleminde otomatik retire: etkilenen cluster_id'lerin strategy_decisions rowları `is_active=false` olur — aynı transaction'da | Must | Pitfall 13 önlemi |

---

## GOV — Cluster Diff Preview & Governance UI

| REQ-ID | Requirement | Priority | Notes |
|--------|------------|----------|-------|
| GOV-01 | Diff baseline labelling: overlay iki tarafı date-stamp ile gösterir — "Onaylanmış Strateji (15 Nisan)" vs "AI Önerisi (Bugün)" | Must | Pitfall 5 önlemi |
| GOV-02 | Diff state machine: idle→diff_generated→in_review→all_decided→applying→applied + error→in_review rollback | Must | |
| GOV-03 | Non-blocking diff banner: "X değişiklik inceleme bekliyor" + "İncele" butonu — overlay'ı force-açmaz | Must | |
| GOV-04 | Per-change approve/reject + batch approve ("Tüm taşınanları kabul et") | Must | |
| GOV-05 | Primary apply = Postgres transaction (not non-fatal): kısmi başarı durumunda "Değişiklikler uygulanamadı" hatası, pending-approval state korunur | Must | Pitfall 8 önlemi |
| GOV-06 | Phase 20 `ClusteringApprovalOverlay` lock awareness: strategy_decisions kilidi olan cluster için Reject butonu disabled + "Kilitli" badge | Must | Pitfall 15 önlemi |

---

## Architectural Constraints (Non-Negotiable)

1. **Hiçbir AI action silent destructive update yapmaz** — her zincir: analyze → explain → diff → approve → apply
2. **DataForSEO: user-triggered, cache-first, cost-aware** — kullanıcıya maliyet tahmini gösterilir
3. **`strategy_decisions` tablosu `ai_memory`'den ayrı tutulur** — farklı TTL, farklı amaç, farklı sorgu pattern'i
4. **Primary apply = transaction; advisory ops = non-fatal** — kısmi başarı yoktur
5. **Competitor keywords = staging first** — `keywords` pool'una explicit user action olmadan eklenmez

---

## Out of Scope (v5.0)

- Otomatik yayın veya apply (onaysız) — her kritik aksiyon kullanıcı onayından geçer
- Real-time SERP polling — cache-first, user-triggered refresh
- Multi-tenant SaaS — tek ajans kullanımı
- Tam otomatik competitor discovery — user-curated + manual URL add
- Numeric keyword priority score (1-100 scale) — binary star + reasoning daha net

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| DFS-01–DFS-08 | Phase 24 | Planned |
| CLU-01–CLU-10 | Phase 26 | Planned |
| CMP-01–CMP-06 | Phase 25 | Planned |
| TRF-01–TRF-05 | Phase 30 | Planned |
| BPT-01–BPT-06 | Phase 27 | Planned |
| STR-01–STR-05 | Phase 29 | Planned |
| GOV-01–GOV-06 | Phase 28 | Planned |
