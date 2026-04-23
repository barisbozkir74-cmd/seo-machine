# Phase 4: Competitor Intelligence - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Her projeye rakip domain listesi ekleme, DataForSEO'dan top pages + kategori yapısı çekme ve içerik kategori boşluklarını gösteren gap raporu üretme.

**Kapsam dahili:**
- Manuel rakip domain ekleme (COMP-01)
- SERP tabanlı rakip keşfi — mini keyword girişiyle (COMP-02)
- Rakip başına top pages + kategori yapısı görüntüleme (COMP-03)
- Kategori boşluğu gap raporu — rakipler sayfasında bölüm olarak (COMP-04)
- `/projeler/[id]/rakipler` ayrı sayfa
- Sol sütun navigasyonu: Rakipler + Kurallar linkleri

**Kapsam dışı:**
- Keyword bazlı gap analizi (Phase 5+ keyword importu gerekiyor)
- Otomatik/zamanlanmış veri çekme (otonom eylem yok)
- Rakip sayfa içeriği analizi (sadece sayfa listesi + kategori)
- Semrush entegrasyonu (DataForSEO yeterli bu fazda)

</domain>

<decisions>
## Implementation Decisions

### Rakip Listesi Konumu (COMP-01)

- **D-01:** Rakip yönetimi `/projeler/[id]/rakipler` ayrı sayfasında yaşar — `/projeler/[id]/kurallar` ile aynı pattern. Sol sütunda 2 link: "Rakipler" (yeni) + "Kurallar" (mevcut). Sağda rakip tablosu + veri.
- **D-02:** Proje detay sol sütunu güncellenir: Kurallar linki üstüne Rakipler linki eklenir. İkisi de "Proje Kuralları" ile aynı stil (hover:bg-secondary, aktif sayfada bg-secondary font-semibold).

### SERP Tabanlı Rakip Keşfi (COMP-02)

- **D-03:** Rakipler sayfasında "Rakip Keşfet" butonu var. Kullanıcı tıklar → dialog/form açılır → 1-3 anahtar kelime girer → DataForSEO SERP API çağrılır → önerilen rakip domain listesi döner → kullanıcı hangileri eklensin seçer → onaylar. Phase 5 (keyword import) olmadan bağımsız çalışır.
- **D-04:** SERP keşfi human-triggered — kullanıcı butona basmazsa hiçbir şey olmuyor. Otomatik arka plan işlemi yok.

### DataForSEO Veri Derinliği (COMP-03)

- **D-05:** Rakip başına çekilecek veri: **Top pages + kategori yapısı**. DataForSEO Domain Analytics API kullanılır. Her rakip için:
  - Top 10 organik sayfa (URL + başlık + tahmini aylık trafik)
  - Alan/kategori yapısı çıkarımı (blog, ürün, hizmet, kategori, landing vb.) — URL pattern analizi ile
- **D-06:** Veri çekme "Veri Çek" butonu ile manuel tetiklenir (rakip başına veya tüm rakipler için). Kullanıcı API maliyetini kontrol eder — ekleme anında otomatik çekim yok.
- **D-07:** Çekilen veri `competitors` tablosundaki `top_pages` (JSONB) ve `category_structure` (JSONB) kolonlarında saklanır — schema Phase 1'de hazır.

### Gap Raporu (COMP-04)

- **D-08:** Gap raporu **içerik kategori boşluklarını** gösterir: Rakiplerin sahip olduğu içerik kategorileri (blog, hizmet, ürün sayfası vb.) ile kullanıcının domain'inin karşılaştırması. Örnek bulgu: "Rakip X'in blog bölümü var, sizin yok."
- **D-09:** Gap raporu `/projeler/[id]/rakipler` sayfasında alt bölüm/sekme olarak gösterilir — ayrı sayfa değil. Rakip listesinin altında "Gap Analizi" başlıklı tablo.
- **D-10:** Gap tablosu satır = kategori (Blog, Ürün Sayfası, Hizmet, vb.), sütun = her rakip + kullanıcının domain'i. Her hücrede ✓/✗ veya sayfa sayısı.

### Claude'un Takdirine Bırakılanlar

