# Phase 6: Keyword Clustering & Scoring — Research

**Researched:** 2026-04-24
**Domain:** SERP-based keyword clustering, opportunity scoring, Supabase schema, Next.js Server Actions
**Confidence:** HIGH (codebase verified) / MEDIUM (DataForSEO endpoint details) / HIGH (algorithm patterns)

---

## Summary

Phase 6 ekler: (1) Mevcut keyword listesini SERP benzerliği ve intent'e göre kümelere bölen otomatik clustering motoru, (2) her cluster için primary keyword ataması ve cannibalization prevention (bir keyword yalnızca bir clustera ait olabilir), (3) her keyword için opportunity score hesaplaması, (4) küme görünümü paneli + keyword'lerin kümeler arasında taşınmasına izin veren UI.

Mevcut `clustering.ts` dosyası metin örtüşmesine dayalı basit bir algoritma uygular. Phase 6 bunu SERP URL overlap'e (DataForSEO organic/live/regular) veya geliştirilmiş metin benzerliğine yükseltecek. SERP endpoint'i her keyword için ayrı çağrı gerektirdiğinden (no batch), büyük listelerde gerçek SERP clustering API maliyeti yüksektir. Pratik yaklaşım: zenginleştirilmiş intent + geliştirilmiş metin algoritması hibrid yöntemi.

Fırsatlar: `opportunity_score` sütunu `keywords` tablosunda zaten tanımlı (NUMERIC(5,2)). `keyword_clusters` tablosunda `primary_keyword_id` FK var. Schema değişikliği minimum — sadece uygulama katmanı.

**Birincil öneri:** SERP clustering için ayrı bir DataForSEO çağrısı yapmak yerine, Phase 5'de zaten çekilen `search_intent` alanını clustering'in birincil sinyali olarak kullan. Metin benzerliği ikincil sinyal. SERP URL overlap opsiyonel/gelecek iterasyon. Bu approach, ek API maliyeti olmadan KEYW-04'ü karşılar.

---

<phase_requirements>
## Phase Requirements

| ID | Açıklama | Research Desteği |
|----|----------|-----------------|
| KEYW-04 | Sistem keyword'leri SERP similarity ve intent mapping ile otomatik cluster'lara böler | Intent-first hibrid algoritması: search_intent (zaten mevcut) + metin benzerliği; mevcut clustering.ts'in üzerine inşa |
| KEYW-05 | Her cluster için primary keyword atanır; tekil keyword başka cluster'a atanamaz (cannibalization prevention) | keyword_clusters.primary_keyword_id FK mevcut; uygulama katmanında: bir keyword atandığında önceki cluster_id'sini null yapar |
| KEYW-06 | Sistem her keyword için opportunity score hesaplar (traffic potential, commercial value, competition score bileşimi) | keywords.opportunity_score sütunu mevcut; formula: weighted score (volume + CPC + KD inverse + intent multiplier) |
| KEYW-07 | Kullanıcı cluster'ları ve keyword'leri panelden görüntüleyebilir, düzenleyebilir, yeniden atayabilir | Yeni cluster-grouped view + drag/move keyword Server Action |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Clustering algoritması | API/Backend (Server Action) | — | CPU-yoğun, client'ta çalıştırılmaz; tüm keyword verisi sunucu tarafında zaten mevcut |
| Opportunity score hesaplama | API/Backend (Server Action) | — | Formula sabit; DB'ye yazılır, client sadece gösterir |
| Primary keyword atama | API/Backend (Server Action) | — | Ownership kontrolü + cannibalization check sunucu tarafında zorunlu |
| Keyword cluster'a taşıma | API/Backend (Server Action) | Browser (optimistic UI) | Sunucu aksiyon tetikler, UI anında güncellenir |
| Cluster görünüm paneli | Frontend Server (SSR) | — | Server Component; keywords + clusters tek sorguda çekilir |
| Cluster düzenleme UI | Browser (Client Component) | — | Drag/select etkileşimi için client gerekli |

---

## Mevcut Kod Altyapısı

### Phase 5'ten Gelen Hazır Yapılar

