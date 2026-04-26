# Phase 12: Content Studio - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Kilitli (locked) bir sayfa paketi için heading_hierarchy'den türetilmiş bölümleri Claude ile üretmek, kullanıcının her bölümü bağımsız onaylamasına/reddetmesine/düzenlemesine izin vermek ve tüm bölümler onaylandığında WordPress-ready HTML çıktısı üretmek.

**In scope:**
- `/projeler/[id]/icerik-studio/[pageId]` route — Content Studio tam sayfa deneyimi
- Page listesinde "İçerik Üret" butonu (yalnızca status='locked' paketlerde)
- heading_hierarchy parse → bölüm kartlarına dönüştürme
- "Tümünü Üret" — tüm bölümler paralel stream başlatır (Anthropic SDK)
- Her bölüm kartında bağımsız "Yeniden Üret" butonu
- Bölüm bazlı onay/ret/inline düzenleme akışı
- WordPress-ready HTML birleştirme ve page_packages'a kaydetme
- content_sections + html_content migration

**Out of scope:**
- WordPress'e gönderim (Phase 13)
- QA geçmiş log görünümü (deferred)
- Otomatik bölüm onayı (human-directed)
- Bulk content generation across multiple pages (deferred)

</domain>

<decisions>
## Implementation Decisions

### D-01: Erişim Noktası

**Route:** `/projeler/[id]/icerik-studio/[pageId]` — ayrı tam sayfa deneyimi

**Entry point:** Page listesindeki her satırda, paket status='locked' ise "İçerik Üret" butonu görünür. PagePackageEditor içinde giriş noktası yok — yalnızca page listesinden erişilir.

**Neden ayrı route:** Çok bölümlü içerik studio deneyimi (heading kartları, stream progress, onay akışı) PagePackageEditor sekmesine sığmayacak kadar kapsamlı.

### D-02: Üretim Modu — Paralel + Tekil Yeniden Üretme

**"Tümünü Üret" (toplu):**
- Tüm heading bölümleri aynı anda, paralel stream başlatır
- Her bölüm kartı kendi streaming içeriğini gösterir
- Kullanıcı bir bölüm gelirken diğerini onaylayabilir

**"Yeniden Üret" (tekil):**
- Her bölüm kartında bağımsız "Yeniden Üret" butonu
- Onaylanmış bölümler dahil bağımsız regenerate edilebilir
- Diğer bölümleri etkilemez

**Section state machine:** `pending` → `generating` → `draft` → (`approved` | `rejected`)
Rejected bölüm `pending`'e döner, yeniden üretilebilir.

### D-03: Bölüm Context Injection

**Tümünü Üret (paralel):**
Her bölüme şu context gönderilir:
- Sayfa paketi: `seo_title`, `meta_description`, `h1`, `focus_keyword`, `search_intent`, `page_type`, `strategic_purpose`
- Proje bilgisi: `name`, `domain`, `sector`, `brand_tone`, `target_language`
- Proje kuralları: aktif SEO kuralları
- Tüm `heading_hierarchy` (sayfa yapısı için)
- Hedef H2 bloğu (hangi bölüm üretileceği)
- **Önceki bölüm metinleri: YOK** (paralel üretimde henüz onaylı bölüm bulunmaz)

**Yeniden Üret (tekil bölüm):**
Yukarıdakilere ek olarak:
- O ana kadar `approved` olan bölümlerin heading + content'i eklenir
- İçerik bütünlüğü ve akış tutarlılığı sağlanır

### D-04: Veritabanı Depolama — Migration Gerekli

**Migration:** `page_packages` tablosuna iki yeni kolon eklenir:

```sql
ALTER TABLE page_packages
  ADD COLUMN content_sections JSONB,
  ADD COLUMN html_content TEXT;
```

**content_sections JSONB şeması:**
```json
[
  {
    "heading": "H2 başlığı metni",
    "level": 2,
    "sub_headings": ["H3 başlığı 1", "H3 başlığı 2"],
    "content": "Üretilen veya düzenlenmiş metin",
    "status": "pending | generating | draft | approved | rejected"
  }
]
```

**html_content TEXT:**
- Tüm bölümler onaylandığında birleştirilmiş WordPress-ready HTML
- `<h2>`, `<h3>`, `<p>` tag yapısı
- Phase 13'te WordPress REST API publish payload'u bu alandan alınır

**Kaydetme zamanlaması:**
- Her bölüm onaylandığında `content_sections` güncellenir
- Tüm bölümler onaylandığında `html_content` otomatik birleştirilir ve yazılır

### D-05: Taşınan Kararlar (Prior Phases)

