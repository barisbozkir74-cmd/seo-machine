# Phase 5: Keyword Import & Enrichment - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Kullanıcı keyword listesini text paste ile sisteme aktarır; sistem anında kelime örtüşmesiyle kümeleme yapar ve DataForSEO'dan volume/CPC/KD/intent verilerini otomatik çeker. Sonuç: küme badge'li, intent renkli, trafik ve öneme göre sıralanmış düz keyword tablosu.

**Kapsam dahili:**
- Mevcut text paste import'u (keyword+volume+KD formatı) korunur
- Import anında kelime örtüşmesi tabanlı kümeleme çalışır
- Import sonrası DataForSEO keyword enrichment otomatik başlar (volume, CPC, KD, intent)
- Düz tablo görünümü: keyword, volume, CPC, KD, Küme (badge), Intent (renkli badge)
- Satır başında × butonu ile keyword silme
- Çelişme durumunda DataForSEO verisi manuel girilen değerlerin üstüne yazar

**Kapsam dışı:**
- CSV file picker — text paste yeterli (KEYW-01 bu şekilde karşılanır)
- Tekil keyword ekleme formu — bulk paste tek kelime için de kullanılabilir
- Keyword clustering & scoring analizi — Phase 6
- Blueprint için öneri/analiz çıktısı — Phase 6

</domain>

<decisions>
## Implementation Decisions

### Import Formatı (KEYW-01, KEYW-02)

- **D-01:** Mevcut `keyword+volume+KD` text paste formatı korunur. `parser.ts` değişmez. Kullanıcı SEO araçlarından (Semrush, Ahrefs vb.) tab/satır ayrılmış veriyi kopyalayıp yapıştırır.
- **D-02:** Tekil keyword ekleme için ayrı form yok — bulk paste tek kelime için yeterli.
- **D-03:** CSV file picker yok — text paste KEYW-01 gereksinimini karşılar.

### Kümeleme Zamanlaması

- **D-04:** Import anında kelime örtüşmesi tabanlı kümeleme (`clustering.ts`) çalışır. Volume 0 olsa bile kümeleme yapılır — enrichment sonrası total_volume güncellenir.

### DataForSEO Enrichment (KEYW-03)

- **D-05:** Enrichment otomatik başlar — kullanıcı ayrı bir butona basmaz. Import → Kümeleme → Enrichment tek akış.
- **D-06:** Çelişme kuralı: DataForSEO verisi manuel girilen volume/KD'yi üsteler. Mantık: "sistematik veri kazanır."
- **D-07:** Eksik enrichment state'i için `enriched_at` alanı kullanılır — null olanlar beklemede, dolu olanlar tamamlandı.
- **D-08:** DataForSEO Keyword Data API kullanılır: `keywords_data/google/search_volume/live` (toplu). Intent için `search_intent` alanı doldurulur.

### Tablo Görünümü & Intent Gösterimi

- **D-09:** Düz tablo: sütunlar = Keyword | Volume | CPC | KD | Küme | Intent | (Sil).
- **D-10:** Küme sütunu: küme adını gösteren küçük badge.
- **D-11:** Intent: renkli badge — Commercial = mavi, Informational = yeşil, Navigational = gri, Transactional = turuncu. DataForSEO intent değerlerine map edilir.
- **D-12:** Silme: her satır başında `×` butonu — tek tıkla keyword silinir (onay dialogu yok, küçük eleman için overkill).
- **D-13:** Tablo sıralaması: volume'a göre azalan (en yüksek trafik potansiyelli üstte).

### Claude'un Takdirine Bırakılanlar

- DataForSEO API çağrılarının batch boyutu ve hata handling (quota aşımı, keyword bulunamadı)
- Enrichment sırasında loading state gösterimi (tablo satırı bazında mı, tablo başlığında genel mi)
- `total_volume` güncelleme zamanlaması (enrichment sonrası cluster'a yazılır)
- Intent değer normalizasyonu (DataForSEO farklı string formatları döndürebilir)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mevcut Keyword Kodu
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` — Mevcut cluster+keyword tablosu görünümü
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` — `importKeywords` Server Action (korunacak, genişletilecek)
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordImport.tsx` — Mevcut textarea import bileşeni
- `src/lib/keywords/parser.ts` — `parseKeywordText` — format değişmez
- `src/lib/keywords/clustering.ts` — `clusterKeywords` — değişmez

### Mevcut DataForSEO Altyapısı
- `src/lib/dataforseo/client.ts` — Mevcut API client (SERP, top pages, backlinks) — enrichment fonksiyonu buraya eklenir
- `src/lib/supabase/vault.ts` — DataForSEO credentials okuma pattern'ı

### Database Schema
- `supabase/migrations/20260422000001_create_tables.sql` — `keywords` tablosu: `volume, cpc, difficulty, search_intent, enriched_at` alanları mevcut
- `supabase/migrations/20260422000001_create_tables.sql` — `keyword_clusters` tablosu: `total_volume, intent` alanları mevcut

### Prior Phase Patterns
- `src/app/(dashboard)/projeler/[id]/rakipler/` — "Tümünü Çek" pattern'ı (toplu API çağrısı + loading state)
- `.planning/phases/04-competitor-intelligence/04-CONTEXT.md` — DataForSEO vault + Server Action pattern referansı

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/keywords/parser.ts` — Değişmeden kullanılır
- `src/lib/keywords/clustering.ts` — Değişmeden kullanılır
- `src/components/ui/badge.tsx` — Küme ve intent badge'leri için
- `src/components/ui/table.tsx` — Keyword tablosu için (mevcut, genişletilecek)
- `src/components/ui/button.tsx` — Silme × butonu için

### Established Patterns
- Server Action + `useTransition` + loading state: `KeywordImport.tsx`'te mevcut
- Vault credentials okuma: `src/lib/supabase/vault.ts`
- Auth guard + ownership check: tüm Server Action'larda tutarlı
- `revalidatePath` ile sayfa yenileme

### Integration Points
- `keyword-stratejisi/actions.ts` — `importKeywords` action'ı genişletilecek: enrichment akışı buraya entegre
- `src/lib/dataforseo/client.ts` — Yeni `fetchKeywordData` fonksiyonu eklenecek
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` — Tablo sütunları genişletilecek (CPC, Intent, Küme badge, × butonu)

</code_context>

<specifics>
## Specific Ideas

- Intent badge renk mapping: Commercial → `bg-blue-500/20 text-blue-400`, Informational → `bg-emerald-500/20 text-emerald-400`, Navigational → `bg-gray-500/20 text-gray-400`, Transactional → `bg-orange-500/20 text-orange-400`
- Enrichment sırasında tabloda keyword satırları `opacity-50` + spinner ile "bekleniyor" göstergesi
- DataForSEO `keywords_data/google/search_volume/live` endpoint — toplu çağrı, keyword listesi gönderilir

</specifics>

<deferred>
## Deferred Ideas

- Keyword önemi / blueprint uygunluğu analizi (ajans modu analizler + blueprint için yapı önerisi) — Phase 6
- Trafik potansiyel skorlama ve opportunity score — Phase 6
- Küme başına primary keyword seçimi — Phase 6
- Keyword/küme ekle drag-and-drop sıralama — MVP sonrası

</deferred>

---

*Phase: 05-keyword-import-enrichment*
*Context gathered: 2026-04-24*
