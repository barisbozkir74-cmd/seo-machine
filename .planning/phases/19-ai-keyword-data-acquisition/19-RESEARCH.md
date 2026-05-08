# Phase 19: AI Keyword Data Acquisition - Research

**Araştırma tarihi:** 2026-05-08
**Domain:** DataForSEO entegrasyonu, keyword veri akışı, birleşik kaynak havuzu
**Güven seviyesi:** HIGH

---

## Özet

Bu faz, projenin rakiplerinin sıralandığı keywordleri DataForSEO `ranked_keywords/live` endpoint'i üzerinden otomatik çekip mevcut `keywords` tablosuna yazarken; var olan CSV/paste import akışını bozmadan her iki kaynağın `source` sütunu ile ayrıştırılabilir bir birleşik keyword havuzu oluşturur.

Kod tabanı incelemesi üç kritik gerçeği ortaya çıkardı: (1) `fetchRankedKeywords()` fonksiyonu `src/lib/dataforseo/client.ts`'de zaten mevcut — Phase 4 Competitor Intelligence tarafından yazılmış, yeniden kullanılabilir. (2) `keywords` tablosundaki `source` sütunu halihazırda `'manual'` değerini taşıyor; yeni değerler (`'competitor'`, `'expansion'`) şemayı bozmadan eklenebilir. (3) Var olan `importKeywords` server action'ı `source: 'manual'` hard-code ile çalışıyor ve dokunulmayacak.

**Temel öneri:** Yeni bir `src/lib/keywords/ai-acquisition.ts` servis katmanı oluştur, yeni bir `/api/keywords/acquire` API route'u ekle ve keyword-stratejisi sayfasına "AI ile Keyword Çek" butonu yerleştir. DB şemasında `source` için yeni değer kısıtlaması dışında migrasyon gerekmez.

---

## Mimari Sorumluluk Haritası

| Yetenek | Birincil Katman | İkincil Katman | Gerekçe |
|---------|----------------|----------------|---------|
| Rakip keyword çekme (DataForSEO) | API / Backend | — | Kimlik bilgileri sunucu tarafında vault'ta |
| Keyword genişletme (related keywords) | API / Backend | — | DataForSEO API çağrısı server-only |
| Birleşik havuz oluşturma / upsert | API / Backend | Database | Duplicate kontrolü DB unique constraint ile |
| Kaynak etiketleme (CSV vs rakip vs genişletme) | Database | — | `source` sütunu DB katmanında taşınır |
| "AI ile Keyword Çek" tetik UI | Browser / Client | Frontend Server (RSC) | Kullanıcı butona basar, sonuç RSC ile gösterilir |
| Keyword listesi görüntüleme | Frontend Server (SSR) | Browser | Mevcut keyword-stratejisi/page.tsx pattern'i korunur |

---

<phase_requirements>
## Faz Gereksinimleri

| ID | Açıklama | Araştırma Desteği |
|----|----------|------------------|
| KWST-01 | Proje rakiplerinin kullandığı keywordler DataForSEO ile otomatik çekilir | `fetchRankedKeywords()` zaten mevcut; `competitors` tablosundaki her domain için çağrılır |
| KWST-02 | Ana keywordler + rakip keywordler + ilişkili genişletmelerden birleşik keyword havuzu oluşturulur | `keywords.source` sütunu `'competitor'` / `'expansion'` değerleri destekleyecek; upsert `onConflict: 'project_id,keyword'` ile duplicate önlenir |
| KWST-05 | Mevcut CSV import akışı korunur ve AI keyword akışıyla birlikte çalışır | `importKeywords` server action'ına dokunulmaz; yeni endpoint paralel çalışır; `source` sütunu ile ayrışım sağlanır |
</phase_requirements>

---

## Standart Yığın

### Mevcut (Yeniden Kullanılacak)
| Kütüphane / Modül | Versiyon | Amaç | Neden Tercih |
|-------------------|---------|------|-------------|
| `src/lib/dataforseo/client.ts` | — | `fetchRankedKeywords()` ve `fetchKeywordData()` | Zaten var, test edilmiş [VERIFIED: codebase grep] |
| `src/lib/supabase/vault.ts` | — | `getDataForSeoCredentials()` | Yerleşik env var / vault pattern [VERIFIED: codebase grep] |
| `src/lib/dataforseo/location-map.ts` | — | `resolveLocation()` | Ülke/dil çözümlemesi için [VERIFIED: codebase grep] |
| Supabase `keywords` tablosu | — | Birleşik keyword havuzu | `source` + `onConflict: 'project_id,keyword'` ile duplicate önleme [VERIFIED: schema] |
| `src/lib/keywords/clustering.ts` | — | `clusterKeywords()` | Çekilen keywordler de cluster'lanabilir (Phase 20 için hazırlık) [VERIFIED: codebase grep] |

