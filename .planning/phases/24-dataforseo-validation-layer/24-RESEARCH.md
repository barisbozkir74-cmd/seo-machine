# Phase 24: DataForSEO Validation Layer — Research

**Researched:** 2026-05-31
**Domain:** DataForSEO cache layer, Supabase server actions, Next.js Server Actions, n8n webhook pattern, concurrent job guard
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DFS-01 | `keyword_data_cache` Supabase tablosu — cache_key (SHA-256), endpoint, keyword, location_code, language_code, analysis_level, response_data JSONB, expires_at | **CRITICAL FINDING:** Proje zaten `dataforseo_task_cache` tablosuna sahip ve aktif kullanılıyor. Planlayıcı bu çakışmayı çözmeli. |
| DFS-02 | `getCachedOrFetch()` util — cache-first, `'server-only'`, `src/lib/dataforseo/cache.ts` | **CRITICAL FINDING:** `fetchWithCache()` orchestrator zaten `src/lib/dataforseo/orchestrator.ts`'de mevcut ve aynı işi yapıyor. |
| DFS-03 | "Temel Verileri Al" butonu — light analysis, maliyet tahmini, synchronous Server Action, max ~50 kw | Keyword stratejisi toolbar'ına eklenecek (KeywordStratejisiToolbar pattern mevcut). `fetchKeywordData()` zaten var. |
| DFS-04 | "Standart Analiz" — cluster bazlı, SERP overlap + related keywords, 5–8s, Server Action | `fetchSerpDomains()` + `fetchRelatedKeywords()` zaten `client.ts`'de mevcut. |
| DFS-05 | "Derinlemesine Analiz" — project bazlı, async, n8n webhook pattern (Phase 16 kopyası) | `/api/recovery/detect/route.ts` tam referans pattern. `X-N8n-Webhook-Secret` + service role. |
| DFS-06 | `workflow_runs` tablosu wiring — deep analysis job tracking, 5s polling | `workflow_runs` tablo ZATEN var (Phase 1). `workflow_type`, `status`, `input_payload`, `result_payload` kolonları var. Sadece wire up gerekli. |
| DFS-07 | UI stale-data uyarısı: `dfs_fetched_at` kolonu, `enriched_at`'den ayrı | `enriched_at` kolonu mevcut (keywords tablosu). `dfs_fetched_at` yeni migration ile eklenmeli, **DEFAULT now() YOK**. |
| DFS-08 | Concurrent analiz guard — proje başına tek analiz, double-click/race condition önlemi | `dataforseo_task_cache.status = 'running'` guard zaten mevcut. `workflow_runs` status check de uygulanabilir. |

</phase_requirements>

---

## Summary

Phase 24, v5.0 milestone'unun temelini oluşturur: `keyword_data_cache` ve `strategy_decisions` tabloları tüm sonraki fazların (Phase 25–30) bağımlılıkları. Bu yüzden ilk çalışmalı.

**Kritik keşif:** Proje zaten Phase 23 öncesinde kapsamlı bir DataForSEO caching altyapısı kurmuş. `dataforseo_task_cache` tablosu ve `fetchWithCache()` orchestrator (`src/lib/dataforseo/orchestrator.ts`) tam anlamıyla DFS-01 + DFS-02'nin gerektirdiklerini karşılıyor. Planlayıcı şu kararı vermeli: (A) Mevcut altyapıyı DFS-01/02 gereksinimlerinin karşılanması olarak say ve `src/lib/dataforseo/cache.ts` wrapper'ını bu orchestrator'ı sararak yaz, veya (B) Ayrı `keyword_data_cache` tablosu oluştur (gereksinim harfi harfine; ancak duplication riski var). Araştırma A seçeneğini önerir — mevcut orchestrator daha kapsamlı.

`strategy_decisions` tablosu henüz yok — bu Phase 24'ün asıl sıfırdan inşası. `keywords.dfs_fetched_at` kolonu henüz yok. 3 analiz butonu (DFS-03/04/05) henüz yok.

