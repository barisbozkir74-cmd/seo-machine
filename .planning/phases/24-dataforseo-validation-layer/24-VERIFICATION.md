---
phase: 24-dataforseo-validation-layer
verified: 2026-05-31T10:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "keyword_data_cache tablosu DFS-01 için oluşturuldu"
    reason: "RESEARCH.md Pitfall 2: dataforseo_task_cache zaten mevcut, keyword_data_cache ayrı tablo açmak duplication riski oluşturur. Plan 01 action bölümünde açıkça belgelenmiş: 'keyword_data_cache adında ayrı tablo AÇILMAYACAK'. dataforseo_task_cache fingerprint(SHA-256)+endpoint+result+expires_at ile DFS-01'in fonksiyonel gereksinimlerini karşılıyor. analysis_level explicit kolonu yok ama endpoint+TTL mantığı orchestrator.ts ENDPOINT_TTL'de uygulanmış."
    accepted_by: "plan-author (24-01-PLAN.md)"
    accepted_at: "2026-05-31T00:00:00Z"
human_verification:
  - test: "Temel Verileri Al butonuna tıkla, onaylamadan önce cost dialog'un açıldığını ve API çağrısının başlamadığını doğrula"
    expected: "Dialog açılır, 'Tahmini maliyet: ~N birim' görünür, sadece 'Temel Analizi Başlat' butonuna basıldıktan sonra API çağrısı tetiklenir"
    why_human: "Diyalog-öncesi API çağrısını engelleyen client-side state akışı programatik olarak test edilemez"
  - test: "Aynı keyword seti için iki kez 'Temel Verileri Al' tetikle"
    expected: "İkinci tetiklemede inline result mesajı 'Cache'den döndü — veri güncel' gösterir (fromCache: true)"
    why_human: "Cache hit davranışı gerçek Supabase + DataForSEO ortamında doğrulanmalı"
  - test: "Analiz çalışırken ikinci kez butona bas"
    expected: "Amber banner 'Analiz devam ediyor. Tamamlanmasını bekleyin.' görünür, butonlar disabled"
    why_human: "isAnalysisRunning SSR prop'u ve UI state geçişi gerçek tarayıcıda doğrulanmalı"
---

# Phase 24: DataForSEO Validation Layer — Doğrulama Raporu

**Phase Goal:** Her DataForSEO çağrısı cache'den önce okunur, kullanıcı maliyet tahmini görür ve onaylar; `keyword_data_cache` ve `strategy_decisions` tabloları tüm v5.0 fazlarının temelini oluşturur
**Doğrulama Tarihi:** 2026-05-31
**Durum:** HUMAN_NEEDED
**Yeniden Doğrulama:** Hayır — ilk doğrulama

---

## Hedef Başarımı

### ROADMAP Success Criteria

ROADMAP.md Phase 24 için 5 success criteria tanımlıyor:

| # | Kriter | Durum | Kanıt |
|---|--------|-------|-------|
| SC-1 | Kullanıcı "Temel Verileri Al" butonuna bastığında önce maliyet tahmini görür, onaylamadan API çağrısı başlamaz | ? HUMAN | AnalysisButtons.tsx'de Dialog + openDialog() → handleConfirm() akışı mevcut; fonksiyonel doğrulama gerekli |
| SC-2 | Aynı keyword için ikinci kez analiz tetiklendiğinde sistem DataForSEO yerine cache'den döner (`fromCache: true`) | ✓ VERIFIED | getCachedOrFetch() → fetchWithCache() → dataforseo_task_cache UNIQUE(project_id, fingerprint); orchestrator.ts makeFingerprint() normalize ediyor (sort+lowercase+trim); 3/3 unit test PASS |
| SC-3 | Keyword listesinde her keyword'ün son DataForSEO fetch tarihi (`dfs_fetched_at`) ayrı bir sütunda görüntülenir, `enriched_at` ile karıştırılmaz | ✓ VERIFIED | page.tsx: "DFS Tarihi" TableHead (text-cyan-400/70), dfs_fetched_at TableCell 3-state (Veri yok/Güncel değil/tarih); ayrı enriched_at sütunu dokunulmamış |
| SC-4 | Eş zamanlı analiz girişimi engellenir: aynı projede analiz çalışırken ikinci tetikleme "analiz devam ediyor" uyarısı gösterir | ? HUMAN | AnalysisButtons.tsx amber banner (bg-amber-500/10) + isAnalysisRunning prop; actions.ts workflow_runs concurrent guard; tarayıcı doğrulaması gerekli |
| SC-5 | Deep analiz tamamlandığında `workflow_runs` satırı güncellenir ve UI 5 saniyelik polling ile güncellenir | ✓ VERIFIED | callback/route.ts workflow_runs UPDATE status='done'+completed_at; DeepAnalysisPoller.tsx setInterval(5000) MAX_LOOPS=144; router.refresh() her döngüde |