### Yeni Eklenecek
| Modül | Amaç | Pattern |
|-------|------|---------|
| `src/lib/keywords/ai-acquisition.ts` | Rakip keyword çekme + genişletme servisi | `sector-research.ts` pattern'i |
| `src/app/api/keywords/acquire/route.ts` | POST API route — acquisition pipeline | `/api/research/trigger/route.ts` pattern'i |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/AiAcquireButton.tsx` | "AI ile Keyword Çek" client bileşeni | `ClusterButton.tsx` pattern'i |

### DataForSEO Endpointleri (Bu Fazda Kullanılacak)
| Endpoint | Zaten Mevcut? | Amaç |
|----------|--------------|------|
| `dataforseo_labs/google/ranked_keywords/live` | Evet (`fetchRankedKeywords`) | Rakip domain'lerin sıralandığı keywordler |
| `keywords_data/google_ads/search_volume/live` | Evet (`fetchKeywordData`) | Çekilen keywordlerin volume/KD/CPC zenginleştirme |
| `dataforseo_labs/google/related_keywords/live` | Hayır — yeni fonksiyon gerekir | Genişletme keywordleri (KWST-02) |

**Kurulum gerekmez** — tüm bağımlılıklar zaten `package.json`'da mevcut.

---

## Mimari Desenler

### Sistem Veri Akışı

```
Kullanıcı: "AI ile Keyword Çek" butona basar
         |
         v
AiAcquireButton (client component)
  → fetch POST /api/keywords/acquire { projectId, userId }
         |
         v
/api/keywords/acquire route.ts
  [1] IDOR: project ownership check (serviceClient)
  [2] competitors tablosundan domain listesi çek
  [3] Proje target_country / target_language → resolveLocation()
         |
         v
ai-acquisition.ts: fetchCompetitorKeywords()
  [4] Her rakip domain için fetchRankedKeywords(domain, credentials, limit=50, location)
      → RankedKeywordItem[] (keyword, position, search_volume, cpc)
  [5] fetchRelatedKeywords(seedKeywords, credentials, location)
      → ilişkili genişletme keywordleri
         |
         v
ai-acquisition.ts: upsertKeywordPool()
  [6] Tüm keywordleri keywords tablosuna upsert
      source='competitor' veya source='expansion'
      onConflict: 'project_id,keyword' → mevcut 'manual' kayıtlar korunur
  [7] Yeni eklenenler için fetchKeywordData() ile volume/KD/CPC zenginleştirme
         |
         v
Route response: { success: true, competitorCount, expansionCount, totalAdded }
         |
         v
AiAcquireButton: success → revalidatePath → keyword listesi güncellenir
```

### Önerilen Proje Yapısı (Yeni Dosyalar)
```
src/
├── lib/
│   └── keywords/
│       └── ai-acquisition.ts     # Yeni: acquisition servisi
├── app/
│   ├── api/
│   │   └── keywords/
│   │       └── acquire/
│   │           └── route.ts      # Yeni: POST API route
│   └── (dashboard)/projeler/[id]/keyword-stratejisi/
│       └── AiAcquireButton.tsx   # Yeni: trigger UI
```

### Desen 1: Rakip Keyword Çekme
```typescript
// Source: src/lib/dataforseo/client.ts — fetchRankedKeywords [VERIFIED: codebase]
// Her rakip için ayrı çağrı; paralel değil sıralı (rate limit riski)
for (const competitor of competitors) {
  const keywords = await fetchRankedKeywords(
    competitor.domain,
    credentials,
    50,  // limit: top 50 ranked keyword
    location
  )
  // keyword → source: 'competitor'
}
```

### Desen 2: İlişkili Keyword Genişletme
```typescript
// DataForSEO related_keywords endpoint — yeni fonksiyon gerekir
// [ASSUMED] API yapısı fetchRankedKeywords ile benzer
POST https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live
Body: [{ keyword: seedKeyword, location_code, language_code, limit: 20, depth: 1 }]
// Her item için source: 'expansion'
```