**Primary recommendation:** `getCachedOrFetch()` fonksiyonunu mevcut `fetchWithCache()` orchestrator'ının `src/lib/dataforseo/cache.ts` wrapper'ı olarak implement et. `strategy_decisions` tablosunu sıfırdan yaz. `dfs_fetched_at` migration'ı DEFAULT olmadan ekle.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cache-first DataForSEO | API/Backend (Server Action) | Database (Supabase) | Server Action cache check → API call → DB write; hiçbir şey client'ta |
| Maliyet tahmini gösterimi | Frontend (Client Component) | API/Backend | Kullanıcı onayı gerektirir, UI state ile yönetilir |
| Light/Standard analiz tetikleme | API/Backend (Server Action) | — | 'server-only' cache.ts; client sadece buton gösterir |
| Deep analiz async job | API/Backend (Next.js Route) | External (n8n webhook) | Phase 16 pattern: Next.js route → n8n → geri çağırma |
| workflow_runs polling | Frontend (Client Component) | API/Backend | 5s `setInterval` + `router.refresh()` — ResearchAutoTrigger pattern |
| strategy_decisions yazma | API/Backend (Server Action) | Database | Auth + ownership + UPSERT; client karar gösterir sadece |
| dfs_fetched_at stale uyarısı | Frontend (Server Component SSR) | Database | SSR'de `dfs_fetched_at IS NULL` veya eski olan satırlar rozet gösterir |
| Concurrent guard | API/Backend (Server Action) | Database | workflow_runs status check; DB seviyesinde idempotent |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.104.0 | DB upsert + cache okuma + RLS | Projede zaten var, tüm fazlar kullanıyor |
| `next` | 16.2.4 | Server Actions, Route Handlers | Projede fixed |
| `server-only` | ^0.0.1 | Server action güvenliği | Projede zaten, cache.ts'de zorunlu |
| `node:crypto` | built-in | SHA-256 fingerprint | `orchestrator.ts`'de zaten `crypto.createHash('sha256')` pattern var |

### Yok — Eklenmeyecek
| Kapsam | Karar |
|--------|-------|
| Redis | Yok — Supabase table cache-store (SUMMARY.md kararı) |
| pg-boss / pg_cron | Yok — n8n webhook + workflow_runs yeterli |
| diff@9.0.0 | Phase 26'ya ertelendi (ROADMAP.md kararı) |

**Version verification:** [VERIFIED: package.json in codebase]

---

## Architecture Patterns

### System Architecture Diagram

```
Kullanıcı (Browser)
    │
    │ Buton tıklama: "Temel Verileri Al" / "Standart Analiz" / "Derinlemesine Analiz"
    ▼
KeywordStratejisiToolbar (Client Component)
    │ Maliyet onay dialog'u göster → kullanıcı onaylar
    │
    ├─── DFS-03/04: Server Action çağrısı
    │       │
    │       ▼
    │   getCachedOrFetch() [src/lib/dataforseo/cache.ts]
    │       │
    │       ├─ Cache HIT: dataforseo_task_cache'den dön (fromCache: true)
    │       │
    │       └─ Cache MISS: DataForSEO API çağrısı
    │               │
    │               ▼
    │          keywords.dfs_fetched_at güncelle
    │          cache yaz (ON CONFLICT DO UPDATE)
    │          Server Action → Client'a sonuç
    │
    └─── DFS-05: POST /api/dataforseo/deep-analysis/route.ts
            │
            ▼
        workflow_runs INSERT (status='pending')
        n8n webhook çağrısı (X-N8n-Webhook-Secret header)
            │
            ▼ (n8n async işler)
        n8n → POST /api/dataforseo/deep-analysis/callback
            │
            ▼
        workflow_runs UPDATE (status='completed'/'failed')
        keywords.dfs_fetched_at bulk update

Client Polling (DFS-06):
    DeepAnalysisStatus (Client Component)
        └─ setInterval 5000ms → router.refresh()
           → SSR page yeniden render → workflow_runs durumu okur
```