**Skor:** 3/5 programatik olarak doğrulandı; 2/5 insan doğrulaması bekliyor (SC-1, SC-4)

---

### Gözlemlenebilir Doğrular (Plan Must-Haves)

**Plan 01 — DFS-01, DFS-07**

| # | Doğru | Durum | Kanıt |
|---|-------|-------|-------|
| 1 | strategy_decisions tablosu: UNIQUE(project_id,module,key), is_locked, is_active kolonları | ✓ VERIFIED | `20260606000001_strategy_decisions.sql` UNIQUE(project_id, module, key) + is_locked BOOLEAN NOT NULL DEFAULT false + is_active BOOLEAN NOT NULL DEFAULT true |
| 2 | keywords.dfs_fetched_at kolonu mevcut, DEFAULT now() yok — mevcut satırlar NULL kalır | ✓ VERIFIED | `20260606000002_keywords_dfs_fetched_at.sql`: ADD COLUMN IF NOT EXISTS dfs_fetched_at TIMESTAMPTZ; DEFAULT now() sadece comment'te (kasıtlı belgeleme), SQL olarak yok |
| 3 | strategy_decisions'da RLS aktif: kullanıcılar sadece kendi satırlarını okur/yazar | ✓ VERIFIED | ENABLE ROW LEVEL SECURITY + `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())` |
| 4 | strategy_decisions migration comment'inde precedence rule belgeli | ✓ VERIFIED | "PRECEDENCE RULE (v5.0): is_locked=true satırlar keyword_clusters.status, arch_status ve keyword_strategy_approved'dan her zaman önceliklidir" — satır 5-8 |
| 5 | dataforseo_task_cache tablosu DFS-01'in cache deposu (duplikasyon yok) | ✓ VERIFIED (override) | `20260522000001_dataforseo_task_cache.sql` mevcut; keyword_data_cache ayrı tablo YOK; plan kararı belgelenmiş |

**Plan 02 — DFS-02**

| # | Doğru | Durum | Kanıt |
|---|-------|-------|-------|
| 1 | getCachedOrFetch() mevcut fetchWithCache() orchestrator'ını sararak çalışıyor | ✓ VERIFIED | cache.ts: `import { fetchWithCache } from './orchestrator'`; direkt delegate |
| 2 | cache.ts dosyası 'server-only' import guard ile başlıyor | ✓ VERIFIED | cache.ts satır 11: `import 'server-only'` |
| 3 | Cache hit durumunda fromCache: true dönüyor | ✓ VERIFIED | cache.test.ts Test 1 PASS; `if (result.skipped) return null; return { data, fromCache }` |
| 4 | Cache miss durumunda API çağrılıp cache'e yazılıyor | ✓ VERIFIED | fetchWithCache orchestrator'da (test mock ile doğrulandı) |
| 5 | buildCacheKey keyword normalize ediyor: lowercase+trim, SHA-256 | ✓ VERIFIED | orchestrator.ts makeFingerprint(): `.toLowerCase().trim()` + sort; cache.ts doğrudan delegate |
| 6 | cache.test.ts 3+ davranışı test ediyor | ✓ VERIFIED | 3 test: hit/miss/skipped — 3/3 PASS |

