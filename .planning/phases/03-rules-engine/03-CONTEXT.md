# Phase 3: Rules Engine - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Kullanıcılar global ve proje bazlı SEO kuralları tanımlar, inline toggle ile anında günceller. Sistem her proje için doğru kural setini uygular: proje bazlı kural global kuralı ezer, override yoksa global kural geçerlidir.

**Kapsam dahili:**
- Global SEO kuralları: `/ayarlar/kurallar` sayfası
- Proje bazlı kural override'ları: `/projeler/[id]/kurallar` sayfası
- 12 boolean kural, 4 kategori (SEO title, H1, slug, meta description)
- Inline toggle düzenleme — anında Server Action ile kayıt
- Scope badge'leri: Global / Proje + Sıfırla linki
- Sistem önerisi gösterimi (her kural için önerilen değer)

**Kapsam dışı:**
- Kural doğrulama / otomatik uygulama (Phase 7-8, sayfa üretimi sırasında)
- Kural geçmişi / audit log
- Kuralları dışa aktarma / içe aktarma
- Takım/rol bazlı kural yönetimi

</domain>

<decisions>
## Implementation Decisions

### Kural Tipleri & İçerik (RULE-01)

- **D-01:** 12 boolean kural, 4 kategori — tüm değerler `rule_value: 'true' | 'false'` olarak `rules` tablosunda saklanır.

**SEO Title (3 kural)**

| rule_key | Türkçe Etiket | Önerilen |
|---|---|---|
| `title_starts_with_keyword` | SEO title focus keyword ile başlamalı | true |
| `title_max_length_enforced` | Max 60 karakter sınırı zorunlu | true |
| `title_includes_brand` | SEO title marka adıyla bitmeli | false |

**H1 (3 kural)**

| rule_key | Türkçe Etiket | Önerilen |
|---|---|---|
| `h1_exact_match` | H1 focus keyword exact match olmalı | false |
| `h1_single_per_page` | Sayfada yalnızca 1 adet H1 kullanılmalı | true |
| `h1_includes_keyword` | H1 focus keyword içermeli | true |

**Slug (3 kural)**

| rule_key | Türkçe Etiket | Önerilen |
|---|---|---|
| `slug_exact_match` | Slug focus keyword exact match olmalı | false |
| `slug_lowercase_hyphen` | Slug küçük harf + tire zorunlu, noktalama yasak | true |
| `slug_no_stopwords` | Slug'dan Türkçe stopword çıkarılmalı | false |

**Meta Description (3 kural)**

| rule_key | Türkçe Etiket | Önerilen |
|---|---|---|
| `meta_desc_required` | Meta description zorunlu | true |
| `meta_desc_includes_keyword` | Meta desc focus keyword içermeli | true |
| `meta_desc_length_enforced` | 120–160 karakter aralığı zorunlu | true |

### Navigasyon & Sayfa Yapısı (RULE-02, RULE-03)

- **D-02:** **Global kurallar:** `/ayarlar/kurallar` — ayrı sayfa. Dashboard'a üst nav'a "Ayarlar" linki eklenir.
- **D-03:** **Proje bazlı kurallar:** `/projeler/[id]/kurallar` — ayrı sayfa. Proje detay sol sütununun altına separator + "Proje Kuralları" linki eklenir.
- **D-04:** Hem global hem proje sayfası aynı 12 kuralı gösterir — global sayfada tüm kurallar global değerleriyle, proje sayfasında her kural ya Global ya Proje badge'iyle.

### Düzenleme UX'i (RULE-02)

- **D-05:** **Inline toggle, anında kayıt.** Her kural satırında toggle switch — tıklanınca Server Action tetiklenir, Supabase'e yazılır, `revalidatePath` ile sayfa yenilenir. Ayrı "Kaydet" butonu YOK.
- **D-06:** Toggle geçişi sırasında loading state gösterilir (toggle disabled + spinner veya opacity düşürme). Hata durumunda toast/inline mesaj ile geri bildirim.