### Recommended Project Structure
```
src/
├── lib/dataforseo/
│   ├── client.ts          # Mevcut — API çağrıları (dokunma)
│   ├── orchestrator.ts    # Mevcut — fetchWithCache (dokunma)
│   ├── types.ts           # Mevcut — TTL, TaskSpec (dokunma)
│   └── cache.ts           # YENİ — getCachedOrFetch() wrapper (DFS-02)
│
├── app/(dashboard)/projeler/[id]/keyword-stratejisi/
│   ├── page.tsx              # Mevcut — dfs_fetched_at ekle SSR query'e
│   ├── KeywordStratejisiToolbar.tsx  # Mevcut — 3 analiz butonu ekle
│   ├── AnalysisButtons.tsx   # YENİ — DFS-03/04/05 buton grubu (client)
│   ├── DeepAnalysisPoller.tsx  # YENİ — 5s polling (DFS-06)
│   └── actions.ts            # Mevcut — lightAnalysis, standardAnalysis action ekle
│
├── app/api/dataforseo/
│   └── deep-analysis/
│       ├── route.ts        # YENİ — n8n trigger (DFS-05)
│       └── callback/
│           └── route.ts    # YENİ — n8n tamamlama callback'i
│
supabase/migrations/
├── XXXXXX_strategy_decisions.sql   # YENİ — DFS-01 strategy_decisions (STR-01)
└── XXXXXX_keywords_dfs_fetched_at.sql  # YENİ — DFS-07 kolon
```

### Pattern 1: Mevcut fetchWithCache'i Sarmak (DFS-02)

```typescript
// Source: src/lib/dataforseo/orchestrator.ts (VERIFIED: codebase)
// cache.ts şöyle görünecek:
import 'server-only'
import { fetchWithCache } from './orchestrator'
import type { TaskSpec } from './types'

export async function getCachedOrFetch<T>(opts: {
  projectId: string
  userId: string
  spec: TaskSpec
  fetcher: () => Promise<T>
}): Promise<{ data: T; fromCache: boolean } | null> {
  const result = await fetchWithCache({ ...opts })
  if (result.skipped) return null
  return { data: result.data as T, fromCache: result.fromCache }
}
```

**Not:** `getCachedOrFetch` gereksiz wrapper olmaktan kaçınmak için doğrudan `fetchWithCache`'i export etmeyi veya `cache.ts`'i orchestrator üzerine ince bir ergonomi katmanı olarak tutmayı düşün.

### Pattern 2: strategy_decisions Upsert (STR-01/STR-03)

```typescript
// Source: ai_memory UPSERT pattern (VERIFIED: 20260512000001_ai_memory.sql)
// strategy_decisions için aynı UNIQUE(project_id, module, key) pattern
await supabase
  .from('strategy_decisions')
  .upsert(
    {
      user_id: user.id,
      project_id: projectId,
      module: 'cluster_priority',
      key: clusterId,
      value: { priority: 'high' },
      reason: 'Manual lock',
      is_locked: true,
      is_active: true,
      locked_at: new Date().toISOString(),
      locked_by: user.id,
    },
    { onConflict: 'project_id,module,key' }
  )
```

### Pattern 3: Deep Analiz n8n Route (Phase 16 Kopyası)

```typescript
// Source: src/app/api/recovery/detect/route.ts (VERIFIED: codebase)
// Aynı pattern:
export async function POST(request: NextRequest) {
  const secret = request.headers.get('X-N8n-Webhook-Secret')
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Service role client kullan
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  // Ownership check: projects.user_id
  // workflow_runs INSERT (pending)
  // n8n webhook call
}
```

### Pattern 4: 5s Polling (DFS-06)

```typescript
// Source: src/app/(dashboard)/projeler/[id]/arastirma/ResearchAutoTrigger.tsx (VERIFIED: codebase)
// Aynı pattern — setInterval + router.refresh()
useEffect(() => {
  const pollInterval = setInterval(() => {
    router.refresh()  // SSR re-render workflow_runs durumunu okur
  }, 5000)
  return () => clearInterval(pollInterval)
}, [router])
```

