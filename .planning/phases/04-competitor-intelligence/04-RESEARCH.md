# Phase 4: Competitor Intelligence - Research

**Researched:** 2026-04-23
**Domain:** DataForSEO API entegrasyonu, Next.js Server Actions, Supabase JSONB, URL pattern analizi
**Confidence:** HIGH (codebase pattern'ları verified, DataForSEO API docs verified)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Rakip yönetimi `/projeler/[id]/rakipler` ayrı sayfasında yaşar — `/projeler/[id]/kurallar` ile aynı pattern. Sol sütunda 2 link: "Rakipler" (yeni) + "Kurallar" (mevcut).
- **D-02:** Proje detay sol sütunu güncellenir: Kurallar linki üstüne Rakipler linki eklenir. İkisi de "Proje Kuralları" ile aynı stil.
- **D-03:** "Rakip Keşfet" butonu → dialog → 1-3 keyword giriş → DataForSEO SERP API → domain listesi → kullanıcı seçer → ekle. Phase 5 bağımsız çalışır.
- **D-04:** SERP keşfi human-triggered — otomatik arka plan işlemi yok.
- **D-05:** Rakip başına: Top 10 organik sayfa (URL + başlık + tahmini trafik) + kategori yapısı çıkarımı (URL pattern analizi). DataForSEO Domain Analytics API.
- **D-06:** Veri çekme "Veri Çek" butonu ile manuel tetiklenir — ekleme anında otomatik çekim yok.
- **D-07:** Çekilen veri `competitors.top_pages` (JSONB) ve `competitors.category_structure` (JSONB) kolonlarında saklanır.
- **D-08:** Gap raporu içerik kategori boşluklarını gösterir — rakibin blog var, kullanıcının yok gibi.
- **D-09:** Gap raporu `/projeler/[id]/rakipler` sayfasında alt bölüm/sekme — ayrı sayfa değil.
- **D-10:** Gap tablosu: satır=kategori, sütun=her rakip + kullanıcının domain'i, hücre=✓/✗ veya sayfa sayısı.

### Claude's Discretion

- Rakip tablosunun kolon yapısı (domain, sayfa sayısı, trafik, durum, eylemler)
- "Veri Çek" butonunun loading state tasarımı
- SERP keşif dialogunun layout detayları
- DataForSEO hata handling (quota aşımı, domain bulunamadı vb.)

### Deferred Ideas (OUT OF SCOPE)

- Keyword bazlı gap analizi — Phase 5/6 keyword importu gelince
- Semrush entegrasyonu
- Otomatik rakip izleme / değişiklik bildirimi
- Rakip sayfa içerik analizi (başlık, H1, meta — tam SEO audit) — Phase 8
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-01 | Kullanıcı bir projeye manuel rakip domain ekleyebilir ve listesini görebilir | competitors tablosu mevcut; Server Action + form pattern kurallar sayfasından alınabilir |
| COMP-02 | Sistem DataForSEO ile hedef keyword'ler için SERP'ten rakipleri otomatik tespit eder | SERP Organic Live endpoint verified; domain field her organic result'ta mevcut |
| COMP-03 | Rakip başına top sayfalar, kategori yapısı ve içerik alanları görüntülenir | DataForSEO Labs Relevant Pages endpoint verified; URL pattern analizi ile kategori çıkarımı yapılabilir |
| COMP-04 | Sistem rakip analizinden boşluk ve fırsat raporu çıkarır | category_structure JSONB'den set intersection algoritması ile hesaplanabilir; client-side hesaplama yeterli |
</phase_requirements>

---

## Summary

Phase 4, mevcut Next.js 15 + Supabase + shadcn/ui stack'i üzerine DataForSEO API entegrasyonu ekler. `competitors` tablosu Phase 1'de oluşturulmuş ve tüm gerekli kolonlar mevcut (`top_pages`, `category_structure`, `content_areas`, `gap_report` JSONB kolonları dahil). Schema değişikliğine gerek yok.

İki ayrı DataForSEO endpoint kullanılır: SERP keşfi için `POST /v3/serp/google/organic/live/regular` (domain field her organic result item'da hazır), top pages çekimi için `POST /v3/dataforseo_labs/google/relevant_pages/live` (page_address + metrics.organic.etv field'ları). Her ikisi de HTTP POST, Basic Auth, JSON response formatında.

Vault pattern CONTEXT.md'de referans verilmiş (`src/lib/supabase/vault.ts`) ancak henüz codebase'de oluşturulmamış. Bu dosyanın Phase 4'te oluşturulması gerekiyor — SUPABASE_SERVICE_ROLE_KEY zaten `.env.local` içinde mevcut ve DataForSEO API key'i Supabase Vault'tan okumak için service role client gerekiyor.

**Primary recommendation:** kurallar/ sayfasını template olarak kullan — aynı 2-sütunlu layout, aynı Server Action auth guard pattern, aynı ownership check. Vault pattern'ı oluştur, DataForSEO çağrılarını ayrı lib dosyasına koy, kategori çıkarımını pure JS fonksiyonu olarak implement et.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Manuel rakip ekleme (COMP-01) | API / Backend (Server Action) | Database (Supabase) | Form → Server Action → INSERT pattern; auth + ownership check zorunlu |
| SERP keşfi (COMP-02) | API / Backend (Server Action) | External API (DataForSEO) | API key server-only; DataForSEO çağrısı client'a sızmaz |
| Top pages çekimi (COMP-03) | API / Backend (Server Action) | Database (Supabase JSONB) | "Veri Çek" tetikler → DataForSEO → competitors tablosu UPDATE |
| Kategori çıkarımı | API / Backend (Server Action içinde) | — | DataForSEO response geldiğinde server-side URL pattern analizi |
| Gap raporu hesaplama (COMP-04) | Frontend Server (SSR) | — | Supabase'den competitors okunur, category_structure JSONB'den set intersection hesaplanır, render time'da |
| Rakip listesi görüntüleme | Frontend Server (SSR) | — | Server Component; Supabase'den doğrudan okunur |
| SERP dialog UI | Browser / Client | — | 'use client' Client Component; keyword input + checkbox seçimi interaktivite gerektirir |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x (mevcut) | Server Actions, SSR | Proje stack'i — değişmez |
| Supabase | mevcut | Database, Auth | Proje stack'i — değişmez |
| shadcn/ui | mevcut | Table, Dialog, Badge, Button, Input | Phase 2-3'te kurulmuş, hepsi kullanılabilir |
| @base-ui/react | mevcut | Dialog primitive (DialogTrigger render prop pattern) | shadcn v4 bu paketi kullanıyor |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DataForSEO REST API | v3 | SERP keşfi + top pages çekimi | Her iki DataForSEO çağrısında |
| Zod | mevcut | Server Action input validasyonu | Manuel domain ekleme + SERP keyword validasyonu |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DataForSEO Labs Relevant Pages | DataForSEO SERP site: operator | site: operatörü 5x maliyet çarpanı getirir; Relevant Pages daha ekonomik ve yapılandırılmış |
| URL pattern analizi (client-side) | AI/NLP kategorizasyonu | URL pattern analizi deterministik, hızlı, sıfır maliyet; AI fazla karmaşık |

**Not:** vault.ts ve bir DataForSEO client lib dosyası bu fazda oluşturulacak yeni dosyalardır.

---

## Architecture Patterns

### System Architecture Diagram

```
Kullanıcı Tarayıcı
       │
       ├─── Manuel domain giriş ──────────────────────────────────────────────┐
       │                                                                       │
       ├─── "Rakip Keşfet" tıkla                                              │
       │         │                                                             │
       │    Dialog açılır (Client Component)                                   │
       │         │ 1-3 keyword giriş                                           │
       │         │ "Ara" tıkla                                                 │
       │         │                                                             ▼
       │         └──────────────► Server Action: discoverCompetitors()
       │                                  │
       │                          DataForSEO SERP API
       │                          POST /serp/google/organic/live/regular
       │                                  │
       │                          domain[] çıkar (deduplicate)
       │                                  │
       │                          Response: domain listesi
       │                                  │
       │    Dialog: checkbox listesi ◄────┘
       │         │ Kullanıcı seçer → "Ekle" tıkla
       │         │
       │         └──────────────► Server Action: addCompetitors()
       │                                  │
       │                          Supabase INSERT competitors
       │                          (source='serp')
       │                                  │
       └─── "Veri Çek" tıkla             │
                 │                        │
                 ▼                        ▼
       Server Action: fetchCompetitorData(competitorId)
                 │
         DataForSEO Labs API
         POST /dataforseo_labs/google/relevant_pages/live
                 │
         page_address + etv fields
                 │
         URL Pattern Analizi
         /blog/ → Blog, /urunler/ → Ürün, vb.
                 │
         Supabase UPDATE competitors SET
           top_pages = [...],
           category_structure = {...}
                 │
         revalidatePath → SSR render
                 │
Gap Raporu (SSR hesaplama):
  competitors listesi çekilir
  her competitor.category_structure okunur
  kullanıcı projesi domain'i için de aynı veri
  Set intersection → hangi kategoriler eksik
  Tablo olarak render edilir
```

### Recommended Project Structure

```
src/
├── app/(dashboard)/projeler/[id]/
│   ├── page.tsx                    # GÜNCELLENECEk — Rakipler linki eklenir sol sütuna
│   └── rakipler/
│       ├── page.tsx                # YENİ — Server Component; rakip listesi + gap tablosu
│       ├── actions.ts              # YENİ — addCompetitor, discoverCompetitors, fetchCompetitorData
│       └── CompetitorDiscoveryDialog.tsx  # YENİ — Client Component
├── lib/
│   ├── supabase/
│   │   ├── server.ts               # Mevcut — değişmez
│   │   └── vault.ts                # YENİ — DataForSEO API key okuma (service role)
│   └── dataforseo/
│       └── client.ts               # YENİ — DataForSEO HTTP çağrı fonksiyonları
└── lib/competitors/
    └── url-categories.ts           # YENİ — URL pattern → kategori çıkarım fonksiyonu
```

### Pattern 1: vault.ts — API Key Okuma

**Ne:** Supabase Vault'tan DataForSEO API key'i okuyan server-only helper.
**Ne zaman:** Her DataForSEO çağrısı yapan Server Action'da import edilir.

```typescript
// src/lib/supabase/vault.ts
// Source: Supabase Vault docs + STATE.md decision (T-03-01, T-03-03)
import 'server-only'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function getDataForSeoCredentials(): Promise<{ login: string; password: string }> {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  const { data, error } = await supabase.rpc('vault.decrypted_secrets')
  // Alternatif: vault secret adıyla doğrudan okuma
  // Supabase Vault: supabase.rpc('vault.decrypted_secrets') veya
  // supabase.from('vault.decrypted_secrets').select('*').eq('name', 'dataforseo_login')
  
  if (error || !data) throw new Error('API credentials okunamadı')
  
  const loginSecret = data.find((s: { name: string }) => s.name === 'dataforseo_login')
  const passwordSecret = data.find((s: { name: string }) => s.name === 'dataforseo_password')
  
  return {
    login: loginSecret?.decrypted_secret,
    password: passwordSecret?.decrypted_secret,
  }
}
```

**Önemli not:** Vault secret isimleri Phase 1'de `dataforseo_login` ve `dataforseo_password` olarak saklanmış olmalı. Eğer sadece tek bir API key varsa pattern buna göre uyarlanır. [ASSUMED — Phase 1 vault setup detayları doğrulanamadı]

### Pattern 2: DataForSEO SERP Endpoint — Rakip Keşfi

**Ne:** 1-3 keyword için Google Organic SERP sonuçlarından domain listesi çıkarma.
**Endpoint:** `POST https://api.dataforseo.com/v3/serp/google/organic/live/regular`

```typescript
// Source: docs.dataforseo.com/v3/serp/google/organic/live/regular
// [VERIFIED: WebFetch official docs]

type SerpTask = {
  keyword: string
  location_code: number  // 2792 = Turkey
  language_code: string  // 'tr'
  depth: number          // 10 yeterli (ilk sayfa)
}

type OrganicItem = {
  type: 'organic'
  rank_absolute: number
  domain: string
  title: string
  url: string
  description: string
}

async function fetchSerpDomains(keywords: string[]): Promise<string[]> {
  const { login, password } = await getDataForSeoCredentials()
  
  const tasks: SerpTask[] = keywords.map(kw => ({
    keyword: kw,
    location_code: 2792,  // Turkey
    language_code: 'tr',
    depth: 10,
  }))
  
  const response = await fetch(
    'https://api.dataforseo.com/v3/serp/google/organic/live/regular',
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tasks),
    }
  )
  
  const data = await response.json()
  
  // Tüm task'lardan organic item'ları topla
  const domains = new Set<string>()
  for (const task of data.tasks ?? []) {
    for (const result of task.result ?? []) {
      for (const item of result.items ?? []) {
        if (item.type === 'organic' && item.domain) {
          // www. prefix'ini normalize et
          domains.add(item.domain.replace(/^www\./, ''))
        }
      }
    }
  }
  
  return Array.from(domains)
}
```

**Maliyet:** ~$0.003 per task × keyword sayısı (1-3 keyword = $0.003–$0.009 per keşif)
[VERIFIED: WebFetch official docs — $0.003 per task for 10 results]

### Pattern 3: DataForSEO Labs Relevant Pages — Top Pages

**Ne:** Rakip domain'in top organik sayfalarını çekme.
**Endpoint:** `POST https://api.dataforseo.com/v3/dataforseo_labs/google/relevant_pages/live`

```typescript
// Source: docs.dataforseo.com/v3/dataforseo_labs/google/relevant_pages/live
// [VERIFIED: WebFetch official docs]

type TopPageItem = {
  se_type: string
  page_address: string
  metrics: {
    organic: {
      etv: number        // Tahmini aylık organik trafik
      count: number      // Kaç keyword'de sıralanıyor
      pos_1: number
      pos_2_3: number
      pos_4_10: number
    }
  }
}

async function fetchTopPages(domain: string): Promise<TopPageItem[]> {
  const { login, password } = await getDataForSeoCredentials()
  
  const response = await fetch(
    'https://api.dataforseo.com/v3/dataforseo_labs/google/relevant_pages/live',
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        target: domain.replace(/^https?:\/\//, '').replace(/^www\./, ''),
        location_code: 2792,  // Turkey
        language_code: 'tr',
        limit: 10,  // Top 10 sayfa (D-05 kararı)
        order_by: [['metrics.organic.etv', 'desc']],
      }]),
    }
  )
  
  const data = await response.json()
  return data.tasks?.[0]?.result?.[0]?.items ?? []
}
```

**Maliyet:** ~$0.0103–$0.0105 per request [VERIFIED: WebFetch + WebSearch]
**Not:** `page_address` field URL, `metrics.organic.etv` aylık trafik tahmini. Title bilgisi bu endpoint'te gelmiyor — URL'den çıkarılabilir veya boş bırakılabilir.

### Pattern 4: URL Pattern → Kategori Çıkarımı

**Ne:** Top pages URL'lerinden içerik kategorisi çıkaran pure function.
**Ne zaman:** `fetchTopPages` sonrası server-side çalışır, result'ı `category_structure` JSONB'ye yazar.

```typescript
// src/lib/competitors/url-categories.ts
// Source: [ASSUMED] — URL pattern analizi için standart bir kütüphane yok, custom logic

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\/blog\//i,              category: 'Blog' },
  { pattern: /\/urunler?\//i,          category: 'Ürün Sayfaları' },
  { pattern: /\/hizmetler?\//i,        category: 'Hizmetler' },
  { pattern: /\/kategori\//i,          category: 'Kategori Sayfaları' },
  { pattern: /\/products?\//i,         category: 'Ürün Sayfaları' },
  { pattern: /\/services?\//i,         category: 'Hizmetler' },
  { pattern: /\/category\//i,          category: 'Kategori Sayfaları' },
  { pattern: /\/shop\//i,              category: 'Mağaza' },
  { pattern: /\/news\//i,              category: 'Haberler' },
  { pattern: /\/about\//i,             category: 'Hakkında' },
  { pattern: /\/hakkimizda\//i,        category: 'Hakkında' },
  { pattern: /\/iletisim\//i,          category: 'İletişim' },
  { pattern: /\/contact\//i,           category: 'İletişim' },
  { pattern: /\/fiyat\//i,             category: 'Fiyatlandırma' },
  { pattern: /\/pricing\//i,           category: 'Fiyatlandırma' },
]

type CategoryStructure = {
  [category: string]: {
    pageCount: number
    sampleUrls: string[]
    totalEtv: number
  }
}

export function extractCategories(pages: TopPageItem[]): CategoryStructure {
  const result: CategoryStructure = {}
  
  for (const page of pages) {
    let matched = false
    for (const { pattern, category } of CATEGORY_PATTERNS) {
      if (pattern.test(page.page_address)) {
        if (!result[category]) {
          result[category] = { pageCount: 0, sampleUrls: [], totalEtv: 0 }
        }
        result[category].pageCount++
        result[category].totalEtv += page.metrics?.organic?.etv ?? 0
        if (result[category].sampleUrls.length < 3) {
          result[category].sampleUrls.push(page.page_address)
        }
        matched = true
        break
      }
    }
    if (!matched) {
      // Ana sayfa veya tanımsız — "Diğer" kategorisine
      if (!result['Diğer']) {
        result['Diğer'] = { pageCount: 0, sampleUrls: [], totalEtv: 0 }
      }
      result['Diğer'].pageCount++
    }
  }
  
  return result
}
```

### Pattern 5: Gap Raporu Algoritması

**Ne:** Tüm rakiplerin category_structure JSONB'lerinden set union alınır; kullanıcı domain'inin yoksa "eksik" işaretlenir.
**Ne zaman:** SSR'da (page.tsx içinde) rakipler yüklendikten sonra.

```typescript
// page.tsx içinde — client hesaplama değil, SSR
// Source: [ASSUMED] — standart set intersection logic

type GapReport = {
  categories: string[]
  matrix: {
    [domain: string]: {
      [category: string]: { exists: boolean; pageCount: number }
    }
  }
}

function buildGapReport(
  competitors: Array<{ domain: string; category_structure: CategoryStructure | null }>,
  userDomain: string,
  userCategoryStructure: CategoryStructure | null
): GapReport {
  // Tüm kategorilerin union'ı
  const allCategories = new Set<string>()
  
  for (const comp of competitors) {
    if (comp.category_structure) {
      Object.keys(comp.category_structure).forEach(cat => allCategories.add(cat))
    }
  }
  if (userCategoryStructure) {
    Object.keys(userCategoryStructure).forEach(cat => allCategories.add(cat))
  }
  
  const categories = Array.from(allCategories).filter(c => c !== 'Diğer')
  
  const matrix: GapReport['matrix'] = {}
  
  // Rakipler
  for (const comp of competitors) {
    matrix[comp.domain] = {}
    for (const cat of categories) {
      const catData = comp.category_structure?.[cat]
      matrix[comp.domain][cat] = {
        exists: !!catData,
        pageCount: catData?.pageCount ?? 0,
      }
    }
  }
  
  // Kullanıcı domain'i
  matrix[userDomain] = {}
  for (const cat of categories) {
    const catData = userCategoryStructure?.[cat]
    matrix[userDomain][cat] = {
      exists: !!catData,
      pageCount: catData?.pageCount ?? 0,
    }
  }
  
  return { categories, matrix }
}
```

### Anti-Patterns to Avoid

- **Client-side DataForSEO çağrısı:** API key browser'a sızmaz — tüm DataForSEO fetch'leri Server Action içinde yapılmalı.
- **Ekleme anında otomatik veri çekimi:** D-06 kararı — "Veri Çek" butonu kullanıcı tetikler, ekleme'de otomatik çekim yok.
- **SERP site: operatörü kullanımı:** 5x maliyet çarpanı — relevant_pages endpoint daha ekonomik.
- **category_structure'ı yokken gap raporu render etme:** Null check zorunlu — "Veri Çek" yapılmamış rakipler için veri yok durumu handle edilmeli.
- **Dialog'u Server Component olarak yazmak:** SERP dialog interaktivite gerektirir — 'use client' Client Component olmalı.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Competitor domain deduplication | Custom string karşılaştırması | JS `Set<string>` + normalize (www. strip) | Basit ve yeterli; regex overkill |
| DataForSEO auth | OAuth, token refresh | HTTP Basic Auth | DataForSEO sadece Basic Auth kullanır [VERIFIED] |
| Category classification | NLP/AI model | URL pattern regex | Deterministik, sıfır maliyet, test edilebilir |
| Top pages caching | Custom TTL cache | `updated_at` timestamp + "Veri Çek" kullanıcı tetikler | Human-triggered model zaten caching sorunu yaratmıyor |

**Key insight:** DataForSEO'nun kendi response formatı yeterince yapılandırılmış — ayrıca bir parsing/normalization katmanı oluşturmak yerine doğrudan JSONB'e yazmak ve gerektiğinde okumak yeterli.

---

## Supabase Schema — Mevcut Durum

`competitors` tablosu Phase 1'de oluşturulmuş [VERIFIED: migration dosyası okundu]:

```sql
CREATE TABLE public.competitors (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id          UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  domain              TEXT NOT NULL,
  source              TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'serp'
  top_pages           JSONB,
  category_structure  JSONB,
  content_areas       JSONB,
  gap_report          JSONB,
  created_at          TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- Index'ler: idx_competitors_project_id, idx_competitors_user_id — mevcut
```

**Önemli:** Schema migration'a gerek yok. `source` kolonu 'manual' veya 'serp' değerini saklayacak. `gap_report` JSONB kolonu mevcut ama planner alternatif olarak SSR'da hesaplamayı tercih edebilir (persist etmeden).

**RLS:** `supabase/migrations/20260422000002_rls_policies.sql` — competitors tablosu için RLS policy mevcut.

---

## Vault Pattern — Kritik Bulgu

`src/lib/supabase/vault.ts` dosyası **henüz oluşturulmamış** [VERIFIED: codebase'de dosya bulunamadı]. CONTEXT.md'de "Phase 1'de hazır" olarak referans verilmiş ancak pratikte yoktur.

Bu dosyanın Phase 4 Wave 0'ında oluşturulması gerekiyor. Pattern:

```typescript
// src/lib/supabase/vault.ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Service role client — anon key değil, service role key kullanılır
// Vault read için gerekli
```

Alternatif: Eğer DataForSEO credentials Vault'ta değil de doğrudan environment variable olarak saklandıysa (`.env.local`), vault helper gerekmeyebilir ve `process.env.DATAFORSEO_LOGIN` / `process.env.DATAFORSEO_PASSWORD` doğrudan kullanılabilir. INFR-03 "Supabase secrets" olarak belirtmiş ancak implementation Phase 1'de tamamlanmamış olabilir. **Planner bu konuyu Wave 0'da netleştirmeli.**

---

## Common Pitfalls

### Pitfall 1: DataForSEO Relevant Pages — Title Yok

**Ne oluyor:** `relevant_pages` endpoint'i `page_address` ve `metrics` döndürür — sayfa title'ı dönmez.
**Neden:** Endpoint sayfa içeriğini analiz etmez, sadece ranking verisi verir.
**Nasıl önlenir:** D-05'te "URL + başlık + tahmini aylık trafik" denmiş ancak title bu endpoint'ten gelmez. Top pages'i URL ve ETV ile sakla, title'ı URL'den parse et (son segment) veya boş bırak.
**Uyarı işareti:** top_pages JSONB'de title field'ı null göründüğünde.

### Pitfall 2: SERP Endpoint — Türkçe Lokasyon

**Ne oluyor:** `location_code` 2840 (US) varsayılan — Türkiye için farklı.
**Neden:** DataForSEO örnekleri US kodu kullanıyor.
**Nasıl önlenir:** `location_code: 2792` (Turkey) kullan. `language_code: 'tr'` ekle.
**Uyarı işareti:** SERP sonuçları Türk domain'i yerine uluslararası domain'ler döndürüyorsa.

### Pitfall 3: www. Normalizasyonu

**Ne oluyor:** SERP endpoint domain field'ında bazen `www.example.com`, bazen `example.com` döner. Supabase'de duplicate oluşur.
**Neden:** DataForSEO domain field normalize etmiyor.
**Nasıl önlenir:** INSERT öncesi `domain.replace(/^www\./, '')` uygula. SERP keşifde de aynı normalzasyon.
**Uyarı işareti:** Aynı domain hem www. hem de www.siz olarak listede görünüyorsa.

### Pitfall 4: vault.ts Yokluğu

**Ne oluyor:** CONTEXT.md vault.ts'i mevcut gibi referans veriyor ama dosya yok.
**Neden:** Phase 1 plan'ı vault'u oluşturmayı öngörmüş olabilir ancak implement edilmemiş.
**Nasıl önlenir:** Wave 0'da vault.ts oluştur VEYA DataForSEO credentials'ı doğrudan env var olarak kullan.
**Uyarı işareti:** Server Action'da import etmeye çalışınca "module not found".

### Pitfall 5: Gap Raporu — Veri Yokken Render

**Ne oluyor:** Rakip eklendi ama "Veri Çek" yapılmadı → `category_structure` null → gap tablosu hata veriyor.
**Neden:** Null JSONB'yi iterate etmeye çalışmak.
**Nasıl önlenir:** Gap raporu bölümünde en az bir rakibin `category_structure` dolu olduğunu kontrol et, yoksa "Veri çekmek için her rakip için 'Veri Çek' butonuna basın" mesajı göster.

### Pitfall 6: DialogTrigger Pattern

**Ne oluyor:** shadcn v4 `@base-ui/react` kullanıyor — `asChild` prop yok, `render prop` pattern var.
**Neden:** STATE.md'de kayıt var: "DialogTrigger render prop — @base-ui/react asChild desteklemiyor".
**Nasıl önlenir:** `<DialogTrigger render={<Button>...</Button>}>` pattern'ını kullan.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| DataForSEO API key | COMP-02, COMP-03 | [ASSUMED: mevcut] | — | Yoksa test mode'da mock data |
| SUPABASE_SERVICE_ROLE_KEY | vault.ts | ✓ | — (.env.local'da) | — |
| Supabase competitors table | COMP-01 | ✓ | — (Phase 1'de oluşturuldu) | — |
| shadcn Dialog | COMP-02 (SERP keşif dialog) | ✓ | — (Phase 2'de kuruldu) | — |
| shadcn Table | Tüm listeler | ✓ | — (Phase 2'de kuruldu) | — |

**Missing dependencies with no fallback:**
- DataForSEO credentials — Supabase Vault'ta kayıtlı olduğu varsayılıyor; planner Wave 0'da doğrulamalı.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Mevcut proje'de test framework tespit edilmedi |
| Config file | Yok |
| Quick run command | Yok (Wave 0'da kurulacak veya skip) |
| Full suite command | Yok |

**Not:** Proje Phase 1-3 boyunca test infrastructure kurmamış. nyquist_validation: true olmasına rağmen test altyapısı mevcut değil.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-01 | Manuel rakip ekleme Server Action — auth guard, ownership check, duplicate handle | unit | Yok | ❌ Wave 0 |
| COMP-02 | SERP keşfi — keyword input → domain listesi döner | integration | Yok (DataForSEO mock gerekir) | ❌ Wave 0 |
| COMP-03 | Top pages fetch → JSONB kayıt | integration | Yok | ❌ Wave 0 |
| COMP-04 | Gap raporu hesaplama — set intersection logic | unit | Yok | ❌ Wave 0 |

### Wave 0 Gaps

- `url-categories.ts` için unit test — `extractCategories()` fonksiyonu deterministik, test edilebilir
- `buildGapReport()` için unit test — pure function, mock data ile test edilebilir
- DataForSEO entegrasyonu için test: gerçek API çağrısı pahalı → mock/stub tercih edilmeli

**Gerçekçi değerlendirme:** Proje pattern'ı manual testing üzerine kurulu (Phase 1-3'te test yok). Planner nyquist_validation için en azından iki pure function'a (url-categories, gap-report) unit test ekleyebilir — bunlar external dependency gerektirmiyor.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `supabase.auth.getUser()` — Server Action başında zorunlu |
| V4 Access Control | yes | `.eq('project_id', id).eq('user_id', user.id)` ownership check — kurallar sayfası pattern |
| V5 Input Validation | yes | Zod — domain format, keyword length (1-3 keywords, max 700 chars) |
| V6 Cryptography | no | DataForSEO Basic Auth — HTTPS üzerinden, key client'a sızmıyor |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Başka kullanıcının rakiplerini görmek/silmek | Information Disclosure / Tampering | Ownership check: `project_id + user_id` double filter (kurallar pattern'ından alınmış) |
| DataForSEO API key'i browser'da ifşa | Information Disclosure | vault.ts server-only import + 'use server' Server Action — key hiçbir zaman client bundle'a girmez |
| Domain injection (SQL/script injection) | Tampering | Zod domain validation (URL format) + Supabase parameterized queries |
| SERP keşifde aşırı API çağrısı | Denial of Service | Rate limit: kullanıcı başına keyword input 1-3 ile sınırlı; human-triggered (D-04) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DataForSEO credentials Supabase Vault'ta `dataforseo_login` ve `dataforseo_password` adlarıyla kayıtlı | vault.ts pattern | vault.ts oluşturulamaz; env var alternatifine geçilmeli |
| A2 | DataForSEO API hesabı aktif ve Phase 4 başlamadan önce kullanılabilir durumda | Environment Availability | COMP-02 ve COMP-03 tamamen bloke olur |
| A3 | `location_code: 2792` Turkey için doğru DataForSEO location code | SERP pattern | Yanlış ülke SERP verisi — yerel rakipler gelmez |
| A4 | relevant_pages endpoint top 10 sayfayı `limit: 10` ile döndürür | Top pages pattern | Limit farklıysa veya endpoint davranışı değiştiyse sonuç kümesi farklılaşır |

---

## Open Questions

1. **DataForSEO Vault Setup**
   - Bilinen: SUPABASE_SERVICE_ROLE_KEY `.env.local`'da mevcut
   - Belirsiz: DataForSEO login/password Vault'ta mı yoksa env var olarak mı saklandı?
   - Öneri: Planner Wave 0'da `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` env var olarak da desteklesin (Vault yoksa fallback)

2. **relevant_pages endpoint — lokasyon bağımsızlığı**
   - Bilinen: endpoint `location_code` ve `language_code` alıyor
   - Belirsiz: Türk domain'leri için Türkiye lokasyonu mu, global mi daha iyi sonuç veriyor?
   - Öneri: Turkey (2792) başlat, kullanıcı eğer global rakip ekliyorsa location parametresi proje ayarlarından çekilebilir (project.target_country)

3. **Gap raporu — kullanıcı domain'inin kendi sayfaları**
   - Bilinen: D-10'da kullanıcının domain'i de sütun olarak gösterilecek
   - Belirsiz: Kullanıcının domain'i için top_pages nasıl çekilecek? Ayrı bir "Kendi Domain'ini Analiz Et" butonu mu gerekiyor?
   - Öneri: Kullanıcının domain'ini de `competitors` tablosuna `source='self'` ile ekle; aynı "Veri Çek" flow'u çalışır

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Semrush entegrasyonu | DataForSEO yeterli (bu fazda) | Phase 4 discuss | Daha ucuz, tek API ile yönetim |
| Ekleme anında otomatik veri çekme | Human-triggered "Veri Çek" | Phase 4 discuss | Kullanıcı API maliyetini kontrol eder |

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/20260422000001_create_tables.sql` — competitors tablosu schema verified
- `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx` — 2-sütunlu layout ve auth pattern verified
- `src/app/(dashboard)/projeler/[id]/kurallar/actions.ts` — Server Action auth guard + ownership check pattern verified
- `src/app/(dashboard)/projeler/[id]/page.tsx` — Sol sütun nav pattern verified
- DataForSEO SERP docs (WebFetch) — endpoint URL, request format, response fields verified
- DataForSEO Labs Relevant Pages docs (WebFetch) — endpoint URL, response fields verified

### Secondary (MEDIUM confidence)
- WebSearch + WebFetch cross-verify: relevant_pages maliyet ~$0.0103-0.0105 per call
- WebSearch: SERP organic endpoint maliyet $0.003 per task

### Tertiary (LOW confidence)
- location_code: 2792 for Turkey — [ASSUMED] training knowledge, doğrulanmadı
- vault.ts implementation pattern — [ASSUMED] Supabase Vault RPC interface detayları

---

## Metadata

**Confidence breakdown:**
- Supabase schema: HIGH — migration dosyası doğrudan okundu
- Codebase patterns: HIGH — 3 kaynak dosya okundu, pattern'lar verified
- DataForSEO SERP endpoint: HIGH — official docs WebFetch ile verified
- DataForSEO Relevant Pages endpoint: HIGH — official docs WebFetch ile verified
- DataForSEO maliyetler: MEDIUM — docs örnek değerler, exact pricing sayfası okunamadı
- vault.ts implementation: LOW-MEDIUM — dosya mevcut değil, pattern assumed
- URL kategori pattern'ları: MEDIUM — Türkçe URL segment'leri assumed, evrensel pattern'lar HIGH

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (DataForSEO API endpoint'leri stabil, 30 gün geçerli)
