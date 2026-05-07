# Phase 17: Keyword Intelligence - Research

**Researched:** 2026-05-07
**Domain:** Keyword cluster scoring, revenue classification, ClusterPanel UI extension
**Confidence:** HIGH — tüm bulgular codebase doğrudan incelenerek elde edildi

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Skor Hesaplama Zamanı**
Niche skoru otomatik hesaplanır — cluster'a keyword eklendiğinde veya çıkarıldığında tetiklenir. Skor DB'ye kaydedilir (`keyword_clusters.opportunity_score` kolonu zaten mevcut). Her sayfa yüklenişinde yeniden hesaplanmaz; kaydedilmiş skor gösterilir. Ayrı bir Supabase trigger'a gerek yok.

**D-02: Skor Formülü**
Basit 3 bileşen, sabit ağırlıklar:
- `total_volume` — cluster toplam hacmi (normalize edilmiş)
- `avg_difficulty` — cluster keyword'lerinin ortalama KD (düşük = iyi, ters normalize)
- `avg_cpc` — cluster keyword'lerinin ortalama CPC (yüksek = ticari değer)

`niche_score = (volume_score * 0.4) + (competition_score * 0.35) + (cpc_score * 0.25)` — 0-100 aralığında normalize edilmiş sonuç. Formül sabit ağırlıklı, kullanıcı arayüzden ayarlayamaz.

**D-03: Revenue Sınıflandırması**
Cluster'daki keyword'lerin `search_intent` dağılımına göre otomatik atanır:
- Çoğunluk `informational` → **bilgi** (bilgi trafiği)
- Çoğunluk `commercial` veya `transactional` → **ticari**
- Karma → **mixed**

Kullanıcı cluster başına manuel olarak `revenue_type` değerini override edebilir (dropdown). DB'deki `revenue_type` kolonu zaten mevcut.