### Pattern 5: SHA-256 Cache Key (DFS-01)

```typescript
// Source: src/lib/dataforseo/orchestrator.ts (VERIFIED: codebase)
// node:crypto kullanımı — Web Crypto API DEĞİL
import crypto from 'node:crypto'
const hash = crypto.createHash('sha256')
  .update(keyword.toLowerCase().trim())
  .digest('hex')
```

**Not:** Proje Web Crypto API (`crypto.subtle`) kullanmıyor — `node:crypto` kullanıyor. SUMMARY.md'deki "Web Crypto SHA-256, no new package" kararı doğru; sadece API adı `crypto.createHash` (Node.js built-in), tarayıcı Web Crypto değil.

### Anti-Patterns to Avoid

- **`dfs_fetched_at DEFAULT now()` eklemek:** Migration'da DEFAULT koyma — mevcut keywordler NULL kalmalı, ilk kullanımda stale check tetiklenmeli [VERIFIED: ROADMAP.md pitfall]
- **`keyword_data_cache` ayrı tablo açmak:** `dataforseo_task_cache` zaten var ve aynı işlevi görüyor; yeni tablo açmak duplication [VERIFIED: codebase]
- **strategy_decisions'ı ai_memory'ye yazmak:** Farklı retention contract + farklı TTL + farklı query pattern — ayrı tablo gerekli [VERIFIED: SUMMARY.md]
- **Cache key'i normalize etmeden hash'lemek:** "SEO" ve "seo" aynı kelime — `keyword.toLowerCase().trim()` zorunlu [VERIFIED: orchestrator.ts pattern]
- **n8n callback route'unda user anon key kullanmak:** Service role gerekli (RLS bypass, workflow_runs INSERT) [VERIFIED: recovery/detect/route.ts]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache fingerprint | Custom hashing | `makeFingerprint()` in orchestrator.ts | Zaten normalize ediyor, TTL entegrasyonu var |
| Cache-first fetch | Custom cache logic | `fetchWithCache()` in orchestrator.ts | Budget guard + backoff + running guard dahil |
| Credentials okuma | Raw env var read | `getDataForSeoCredentials()` in vault.ts | Vault fallback + env var öncelik zaten var |
| SHA-256 hashing | Web Crypto veya external lib | `crypto.createHash('sha256')` (node:crypto) | Built-in, server-only, proje zaten kullanıyor |
| n8n auth | Custom auth scheme | `X-N8n-Webhook-Secret` header check | Phase 16 pattern, env var `N8N_WEBHOOK_SECRET` |

**Key insight:** Proje Phase 23 öncesinde zaten kapsamlı bir DataForSEO orchestration katmanı kurmuş (`dataforseo_task_cache` + `fetchWithCache`). Phase 24'ün ana işi: (1) bu altyapıyı keyword stratejisi UI'ına bağlamak, (2) `strategy_decisions` tablosunu açmak, (3) `dfs_fetched_at` column eklemek, (4) 3 analiz butonu + polling UI inşa etmek.

---

## Runtime State Inventory