### Desen 3: Upsert ile Kaynak Koruma
```typescript
// Source: mevcut importKeywords pattern [VERIFIED: codebase]
await supabase.from('keywords').upsert(
  keywordRows,
  { onConflict: 'project_id,keyword', ignoreDuplicates: true }
  // ignoreDuplicates: true → manual kayıtlar ezilmez
)
```

**Kritik:** `ignoreDuplicates: true` kullanılmalı (mevcut `importKeywords`'daki `false`'tan farklı). Gerekçe: CSV ile manuel eklenen keyword zaten `source: 'manual'`; rakip verisi geldiğinde kaynağı değiştirmemek gerekir.

### Anti-Desenler
- **Her rakip için paralel API çağrısı:** Rate limit ihlali — Phase 18'deki `sector-research.ts` sıralı çağrı pattern'ini izle
- **Source sütununa `null` yazma:** `keywords.source` `NOT NULL DEFAULT 'manual'` — her yeni satır için açık `source` değeri set et
- **`ignoreDuplicates: false` ile upsert:** Manual keyword'lerin `source`'unu `competitor`'a çevirir; veri bütünlüğü bozulur

---

## El Yazmaması Gerekenler (Don't Hand-Roll)

| Problem | El Yapımı | Kullan | Neden |
|---------|-----------|--------|-------|
| Rakip ranked keyword verisi | Custom scraper | `fetchRankedKeywords()` in `client.ts` | Zaten var, test edilmiş |
| Volume / KD / CPC zenginleştirme | Custom hesaplama | `fetchKeywordData()` in `client.ts` | Zaten var, import akışında kullanıyor |
| Ülke/dil çözümleme | Hard-code | `resolveLocation()` in `location-map.ts` | Tüm ülke/dil kapsama dahil |
| DB duplicate kontrolü | Manual sorgu | `onConflict: 'project_id,keyword'` + `ignoreDuplicates: true` | Unique constraint zaten var (Migration 20260423000005) |
| DataForSEO credential yönetimi | Direkt env var okuma | `getDataForSeoCredentials()` | Vault fallback zaten var |

---

## Yaygın Tuzaklar

### Tuzak 1: ignoreDuplicates Seçimi
**Ne olur:** `ignoreDuplicates: false` kullanılırsa manual kayıtların `source` değeri `'competitor'`'a güncellenir.
**Neden olur:** Mevcut `importKeywords`'de `false` seçilmiş çünkü DataForSEO volume verisi manual girişin üzerine yazması isteniyor. Keyword acquisition'da bu davranış istenmez.
**Nasıl önlenir:** Yeni `upsertKeywordPool()` fonksiyonunda `ignoreDuplicates: true` kullan; kaynağı değiştirme, sadece eksik olanları ekle.
**Erken işaret:** Keyword listesinde manual kayıtların `source` değeri değişiyorsa.

### Tuzak 2: Rakip Limiti Yönetimi
**Ne olur:** Bir projede 10+ rakip varsa DataForSEO'ya 10+ ranked_keywords çağrısı gider; her biri yaklaşık 2 saniye.
**Neden olur:** Sıralı çağrı birikerek timeout'a yol açar.
**Nasıl önlenir:** Acquisition başlangıcında rakip sayısını cap'le (örn. max 5); seçilmemiş rakipleri skip et. Phase 18'deki `queries.slice(0, 7)` pattern'ini izle.
**Erken işaret:** `/api/keywords/acquire` route'u 60s'yi aşarsa.

### Tuzak 3: Genişletme keyword sayısı patlaması
**Ne olur:** 10 seed keyword × depth=2 related_keywords → yüzlerce keyword; DB'ye toplu yazım yavaşlar.
**Neden olur:** DataForSEO `related_keywords` `depth` parametresi üstel büyür.
**Nasıl önlenir:** `depth: 1` ve `limit: 20` per seed ile başla; Phase 19 kapsamında genişletme küçük tutulur (20-50 keyword hedefi).
**Erken işaret:** `expansion` source ile 200+ keyword eklenmesi.

