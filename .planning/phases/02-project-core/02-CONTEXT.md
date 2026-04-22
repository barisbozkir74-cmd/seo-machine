# Phase 2: Project Core - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Kullanıcılar proje oluşturabilir, tüm projelerini merkezi bir tablodan takip eder, her projeyi 10 aşamalı stage engine üzerinde ilerletir ve sisteme serbest not bırakarak karar hafızası oluşturur. Başka hiçbir özellik bu fazda inşa edilmez.

**Kapsam dahili:**
- Proje oluşturma (modal form: ad + domain zorunlu, diğerleri opsiyonel)
- Merkezi dashboard: tüm projelerin tablo görünümü
- Proje detay sayfası: 2 sütunlu yapı (sol: stage listesi, sağ: içerik)
- 10 aşamalı stage engine: dikey liste gösterimi + onaylı geçiş
- Serbest not / karar hafızası (stage bazlı, audits tablosuna yazılır)
- Türkçe arayüz

**Kapsam dışı:**
- Rakip toplama, keyword, site blueprint — sonraki fazlar
- Kurallar motoru (Phase 3)
- Proje silme / arşivleme (MVP dışı)
- Çoklu kullanıcı / takım yönetimi

</domain>

<decisions>
## Implementation Decisions

### Proje Listesi (PROJ-02)
- **D-01:** Dashboard'da projeler **sıralanabilir tablo** olarak gösterilir. Sütunlar: Proje Adı, Domain, Sektör, Aktif Stage, Durum, Oluşturma Tarihi.
- **D-02:** **Boş durum:** Hiç proje yokken ortada ikon + "Henüz proje yok" mesajı + "Yeni Proje Oluştur" butonu gösterilir. Kullanıcıyı doğal olarak aksiyona yönlendirir.

### Proje Oluşturma (PROJ-01)
- **D-03:** Yeni proje formu **modal pencere** olarak açılır (dashboard üzerinde, sayfa geçişi olmadan). Mevcut shadcn `Dialog` + `Form` bileşenleri kullanılır.
- **D-04:** İlk oluşturmada **zorunlu alanlar yalnızca Ad + Domain**. Diğer tüm alanlar (sektör, hedef ülke, hedef dil, iş modeli, site tipi, marka tonu, notlar) opsiyonel — proje detay sayfasından sonradan doldurulabilir.
- **D-05:** Form doğrulama: Ad boş olamaz; Domain geçerli format olmalı (boşluksuz, nokta içermeli). Zod şeması ile validasyon.

### Stage Engine (PROJ-03, PROJ-04)
- **D-06:** Stage engine **dikey liste** olarak sol sütunda gösterilir. Her satır: stage adı, durum badge'i (Aktif / Tamamlandı / Bekliyor), tamamlanma tarihi (varsa).
- **D-07:** Stage geçişi **onay gerektiren buton** ile yapılır: "Sonraki Aşamaya Geç" butonu → onay dialogu ("Bu aşamayı tamamlamak istediğinize emin misiniz?") → onaylanınca geçiş kaydedilir. Stage geçişi geri alınamaz.
- **D-08:** 10 aşamanın isimleri Türkçe gösterilir: Alım → Keşif → Keyword Stratejisi → Site Blueprint → Sayfa Planlaması → Sayfa Paketi → İçerik Üretimi → SEO Denetimi → Yayın Hazırlığı → Yayın Sonrası.