### Global vs Proje Scope Gösterimi (RULE-03)

- **D-07:** **Badge sistemi:** Her kural satırında kaynak badge'i — `[Global]` veya `[Proje]`. Proje bazlı override'lar `[Proje] ✕` formatında gösterilir; ✕ tıklanınca override silinir (global'e döner).
- **D-08:** **Inheritance modeli:** Proje oluşturulduğunda `rules` tablosuna hiçbir satır INSERT edilmez. Global kurallar otomatik geçerlidir. Proje bazlı kural yalnızca override yapıldığında yazılır (`project_id` dolu, `scope: 'project'`).
- **D-09:** **Sistem önerisi:** Her kural satırında "(Önerilen: Açık/Kapalı)" ipucu gösterilir. Kullanıcı mevcut değerin best practice'ten ne kadar saptığını görür.

### Claude's Discretion
- Global kuralların başlangıç değerleri (yukarıdaki "Önerilen" sütunu baz alınır)
- Toggle animasyon hızı ve disabled state görünümü
- Sayfa başlığı ve açıklama metni (Türkçe, kısa)
- Hata toast'larının konumu (sağ alt köşe — Phase 2 pattern'ı yoksa)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `.planning/phases/01-foundation/01-02-SUMMARY.md` — `rules` tablosu şeması: `id, user_id, project_id (nullable), scope, rule_key, rule_value, description, created_at, updated_at`. RLS tüm tablolarda aktif.

### Prior Phase Patterns
- `.planning/phases/02-project-core/02-03-SUMMARY.md` — Server Action + Zod validasyon pattern (createProject)
- `.planning/phases/02-project-core/02-05-SUMMARY.md` — advanceStage pattern: auth guard, ownership check, revalidatePath
- `.planning/phases/02-project-core/02-CONTEXT.md` — Phase 2 kararları: Türkçe UI, shadcn bileşenleri, 2 sütunlu layout

### Existing UI Components
- `src/components/ui/` — badge, table, separator, button mevcut. Toggle/Switch bileşeni henüz eklenmedi — `npx shadcn add switch` gerekecek.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/badge.tsx` — Scope badge'leri için (Global/Proje) kullanılabilir
- `src/components/ui/table.tsx` — Kural listesi tablosu için
- `src/components/ui/separator.tsx` — Proje sol sütun alt kısmı için
- `src/app/(dashboard)/projeler/[id]/actions.ts` — Server Action pattern referansı
- `src/lib/supabase/server.ts` — createClient() pattern

### Established Patterns
- Server Component veri çekimi + Client Component toggle interaktiflik
- `supabase.auth.getUser()` + ownership guard her Server Action'da
- `revalidatePath()` ile sayfa yenileme
- Türkçe hata mesajları

### Integration Points
- Dashboard layout'a nav linki: `src/app/(dashboard)/layout.tsx` genişletilecek
- Proje detay sol sütun: `src/app/(dashboard)/projeler/[id]/page.tsx` — separator + link eklenecek
- Yeni rotalar: `src/app/(dashboard)/ayarlar/kurallar/page.tsx` ve `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx`

</code_context>

<specifics>
## Specific Ideas

- Toggle switch için shadcn `Switch` bileşeni kullanılacak (`npx shadcn add switch`)
- Proje kuralları sayfasında override'ı silmek: `✕` tıklayınca `rules` tablosundan o satır DELETE edilir, global'e döner
- Global kurallar ilk kurulumda `scope: 'global', project_id: null` olarak INSERT edilmeli — kullanıcı ilk açtığında boş sayfa görmemeli

</specifics>

<deferred>
## Deferred Ideas

- Kural doğrulama motoru (kurallar fiilen sayfa paketine uygulanacak) — Phase 7-8
- Kural geçmişi / değişiklik audit log'u — MVP sonrası
- Kuralları JSON olarak dışa aktarma — MVP sonrası

</deferred>

---

*Phase: 03-rules-engine*
*Context gathered: 2026-04-22*