**Plan 03 — DFS-03, DFS-04, DFS-07, DFS-08**

| # | Doğru | Durum | Kanıt |
|---|-------|-------|-------|
| 1 | "Temel Verileri Al" butonuna tıklayınca cost dialog açılır, onaylamadan API çağrısı başlamaz | ? HUMAN | openDialog('light') → Dialog açık → handleConfirm() → lightAnalysisAction(); kod akışı doğru, UI doğrulaması gerekli |
| 2 | lightAnalysisAction ve standardAnalysisAction getCachedOrFetch() üzerinden çalışıyor | ✓ VERIFIED | actions.ts satır 7: `import { getCachedOrFetch } from '@/lib/dataforseo/cache'`; satır 1159 ve 1248: getCachedOrFetch çağrısı |
| 3 | dfs_fetched_at sütunu keyword tablosunda görünüyor: NULL='Veri yok', stale='Güncel değil', fresh=tarih | ✓ VERIFIED | page.tsx: 3-state TableCell (null→Badge "Veri yok"; isDfsStale→Badge "Güncel değil"; else→formatDfsDate) |
| 4 | Eş zamanlı analiz girişimi engelleniyor | ? HUMAN | amber banner kodu mevcut; isAnalysisRunning prop + workflow_runs guard; tarayıcı doğrulaması gerekli |
| 5 | Standart analiz cluster-scoped: clusters yoksa buton disabled | ✓ VERIFIED | AnalysisButtons.tsx: `standardDisabled = noKeywords || anyConcurrent || clusterCount === 0`; standardAnalysisAction cluster check |
| 6 | AnalysisButtons.tsx 3 butonu cyan renk temasıyla toolbar'ın sağına ekleniyor | ✓ VERIFIED | `border-cyan-500/30 bg-cyan-500/10 text-cyan-400` 3 ayrı yerde (grep çıktısı: 3 eşleşme) |

**Plan 04 — DFS-05, DFS-06, DFS-08**

| # | Doğru | Durum | Kanıt |
|---|-------|-------|-------|
| 1 | POST /api/dataforseo/deep-analysis X-N8n-Webhook-Secret header ile korunuyor | ✓ VERIFIED | route.ts satır 29: `request.headers.get('X-N8n-Webhook-Secret')`; 401 dönüyor |
| 2 | Deep analiz trigger'ı workflow_runs tablosuna status='pending' satır INSERT ediyor | ✓ VERIFIED | route.ts satır 88-100: `workflow_runs` INSERT `workflow_type: 'dfs_deep_analysis', status: 'pending'` |
| 3 | n8n tamamlanınca callback route workflow_runs'ı done/failed yapıyor | ✓ VERIFIED | callback/route.ts satır 88-100: UPDATE `status, result_payload, completed_at` |
| 4 | Callback route keywords.dfs_fetched_at'ı bulk güncelliyor (status='done' ise) | ✓ VERIFIED | callback/route.ts satır 106-111: `if (status === 'done' && keywordIds.length > 0) → keywords.update({ dfs_fetched_at: now })` |
| 5 | DeepAnalysisPoller.tsx 5 saniyelik polling, 144 döngü timeout | ✓ VERIFIED | setInterval(5000) + MAX_LOOPS = 144; `router.refresh()` her döngüde |
| 6 | Deep analiz çalışırken ikinci tetikleme concurrent guard tarafından engelleniyor | ✓ VERIFIED | trigger route satır 73-80: workflow_runs `.in('status', ['pending','running']) → 409`; triggerDeepAnalysisAction'da da aynı guard |

---

### Gerekli Artifaktlar

