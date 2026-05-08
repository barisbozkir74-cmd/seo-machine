# Phase 18: Project Launch Gate & Sector Research - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

"Projeyi Başlat" butonu bir launch gate olarak çalışır: `sector`, `initial_competitors`, `target_keywords` alanlarının tamamı dolduğunda aktif hale gelir. Tetiklenince SerpAPI tabanlı Google araması + Claude analizi otomatik olarak sektör araştırması üretir ve sonuçları mevcut `/arastirma` sayfasındaki `research_reports` bölümlerine yazar. Kullanıcı raporu görüntüler, notlar ekler ve isterse "Yeniden Araştır" ile güncelleyebilir.

Bu faz yeni bir sayfa veya route açmaz — mevcut `/arastirma` sayfası üzerine inşa eder. "Projeyi Başlat" butonu `ProjectInfoSection` içine eklenir.

</domain>

<decisions>
## Implementation Decisions

### D-01: Launch Gate — Zorunlu Alanlar
- **D-01:** "Projeyi Başlat" butonu ancak şu 3 alan birden dolu olduğunda aktif hale gelir:
  - `sector` (sektör)
  - `initial_competitors` (en az 1 rakip)
  - `target_keywords` (en az 1 keyword)
- Eksik alan varken buton disabled görünür; kullanıcıya hangi alanların eksik olduğu inline hint ile gösterilir.
- `name` + `domain` proje oluşturulurken zaten zorunlu — gate bu 3 ek alanı kontrol eder.

### D-02: WP Import Akışı
- **D-02:** WP import ile oluşturulan projelerde aynı gate logic geçerlidir — import tamamlandıktan sonra `ProjectInfoSection`'da aynı buton gösterilir.
- WP import tamamlanınca araştırma otomatik tetiklenmez; kullanıcı eksik alanları doldurup manuel olarak "Projeyi Başlat"a basmalıdır.

### D-03: Research Trigger Mekanizması
- **D-03:** Araştırma Next.js API route üzerinden tetiklenir: `/api/research/trigger`
- Akış: Kullanıcı butona basar → server action API route'u çağırır → SerpAPI ile Google aramaları → Claude (claude-sonnet-4-6) analiz eder → `research_reports` DB'ye yazılır.
- SerpAPI anahtarı `vault.ts` env var pattern'i ile tutulur (DataForSEO pattern'iyle aynı).
- SRCH-01: Sektör + rakipler + target_keywords'ten otomatik arama sorguları üretilir.

### D-04: Progress UX
- **D-04:** Buton tıklanınca loading state'e geçer (spinner). Route tamamlanınca "Araştırma tamamlandı — Görüntüle" linki çıkar.
- Kullanıcı araştırma sırasında aynı sayfada kalır; otomatik yönlendirme olmaz.
- Hata durumunda kullanıcıya toast ile bildirim verilir.

### D-05: Rapor Çıktı Formatı
- **D-05:** AI çıktısı mevcut `research_reports` tablosundaki bölümlere yazılır:
  - `market_structures` — pazar özeti / öne çıkan yapılar
  - `competitor_strengths` — rakiplerin güçlü olduğu alanlar
  - `competitor_weaknesses` — rakiplerin zayıf olduğu alanlar
  - `quick_wins` — hızlı fırsatlar
  - `high_value_opportunities` — yüksek değerli fırsatlar
- AI çıktısı mevcut satırların üzerine yazılır (replace, not append).
- Kullanıcı AI doldurduğu tablolara sonradan manuel satır ekleyebilir/düzenleyebilir (mevcut `ResearchSection` davranışı korunur).

### D-06: Yeniden Araştır
- **D-06:** `/arastirma` sayfasında "Yeniden Araştır" butonu olacak. Tıklanınca mevcut `research_reports` üzerine yazar.
- "Projeyi Başlat" butonu araştırma tamamlandıktan sonra "Yeniden Araştır" olarak değişmez — `ProjectInfoSection`'daki buton sadece ilk tetikleme içindir; yeniden araştırma `/arastirma` sayfasından yapılır.

### D-07: UI Yerleşimi
- **D-07:** "Projeyi Başlat" butonu `ProjectInfoSection` bileşenine eklenir — proje bilgileri formunun altında.
- Disabled state'de inline validation hint: "Eksik: sektör, rakipler" gibi.
- Araştırma daha önce çalıştırılmışsa buton "Araştırma tamamlandı ✓ — Tekrar çalıştır için /arastirma'ya git" şeklinde gösterilebilir (Claude karar verir).