> Bu faz greenfield DB table/column ekleme + UI wiring — rename/refactor değil. Ancak mevcut altyapının tespiti kritik.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `dataforseo_task_cache` tablosu mevcut ve kullanımda (Phase 23 öncesi oluşturuldu) | DFS-01 için bu tabloyu kullan veya gereksinimlere göre adapte et |
| Stored data | `keywords.enriched_at` kolonu mevcut (`20260422000001_create_tables.sql`) | `dfs_fetched_at` ayrı kolon — `enriched_at`'e dokunma |
| Stored data | `workflow_runs` tablosu mevcut (`20260422000001_create_tables.sql`) | Phase 24'te wire up, yeni migration gerekmez |
| Stored data | `ai_memory` tablosu mevcut ve kullanımda | `strategy_decisions` AYRI tablo — ai_memory'ye yazma |
| Live service config | n8n webhook `N8N_WEBHOOK_SECRET` env var — Phase 16'da kuruldu | Deep analysis için aynı secret kullanılacak, yeni secret gerekmez |
| OS-registered state | Yok | — |
| Secrets/env vars | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` — vault.ts'de var ve aktif | Değişiklik gerekmez |
| Build artifacts | Yok | — |

---

## Common Pitfalls

### Pitfall 1: `dfs_fetched_at` DEFAULT now() Tuzağı (CRITICAL)
**What goes wrong:** Migration'a `DEFAULT now()` eklersek mevcut tüm keywordler anlık bir timestamp alır — gerçek fetch zamanı değil. UI bu keywordleri "taze" gösterir, oysa hiç DataForSEO'dan çekilmemişler.
**Why it happens:** Standart migration reflex'i — NULL bırakmak garip görünür.
**How to avoid:** `ADD COLUMN IF NOT EXISTS dfs_fetched_at TIMESTAMPTZ` — DEFAULT yok, NULL bırak. NULL = hiç fetch edilmedi = stale uyarısı göster.
**Warning signs:** Migration sonrası keyword listesinde tüm satırlar dolu timestamp gösteriyorsa, DEFAULT eklenmişti.

### Pitfall 2: `dataforseo_task_cache` vs `keyword_data_cache` Çakışması (CRITICAL)
**What goes wrong:** DFS-01, `keyword_data_cache` adında ayrı bir tablo tanımlıyor. Ancak proje zaten `dataforseo_task_cache` tablosuna sahip (daha kapsamlı şema). İkisi birden açılırsa cache split olur — bazı çağrılar birinden, bazıları diğerinden okur.
**Why it happens:** Roadmap DFS-01 requirement'ı, mevcut altyapı farkında değil yazılmış.
**How to avoid:** Planlayıcı şu kararı vermeli: `getCachedOrFetch()` = `fetchWithCache()` wrapper'ı olarak implement et, mevcut `dataforseo_task_cache` tablosunu kullan. DFS-01'i "mevcut tablo adapte edildi" olarak karşıla.
**Warning signs:** İki ayrı cache tablosu varsa çakışma var.

### Pitfall 3: strategy_decisions vs ai_memory Karışıklığı (HIGH)
**What goes wrong:** `strategy_decisions` yazılacakken ai_memory'e yazılırsa: farklı TTL politikası, `is_locked` flag yok, precedence rule uygulanamaz.
**Why it happens:** ai_memory zaten `UNIQUE(project_id, module, key)` şemasıyla benzer görünüyor.
**How to avoid:** `strategy_decisions` ayrı tablo — `is_locked`, `is_active`, `locked_at`, `locked_by` kolonları zorunlu. Migration comment'inde precedence rule belgele.
**Warning signs:** `ai_memory`'e `is_locked` kolonu eklenmişse yanlış tabloya yazılıyor.

### Pitfall 4: Concurrent Analysis Guard Eksikliği (HIGH)
**What goes wrong:** Kullanıcı "Temel Verileri Al" butonuna çift tıklarsa iki Server Action eş zamanlı çalışır, aynı keyword setini iki kez DataForSEO'ya gönderir.
**Why it happens:** Server Action'lar doğası gereği idempotent değil.
**How to avoid:** DFS-08 için `workflow_runs` tablosuna `pending/running` statüslü kayıt var mı kontrol et. Mevcut `isAlreadyRunning()` guard'ı orchestrator'da var — light/standard için de kullan.
**Warning signs:** Test sırasında iki aynı DataForSEO çağrısı loglanıyor.

### Pitfall 5: strategy_decisions UNIQUE Constraint Yanlış Conflict Key (HIGH)
**What goes wrong:** `onConflict: 'project_id,module,key'` yerine başka kolon kullanılırsa upsert hata verir.
**Why it happens:** Supabase `upsert` `onConflict` parametresi string — typo'ya açık.
**How to avoid:** Migration'da UNIQUE constraint adını belgele, upsert'te tam olarak aynı kolon adlarını kullan.
**Warning signs:** Supabase'den "duplicate key value" hatası — constraint adı eşleşmiyordur.

### Pitfall 6: n8n Callback Route'unda Anon Key Kullanmak (HIGH)
**What goes wrong:** Callback route anon key ile çalışırsa `workflow_runs` INSERT/UPDATE RLS politikasına takılır (n8n'in user_id'si yok).
**Why it happens:** Server action'lardan `createClient()` çağrısına alışkanlık.
**How to avoid:** Phase 16 pattern tam kopyala — `createServiceClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`. Recovery detect route referans: [VERIFIED: codebase].

---

## Code Examples

### Mevcut fetchWithCache Kullanımı (Referans)

```typescript
// Source: src/lib/dataforseo/orchestrator.ts (VERIFIED: codebase)
// Light analysis için kullanım örneği:
const result = await fetchWithCache({
  projectId,
  userId: user.id,
  spec: {
    module: 'keyword_stratejisi',
    endpoint: 'keyword_data/search_volume',
    target: { type: 'keywords', value: keywordTexts },
    locationCode: 2792,
    languageCode: 'tr',
  },
  fetcher: () => fetchKeywordData(keywordTexts, credentials),
})
if (result.skipped) return { error: result.reason }
// result.data — KeywordDataItem[]
// result.fromCache — true ise cache'den geldi
```

### workflow_runs Şeması (Referans)

```sql
-- Source: 20260422000001_create_tables.sql (VERIFIED: codebase)
-- Mevcut kolonlar:
-- id, user_id, project_id, workflow_type TEXT, status TEXT ('pending'),
-- input_payload JSONB, result_payload JSONB, error_message TEXT,
-- started_at, completed_at, created_at, updated_at
-- CHECK kısıtı YOK — status değerleri: pending/running/done/failed (application-level)
```

### strategy_decisions Tablo Tasarımı (DFS-01/STR-01)

```sql
-- YENİ migration gerekli
CREATE TABLE public.strategy_decisions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id  UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  -- module: 'cluster_priority'|'primary_keyword'|'page_type'|
  --         'cannibalization'|'authority_structure'|'target_url'|'starred_keywords'
  module      TEXT NOT NULL,
  key         TEXT NOT NULL,    -- cluster_id veya keyword_id
  value       JSONB NOT NULL DEFAULT '{}',
  reason      TEXT,
  locked_at   TIMESTAMPTZ,
  locked_by   UUID REFERENCES auth.users(id),
  is_locked   BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  -- PRECEDENCE RULE (v5.0): is_locked=true satırlar keyword_clusters.status,
  -- arch_status ve keyword_strategy_approved'dan her zaman önceliklidir.
  UNIQUE(project_id, module, key)
);
```

### keywords.dfs_fetched_at Migration (DFS-07)

```sql
-- DEFAULT YOK — mevcut keywordler NULL kalır (stale check tetiklenir)
ALTER TABLE public.keywords
  ADD COLUMN IF NOT EXISTS dfs_fetched_at TIMESTAMPTZ;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Her DataForSEO çağrısı doğrudan API | Cache-first: `dataforseo_task_cache` + `fetchWithCache` | Phase 23 öncesi altyapı | Mevcut orchestrator Phase 24 için kullanılabilir |