- Rakip tablosunun kolon yapısı (domain, sayfa sayısı, trafik, durum, eylemler)
- "Veri Çek" butonunun loading state tasarımı
- SERP keşif dialogunun layout detayları
- DataForSEO hata handling (quota aşımı, domain bulunamadı vb.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mevcut Schema
- `supabase/migrations/20260422000001_create_tables.sql` — `competitors` tablosu: id, user_id, project_id, domain, source, top_pages (JSONB), category_structure (JSONB), content_areas (JSONB), gap_report (JSONB)
- `supabase/migrations/20260422000002_rls_policies.sql` — competitors tablosu RLS politikaları

### Mevcut Pattern'lar
- `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx` — 2-sütunlu layout, sol sütun navigasyon, RuleToggleRow pattern — rakipler sayfası aynı yapıyı izler
- `src/app/(dashboard)/projeler/[id]/page.tsx` — Sol sütun, stage listesi, Separator + link pattern
- `src/app/(dashboard)/projeler/[id]/kurallar/actions.ts` — Server Action şablonu (auth guard + ownership check + Supabase)
- `src/lib/supabase/vault.ts` — DataForSEO API key'i Supabase Vault'tan okuma (server-only)

### Gereksinimler
- `.planning/REQUIREMENTS.md` §Competitor Intelligence — COMP-01, COMP-02, COMP-03, COMP-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/table.tsx` — Rakip listesi ve gap raporu tabloları için kullanılacak
- `src/components/ui/dialog.tsx` — SERP keşif formu için (keyword girişi + onay adımı)
- `src/components/ui/badge.tsx` — Kaynak badge'i (Manual / SERP), veri durumu badge'i
- `src/components/ui/button.tsx` — "Rakip Ekle", "Rakip Keşfet", "Veri Çek" butonları
- `src/components/ui/input.tsx` — SERP keşif dialog'unda keyword input

### Established Patterns
- Server Component + Server Action: Tüm veri çekme ve mutasyonlar bu şekilde (Phase 2-3 boyunca tutarlı)
- Auth guard: `if (!user) notFound()` — her page.tsx'in başında
- Ownership check: `.eq('project_id', id).eq('user_id', user.id)` — competitors sorgularında aynı pattern
- Loading state: `useState(isPending)` + disabled + opacity-50 (RuleToggleRow'dan alındı)
- Badge className: direct CSS class, variant prop yok

### Integration Points
- `src/app/(dashboard)/projeler/[id]/page.tsx` — Sol sütuna Rakipler linki eklenecek (Kurallar'ın üstüne)
- `src/app/(dashboard)/layout.tsx` — Üst nav gerekirse güncellenebilir (şimdilik Projeler + Ayarlar yeterli)
- `src/lib/supabase/vault.ts` — DataForSEO API key okuma — Server Action'larında import edilecek

</code_context>

<specifics>
## Specific Ideas

- Rakip keşif flow: Dialog içinde 2 adım — (1) keyword giriş, (2) bulunan rakipleri checkbox listesiyle seç + onayla
- Gap tablosu görsel: ✓ yeşil (rakip bu kategoride var) / ✗ gri (yok) — kullanıcının domain'i için ayrı sütun
- "Veri Çek" butonu: Her rakip satırında küçük buton, son çekim tarihi gösterilir (updated_at)
- Kategori çıkarımı: URL pattern analizi (örn. `/blog/` → Blog, `/urunler/` → Ürün) — DataForSEO'nun content_categories veya sayfa URL'leri üzerinden

</specifics>

<deferred>
## Deferred Ideas

- Keyword bazlı gap analizi (rakip X'in hangi keyword'lerde sıralandığı) — Phase 5/6 keyword importu gelince anlamlı
- Semrush entegrasyonu — DataForSEO yeterli, Semrush ileriki aşamaya ertelendi
- Otomatik rakip izleme / değişiklik bildirimi — otonom eylem olmayacak kararıyla ertelendi
- Rakip sayfa içerik analizi (başlık, H1, meta — tam SEO audit) — Phase 8 (SEO Audit) kapsamında

</deferred>

---

*Phase: 04-competitor-intelligence*
*Context gathered: 2026-04-23*