- **Model:** Claude claude-sonnet-4-6 (kilitli — STATE.md)
- **Streaming:** Anthropic SDK, mevcut `/api/ai/generate-page-package/route.ts` pattern'ı
- **Human-directed:** Otomatik onay yok; kullanıcı her bölümü bağımsız onaylar
- **Auth pattern:** Auth check + ownership verify + revalidatePath (tüm server action'lar)
- **Font-medium:** YASAK
- **Badge:** `className` ile renk, `variant` prop YOK
- **DialogTrigger:** `render={}` prop, `asChild` YOK
- **Tailwind v4:** CSS-first, `tailwind.config.ts` yok

### Claude's Discretion

- Content Studio route layout yapısı (sticky header, scroll bölge, sidebar vs. düz liste)
- Her bölüm kartının tam görsel tasarımı (stream cursor, onay butonlarının konumu)
- Heading'den bölüm parse mantığının tam implementasyonu (heading_hierarchy JSONB → section array)
- Progress göstergesinin formatı (header'da "3/7 Onaylandı" badge veya progress bar)
- HTML birleştirme formatı (boş satır, whitespace kuralları)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### AI Üretim Pattern'ları
- `src/app/api/ai/generate-page-package/route.ts` — Anthropic SDK streaming endpoint pattern; Content Studio bölüm üretim route'u bu yapıyı izler
- `src/app/api/ai/qa-audit/route.ts` — Non-streaming Anthropic endpoint pattern (referans)

### Page Package (Evrilecek)
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx` — SSR sorgu pattern'ı, page_packages JOIN
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` — `updatePackageStatus`, `updatePagePackage` pattern'ları; `content_sections` ve `html_content` güncellemesi için yeni action'lar eklenecek
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` — Tab yapısı referansı; Content Studio ayrı route ama heading_hierarchy parse için editör yapısı incelenecek

### Rules Engine (Context Injection İçin)
- `src/lib/rules/rule-meta.ts` — 12 kural tanımı; üretim prompt'una kurallar dahil edilecek
- `src/app/(dashboard)/projeler/[id]/kurallar/actions.ts` — toggleProjectRule pattern; rules okuma

### UI Constraints (Önceki Fazlardan Kilitli)
- Phase 11 CONTEXT.md `canonical_refs` → UI constraints listesi (font-medium yasak, Badge className, DialogTrigger render prop)

### DB Migration Referansı
- `supabase/migrations/` — Mevcut page_packages yapısı; `content_sections JSONB` ve `html_content TEXT` eklemesi yeni migration olarak eklenir

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Anthropic streaming pattern** — `generate-page-package/route.ts`; `client.messages.stream()` veya `client.messages.create({stream: true})` ile bölüm üretim route'u kurulur
- **`useTransition` + `router.refresh()`** — Bölüm kaydetme/onaylama sonrası refresh pattern
- **`createClient()` server-side** — Server action'larda auth + ownership verify
- **`cn()`** — Conditional className (bölüm kartı duruma göre renk değişimi)
- **`LockedBanner`** — Kilitli durum gösterimi pattern'ı (referans)
- **`PackageStatusBadge`** — Status gösterimi pattern'ı; içerik studio'da bölüm badge'leri için

### Established Patterns
- Server Actions: `'use server'` + `getUser()` + ownership check + DB op + `revalidatePath()`
- Streaming: `ReadableStream` + `TextEncoder` + `controller.enqueue()` — mevcut generate-page-package route'undan
- Page package query: `supabase.from('page_packages').select()` + `page_id` + `project_id` + `user_id` ownership

### Integration Points
- **Page list → Content Studio:** `status='locked'` koşulunu page listesi server component'ı kontrol eder, "İçerik Üret" butonu link olarak render edilir
- **content_sections → Progress badge:** Page package editöründe "X/Y bölüm onaylandı" satırı `content_sections`'ı sayar — SSR'da hesaplanır
- **html_content → Phase 13:** WordPress publish payload, bu alanı slug/title/meta ile birlikte REST API'ye gönderir

</code_context>

<specifics>
## Specific Ideas

- Content Studio sayfa başlığı: sayfa başlığı + "İçerik Stüdyosu" (örn: "Kurumsal SEO Danışmanlığı — İçerik Stüdyosu")
- "Tümünü Üret" butonu disabled olurken "Üretiliyor... (3/7)" gibi progress gösterimi
- Onaylanan bölüm kartı yeşil border veya `emerald-400` sol çizgi ile işaretlenir
- Reddedilen bölüm `pending` durumuna döner, "Yeniden Üret" butonu aktif olur
- Son bölüm onaylandığında "HTML Çıktısı Hazır — Yayına Hazırlık İçin Phase 13'e Geçin" bildirimi

</specifics>

<deferred>
## Deferred Ideas

- **QA geçmiş log** — Önceki üretim turlarının içerik karşılaştırması (future)
- **Bulk content** — Birden fazla sayfanın içeriğini aynı anda üretme (future)
- **Ton kalibrasyonu** — Bölüm bazında brand_tone override (future)
- **Schema validation** — JSON-LD uyumluluk kontrolü (Phase 12+ deferred from Phase 11)

</deferred>

---

*Phase: 12-content-studio*
*Context gathered: 2026-04-26*