| node:crypto yok, Web Crypto | `node:crypto` (server-only) | Proje başından beri | `createHash('sha256')` kullan — tarayıcı crypto API değil |
| workflow_runs kullanılmıyor | workflow_runs mevcut ama unwired | Phase 1'den beri var | Deep analysis için wire up |

**Deprecated/outdated:**
- `enriched_at` DataForSEO freshness sinyali olarak kullanmak: `dfs_fetched_at` ayrı — Phase 24'ten sonra `enriched_at` sadece "keyword data vardı" demek, "ne zaman DFS'den çekildi" değil.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | n8n webhook secret `N8N_WEBHOOK_SECRET` env var Phase 16'da kurulmuş ve aktif | Code Examples | Deep analysis route kurulmadan önce env var varlığı doğrulanmalı |
| A2 | `workflow_runs.status` için CHECK kısıtı yok — application-level validation yeterli | Standard Stack | Eğer kısıt varsa (gezmedik), INSERT'ler hata verir |

**A1 kanıtı:** `recovery/detect/route.ts`'de `process.env.N8N_WEBHOOK_SECRET` kullanımı mevcut [VERIFIED: codebase]. Phase 16 tamamlandı, env var kurulmuş olmalı. Uygulama öncesi `printenv N8N_WEBHOOK_SECRET` ile doğrula.