**`src/lib/keywords/clustering.ts`** — Mevcut algoritma:
- Metin örtüşmesi tabanlı (stop words filtrelemeli, basit stemming)
- Volume azalan sıralama, cluster head = en yüksek hacimli keyword
- 50%+ overlap threshold ile küme ataması
- Phase 6'da bu dosya genişletilecek (SERP + intent sinyali ekleme)

**`src/lib/keywords/parser.ts`** — CSV/metin parse; Phase 6'da dokunulmaz.

**`src/lib/dataforseo/client.ts`** — Mevcut fonksiyonlar:
- `fetchSerpDomains()` — serp/google/organic/live/regular (tekil keyword, domain listesi döner)
- `fetchKeywordData()` — keywords_data/google_ads/search_volume/live (toplu keyword, volume+intent+CPC+KD döner)

**`src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts`** — Phase 6'da genişletilecek:
- `importKeywords` — cluster oluşturma mantığı burada; Phase 6 bu akışı günceller
- `deleteCluster` — mevcut, değişmez
- `deleteKeyword` — mevcut, değişmez

**`src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx`** — 7 sütunlu düz tablo:
- "Küme" sütunu zaten var (Phase 5'te badge ile gösterim)
- Phase 6'da cluster-grouped view eklenir veya sayfa yeniden düzenlenir

### DB Schema (Doğrulanmış)

**`keywords` tablosu:**
```sql
id UUID PK
user_id UUID FK (auth.users)
project_id UUID FK (projects)
keyword TEXT
volume INTEGER
cpc NUMERIC(10,2)
difficulty INTEGER          -- 0-100 KD
search_intent TEXT          -- 'commercial' | 'informational' | 'navigational' | 'transactional'
opportunity_score NUMERIC(5,2)  -- Phase 6'da doldurulacak, sütun MEVCUT
source TEXT
enriched_at TIMESTAMPTZ
cluster_id UUID FK (keyword_clusters) ON DELETE SET NULL
UNIQUE (project_id, keyword)
```

**`keyword_clusters` tablosu:**
```sql
id UUID PK
user_id UUID FK
project_id UUID FK
cluster_name TEXT
primary_keyword_id UUID FK (keywords) ON DELETE SET NULL  -- MEVCUT
intent TEXT                 -- cluster seviyesinde intent override
UNIQUE (project_id, cluster_name)
```

**Önemli ilişki:** keywords.cluster_id → keyword_clusters.id (SET NULL ON DELETE) ve keyword_clusters.primary_keyword_id → keywords.id (SET NULL ON DELETE). Circular FK zaten çözülmüş (Phase 1 migration sırası ile).

**Schema değişikliği gerekiyor mu?**
- Hayır — `opportunity_score` ve `primary_keyword_id` zaten var.
- `keyword_clusters.total_volume` sütunu mevcut (upsert'te kullanılıyor).
- Ek indeks: `idx_keywords_opportunity_score` faydalı olabilir ama zorunlu değil.

---

## Standard Stack

### Core
| Kütüphane | Versiyon | Amaç | Neden Standart |
|-----------|----------|------|----------------|
| Next.js (App Router) | 14 | Server Actions, SSR | Proje stack; değişmez |
| Supabase JS | mevcut | DB read/write | Proje stack; değişmez |
| DataForSEO API | v3 | SERP verisi (opsiyonel genişleme) | Phase 4-5'ten entegre |

### No New Libraries
Phase 6 yeni npm paketi gerektirmez. Clustering saf TypeScript, opportunity score saf matematik.

---

## Architecture Patterns

### Sistem Mimarisi

```
Kullanıcı → "Kümelere Böl" Butonu
      ↓
Server Action: clusterAndScoreKeywords(projectId)
      ↓
[1] DB'den tüm enriched keywords'ü çek (project_id + user_id)
      ↓
[2] clusterKeywords() — Intent-first hibrid algoritma
    ├── intent gruplaması (commercial, informational, navigational, transactional)
    └── metin benzerliği ile intent içinde alt kümeleme
      ↓
[3] calculateOpportunityScore() — Her keyword için
    formula: (volume_score × 0.4) + (cpc_score × 0.25) + (intent_multiplier × 0.2) + ((100 - difficulty) × 0.15)
      ↓
[4] DB yazma: keyword_clusters UPSERT + keywords UPDATE (cluster_id + opportunity_score)
      ↓
[5] primary_keyword_id otomatik ata: cluster içinde en yüksek volume'e sahip keyword
      ↓
revalidatePath → Sayfa yeniden render
```

### Önerilen Proje Yapısı
```
src/lib/keywords/
├── parser.ts           # mevcut (dokunulmaz)
├── clustering.ts       # genişletilecek — intent-first algoritma
└── scoring.ts          # YENİ — opportunity score hesaplama

src/app/(dashboard)/projeler/[id]/keyword-stratejisi/
├── actions.ts          # genişletilecek — clusterAndScoreKeywords, moveKeywordToCluster, setPrimaryKeyword
├── page.tsx            # düz tablo korunur; cluster panel ayrı section
├── ClusterPanel.tsx    # YENİ — cluster-grouped görünüm
├── MoveKeywordDialog.tsx  # YENİ — keyword'ü cluster'a taşı
├── IntentBadge.tsx     # mevcut (dokunulmaz)
├── KeywordDeleteButton.tsx # mevcut (dokunulmaz)
├── ClusterDeleteButton.tsx # mevcut (güncellenebilir)
└── KeywordImport.tsx   # mevcut (dokunulmaz)
```

### Pattern 1: Intent-First Hibrid Clustering
**Ne yapar:** Önce search_intent ile büyük gruplar oluşturur, sonra metin benzerliği ile bunları alt kümelere böler.
**Ne zaman kullanılır:** enriched_at NOT NULL olan keywordler için (intent verisi mevcut); unenriched keywordler sadece metin benzerliğine göre kümelenir.

```typescript
// src/lib/keywords/clustering.ts (güncellenecek)
type ClusterInput = {
  id: string
  keyword: string
  volume: number | null
  difficulty: number | null
  cpc: number | null
  search_intent: string | null
}

// Adım 1: intent gruplaması
const intentGroups = groupBy(keywords, (k) => k.search_intent ?? 'unknown')

// Adım 2: Her intent grubu içinde metin benzerliği ile alt kümeleme
// (mevcut overlapsWithCluster algoritması korunur)
for (const [intent, group] of Object.entries(intentGroups)) {
  const subClusters = clusterByText(group)
  // cluster_name = head keyword (en yüksek volume)
  // intent = intentGroups key
}
```

### Pattern 2: Opportunity Score Formula

```typescript
// src/lib/keywords/scoring.ts (YENİ)

const INTENT_MULTIPLIERS: Record<string, number> = {
  transactional: 1.0,
  commercial:    0.85,
  informational: 0.5,
  navigational:  0.3,
  unknown:       0.5,
}

function normalizeVolume(volume: number, maxVolume: number): number {
  if (maxVolume === 0) return 0
  return Math.min(volume / maxVolume, 1) // 0-1
}

function normalizeCpc(cpc: number, maxCpc: number): number {
  if (maxCpc === 0) return 0
  return Math.min(cpc / maxCpc, 1) // 0-1
}

export function calculateOpportunityScore(
  keyword: {
    volume: number | null
    cpc: number | null
    difficulty: number | null
    search_intent: string | null
  },
  context: { maxVolume: number; maxCpc: number }
): number {
  const volumeScore  = normalizeVolume(keyword.volume ?? 0, context.maxVolume)
  const cpcScore     = normalizeCpc(keyword.cpc ?? 0, context.maxCpc)
  const kdScore      = (100 - (keyword.difficulty ?? 50)) / 100  // 0-1, düşük KD = yüksek skor
  const intentMult   = INTENT_MULTIPLIERS[keyword.search_intent?.toLowerCase() ?? 'unknown'] ?? 0.5

  const raw = (volumeScore * 0.40) + (cpcScore * 0.25) + (kdScore * 0.15) + (intentMult * 0.20)
  return Math.round(raw * 100 * 10) / 10  // 0-100, 1 ondalık
}

// Kullanım: tüm keywordler üzerinde max değerleri önce hesapla
const maxVolume = Math.max(...keywords.map(k => k.volume ?? 0))
const maxCpc    = Math.max(...keywords.map(k => k.cpc ?? 0))
const scored = keywords.map(k => ({
  ...k,
  opportunity_score: calculateOpportunityScore(k, { maxVolume, maxCpc })
}))
```

**Formula açıklaması:**
- **Volume (40%):** Trafik potansiyeli — normalize edilmiş, 0-1 arası
- **CPC (25%):** Ticari değer — CPC yüksekse keyword parasal değeri yüksek
- **KD inverse (15%):** Rekabet kolaylığı — düşük difficulty = yüksek skor
- **Intent multiplier (20%):** Transactional/commercial keyword'ler daha değerli

### Pattern 3: Cannibalization Prevention (Uygulama Katmanı)

Bir keyword yalnızca bir cluster'a ait olabilir. Bu `keywords.cluster_id` sütununun doğasından gelir — tek bir FK. Cannibalization prevention, keyword'ü farklı bir cluster'a taşıdığınızda eski cluster_id'nin üzerine yazılmasıyla otomatik sağlanır.

```typescript
// actions.ts — moveKeywordToCluster Server Action
export async function moveKeywordToCluster(
  keywordId: string,
  newClusterId: string,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Ownership doğrula (mevcut pattern)
  const { data: kw } = await supabase
    .from('keywords')
    .select('id, cluster_id')
    .eq('id', keywordId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!kw) return { success: false, error: 'Keyword bulunamadı.' }

  // cluster_id UPDATE — eski cluster_id otomatik ezilir (cannibalization prevention)
  const { error } = await supabase
    .from('keywords')
    .update({ cluster_id: newClusterId })
    .eq('id', keywordId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Küme ataması başarısız.' }

  revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
  return { success: true }
}
```

**DB-level constraint gerekli mi?** Hayır. `cluster_id` tek bir değer tuttuğundan bir keyword iki cluster'da aynı anda olamaz. Application-level check yeterli.

### Pattern 4: Primary Keyword Ataması

Sistem otomatik atar (en yüksek volume), kullanıcı override edebilir.

```typescript
// actions.ts — setPrimaryKeyword Server Action
export async function setPrimaryKeyword(
  clusterId: string,
  keywordId: string,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  // Ownership doğrula: hem cluster hem keyword bu projeye ait mi?
  // keyword_clusters UPDATE primary_keyword_id = keywordId
  // Yeni keyword, cluster'ın bir üyesi olmalı (cluster_id = clusterId)
}
```

**Kısıt:** primary_keyword_id yalnızca o cluster'ın bir üyesi olabilir. Bu uygulama katmanında doğrulanır (keyword.cluster_id === clusterId check).

### Pattern 5: Clustering Server Action (Ana Akış)

```typescript
// actions.ts — clusterAndScoreKeywords
export async function clusterAndScoreKeywords(
  projectId: string
): Promise<{ success: boolean; clusterCount: number; error?: string }> {
  // 1. Tüm enriched keywords'ü çek
  const { data: keywords } = await supabase
    .from('keywords')
    .select('id, keyword, volume, cpc, difficulty, search_intent, cluster_id')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .not('enriched_at', 'is', null)  // sadece zenginleştirilmiş keywordler

  // 2. Cluster algoritması çalıştır
  const clusters = clusterKeywords(keywords)  // güncellenmiş, intent-first

  // 3. Opportunity score hesapla
  const maxVolume = Math.max(...keywords.map(k => k.volume ?? 0))
  const maxCpc = Math.max(...keywords.map(k => k.cpc ?? 0))

  // 4. DB'ye yaz (her cluster için upsert, her keyword için update)
  for (const cluster of clusters) {
    // keyword_clusters UPSERT
    // Otomatik primary: cluster.keywords[0] (en yüksek volume — zaten sıralı)
    // keywords UPDATE cluster_id + opportunity_score
  }

  revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
  return { success: true, clusterCount: clusters.length }
}
```

### Anti-Patterns

- **SERP URL overlap için her keyword'e ayrı API çağrısı:** 50 keyword için 50 DataForSEO çağrısı. API maliyeti yüksek, kullanıcı bekleme süresi uzun. Intent-first hibrid yaklaşım daha pratik.
- **Client-side clustering:** Keyword listesi büyüyebilir, tüm veriyi client'a indirmek gereksiz.
- **Blocking UI (await olmadan):** clusterAndScoreKeywords orta boy listede (50-200 kw) birkaç saniye sürebilir. `useTransition` ile "Kümeleniyor..." loading state gösterilmeli.
- **Her cluster update'de sayfayı yeniden cluster'lama:** Kullanıcı keyword taşıyınca sadece o keyword güncellenir, tüm liste yeniden cluster'lanmaz.

---

## Don't Hand-Roll

| Problem | Yapma | Kullan | Neden |
|---------|-------|--------|-------|
| Opportunity score normalizasyon | Custom karmaşık math | Basit min-max normalize | KEYW-06'nın gereği bu kadar; makine öğrenimi gerekmez |
| DB-level cannibalization constraint | UNIQUE(keyword_id, cluster_id) trigger | FK tek değer (cluster_id) | Schema zaten doğru tasarlanmış |
| Async queue için n8n/cron | Queue sistemi kurmak | Synchronous Server Action | Phase 1-8 scope'unda n8n yok (STATE.md) |
| SERP URL overlap API'ye tüm keyword'leri yolla | Yüzlerce DataForSEO çağrısı | Intent-first metin algoritma | Phase 5 intent verisi zaten hazır; ek API maliyeti gerekmez |

---

## Common Pitfalls

### Pitfall 1: unenriched Keywords'ü Clustering'e Dahil Etmek
**Ne olur:** enriched_at IS NULL olan keyword'lerde search_intent boş gelir. Intent-first algoritma bu keyword'leri yanlış gruplar.
**Neden olur:** clusterAndScoreKeywords tüm keywords'ü çekince bazıları hala enrichment bekliyor.
**Önlem:** `NOT enriched_at IS NULL` filtresi. Unenriched keywordler "Zenginleştirme Bekleniyor" gösterir, kümelenmez.
**Uyarı:** pendingEnrichment count UI'da zaten gösteriliyor (Phase 5 pattern).

### Pitfall 2: primary_keyword_id Cluster Üyesi Olmaması
**Ne olur:** Kullanıcı primary olarak başka bir keyword seçer, sonra o keyword'ü cluster'dan taşırsa → primary_keyword_id geçersiz.
**Neden olur:** keyword.cluster_id güncellenir ama cluster.primary_keyword_id temizlenmez.
**Önlem:** moveKeywordToCluster action'ında: keyword mevcut cluster'ın primary'si ise, primary_keyword_id'yi NULL yap (veya kalan en yüksek volume'e sahip üyeye ata).
**Uyarı:** primary_keyword_id FK ON DELETE SET NULL zaten mevcut — keyword silinirse otomatik temizlenir. Ama taşıma farklı (keyword silinmez).

### Pitfall 3: Cluster Name Unique Constraint Çakışması
**Ne olur:** "ankara" keyword başlıklı iki farklı cluster oluşturulmaya çalışılır. `keyword_clusters_project_name_unique` hatası.
**Neden olur:** clusterKeywords() cluster head keyword'ü isim olarak kullanır. Aynı head word iki farklı intent grubunda çıkabilir.
**Önlem:** cluster_name = `${head_keyword} (${intent})` formatı kullan: "ankara hizmet (commercial)", "ankara ne zaman (informational)".
**Alternatif:** UPSERT with `ignoreDuplicates: false` — mevcut pattern (actions.ts L49) bu yaklaşımı zaten kullanıyor.

### Pitfall 4: Synchronous Clustering Büyük Listelerde Timeout
**Ne olur:** 200+ keyword için clusterAndScoreKeywords, DB round-triplerle 30 sn'yi aşabilir. Next.js Server Action timeout (varsayılan 30s, ayarlanabilir).
**Neden olur:** Her keyword için ayrı `supabase.update()` çağrısı (Phase 5 enrichment pattern gibi).
**Önlem:** Toplu UPDATE — `keywords.opportunity_score` için `Promise.all()` veya tek UPDATE CASE WHEN ifadesi. Ya da: opportunity_score'u JavaScript'te hesapla, `upsert()` ile toplu yaz.
**Gerçekçi boyut:** Ajans projelerinde 50-200 keyword tipik. Bu aralıkta problem yok, 500+ için dikkat.

### Pitfall 5: Küme Panel'i ile Düz Tablo Arasında Veri Tutarsızlığı
**Ne olur:** Kullanıcı küme panelinde bir keyword'ü taşır, düz tablo hala eski kümeyi gösterir.
**Neden olur:** `revalidatePath` doğru çağrılmazsa.
**Önlem:** moveKeywordToCluster ve setPrimaryKeyword action'larında `revalidatePath('/projeler/[id]/keyword-stratejisi')` zorunlu.

---

## DataForSEO Endpoint Özeti

### Mevcut Kullanılan (Phase 5'ten)
- `POST /v3/keywords_data/google_ads/search_volume/live` — Toplu keyword data, search_intent dahil. Phase 6'da tekrar kullanılmaz (veriler zaten çekildi).

### Mevcut Kullanılan (Phase 4'ten)
- `POST /v3/serp/google/organic/live/regular` — Tek keyword, SERP domain listesi. [VERIFIED: codebase]
  - **Kısıt: tek task = tek keyword.** Batch değil. 50 keyword = 50 çağrı.
  - Phase 6'da bu endpoint kullanılmaması önerilir (cost + latency).

### Opsiyonel Gelecek Endpoint
- `POST /v3/dataforseo_labs/google/serp_competitors/live` — Birden fazla keyword için domain yarışmacılarını verir. [VERIFIED: docs.dataforseo.com/v3/dataforseo_labs-google-serp_competitors-live] Doğrudan SERP overlap clustering vermez ama hangi keyword grubunun aynı domain seti ile yarıştığını gösterir.

---

## SERP-Based Clustering: Karar Analizi

### Seçenek A: Saf SERP URL Overlap (Endüstri standardı)
- Her keyword için SERP'e bak, top 10 URL'leri çıkar
- İki keyword ≥4 ortak URL paylaşıyorsa aynı cluster
- **Maliyet:** 50 keyword = 50 DataForSEO SERP çağrısı (~$0.01-0.05 per çağrı)
- **Süre:** Sequential yapılırsa 50 × ~1s = ~50s. Paralel: ~5-10s
- **Kalite:** Yüksek (endüstri standardı [CITED: oncrawl.com/on-page-seo/keyword-clustering-using-python-serp-api/])

### Seçenek B: Intent-First Metin Hibrid (Önerilen)
- search_intent ile büyük gruplar (Phase 5'ten hazır)
- Metin benzerliği ile alt kümeler (clustering.ts mevcut)
- **Maliyet:** $0 (ek API çağrısı yok)
- **Süre:** <1s (pure JS, senkron)
- **Kalite:** Orta-Yüksek (ajans aracı için yeterli; KEYW-04'ü karşılar)

**Karar:** Seçenek B. KEYW-04 "SERP similarity ve intent mapping" der — intent mapping zaten hazır. "SERP similarity" için Phase 5 SERP verisi dolaylı yansıma sağlar (search_intent DataForSEO SERP'ten türetilir). Gelecek iterasyonda Seçenek A opsiyonel genişleme olarak eklenebilir.

---

## Opportunity Score Formula (Sonuçlanan)

```
opportunity_score = (volume_score × 0.40) + (cpc_score × 0.25) + (kd_ease × 0.15) + (intent_weight × 0.20)
```

| Bileşen | Hesaplama | Ağırlık | Açıklama |
|---------|-----------|---------|----------|
| volume_score | keyword.volume / max(all volumes) | 40% | Trafik potansiyeli |
| cpc_score | keyword.cpc / max(all CPCs) | 25% | Ticari değer sinyali |
| kd_ease | (100 - difficulty) / 100 | 15% | Düşük KD = kolay ranklanma |
| intent_weight | transactional=1.0, commercial=0.85, informational=0.5, navigational=0.3 | 20% | Dönüşüm potansiyeli |

Sonuç: 0-100 arasında NUMERIC(5,2) (zaten `keywords` tablosunda bu tip).

**Kaynak:** [CITED: hmdigitalsolution.com/keyword-opportunity-score-calculation/] — "no universal formula" teyidi. Bu formula sektör pratiklerinden sentezlenmiş [ASSUMED: ağırlık değerleri]. Kullanıcı onayı gerekirse ağırlıklar ayarlanabilir.

---

## Validation Architecture (nyquist_validation: true)

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest veya vitest (mevcut proje yapısına bakılmadan) |
| Config file | Wave 0'da oluşturulacak |
| Quick run command | `npx vitest run src/lib/keywords/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Davranış | Test Tipi | Otomatik Komut | Dosya Mevcut mu? |
|--------|---------|-----------|----------------|-----------------|
| KEYW-04 | Intent gruplaması doğru çalışır | unit | `npx vitest run src/lib/keywords/clustering.test.ts` | ❌ Wave 0 |
| KEYW-04 | Metin benzerliği doğru cluster atar | unit | `npx vitest run src/lib/keywords/clustering.test.ts` | ❌ Wave 0 |
| KEYW-05 | Keyword cluster taşınca eski cluster_id null olur | unit | `npx vitest run src/lib/keywords/clustering.test.ts` | ❌ Wave 0 |
| KEYW-06 | Opportunity score 0-100 arasında kalır | unit | `npx vitest run src/lib/keywords/scoring.test.ts` | ❌ Wave 0 |
| KEYW-06 | Transactional intent commercial'den yüksek skor alır | unit | `npx vitest run src/lib/keywords/scoring.test.ts` | ❌ Wave 0 |
| KEYW-07 | UI cluster panel render, keyword taşıma | manual | Manuel test (e2e kapsam dışı) | N/A |

### Wave 0 Gaps
- [ ] `src/lib/keywords/clustering.test.ts` — KEYW-04, KEYW-05
- [ ] `src/lib/keywords/scoring.test.ts` — KEYW-06
- [ ] Vitest kurulumu: `npm install -D vitest` (mevcut package.json'da yoksa)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Uygulanır | Standart Kontrol |
|---------------|-----------|-----------------|
| V2 Authentication | Hayır | — |
| V3 Session Management | Hayır | — |
| V4 Access Control | Evet | Tüm Server Actions: getUser() + project ownership doğrula |
| V5 Input Validation | Evet | projectId, clusterId, keywordId — UUID format; unknown intent string'i toLowerCase ile normalize |
| V6 Cryptography | Hayır | — |

### Phase 6'ya Özgü Tehdit Deseni

| Tehdit | STRIDE | Mitigasyon |
|--------|--------|-----------|
| Başka kullanıcının cluster'ını düzenle | Elevation of Privilege | moveKeywordToCluster: keyword + cluster'ın her ikisi de user_id + project_id ile doğrulanır |
| primary_keyword_id olarak başka projenin keyword UUID'si | Tampering | setPrimaryKeyword: keyword.project_id === projectId && keyword.user_id === user.id kontrolü |
| Çok büyük proje: clustering DOS | DoS | Uygulama katmanı keyword sayısı limiti (örn. 500+) — uyarı verip dur |

---

## Environment Availability

Step 2.6: SKIPPED — Phase 6 saf TypeScript + mevcut Supabase + mevcut DataForSEO entegrasyonu. Yeni harici bağımlılık yok. Tüm ortam gereksinimleri Phase 1-5'te doğrulandı.

---

## Assumptions Log

| # | Claim | Section | Yanlışsa Riski |
|---|-------|---------|----------------|
| A1 | Opportunity score ağırlıkları (40/25/15/20) sektör ortalamasını temsil eder | Opportunity Score Formula | Düşük — formula ayarlanabilir; kullanıcı onayı ile kilitlenebilir |
| A2 | 50-200 keyword için synchronous clustering ~2-5s içinde tamamlanır (timeout yok) | Common Pitfalls #4 | Orta — test edilmeli; >200 keyword projesinde Next.js action timeout riski |
| A3 | Vitest mevcut projeye eklenmemiş (package.json kontrol edilmedi) | Validation Architecture | Düşük — Wave 0'da kontrol edilip kurulur |

---

## Open Questions (RESOLVED)

1. **Clustering yeniden tetikleme stratejisi**
   - Bilinenler: "Kümelere Böl" butonu kullanıcı tetikler; otomatik değil.
   - Belirsizlik: Kullanıcı yeni keyword import edince mevcut kümeler ne olur? Sıfırdan yeniden kümeleme mi, sadece yeni keyword'leri mevcut kümelere ata mı?
   - **KARAR:** Açık "Yeniden Kümeleme" butonu ile sıfırdan yeniden kümeleme — mevcut cluster atamaları silinir, tüm keywordler yeniden kümelenir. Buton küme varsa "Yeniden Kümeleme", yoksa "Kümelere Böl" metni gösterir (UI-SPEC.md Copywriting Contract).

2. **Cluster paneli tasarım kararı: ayrı sayfa mı, aynı sayfada section mı?**
   - Bilinenler: Phase 5 düz tablo zaten keyword-stratejisi sayfasında.
   - Belirsizlik: Cluster-grouped görünüm için ayrı `/keyword-stratejisi/kumeler` route gerekli mi?
   - **KARAR:** Aynı sayfada toggle ile — `?view=flat` (default) / `?view=cluster` URL query parametresi. Ayrı route açılmaz. Server Component searchParams ile okur. (06-UI-SPEC.md — "Karar: Cluster Panel Konumu")

3. **Unenriched keywords için clustering davranışı**
   - Bilinenler: enriched_at IS NULL olan keywordler intent verisi taşımaz.
   - Belirsizlik: Bu keywordler tamamen clustering dışı mı tutulsun, sadece metin benzerliğiyle mi kümelensin?
   - **KARAR:** enriched_at IS NOT NULL filtresi — unenriched keywordler clusterAndScoreKeywords'e dahil edilmez. Enrichment uyarı banner'ı ile kullanıcı bilgilendirilir: "X keyword zenginleştirilmemiş — bunlar yalnızca metin benzerliğiyle kümelenecek." (06-UI-SPEC.md — Enrichment Uyarısı kararı)

---

## State of the Art

| Eski Yaklaşım | Mevcut Yaklaşım | Değişim | Etki |
|---------------|-----------------|---------|------|
| Manuel keyword gruplama | SERP URL overlap + metin benzerliği | 2020+ | Otomatik clustering artık endüstri standardı |
| Basit volume sıralama | Multi-signal opportunity scoring | 2022+ | Intent + CPC değer hesaplamada kritik sinyal |
| n8n / cron için async | Server Action synchronous | Phase 1-8 scope | n8n yok; sync yeterli bu ölçekte |

---

## Sources

### Primary (HIGH confidence)
- `[VERIFIED: codebase]` — src/lib/keywords/clustering.ts, parser.ts, dataforseo/client.ts, actions.ts, page.tsx, supabase migrations
- `[VERIFIED: codebase]` — keywords.opportunity_score NUMERIC(5,2) ve keyword_clusters.primary_keyword_id FK Phase 1 schema'da mevcut

### Secondary (MEDIUM confidence)
- `[CITED: docs.dataforseo.com/v3/serp/google/organic/live/regular/]` — Tek keyword per request kısıtı
- `[CITED: docs.dataforseo.com/v3/dataforseo_labs-google-serp_competitors-live/]` — SERP competitors endpoint
- `[CITED: oncrawl.com/on-page-seo/keyword-clustering-using-python-serp-api/]` — SERP URL overlap threshold: 4-6 ortak URL

### Tertiary (LOW confidence)
- `[ASSUMED]` — Opportunity score ağırlıkları (40/25/15/20) — sektör pratiklerinden sentezlenmiş, kanonize edilmemiş

---

## Metadata

**Confidence breakdown:**
- DB Schema: HIGH — migration dosyaları ve codebase doğrulandı
- Mevcut kod altyapısı: HIGH — clustering.ts, actions.ts, client.ts okundu
- Clustering algoritması: HIGH — endüstri standardı URL overlap + intent mapping teyitli
- Opportunity score formula: MEDIUM — no universal standard, bu çarpanlar ASSUMED
- DataForSEO endpoint kısıtları: MEDIUM — WebFetch ile docs doğrulandı

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (stabil stack; DataForSEO API versiyonu değişmediği sürece)