### Tuzak 4: `source` sütunu string serbest bırakılması
**Ne olur:** Gelecekte birinin `source: 'ai-v2'` gibi değer yazması ve keyword listesi UI'ının bozulması.
**Neden olur:** `keywords.source` kolonunda DB-level CHECK constraint yok.
**Nasıl önlenir:** Migrasyon ile `CHECK (source IN ('manual', 'competitor', 'expansion'))` ekle.
**Erken işaret:** `source` değerlerinin `SELECT DISTINCT` ile farklılık göstermesi.

### Tuzak 5: Acquisition sonrası UI güncelleme
**Ne olur:** API route başarıyla dönse bile sayfada yeni keywordler görünmez.
**Neden olur:** Next.js RSC sayfası cache'de kalmış.
**Nasıl önlenir:** API route içinde `revalidatePath` çağrısı (server action değil route olduğu için `revalidatePath` çalışmaz — istemci tarafından `router.refresh()` çağırılmalı) veya buton `startTransition` + `router.refresh()` içermeli.
**Erken işaret:** API 200 döndü ama liste aynı.

---

## Kod Örnekleri

### Rakip Keyword Çekme (Mevcut Fonksiyon)
```typescript
// Source: src/lib/dataforseo/client.ts [VERIFIED: codebase]
const items = await fetchRankedKeywords(
  'rakip.com',
  credentials,
  50,  // limit
  { locationCode: 2792, languageCode: 'tr' }
)
// Her item: { keyword, location_code, ranked_serp_element, keyword_data }
// keyword_data.keyword_info.search_volume, cpc
// ranked_serp_element.serp_item.rank_absolute → pozisyon
```

### Upsert Pattern (Kaynak Koruyarak)
```typescript
// Source: importKeywords pattern'inden türetilmiş [VERIFIED: codebase]
await supabase.from('keywords').upsert(
  rows.map(kw => ({
    user_id,
    project_id,
    keyword: kw.keyword,
    volume: kw.search_volume ?? null,
    cpc: kw.cpc ?? null,
    source: 'competitor' as const,  // veya 'expansion'
  })),
  { onConflict: 'project_id,keyword', ignoreDuplicates: true }
  // ignoreDuplicates: true → manual kayıtları korur
)
```

### API Route Pattern (Phase 18'den)
```typescript
// Source: src/app/api/research/trigger/route.ts [VERIFIED: codebase]
export async function POST(request: NextRequest) {
  const { projectId, userId } = await request.json()
  // IDOR: ownership check
  const { data: project } = await serviceClient
    .from('projects')
    .select('id, ...')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // ... pipeline
}
```

### AiAcquireButton Pattern (ClusterButton'dan)
```typescript
// Source: src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterButton.tsx [VERIFIED: codebase]
'use client'
export function AiAcquireButton({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleAcquire = () => {
    startTransition(async () => {
      const res = await fetch('/api/keywords/acquire', {
        method: 'POST',
        body: JSON.stringify({ projectId }),
      })
      if (res.ok) {
        router.refresh()  // Tuzak 5: router.refresh() gerekli
      }
    })
  }
}
```

---

## Veritabanı Şeması (Mevcut + Gerekli Değişiklikler)

### Mevcut keywords tablosu
```sql
-- [VERIFIED: supabase/migrations/20260422000001_create_tables.sql]
CREATE TABLE public.keywords (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID NOT NULL,
  project_id        UUID NOT NULL,
  keyword           TEXT NOT NULL,
  volume            INTEGER,
  cpc               NUMERIC(10, 2),
  difficulty        INTEGER,
  search_intent     TEXT,
  opportunity_score NUMERIC(5, 2),
  source            TEXT NOT NULL DEFAULT 'manual',  -- 'manual' zaten var
  enriched_at       TIMESTAMPTZ,
  cluster_id        UUID,
  ...
);
-- Unique constraint: [VERIFIED: migration 20260423000005]
UNIQUE (project_id, keyword)
```

### Gerekli Migrasyon
```sql
-- Yeni: source sütununa CHECK constraint ekle
-- Phase 19 yeni değerler: 'competitor', 'expansion'
ALTER TABLE public.keywords
  DROP CONSTRAINT IF EXISTS keywords_source_check,
  ADD CONSTRAINT keywords_source_check
    CHECK (source IN ('manual', 'competitor', 'expansion'));
```

**Not:** `cluster_id` kolonu yeni keywordlerde başlangıçta `NULL` olacak — Phase 20 (AI Keyword Clustering) bu null olanları cluster'layacak. Bu doğru davranış.