---

## Open Questions

1. **DFS-01: `keyword_data_cache` vs mevcut `dataforseo_task_cache`**
   - What we know: İki isim farklı ama işlev aynı. `dataforseo_task_cache` daha kapsamlı şemaya sahip.
   - What's unclear: Planlayıcı DFS-01'i mevcut tabloyla karşılayacak mı, yoksa yeni tablo mu açacak?
   - Recommendation: Mevcut tabloyu kullan, `getCachedOrFetch()` = `fetchWithCache()` wrapper'ı olarak yaz. Gereksinim metnindeki tablo adı fark etmez — işlev karşılandı.

2. **Maliyet tahmini hesaplama (DFS-03/04)**
   - What we know: Kullanıcı onay öncesi maliyet tahmini görmeli.
   - What's unclear: DataForSEO live endpoint'leri çağrı başına maliyet döndürmüyor (orchestrator.ts comment: "Live endpoint cost döndürmez → Phase 1'de NULL"). Gerçek cost_units ancak sonradan bilinebilir.
   - Recommendation: Sabit tahmin formülü kullan: ~1 unit/keyword `keyword_data/search_volume` için. "Tahmini maliyet: ~{count} birim" göster; kesin değil ama kullanıcıya bağlam verir.

3. **Deep analysis callback route güvenliği**
   - What we know: n8n → callback route, ownership check gerekli.
   - What's unclear: n8n payload'ında `projectId` + `userId` mı gelecek, yoksa `workflowRunId` mi?
   - Recommendation: Phase 16 pattern'ını izle: `projectId` + `userId` body'de → ownership check. `workflowRunId` da ekle, callback'in hangi `workflow_runs` satırını güncelleyeceğini bilsin.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | node:crypto | ✓ | v25.9.0 | — |