**D-04: UI Yerleşimi**
Mevcut `keyword-stratejisi` sayfasındaki cluster görünümüne iki yeni sütun eklenir:
- `Niche Skoru` — sayısal skor + renk kodu (≥70 violet, ≥40 amber, altı gri)
- `Revenue` — bilgi/mixed/ticari rozeti (kullanıcı override dropdown'ı ile)

Ayrı sayfa veya route açılmaz. Liste sıralama niche skoruna göre yapılabilir olmalı.

### Claude's Discretion
- Niche skor normalize etme algoritması (min-max vs. logaritmik) — planner seçer
- Revenue override dropdown component'i (inline edit vs. select) — mevcut pattern'e uygun seçilir
- Skor sütunu başlangıçta yüklenmemiş cluster'larda nasıl gösterilir (dash vs. skeleton) — Claude karar verir

### Deferred Ideas (OUT OF SCOPE)
- 6 bileşenli gelişmiş skor (programmatic potansiyel, sezonluk dalgalanma vb.) — Phase 17+ scope
- Ayrı Intelligence sayfası / cluster-to-revenue haritası görünümü — gelecek milestone
- Kullanıcı tarafından ağırlık ayarlama — kapsam dışı

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NICH-01 | Sistem her keyword cluster için niche selection skoru hesaplar (hacim, rekabet, ticari değer bileşenlerinden) | `keyword_clusters.opportunity_score` kolonu mevcut; `src/lib/keywords/scoring.ts` pattern'i doğrudan adapte edilebilir |
| NICH-02 | Kullanıcı cluster başına niche skorunu keyword strateji görünümünde görebilir | `ClusterPanel.tsx` cluster header'ına yeni sütun eklenir; `ScoreBadge` zaten hazır |
| RVEN-01 | Sistem cluster'ları gelir potansiyeline göre sınıflandırır (bilgi trafiği / mixed / ticari) | `keyword_clusters.revenue_type` kolonu mevcut; `search_intent` dağılım analizi yeterli |
| RVEN-02 | Kullanıcı cluster-to-revenue haritasını keyword strateji görünümünde görebilir | `RevenueBadge` + `RevenueOverrideSelect` bileşenleri; ClusterPanel header genişletme |

</phase_requirements>

---

## Summary

Phase 17, mevcut `keyword-stratejisi` sayfasının cluster görünümüne iki yeni sütun ekleyerek keyword cluster'larına stratejik değer puanı ve gelir sınıflandırması atar. Bu faz yeni bir route veya sayfa açmaz — tamamen mevcut bileşenler üzerine inşa eder.

**Kritik bulgu:** `keyword_clusters` tablosunda `opportunity_score` (NUMERIC 5,2) ve `revenue_type` (TEXT) kolonları zaten mevcut (20260423000003_product_layers_schema.sql). Yeni migration gerekmez. `keywords` tablosunda `volume`, `cpc`, `difficulty`, `search_intent` kolonları da mevcuttur ve her cluster'daki keyword'ler üzerinden aggregate hesaplama yapılabilir.

**Mevcut altyapı çok uygun:** `src/lib/keywords/scoring.ts`'deki keyword-level fırsat skoru hesaplama pattern'i (min-max normalizasyon, sabit ağırlıklar) cluster-level niche skoru için doğrudan adapte edilebilir. `ScoreBadge` bileşeni ClusterPanel.tsx içinde inline tanımlanmış ve renk eşiklerini (≥70 violet, ≥40 amber, gri) zaten uyguluyor. `IntentBadge` pattern'i (config objesi + className direkt atama) `RevenueBadge` için bire bir kopyalanabilir.

**Primary recommendation:** Tek bir `recalculateClusterNicheScore(clusterId, supabase, userId)` helper fonksiyonu yaz; bu fonksiyon cluster'ın tüm keyword'lerini çekip aggregate eder, niche_score ve revenue_type hesaplar, `keyword_clusters` tablosuna yazar. Bu helper'ı `moveKeywordToCluster` ve `deleteKeyword` action'larının sonuna inject et. Ayrı plan'lar: (1) lib helper + skor mantığı, (2) actions.ts entegrasyonu + `updateClusterRevenue` action, (3) ClusterPanel UI genişletme + sıralama.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Niche score hesaplama | API / Backend (Server Action) | — | Aggregate SQL query + math; browser'a açılmaz |
| Revenue type otomatik atama | API / Backend (Server Action) | — | intent dağılımı analizi, DB yazma |
| Revenue type override | API / Backend (Server Action) | Browser / Client | Client optimistic update yok; revalidatePath yeterli |
| Niche Skoru badge gösterimi | Frontend SSR | — | ClusterPanel SSR bileşeni, veri DB'den gelir |
| Revenue badge + dropdown | Browser / Client | Frontend SSR | RevenueOverrideSelect client component olacak |
| Sıralama (sort by niche score) | Frontend SSR | — | searchParams URL-driven; page.tsx sorguyu ORDER BY ile yapar |

---

## Standard Stack

### Core — Mevcut, Değişmiyor

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 15.x | SSR page, searchParams sort | Proje geneli pattern |
| Supabase JS | 2.x | keyword_clusters UPDATE | Mevcut tüm action'larda kullanılıyor |
| shadcn/ui Badge | — | RevenueBadge tabanı | STATE.md: `variant` prop yok, className direkt atama |

### Yeni Bileşenler (Bu Fazda Oluşturulacak)

| Dosya | Amaç | Pattern Kaynağı |
|-------|------|-----------------|
| `src/lib/keywords/niche-scoring.ts` | Cluster-level niche score + revenue type hesaplama | `scoring.ts` adaptasyonu |
| `./RevenueBadge.tsx` | `revenue_type` → renk kodlu rozet | `IntentBadge.tsx` bire bir kopyası |
| `./RevenueOverrideSelect.tsx` | Kullanıcı override dropdown | Yeni client component; shadcn Select |

### Alternatifler Değerlendirilmedi

Tüm kararlar CONTEXT.md'de kilitlenmiş. Alternatif araştırması kapsam dışı.

---

## Architecture Patterns

### Sistem Mimarisi (Veri Akışı)

```
Keyword ekleme/silme/taşıma
        |
   actions.ts (mutasyon)
        |
   recalculateClusterNicheScore(clusterId)
        |
   SELECT keywords WHERE cluster_id = ?
   → aggregate: sum(volume), avg(difficulty), avg(cpc), count by intent
        |
   niche-scoring.ts
   → niche_score = (vol_score*0.4) + (comp_score*0.35) + (cpc_score*0.25)
   → revenue_type = majority intent mapping
        |
   UPDATE keyword_clusters SET opportunity_score=?, revenue_type=?
        |
   revalidatePath('/projeler/[id]/keyword-stratejisi')
        |
   page.tsx SSR — SELECT keyword_clusters (opportunity_score, revenue_type dahil)
        |
   ClusterPanel → ScoreBadge + RevenueBadge gösterimi
```

### Önerilen Dosya Yapısı

```
src/lib/keywords/
├── scoring.ts           # Mevcut — keyword-level fırsat skoru
├── niche-scoring.ts     # YENİ — cluster-level niche skoru + revenue type
└── clustering.ts        # Mevcut — dokunulmaz

src/app/(dashboard)/projeler/[id]/keyword-stratejisi/
├── actions.ts           # Mevcut — recalculateClusterNicheScore inject edilecek
├── ClusterPanel.tsx     # Mevcut — 2 yeni sütun + sıralama butonu eklenecek
├── RevenueBadge.tsx     # YENİ — IntentBadge pattern
├── RevenueOverrideSelect.tsx  # YENİ — Client component, shadcn Select
├── page.tsx             # Mevcut — searchParams sort desteği + oppScore/revType SELECT
└── IntentBadge.tsx      # Mevcut — dokunulmaz
```

### Pattern 1: Cluster-Level Niche Score Hesaplama

```typescript
// src/lib/keywords/niche-scoring.ts
// [VERIFIED: codebase — scoring.ts, supabase migration kolonları]

export type ClusterKeywordData = {
  volume: number | null
  cpc: number | null
  difficulty: number | null
  search_intent: string | null
}

export function calculateNicheScore(
  keywords: ClusterKeywordData[],
  context: { maxClusterVolume: number; maxCpc: number }
): number {
  if (keywords.length === 0) return 0

  const totalVolume = keywords.reduce((s, k) => s + (k.volume ?? 0), 0)
  const avgDifficulty = keywords.reduce((s, k) => s + (k.difficulty ?? 50), 0) / keywords.length
  const avgCpc = keywords.reduce((s, k) => s + (k.cpc ?? 0), 0) / keywords.length

  // Min-max normalize (mevcut scoring.ts pattern'i)
  const volumeScore = context.maxClusterVolume > 0
    ? Math.min(totalVolume / context.maxClusterVolume, 1)
    : 0
  const competitionScore = (100 - avgDifficulty) / 100  // düşük KD = iyi
  const cpcScore = context.maxCpc > 0
    ? Math.min(avgCpc / context.maxCpc, 1)
    : 0

  const raw = (volumeScore * 0.4) + (competitionScore * 0.35) + (cpcScore * 0.25)
  return Math.round(raw * 100 * 10) / 10  // 0-100, 1 decimal
}

export function classifyRevenueType(
  keywords: ClusterKeywordData[]
): 'bilgi' | 'mixed' | 'ticari' {
  if (keywords.length === 0) return 'mixed'

  const counts = { informational: 0, commercial: 0, transactional: 0, other: 0 }
  for (const kw of keywords) {
    const intent = kw.search_intent?.toLowerCase() ?? 'other'
    if (intent === 'informational') counts.informational++
    else if (intent === 'commercial' || intent === 'transactional') {
      counts.commercial++
    } else {
      counts.other++
    }
  }

  const total = keywords.length
  if (counts.informational / total > 0.5) return 'bilgi'
  if (counts.commercial / total > 0.5) return 'ticari'
  return 'mixed'
}
```

### Pattern 2: RecalculateClusterNicheScore Helper (actions.ts inject)

```typescript
// actions.ts içine — her mutasyon sonrası çağrılır
// [VERIFIED: codebase — actions.ts pattern]

async function recalculateClusterNicheScore(
  clusterId: string,
  projectId: string,
  userId: string,
  supabase: SupabaseClient,
  allClusterVolumes: number[]  // normalizasyon için proje geneli max
): Promise<void> {
  const { data: keywords } = await supabase
    .from('keywords')
    .select('volume, cpc, difficulty, search_intent')
    .eq('cluster_id', clusterId)
    .eq('user_id', userId)

  if (!keywords || keywords.length === 0) return

  const maxClusterVolume = Math.max(...allClusterVolumes, 0)
  const maxCpc = Math.max(...keywords.map(k => k.cpc ?? 0), 0)

  const nicheScore = calculateNicheScore(keywords, { maxClusterVolume, maxCpc })
  const revenueType = classifyRevenueType(keywords)

  await supabase
    .from('keyword_clusters')
    .update({
      opportunity_score: nicheScore,
      revenue_type: revenueType,
    })
    .eq('id', clusterId)
    .eq('user_id', userId)
}
```

### Pattern 3: RevenueBadge (IntentBadge bire bir kopyası)

```typescript
// RevenueBadge.tsx — [VERIFIED: codebase — IntentBadge.tsx pattern]
import { Badge } from '@/components/ui/badge'

const revenueConfig: Record<string, { className: string; label: string }> = {
  bilgi:   { className: 'bg-emerald-500/20 text-emerald-400', label: 'Bilgi' },
  mixed:   { className: 'bg-yellow-500/20 text-yellow-400',  label: 'Mixed' },
  ticari:  { className: 'bg-red-500/20 text-red-400',        label: 'Ticari' },
}

export function RevenueBadge({ revenueType }: { revenueType: string | null }) {
  if (!revenueType) return <span className="text-sm text-muted-foreground">—</span>
  const config = revenueConfig[revenueType.toLowerCase()]
  if (!config) return <span className="text-sm text-muted-foreground">{revenueType}</span>
  return (
    <Badge className={`${config.className} text-xs border-0`}>
      {config.label}
    </Badge>
  )
}
```

### Pattern 4: Sıralama (searchParams ile URL-driven)

```typescript
// page.tsx içinde — [VERIFIED: codebase — mevcut searchParams pattern]
// searchParams: { view?: string; sort?: string; dir?: string }

const { view, sort, dir } = await searchParams
const sortColumn = sort === 'niche_score' ? 'opportunity_score' : 'total_volume'
const ascending = dir === 'asc'

const { data: clustersRaw } = await supabase
  .from('keyword_clusters')
  .select('id, cluster_name, intent, primary_keyword_id, opportunity_score, revenue_type')
  .eq('project_id', id)
  .eq('user_id', user.id)
  .order(sortColumn, { ascending, nullsFirst: false })
```

### Anti-Patterns — Kaçınılacaklar

- **Client-side sıralama:** `ClusterPanel` içinde JavaScript sort kullanma. URL searchParam + SSR sorgusu daha temiz ve sayfayı yenileyen kullanıcı için tutarlı.
- **Her sayfa yükünde skor hesaplama:** CONTEXT.md D-01 kararı — skor hesaplanıp DB'ye yazılır, her yüklemede yeniden hesaplanmaz.
- **Optimistic update:** Revenue override için optimistic state gereksiz — `revalidatePath` SSR sayfayı hızla günceller, UX yeterlidir.
- **variant prop kullanımı:** STATE.md kararı — Badge bileşenine `variant` prop geçilmez, `className` direkt atanır.
- **Normalizasyon için global max:** Niche skor normalizasyonunda dikkat: `maxClusterVolume` proje içindeki tüm cluster'ların toplam volume'ları üzerinden hesaplanmalı, sadece hesaplanan cluster üzerinden değil.

---

## Don't Hand-Roll

| Problem | Yapma | Kullan |
|---------|-------|--------|
| Badge renk kodlama | Özel CSS sınıfları | shadcn Badge + className direkt atama (IntentBadge pattern) |
| Dropdown | Özel HTML select | shadcn `Select` bileşeni veya native `<select>` |
| Normalizasyon | Karmaşık istatistik | Basit min-max — scoring.ts pattern'i yeterli |
| DB güncelleme | Supabase trigger | Server action içinde explicit UPDATE (D-01 kararı) |

---

## DB Schema — Doğrulama

### keyword_clusters tablosu — Mevcut Kolonlar

[VERIFIED: supabase/migrations/20260423000003_product_layers_schema.sql]

```sql
ALTER TABLE public.keyword_clusters
  ADD COLUMN IF NOT EXISTS total_volume       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_type       TEXT,
  ADD COLUMN IF NOT EXISTS opportunity_score  NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS build_priority     TEXT NOT NULL DEFAULT 'medium';
```

**Sonuç: Yeni migration gerekmez.** `opportunity_score` ve `revenue_type` kolonları zaten mevcut. Bu faz bu kolonlara yazar.

### keywords tablosu — Mevcut Kolonlar

[VERIFIED: supabase/migrations/20260422000001_create_tables.sql]

```sql
CREATE TABLE public.keywords (
  id                UUID ... PRIMARY KEY,
  volume            INTEGER,
  cpc               NUMERIC(10, 2),
  difficulty        INTEGER,
  search_intent     TEXT,
  opportunity_score NUMERIC(5, 2),
  -- ...
);
```

**Sonuç:** `volume`, `cpc`, `difficulty`, `search_intent` kolonları mevcuttur. Cluster-level aggregate için gerekli tüm veri tabloda var.

---

## Mevcut ClusterPanel Analizi

[VERIFIED: codebase — ClusterPanel.tsx doğrudan okundu]

### Mevcut ClusterData Tipi

```typescript
type ClusterData = {
  id: string
  cluster_name: string
  intent: string | null
  primary_keyword_id: string | null
  keywords: ClusterKeyword[]
}
```

**Eksik:** `opportunity_score` ve `revenue_type` yok. Tip genişletilmeli.

### Mevcut page.tsx Cluster SELECT sorgusu

```typescript
const { data: clustersRaw } = await supabase
  .from('keyword_clusters')
  .select('id, cluster_name, intent, primary_keyword_id')  // opportunity_score ve revenue_type yok!
  .eq('project_id', id)
  .eq('user_id', user.id)
  .order('total_volume', { ascending: false, nullsFirst: false })
```

**Güncellenmesi gereken:** SELECT sorgusuna `opportunity_score, revenue_type` eklenmeli.

### Mevcut ScoreBadge — Doğrudan Kullanılabilir

```typescript
// ClusterPanel.tsx içinde inline — [VERIFIED: codebase]
function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-sm text-muted-foreground">—</span>
  if (score >= 70) return <Badge className="bg-violet-500/20 text-violet-400 text-xs border-0">{score.toFixed(1)}</Badge>
  if (score >= 40) return <Badge className="bg-amber-500/20 text-amber-400 text-xs border-0">{score.toFixed(1)}</Badge>
  return <Badge className="bg-secondary text-muted-foreground text-xs border-0">{score.toFixed(1)}</Badge>
}
```

**Sonuç:** ScoreBadge değiştirilmeden kullanılır. `opportunity_score` zaten bu bileşeni besleyebilir.

### Mevcut Cluster Header Layout

```
[ cluster_name + IntentBadge ] .............. [ ClusterDeleteButton ]
```

Phase 17 sonrası:
```
[ cluster_name + IntentBadge ] ... [ RevenueBadge+Override w-28 ] [ ScoreBadge w-24 ] [ ClusterDeleteButton ]
```

---

## Tetiklenme Noktaları (Injection Points)

[VERIFIED: codebase — actions.ts doğrudan okundu]

Niche skoru aşağıdaki 3 action'dan sonra güncellenmelidir:

| Action | Tetikleme Gerekçesi |
|--------|---------------------|
| `moveKeywordToCluster` | Keyword'ün cluster'ı değişti — hem eski hem yeni cluster'ın skoru güncellenmeli |
| `deleteKeyword` | Keyword silindi — kalan keyword'lerle skor yeniden hesaplanmalı |
| `clusterAndScoreKeywords` | Tam recluster — tüm cluster'lar için batch hesaplama yapılmalı |

**Not:** `importKeywords` action'ı da tetikleyebilir ancak bu genellikle `clusterAndScoreKeywords` öncesi kullanılır. Mevcut akışta import sonrası manuel clustering yapılıyor.

**Dikkat:** `moveKeywordToCluster`'da **eski cluster için de** skor güncellemesi gerekir. Keyword çıktıktan sonra eski cluster'ın metrikleri değişir.

---

## Normalizasyon Yaklaşımı — Planner Kararı

CONTEXT.md "Claude's Discretion" kapsamında. Aşağıdaki analiz:

### Min-Max Normalizasyon (Önerilen)

**Avantaj:** Mevcut `scoring.ts` zaten bu yaklaşımı kullanıyor — tutarlılık ve öğrenme eğrisi yok.
**Dezavantaj:** Tek bir outlier (çok yüksek hacimli cluster) diğer tüm cluster'ların göreli skorunu etkiler.
**Uygulama:** `maxClusterVolume` = projedeki tüm cluster'ların `total_volume` maksimumu; `maxCpc` = projedeki tüm keyword'lerin CPC maksimumu.

### Logaritmik Normalizasyon

**Avantaj:** Outlier etkisini azaltır; gerçek SEO verilerinde hacim dağılımı log-normal.
**Dezavantaj:** Karmaşık; açıklaması zor; mevcut pattern'den sapma.

**Öneri:** Min-max kullan (tutarlılık > kesinlik; bu kullanıcıya görece skor gösteriyor, mutlak tahmin değil).

---

## Revenue Override Dropdown — Planner Kararı

CONTEXT.md "Claude's Discretion" kapsamında. UI-SPEC kesin: `RevenueOverrideSelect` client component, seçim anında `updateClusterRevenue(clusterId, newRevenue, projectId)` çağrır, `revalidatePath` ile sayfa güncellenir.

**Öneri:** shadcn `Select` bileşeni — native `<select>` da çalışır ama proje genelinde shadcn tercih ediliyor. Trigger: `RevenueBadge`'in kendisi tıklanabilir olur.

---

## Common Pitfalls

### Pitfall 1: SELECT Sorgusu Güncellenmezse Skor Gösterilemez

**Ne olur:** `page.tsx` `keyword_clusters` SELECT'i `opportunity_score` ve `revenue_type` içermiyor. ClusterPanel'e bu değerler iletilmez.
**Önlem:** `page.tsx` SELECT sorgusuna eksik kolonları ekle; `ClusterData` tipini genişlet; `allClusters` mapping'ini güncelle.

### Pitfall 2: moveKeywordToCluster Eski Cluster Skoru Güncellenmez

**Ne olur:** Keyword bir cluster'dan diğerine taşındığında sadece yeni cluster'ın skoru güncellenir. Eski cluster daha yüksek hacimle skoru gösterir.
**Önlem:** `moveKeywordToCluster` action'ında `kw.cluster_id` (eski) ve `newClusterId` (yeni) için her ikisini de recalculate et.

### Pitfall 3: clusterAndScoreKeywords'de Normalizasyon Bağlamı Eksik

**Ne olur:** Her cluster için ayrı ayrı `niche_score` hesaplanırsa her cluster kendi max değerine göre normalize edilir — tüm cluster'lar yüksek skor alır.
**Önlem:** `clusterAndScoreKeywords` action'ında tüm cluster'ların toplam volume'larını önce çek, projeye özel `maxClusterVolume` belirle, tüm cluster'lar aynı context ile normalize edilsin.

### Pitfall 4: Revenue Type Değerleri Tutarsız

**Ne olur:** DB'de `revenue_type` değerleri büyük/küçük harf veya farklı format (örn. `Bilgi` vs `bilgi`) ile kaydedilirse `RevenueBadge` config objesi eşleşme bulamaz.
**Önlem:** Her zaman küçük harf kaydet (`'bilgi'`, `'mixed'`, `'ticari'`); `RevenueBadge`'de `.toLowerCase()` normalize et.

### Pitfall 5: Sıralama URL Parametresi ClusterPanel'e İletilmezse

**Ne olur:** NicheScoreHeader button'ı `router.push` ile URL günceller ama `page.tsx` sorgusu `searchParams` okumuyorsa sıralama çalışmaz.
**Önlem:** `page.tsx`'de `sort` ve `dir` searchParams'ı oku; ORDER BY SQL sorgusuna yansıt.

---

## Runtime State Inventory

Bu faz greenfield değil ama rename/refactor değil — mevcut colonlara yeni veri yazılıyor. Mevcut `opportunity_score` ve `revenue_type` alanları boş olduğu için migration gerekmez ve veri migration'ı da gerekmez.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `keyword_clusters.opportunity_score` mevcut, boş | Skor hesaplandığında güncellenir — migration yok |
| Stored data | `keyword_clusters.revenue_type` mevcut, boş | Revenue type atandığında güncellenir — migration yok |
| Live service config | — | Yok |
| OS-registered state | — | Yok |
| Secrets/env vars | — | Yok |
| Build artifacts | — | Yok |

---

## Environment Availability

Bu faz external tool bağımlılığı içermiyor — kod + config değişiklikleri.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build | Yes | v25.9.0 | — |
| Vitest | Tests | Yes | ^4.1.5 | — |
| Supabase | DB writes | Yes (proje zaten çalışıyor) | 2.x | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` (proje root) |
| Quick run command | `npm test` (vitest run) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NICH-01 | `calculateNicheScore` doğru 0-100 skor döner | unit | `npx vitest run src/lib/keywords/niche-scoring.test.ts` | Wave 0'da oluşturulacak |
| NICH-01 | `calculateNicheScore` boş keywords için 0 döner | unit | `npx vitest run src/lib/keywords/niche-scoring.test.ts` | Wave 0'da oluşturulacak |
| RVEN-01 | `classifyRevenueType` çoğunluk informational → 'bilgi' döner | unit | `npx vitest run src/lib/keywords/niche-scoring.test.ts` | Wave 0'da oluşturulacak |
| RVEN-01 | `classifyRevenueType` çoğunluk commercial/transactional → 'ticari' döner | unit | `npx vitest run src/lib/keywords/niche-scoring.test.ts` | Wave 0'da oluşturulacak |
| RVEN-01 | `classifyRevenueType` karma dağılım → 'mixed' döner | unit | `npx vitest run src/lib/keywords/niche-scoring.test.ts` | Wave 0'da oluşturulacak |
| NICH-02 | ClusterPanel cluster header'ında opportunity_score gösterilir | E2E / manual | Tarayıcı gözlemi | — |
| RVEN-02 | ClusterPanel revenue_type badge gösterilir | E2E / manual | Tarayıcı gözlemi | — |

### Sampling Rate

- **Per task commit:** `npm test` (scoring ve niche-scoring test dosyaları)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/keywords/niche-scoring.test.ts` — NICH-01, RVEN-01 unit testleri
- [ ] `src/lib/keywords/niche-scoring.ts` — ana implementasyon dosyası

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase auth — mevcut `createClient()` pattern |
| V3 Session Management | yes | Mevcut middleware — dokunulmaz |
| V4 Access Control | yes | `user_id` + `project_id` ownership check — mevcut action pattern |
| V5 Input Validation | yes | `revenue_type` override: whitelist (`bilgi`, `mixed`, `ticari`) |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Başka projenin cluster'ına revenue_type yazma | Tampering | `updateClusterRevenue` içinde `project_id + user_id` ownership doğrula |
| Geçersiz `revenue_type` değeri enjeksiyonu | Tampering | Action içinde whitelist kontrolü: sadece `bilgi`, `mixed`, `ticari` kabul et |
| Başka kullanıcının cluster skorunu tetikleme | Elevation of Privilege | recalculate helper'ında `user_id` filtresi zorunlu |

---

## Code Examples

### IntentBadge — Referans Pattern (değiştirilmez)

```typescript
// [VERIFIED: codebase — IntentBadge.tsx]
const intentConfig: Record<string, { className: string; label: string }> = {
  commercial:    { className: 'bg-blue-500/20 text-blue-400',      label: 'Commercial' },
  informational: { className: 'bg-emerald-500/20 text-emerald-400', label: 'Informational' },
  navigational:  { className: 'bg-gray-500/20 text-gray-400',      label: 'Navigational' },
  transactional: { className: 'bg-orange-500/20 text-orange-400',  label: 'Transactional' },
}
// variant prop kullanılmaz — STATE.md proje kararı
```

### Mevcut scoring.ts — Adapte Edilecek Pattern

```typescript
// [VERIFIED: codebase — src/lib/keywords/scoring.ts]
// Min-max normalizasyon, 0-100 aralığı, 1 decimal
export function calculateOpportunityScore(keyword, context) {
  const volumeScore = normalizeVolume(keyword.volume ?? 0, context.maxVolume)
  const cpcScore    = normalizeCpc(keyword.cpc ?? 0, context.maxCpc)
  const kdScore     = (100 - (keyword.difficulty ?? 50)) / 100
  const intentMult  = INTENT_MULTIPLIERS[keyword.search_intent?.toLowerCase() ?? 'unknown'] ?? 0.5
  const raw = (volumeScore * 0.40) + (cpcScore * 0.25) + (kdScore * 0.15) + (intentMult * 0.20)
  return Math.round(raw * 100 * 10) / 10
}
```

Niche scoring için adaptasyon: `intentMult` yerine `avgDifficulty` ters normalize kullanılır; bireysel keyword değil cluster aggregate alınır.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Keyword-level fırsat skoru (Phase 6) | Cluster-level niche skoru (Phase 17) | Bu faz | Cluster bazında stratejik önceliklendirme mümkün olur |
| Revenue type yok | Otomatik + override'lı revenue sınıflandırması | Bu faz | Cluster'ların gelir potansiyelini görünür kılar |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Niche skor normalizasyonunda proje geneli max değerler kullanılmalı (cluster bazında değil) | Normalizasyon Yaklaşımı | Tüm cluster'lar benzer skor alırsa relative ranking bozulur |
| A2 | `recalculateClusterNicheScore` fonksiyonu hem eski hem yeni cluster'ı günceller (`moveKeywordToCluster`) | Injection Points | Eski cluster'da yanlış skor kalır |

---

## Open Questions

1. **`clusterAndScoreKeywords` içinde toplu hesaplama verimliliği**
   - Ne biliyoruz: Mevcut action tüm keywords'ü bir kerede çekiyor
   - Belirsiz: Çok sayıda cluster varsa (50+) skor hesaplama yavaş olabilir mi?
   - Öneri: İlk versiyonda sequential Promise.all yeterli; ölçek problemi olursa optimize edilir

2. **`updateClusterRevenue` action'ının `importKeywords` ile entegrasyonu**
   - Ne biliyoruz: Import sonrası clustering yok — kullanıcı manuel "Kümelere Böl" çalıştırıyor
   - Belirsiz: Import sırasında skor tetiklenmesi gerekir mi?
   - Öneri: Hayır — import sırasında cluster'lar henüz oluşturulmamış olabilir; `clusterAndScoreKeywords` tetiklendiğinde hesapla

---

## Sources

### Primary (HIGH confidence)

- Codebase doğrudan inceleme: `ClusterPanel.tsx`, `actions.ts`, `scoring.ts`, `IntentBadge.tsx`
- Codebase doğrudan inceleme: `supabase/migrations/20260423000003_product_layers_schema.sql`
- Codebase doğrudan inceleme: `supabase/migrations/20260422000001_create_tables.sql`
- Codebase doğrudan inceleme: `page.tsx` (keyword-stratejisi)
- `.planning/phases/17-keyword-intelligence/17-CONTEXT.md` — kullanıcı kararları
- `.planning/phases/17-keyword-intelligence/17-UI-SPEC.md` — UI design contract

### Secondary (MEDIUM confidence)

- Yok (tüm bulgular codebase veya CONTEXT.md kaynaklı)

### Tertiary (LOW confidence)

- Yok

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — tüm kolonlar ve bileşenler codebase'de doğrulandı
- Architecture: HIGH — injection points ve veri akışı kod okunarak belirlendi
- Pitfalls: HIGH — mevcut kod eksiklikleri (SELECT sorgusu, eski cluster güncelleme) doğrudan tespit edildi

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (stable — kod yapısı değişmediği sürece)