### Proje Detay Yapısı
- **D-09:** Proje detay sayfası **2 sütunlu layout**: Sol dar sütun (stage listesi), sağ geniş sütun (aktif stage'in içeriği: proje bilgileri, notlar, aksiyon butonu). Aktif stage değişince sağ taraf güncellenir.
- **D-10:** URL yapısı: `/dashboard/projeler/[id]` — proje UUID'si URL'de.

### Karar Hafızası / Notlar (PROJ-05)
- **D-11:** Her stage için **serbest metin not alanı**. Kullanıcı istediğini yazar, sistem kaydeder. Not verisi `audits` tablosuna `event_type: 'note'`, `entity_type: 'stage'` olarak yazılır.
- **D-12:** Notlar stage bazlı gruplanarak gösterilir — aktif stage'de not ekleme formu + o stage'e ait geçmiş notlar listesi.

### Arayüz Dili
- **D-13:** Tüm UI Türkçe — butonlar, etiketler, hata mesajları, boş durum metinleri, onay dialogları. Teknik terimler (domain, stage, dashboard) olduğu gibi kalır.

### Claude's Discretion
- Tablo sıralama mantığı (varsayılan sıra: oluşturma tarihi, en yeni üstte)
- Modal içindeki opsiyonel alanların tam listesi ve sırası
- Stage listesinin tam renk/ikon sistemi (aktif: mavi, tamamlandı: yeşil, bekliyor: gri)
- Proje detay sayfasında proje bilgilerinin düzenleme (edit) akışı

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Gereksinimler
- `.planning/REQUIREMENTS.md` — PROJ-01 through PROJ-05 (Phase 2 gereksinimleri)
- `.planning/ROADMAP.md` — Phase 2 success criteria (5 madde)

### Phase 1 Kararları (taşınan)
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-01 (App Router), D-02 (@supabase/ssr), D-05 (UUID PKs), D-06 (hard deletes), D-08 (user_id RLS pattern)

### Veritabanı Şeması
- `supabase/migrations/20260422000001_create_tables.sql` — `projects` ve `stages` tabloları Phase 2'nin temelini oluşturur; `audits` tablosu karar hafızası için kullanılır
- `supabase/migrations/20260422000002_rls_policies.sql` — RLS politikaları; her Supabase sorgusu user_id filtreli olmalı

### Mevcut Kod
- `src/lib/supabase/client.ts` — Browser client (Client Components)
- `src/lib/supabase/server.ts` — Server client (Server Components + Server Actions)
- `src/app/(dashboard)/layout.tsx` — Dashboard layout (auth guard dahil)
- `src/components/ui/` — Button, Card, Form, Input, Label, shadcn bileşenleri

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/button.tsx` — CTA butonları için
- `src/components/ui/card.tsx` — Tablo alternatifi veya istatistik kartları için
- `src/components/ui/form.tsx` + `input.tsx` + `label.tsx` — Modal form için
- `src/lib/supabase/server.ts` — Server Actions'da Supabase sorguları için
- `src/app/(dashboard)/layout.tsx` — Auth guard zaten var, yeni sayfalar bu layout altında açılır

### Established Patterns
- Server Actions: form submit → Supabase insert/update → revalidatePath (Phase 1'de auth formlarında kullanıldı)
- `createClient()` from `@/lib/supabase/server` for all server-side Supabase calls
- `createClient()` from `@/lib/supabase/client` for all client-side Supabase calls
- Route group pattern: `app/(dashboard)/` — tüm korumalı sayfalar bu grup altında

### Integration Points
- Yeni sayfalar: `app/(dashboard)/projeler/page.tsx` (liste), `app/(dashboard)/projeler/[id]/page.tsx` (detay)
- `app/(dashboard)/dashboard/page.tsx` stub'ı proje listesine yönlendirme veya direkt liste ile değiştirilebilir
- `audits` tablosu karar hafızası için hazır (event_type, entity_type, entity_id, payload sütunları mevcut)
- `stages` tablosu her proje için stage geçmişini tutar (project_id, stage_name, status, started_at, completed_at)

</code_context>

<specifics>
## Specific Ideas

- Stage isimleri tam Türkçe listesi (D-08): Alım, Keşif, Keyword Stratejisi, Site Blueprint, Sayfa Planlaması, Sayfa Paketi, İçerik Üretimi, SEO Denetimi, Yayın Hazırlığı, Yayın Sonrası
- Dashboard tablo sütun sırası: Proje Adı | Domain | Sektör | Aktif Stage | Durum | Oluşturulma
- Modal'da "Yeni Proje Oluştur" başlığı, zorunlu alan placeholder'ları: "örn. Müşteri Projesi", "örn. musteri.com"
- Onay dialogu metni önerisi: "Bu aşamayı tamamladınız mı? Bu işlem geri alınamaz."

</specifics>

<deferred>
## Deferred Ideas

- Proje arama / filtreleme (tablo üzerinde) — proje sayısı artınca gerekecek, şimdilik erken
- Proje silme / arşivleme — MVP dışı, sonraki milestone
- Proje bazlı özel kurallar (PROJ-01'deki "özel kurallar" alanı) — Phase 3 Rules Engine kapsamında

</deferred>

---

*Phase: 02-project-core*
*Context gathered: 2026-04-22*