| `@supabase/supabase-js` | DB operations | ✓ | ^2.104.0 | — |
| `server-only` package | cache.ts import guard | ✓ | ^0.0.1 | — |
| n8n (N8N_WEBHOOK_SECRET) | DFS-05 deep analysis | Assumed ✓ [A1] | — | Skip deep analysis if not configured |
| `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | Tüm DFS çağrıları | ✓ | — (vault.ts) | Vault fallback zaten var |
| `SUPABASE_SERVICE_ROLE_KEY` | Deep analysis route | ✓ | — | — (zorunlu) |

**Missing dependencies with no fallback:** Yok — tüm bağımlılıklar mevcut veya fallback var.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.7 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run src/__tests__/lib/dataforseo/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DFS-01 | strategy_decisions UPSERT idempotent | unit | `npx vitest run src/__tests__/lib/dataforseo/strategy-decisions.test.ts` | ❌ Wave 0 |
| DFS-02 | getCachedOrFetch: cache hit döndürür | unit | `npx vitest run src/__tests__/lib/dataforseo/cache.test.ts` | ❌ Wave 0 |
| DFS-02 | getCachedOrFetch: cache miss → API çağrısı | unit | same | ❌ Wave 0 |
| DFS-03 | lightAnalysis Server Action: cost estimate | unit | `npx vitest run src/__tests__/lib/dataforseo/light-analysis.test.ts` | ❌ Wave 0 |
| DFS-07 | dfs_fetched_at NULL → stale uyarısı gösterir | unit | `npx vitest run src/__tests__/lib/dataforseo/staleness.test.ts` | ❌ Wave 0 |
| DFS-08 | Concurrent guard: ikinci çağrı bloklanır | unit | `npx vitest run src/__tests__/lib/dataforseo/concurrent-guard.test.ts` | ❌ Wave 0 |

### Mevcut Test Altyapısı
- `vitest.config.ts` var, `server-only` mock (`src/__mocks__/server-only.ts`) var
- `vault.ts` mock pattern: `20-01 kararı` — `vi.mock('@/lib/supabase/vault')` gerekli
- Supabase client mock: tüm test dosyalarında `vi.mock('@/lib/supabase/server')` kullanılıyor

### Wave 0 Gaps
- [ ] `src/__tests__/lib/dataforseo/cache.test.ts` — getCachedOrFetch, cache hit/miss
- [ ] `src/__tests__/lib/dataforseo/strategy-decisions.test.ts` — UPSERT idempotent, precedence
- [ ] `src/__tests__/lib/dataforseo/concurrent-guard.test.ts` — double-click guard
- [ ] `src/__tests__/lib/dataforseo/staleness.test.ts` — dfs_fetched_at NULL check

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `supabase.auth.getUser()` — tüm Server Actions'ta zorunlu |
| V3 Session Management | no | Supabase SSR zaten yönetiyor |
| V4 Access Control | yes | `.eq('user_id', user.id)` ownership check — her DB query'de |
| V5 Input Validation | yes | `projectId` UUID format, `keywords` array max 50 (DFS-03) |
| V6 Cryptography | yes | `node:crypto` SHA-256 — hand-roll yok |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR — başka proje cache'ini okuma | Elevation of Privilege | Her query'de `.eq('project_id', id).eq('user_id', user.id)` |
| n8n callback spoofing | Spoofing | `X-N8n-Webhook-Secret` header check + ownership re-check |
| keyword batch bombing (>50 DFS request) | DoS | DFS-03: max ~50 kw batch limit (Server Action'da enforce et) |
| strategy_decisions'a unauthorized lock | Tampering | Server Action'da auth + ownership; RLS politikası |

---

## Sources

### Primary (HIGH confidence)
- `src/lib/dataforseo/orchestrator.ts` — Mevcut fetchWithCache pattern, fingerprint, SHA-256 hashing
- `src/lib/dataforseo/types.ts` — TaskSpec, EndpointId, ENDPOINT_TTL, CacheResult
- `src/lib/dataforseo/client.ts` — fetchKeywordData, fetchRelatedKeywords, fetchSerpDomains
- `src/lib/supabase/vault.ts` — getDataForSeoCredentials pattern
- `supabase/migrations/20260422000001_create_tables.sql` — workflow_runs şeması, keywords şeması
- `supabase/migrations/20260522000001_dataforseo_task_cache.sql` — mevcut cache tablo şeması
- `supabase/migrations/20260512000001_ai_memory.sql` — UNIQUE(project_id,module,key) UPSERT pattern
- `src/app/api/recovery/detect/route.ts` — n8n webhook pattern (service role, X-N8n-Webhook-Secret, ownership)
- `src/app/(dashboard)/projeler/[id]/arastirma/ResearchAutoTrigger.tsx` — 5s polling pattern
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordStratejisiToolbar.tsx` — toolbar extension noktası
- `.planning/research/SUMMARY.md` — v5.0 mimari kararlar (cache store, n8n, strategy_decisions)
- `.planning/ROADMAP.md` — Phase 24 pitfalls, success criteria, build order
- `.planning/REQUIREMENTS.md` — DFS-01 through DFS-08 full requirement text

### Secondary (MEDIUM confidence)
- `vitest.config.ts` — test altyapısı yapılandırması, `server-only` mock path

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — tüm kütüphaneler codebase'de doğrulandı
- Architecture: HIGH — mevcut pattern'lar (Phase 16, orchestrator.ts) verified
- Pitfalls: HIGH — ROADMAP.md + codebase çapraz doğrulama
- strategy_decisions şeması: HIGH — REQUIREMENTS.md + ai_memory pattern analogy

**Research date:** 2026-05-31
**Valid until:** 2026-06-30 (stabil stack, 30 gün geçerlilik)