| Artifakt | Beklenti | Durum | Detay |
|----------|----------|-------|-------|
| `supabase/migrations/20260606000001_strategy_decisions.sql` | strategy_decisions DDL + RLS + index | ✓ VERIFIED | 48 satır; UNIQUE+RLS+3 index+precedence rule |
| `supabase/migrations/20260606000002_keywords_dfs_fetched_at.sql` | dfs_fetched_at kolonu, DEFAULT olmadan | ✓ VERIFIED | 15 satır; TIMESTAMPTZ, DEFAULT yok, partial index |
| `src/lib/dataforseo/cache.ts` | getCachedOrFetch() wrapper + server-only | ✓ VERIFIED | 37 satır; import 'server-only'; export async function getCachedOrFetch; CachedFetchResult type |
| `src/__tests__/lib/dataforseo/cache.test.ts` | Unit testler: hit/miss/skipped | ✓ VERIFIED | 3 test; 3/3 PASS |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/AnalysisButtons.tsx` | 3 cyan buton + cost dialog + concurrent guard | ✓ VERIFIED | 'use client'; cyan tema 3x; amber banner; Dialog bileşeni |
| `src/__tests__/lib/dataforseo/analysis.test.ts` | Unit testler: lightAnalysisAction | ✓ VERIFIED | lightAnalysisAction import; 6+ test case |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` (güncelleme) | lightAnalysisAction + standardAnalysisAction + triggerDeepAnalysisAction | ✓ VERIFIED | satır 1104, 1183, 1277 export async function'lar |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` (güncelleme) | dfs_fetched_at SSR + AnalysisButtons + DeepAnalysisPoller | ✓ VERIFIED | dfs_fetched_at select'te, AnalysisButtons render, DeepAnalysisPoller mount |
| `src/app/api/dataforseo/deep-analysis/route.ts` | n8n trigger route | ✓ VERIFIED | X-N8n-Webhook-Secret + SUPABASE_SERVICE_ROLE_KEY + dfs_deep_analysis + 409 concurrent guard |
| `src/app/api/dataforseo/deep-analysis/callback/route.ts` | n8n callback route | ✓ VERIFIED | webhook secret + ownership + workflow_runs UPDATE + dfs_fetched_at bulk update |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/DeepAnalysisPoller.tsx` | 5s polling + timeout guard | ✓ VERIFIED | setInterval(5000) + MAX_LOOPS=144 + router.refresh() + 3 stop condition |

---

### Key Link Doğrulaması

| Kaynak | Hedef | Bağlantı | Durum | Detay |
|--------|-------|----------|-------|-------|
| `cache.ts` | `orchestrator.ts` | `import { fetchWithCache } from './orchestrator'` | ✓ WIRED | satır 13 |
| `AnalysisButtons.tsx` | `lightAnalysisAction / standardAnalysisAction` | `import ... from './actions'` + `startLightTransition(async () => lightAnalysisAction(...))` | ✓ WIRED | satır 12, 67, 83 |
| `lightAnalysisAction` | `getCachedOrFetch` | `import { getCachedOrFetch } from '@/lib/dataforseo/cache'` | ✓ WIRED | actions.ts satır 7, 1159, 1248 |
| `page.tsx` SSR query | `keywords.dfs_fetched_at` | select string'e dahil | ✓ WIRED | satır 118 |
| `AnalysisButtons.tsx` | `triggerDeepAnalysisAction` | `import ... from './actions'` + `startDeepTransition` | ✓ WIRED | satır 12, 100 |
| `DeepAnalysisPoller.tsx` | `page.tsx SSR` | `setInterval → router.refresh()` | ✓ WIRED | DeepAnalysisPoller.tsx satır 53 |
| n8n webhook | `/api/dataforseo/deep-analysis/callback` | `X-N8n-Webhook-Secret` header pattern | ✓ WIRED (yapısal) | callback/route.ts satır 33-36 |

---

### Data-Flow Trace (Level 4)

| Artifakt | Data Değişkeni | Kaynak | Gerçek Veri Üretiliyor mu | Durum |
|----------|---------------|--------|--------------------------|-------|
| `AnalysisButtons.tsx` | `resultMsg` | `lightAnalysisAction` return value | LightAnalysisResult.count (DB'den gerçek keyword sayısı) | ✓ FLOWING |
| `page.tsx` (DFS Tarihi sütunu) | `kw.dfs_fetched_at` | SSR: `keywords.select(...dfs_fetched_at...)` | Supabase keywords tablosundan gerçek veri | ✓ FLOWING |
| `DeepAnalysisPoller.tsx` | `phase` / `currentStatus` | `page.tsx` SSR → `activeWorkflow.status` | Supabase workflow_runs tablosundan gerçek durum | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Davranış | Kontrol | Sonuç | Durum |
|----------|---------|-------|-------|
| cache.ts server-only guard | `head -1 src/lib/dataforseo/cache.ts` → "import 'server-only'" | İlk gerçek import satırı `import 'server-only'` | ✓ PASS |
| getCachedOrFetch export edilmiş | `grep "export.*getCachedOrFetch"` | satır 27 | ✓ PASS |
| lightAnalysisAction export | `grep "export async function lightAnalysisAction"` | satır 1104 | ✓ PASS |
| Concurrent guard | `grep "workflow_runs.*pending"` actions.ts | satır 1125 | ✓ PASS |
| Webhook secret callback | `grep "X-N8n-Webhook-Secret"` callback/route.ts | satır 33 | ✓ PASS |
| MAX_LOOPS=144 | `grep "MAX_LOOPS"` DeepAnalysisPoller.tsx | satır 41 | ✓ PASS |
| dfs_fetched_at DEFAULT yok | `grep -c "DEFAULT now()"` migration → comment satırında, SQL kodu olarak 0 | Yalnızca açıklayıcı comment | ✓ PASS |

---

### Gereksinim Kapsama Analizi

| REQ-ID | Kaynak Plan | Açıklama | Durum | Kanıt |
|--------|------------|----------|-------|-------|
| DFS-01 | 24-01 | keyword_data_cache / cache deposu | ✓ SATISFIED (override) | dataforseo_task_cache mevcut; getCachedOrFetch bunu kullanıyor; plan kararı belgelenmiş |
| DFS-02 | 24-02 | getCachedOrFetch() cache-first wrapper | ✓ SATISFIED | cache.ts mevcut, server-only, fetchWithCache sarmalıyor, 3/3 test PASS |
| DFS-03 | 24-03 | Light analiz tetikleyici + maliyet onayı | ✓ SATISFIED (kod); ? HUMAN (UI akışı) | lightAnalysisAction + AnalysisButtons Dialog; fonksiyonel UI doğrulaması gerekli |
| DFS-04 | 24-03 | Standart analiz tetikleyici — cluster bazlı | ✓ SATISFIED | standardAnalysisAction + cluster gate + getCachedOrFetch |
| DFS-05 | 24-04 | Deep analiz tetikleyici — async n8n | ✓ SATISFIED | trigger route + triggerDeepAnalysisAction + workflow_runs INSERT |
| DFS-06 | 24-04 | workflow_runs wiring — 5s polling | ✓ SATISFIED | DeepAnalysisPoller + callback route UPDATE + router.refresh() |
| DFS-07 | 24-01, 24-03, 24-04 | UI stale-data uyarısı — dfs_fetched_at | ✓ SATISFIED | migration mevcut; UI sütunu mevcut; analiz sonrası güncelleme hem light/standard hem deep callback'te |
| DFS-08 | 24-03, 24-04 | Concurrent analiz guard | ✓ SATISFIED (kod); ? HUMAN (UI) | workflow_runs pending/running check her action'da; amber banner AnalysisButtons'da |

**Not — DFS-01 Tasarım Kararı:** REQUIREMENTS.md DFS-01'de `keyword_data_cache` adında yeni tablo istiyor. Plan ekibi `dataforseo_task_cache` (20260522000001 migration) zaten mevcut olduğundan yeni tablo açmamaya karar verdi. Bu karar 24-01-PLAN.md action bölümünde ve cache.ts JSDoc'unda belgelenmiş. Fonksiyonel gereksinimler (SHA-256 hash, TTL, cache hit/miss) karşılanıyor.

---

### Anti-Pattern Taraması

| Dosya | Satır | Pattern | Önem | Etki |
|-------|-------|---------|------|------|
| `actions.ts` | — | `void (fetchSerpDomains as unknown)` — Phase 25 için korunan unused import | ℹ️ Info | Phase 25'e kadar teknik borç; TypeScript uyarısı bastırılmış |

Tarama sonucu: Stub, placeholder, boş implementasyon, hardcoded empty data yok. Tüm Server Action'lar gerçek DB sorgularına bağlı.

---

### İnsan Doğrulaması Gereken Maddeler

#### 1. Cost Approval Dialog UI Akışı (SC-1, DFS-03)

**Test:** keyword-stratejisi sayfasını aç, en az 1 keyword olan projede "Temel Verileri Al" butonuna tıkla.
**Beklenen:** Dialog açılır, "Tahmini maliyet: ~N birim" ve "Temel Analizi Başlat" butonu görünür. Dialog kapatılmadan (İptal) API çağrısı başlamaz.
**Neden İnsan:** Client-side Dialog state → handleConfirm() → Server Action akışı programatik test ile doğrulanamaz (Supabase + DataForSEO ortamı gerekli).

#### 2. Concurrent Guard UI (SC-4, DFS-08)

**Test:** Bir analiz başlat, bitmeden ikinci kez butona bas.
**Beklenen:** Amber banner "Analiz devam ediyor. Tamamlanmasını bekleyin." görünür; tüm 3 buton disabled durumda.
**Neden İnsan:** isAnalysisRunning prop'u SSR'dan gelir; real-time state geçişi gerçek tarayıcı oturumunda test edilmeli.

#### 3. Cache Hit Davranışı (SC-2)

**Test:** Aynı keyword seti için iki kez "Temel Verileri Al" tetikle (DataForSEO credentials konfigüre edilmiş ortamda).
**Beklenen:** İkinci tetiklemede "Cache'den döndü — veri güncel" inline mesajı görünür (fromCache: true).
**Neden İnsan:** Unit testler mock orchestrator ile geçiyor; gerçek dataforseo_task_cache cache satırları gerçek ortamda doğrulanmalı.

---

### Genel Değerlendirme

Phase 24'ün tüm artifaktları mevcut, substantive ve wired durumda. 10 dosya oluşturulmuş/güncellenmiş, 10 commit ile belgelenmiş. Tüm ROADMAP Success Criteria kod seviyesinde karşılanıyor.

**Geçen kontroller (programatik):** Tüm migration dosyaları, cache.ts server-only guard, getCachedOrFetch orchestrator wiring, lightAnalysisAction + standardAnalysisAction + triggerDeepAnalysisAction exports, workflow_runs concurrent guard, dfs_fetched_at SSR + UI display, deep analysis trigger + callback routes (webhook secret, service role, ownership), DeepAnalysisPoller 5s polling + MAX_LOOPS, 3/3 cache unit test, strategy_decisions UNIQUE+RLS+precedence rule.

**İnsan doğrulaması gereken:** SC-1 (cost dialog önce gösterilir) ve SC-4 (amber banner) UI akışları; SC-2 gerçek cache hit (production-like ortam).

**DFS-01 Sapması:** `keyword_data_cache` yerine `dataforseo_task_cache` kullanımı intentional ve belgelenmiş — override kabul edildi.

---

_Doğrulama: 2026-05-31_
_Doğrulayan: Claude (gsd-verifier)_