### D-08: SRCH-03 — Notlar
- **D-08:** Kullanıcı araştırma raporuna not ekleyebilir — mevcut `/arastirma` sayfasındaki bölümler zaten editable. Ayrı bir not alanı gerekmez.

### Claude's Discretion
- SerpAPI'den kaç arama sorgusu çekilecek ve sorgu stratejisi (sektör bazlı, rakip bazlı, keyword bazlı kombinasyonlar) — planner/araştırmacı belirler
- `research_reports` satırlarına `ai_generated: true` flag'i eklenmeli mi yoksa plain rows yeterli mi — Claude karar verir
- "Araştırma tamamlandı" durumunun DB'de nerede saklanacağı (projects tablosuna `research_status` kolonu mu, yoksa `research_reports` doluluk kontrolü mi) — Claude araştırır
- `ProjectInfoSection`'da araştırma durumu gösterme detayı — mevcut pattern'e uygun seçilir

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mevcut Araştırma Altyapısı
- `src/app/(dashboard)/projeler/[id]/arastirma/page.tsx` — /arastirma sayfası SSR yapısı (5 bölüm konfigürasyonu)
- `src/app/(dashboard)/projeler/[id]/arastirma/ResearchSection.tsx` — editable tablo bileşeni
- `src/app/(dashboard)/projeler/[id]/arastirma/actions.ts` — `upsertSection` server action
- `supabase/migrations/20260423000003_product_layers_schema.sql` — `research_reports` tablo şeması

### Mevcut Proje UI
- `src/app/(dashboard)/projeler/[id]/ProjectInfoSection.tsx` — "Projeyi Başlat" butonu buraya eklenecek
- `src/app/(dashboard)/projeler/[id]/page.tsx` — proje detay sayfası SSR yapısı (proje field query'si burada)
- `src/app/(dashboard)/projeler/[id]/edit-project-modal.tsx` — mevcut zorunlu alan mantığı (name+domain)

### Mevcut API Patterns
- `src/lib/supabase/vault.ts` — env var / vault pattern (SerpAPI key buraya eklenecek)
- `src/app/api/wp/import/route.ts` — Next.js API route pattern referansı
- DataForSEO entegrasyonu (Phase 19 için) — SerpAPI ile aynı pattern uygulanacak

### Requirements
- `PROJ-06`, `PROJ-07`, `SRCH-01`, `SRCH-02`, `SRCH-03` — `.planning/REQUIREMENTS.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ResearchSection` bileşeni — AI çıktısı bu tablolara yazılacak; bileşen değişmez, sadece veri doldurulur
- `upsertSection` server action — AI çıktısını `research_reports`'a yazmak için kullanılabilir veya extend edilir
- `vault.ts` env var pattern — SerpAPI key için
- API route pattern (`/api/wp/import/route.ts`) — `/api/research/trigger` için referans

### Established Patterns
- Server action → API route → external API → DB write (DataForSEO, WP publish pattern'i)
- Disabled button + inline validation hint (edit-project-modal'daki `!form.name.trim() || !form.domain.trim()` pattern'i)
- Toast notification — hata/başarı bildirim pattern'i mevcut

### Integration Points
- `projects` tablosunda `sector`, `initial_competitors`, `target_keywords` alanları zaten var
- `research_reports` tablosu zaten var; AI çıktısı `rows` JSONB'ye yazılacak
- `/arastirma` sayfası route zaten var; yeni route gerekmez

</code_context>

<specifics>
## Specific Ideas

- Gate logic: `!sector || !initial_competitors || !target_keywords` → disabled
- SRCH-01 arama sorgusu üretimi: sektör + her rakip için ayrı sorgu + ana keyword kombinasyonları
- SRCH-02 rapor bölümleri: mevcut 5 bölüm (market_structures, competitor_strengths, competitor_weaknesses, quick_wins, high_value_opportunities) — yeni bölüm açılmaz
- "Projeyi Başlat" butonu ilk araştırmayı tetikler; /arastirma sayfasında "Yeniden Araştır" güncellemeleri yönetir

</specifics>

<deferred>
## Deferred Ideas

- SSE (Server-Sent Events) ile canlı araştırma progress bar — Phase 18 spinner yeterli; ileride UX iyileştirme olarak eklenebilir
- Araştırma geçmişi / versiyon kayıtları — Phase 22 carry-over kapsamında değerlendirilebilir
- Araştırma raporunun PDF export'u — kapsam dışı

</deferred>

---

*Phase: 18-project-launch-gate-sector-research*
*Context gathered: 2026-05-08*