---

## Kaynak Ayırt Edilebilirlik (KWST-02 / Kullanıcı Success Criteria #4)

`source` sütunu değerleri:
| Değer | Anlam | Kim Yazar |
|-------|-------|-----------|
| `'manual'` | CSV/paste import | `importKeywords` server action (dokunulmaz) |
| `'competitor'` | DataForSEO ranked_keywords ile rakipten çekildi | `ai-acquisition.ts` |
| `'expansion'` | DataForSEO related_keywords ile genişletme | `ai-acquisition.ts` |

UI'da badge/label ile gösterilebilir. Mevcut `keyword-stratejisi/page.tsx` flat table'ında yeni sütun veya badge eklenmeli (Phase 19 success criteria #4 gereği).

---

## Enviro Kullanılabilirliği

| Bağımlılık | Zorunlu Olan | Mevcut | Versiyon | Fallback |
|------------|-------------|--------|---------|---------|
| DataForSEO credentials | KWST-01 | Evet | — | Yok (phase bloklayıcı) |
| `fetchRankedKeywords()` | KWST-01 | Evet [VERIFIED] | — | — |
| `fetchKeywordData()` | Zenginleştirme | Evet [VERIFIED] | — | — |
| `resolveLocation()` | Lokasyon çözümleme | Evet [VERIFIED] | — | — |
| `competitors` tablosu | Domain listesi | Evet [VERIFIED] | — | — |
| `keywords` tablosu | Hedef depolama | Evet [VERIFIED] | — | — |
| DataForSEO `related_keywords/live` | KWST-02 genişletme | Evet (API endpoint mevcut, wrapper yok) [ASSUMED] | — | Genişletmeyi atla, sadece competitor |

**Engelsiz bağımlılıklar:** DataForSEO credentials configured olmak zorunda. Vault pattern mevcut.

---

## Doğrulama Mimarisi

### Test Çerçevesi
| Özellik | Değer |
|---------|-------|
| Çerçeve | Vitest (mevcut `*.test.ts` dosyaları) |
| Hızlı çalıştırma | `npx vitest run src/lib/keywords` |
| Tam test | `npx vitest run` |

### Gereksinim → Test Haritası
| Req ID | Davranış | Test Türü | Otomatik Komut | Dosya Mevcut? |
|--------|----------|-----------|---------------|--------------|
| KWST-01 | Rakip keyword'leri DB'ye kaydedilir | Entegrasyon (manuel test) | — | Hayır — Wave 0 |
| KWST-02 | Manual + competitor + expansion birleşik | Unit: upsert ignoreDuplicates davranışı | `npx vitest run src/lib/keywords/ai-acquisition.test.ts` | Hayır — Wave 0 |
| KWST-05 | CSV akışı bozulmaz | Unit: mevcut importKeywords dokunulmamış | `npx vitest run src/lib/keywords` | Kısmen (clustering.test.ts var) |

### Wave 0 Boşlukları
- [ ] `src/lib/keywords/ai-acquisition.test.ts` — upsert kaynak koruma davranışı testleri
- [ ] `src/lib/keywords/ai-acquisition.ts` — servis katmanı (Wave 0'da iskelet)

---

## Güvenlik Alanı

### Geçerli ASVS Kategorileri

| ASVS Kategorisi | Geçerli | Standart Kontrol |
|-----------------|---------|-----------------|
| V4 Access Control | Evet | IDOR: project ownership check (`.eq('user_id', userId)`) |
| V5 Input Validation | Evet | `projectId` UUID format validation (mevcut pattern: `/^[0-9a-f-]{36}$/i`) |
| V6 Cryptography | Hayır | DataForSEO credentials vault'ta — hand-roll yok |

### Bu Stack için Bilinen Tehdit Desenleri

| Desen | STRIDE | Standart Önlem |
|-------|--------|---------------|
| IDOR — başka projenin keyword havuzunu kirletme | Tampering | API route'da `serviceClient.from('projects').eq('user_id', userId)` ownership check |
| Büyük veri yazımı DoS — rakip + expansion birleşik | DoS | Rakip limiti (max 5), genişletme limiti (depth:1, limit:20); mevcut 500 keyword guard pattern'i |
| source değer enjeksiyonu | Tampering | DB-level CHECK constraint (migrasyon); whitelist enum TypeScript'te |

---

## Güncel Durum

| Eski Yaklaşım | Mevcut Yaklaşım | Değişim | Etki |
|--------------|----------------|---------|------|
| Manual CSV import tek kaynak | CSV + competitor + expansion paralel akış | Phase 19 | `source` sütunu ayrıştırma etkin |
| `fetchRankedKeywords` sadece competitor detail UI'da | Keyword acquisition pipeline'ında da kullanılır | Phase 19 | Yeniden kullanım, yeni kod yok |
| `source` değerleri: `'manual'` | `'manual'` + `'competitor'` + `'expansion'` | Phase 19 | CHECK constraint gerekir |

---

## Varsayımlar Kaydı

| # | Varsayım | Bölüm | Yanlışsa Risk |
|---|----------|-------|--------------|
| A1 | DataForSEO `related_keywords/live` endpoint'i `ranked_keywords/live` ile benzer istek yapısına sahip | Standart Yığın, Kod Örnekleri | API wrapper farklı parametre seti gerektirebilir |
| A2 | `related_keywords/live` endpoint'i mevcut DataForSEO abonelik planında erişilebilir | Enviro Kullanılabilirliği | Ek plan yükseltmesi gerekebilir; fallback: expansion adımını atla |
| A3 | Rakip başına top 50 ranked keyword çekmek makul maliyette ve sürede | Standart Yığın | Daha fazla keyword gerekirse limit artışı phase 19+ için |

---

## Açık Sorular

1. **DataForSEO `related_keywords/live` plan dahilinde mi?**
   - Bildiğimiz: `ranked_keywords/live` Phase 4'ten bu yana kullanılıyor, fatura edilmiş
   - Belirsiz: `related_keywords` farklı tier gerektirebilir
   - Öneri: Geliştirme başlamadan DataForSEO dashboard'dan plan kontrolü yapılsın; yoksa KWST-02 genişletme adımını atla, sadece KWST-01 (rakip keyword) ile devam et

2. **Acquisition tetiklenmesi: otomatik mi, manuel mi?**
   - Bildiğimiz: Phase 18 kararı "insan-yönlendirmeli sistem" — kullanıcı açıkça tetikler
   - Belirsiz: Kullanıcı "AI ile Keyword Çek" butonuna bir kez basacak mı, yoksa her proje açılışında otomatik mi çalışacak?
   - Öneri: Manuel buton — Phase 18 D-02 ve D-03 kararlarıyla tutarlı

3. **Mevcut manual keyword'lerin üzerine yazılsın mı?**
   - Bildiğimiz: `ignoreDuplicates: true` önerildi (kaynak koruma)
   - Belirsiz: Kullanıcı aynı keyword için farklı volume bekliyorsa ne olacak?
   - Öneri: `ignoreDuplicates: true` + enrichment sonrası volume güncellemesi sadece `source: 'competitor'` olanlara uygulanır

---

## Kaynaklar

### Birincil (HIGH güven)
- `src/lib/dataforseo/client.ts` — `fetchRankedKeywords`, `fetchKeywordData`, `fetchTopPages` [VERIFIED: codebase]
- `supabase/migrations/20260422000001_create_tables.sql` — keywords ve keyword_clusters şeması [VERIFIED: codebase]
- `supabase/migrations/20260423000005_keyword_constraints.sql` — unique constraint [VERIFIED: codebase]
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` — mevcut import akışı [VERIFIED: codebase]
- `src/lib/supabase/vault.ts` — credential pattern [VERIFIED: codebase]
- `src/app/api/research/trigger/route.ts` — API route pattern referansı [VERIFIED: codebase]

### İkincil (MEDIUM güven)
- DataForSEO `dataforseo_labs/google/related_keywords/live` endpoint — benzer API pattern varsayımı [ASSUMED]

---

## Metadata

**Güven dağılımı:**
- Standart yığın: HIGH — tüm mevcut bileşenler kod tabanında doğrulandı
- Mimari: HIGH — Phase 18 ve Phase 4 pattern'lerinden türetildi
- Tuzaklar: HIGH — `ignoreDuplicates` davranışı kod tabanında incelendi; source constraint migration gerekliliği şemadan türetildi
- `related_keywords` API detayları: LOW — varsayım, kullanılmadan önce doğrulama gerekli

**Araştırma tarihi:** 2026-05-08
**Geçerlilik:** 30 gün (DataForSEO API genellikle stabil)
