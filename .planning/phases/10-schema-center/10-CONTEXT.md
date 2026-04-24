# Phase 10: Schema Center - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10, `PagePackageEditor`'a page_type'a göre client-side JSON-LD schema üretimi ekler ve bunu ayrı bir "Schema" sekmesinden erişilebilir kılar. Kullanıcı schema'yı önizleyebilir, manuel düzenleyebilir ve tek tıkla kopyalayabilir. Üretilen JSON-LD `page_packages` tablosuna kaydedilir (yeni `schema_jsonld` sütunu — migration gerektirir).

**Phase 10 kapsamı dışı:**
- AI-driven schema generation (Phase 10'da client-side template yeterli)
- Rules engine entegrasyonu (Phase 11)
- LLM QA denetimi (Phase 11)
- Versioning (Phase 12)

</domain>

<decisions>
## Implementation Decisions

### D-01: Tab Mimarisi — Minimal İki Sekme

Mevcut scroll form korunur. `PagePackageEditor` üstüne iki sekme eklenir:
- **"Paket"** — Mevcut tüm scroll form içeriği (değişmez)
- **"Schema"** — Yeni JSON-LD editörü (Schema Üret butonu + mono textarea + copy butonu)

Tüm editörü sekmelere bölme yok. Minimal değişiklik: sadece sekme navigation + aktif sekme conditional render.

### D-02: Üretim Mekanizması — Client-Side Template

AI çağrısı yok. `page_type` değerine göre deterministik client-side template:

| page_type | JSON-LD @type |
|-----------|--------------|
| homepage | Organization + WebSite |
| category | WebPage |
| service | Service |
| product | Product |
| blog | Article |
| landing | WebPage |
| default/diğer | WebPage |

Template mevcut paket alanlarından doldurulur:
- `seo_title` → `name`
- `meta_description` → `description`
- `canonical_url` → `url`
- `faq` doluysa → FAQPage @type eklenir (veya birleşik schema)
- Focus keyword, page title page'den gelir

### D-03: Generation Trigger — Ayrı "Schema Üret" Butonu

"AI ile Üret" akışından bağımsız. Schema sekmesinde ayrı "Schema Üret" butonu:
- Schema boşsa: "Schema Üret" CTA gösterilir
- Schema doluysa: mevcut JSON-LD gösterilir, "Yenile" veya düzenleme modu

Package locked ise butona tıklanamaz (diğer alanlarla tutarlı).

### D-04: Schema Editörü — Mono Textarea

Mevcut `Field` bileşeninin `mono` prop'u ile oluşturulan Textarea. Sıfır yeni bağımlılık, mevcut `heading_hierarchy` / `faq` JSON alanlarıyla tutarlı pattern.

### D-05: DB — Yeni `schema_jsonld JSONB` Sütunu

`page_packages` tablosuna yeni sütun eklenir:
```sql
ALTER TABLE public.page_packages ADD COLUMN schema_jsonld JSONB;
```
Mevcut `schema_type TEXT` sütunu korunur (schema tipi metadata olarak tutulabilir).
`schema_jsonld`: tam JSON-LD objesi saklanır.

### D-06: Kaydetme

Schema sekmesinde değişiklikler mevcut "Kaydet" akışına entegre olur — `updatePagePackage` server action `schema_jsonld` alanını da günceller. Ayrı kaydetme butonu yok.

### D-07: Kopyala Butonu

Schema sekmesinde "Kopyala" butonu `navigator.clipboard.writeText()` ile JSON-LD string'ini panoya kopyalar. Kopyalandı feedback: buton label geçici "Kopyalandı ✓" olarak değişir.

### Claude's Discretion

- Template output'un `@context`, `@type` dışındaki opsiyonel alanları (publisher, logo, datePublished) dahil etme kararı
- "Schema Üret" tetiklendiğinde mevcut schema varsa üzerine yazma uyarısı gösterip göstermeme
- Kopyala feedback animasyonunun süresi (örn. 2 sn)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mevcut Uygulama (Evolve Edilecek)
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` — Mevcut editör; "Paket" sekmesi bu, "Schema" sekmesi eklenecek
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` — `updatePagePackage` action; `schema_jsonld` alanı eklenir
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx` — Ana sayfa; `page_packages` sorgusuna `schema_jsonld` join

### DB (Migration Gerektirir)
- `supabase/migrations/20260424000005_create_page_packages.sql` — Mevcut tablo yapısı; yeni migration `schema_jsonld JSONB` ekleyecek
- `src/app/(dashboard)/projeler/[id]/sayfalar/actions.ts` — Ownership check pattern referansı

### Requirements
- `REQUIREMENTS.md` §PAGE-02 — Schema üretim tipi gereksinimleri (Organization/WebSite, WebPage, Service, FAQPage, LocalBusiness, Product)
- `REQUIREMENTS.md` §PAGE-02b — Schema sekmesi: önizleme + düzenleme + kopyalama

### UI Constraints (Önceki Fazlardan Yerleşik)
- `font-medium` YASAK — Phase 9 UI-SPEC bağlayıcı
- `Badge` → `className` ile renk, `variant` prop YOK
- `DialogTrigger` → `render={}` prop, NOT `asChild`
- Tailwind v4 CSS-first: `tailwind.config.ts` yok

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Field` bileşeni (`PagePackageEditor.tsx` içinde) — `mono` prop zaten var; schema textarea doğrudan kullanır
- `parseJsonField` / `jsonString` helper'ları — JSON alanları parse/serialize için; schema_jsonld için aynı pattern
- `cn()` — conditional className
- `useTransition` + `router.refresh()` — save/copy action sonrası

### Established Patterns
- Sekme navigation: Proje detay sayfasında (`/projeler/[id]/page.tsx`) tab pattern mevcut — `searchParams` + `Link` ile server-side tab routing
- Kopyalama feedback: Mevcut kodda yok ama `useState` + `setTimeout` ile basit implementasyon yeterli
- JSON field display: `heading_hierarchy`, `faq` alanları aynı mono textarea pattern — schema aynı şekilde

### Integration Points
- `PageData` type'a `pkg.schema_jsonld` alanı eklenmesi gerekiyor
- `updatePagePackage` server action'a `schema_jsonld?: unknown` parametresi eklenir
- `page.tsx` page_packages SELECT sorgusuna `schema_jsonld` kolonu eklenir

</code_context>

<specifics>
## Specific Ideas

- Schema sekmesi başlığı: "Schema" (basit, tutarlı diğer sekmelerle)
- JSON-LD formatı: `<script type="application/ld+json">` bloğu için hazır output (script tag dahil veya saf JSON — kullanıcı kopyalayacak)
- Template null safety: page_type null ise `WebPage` fallback
- Schema boş state: "Bu sayfa için henüz schema üretilmedi. Schema Üret butonuna tıkla." mesajı

</specifics>

<deferred>
## Deferred Ideas

- **AI-driven schema refinement** — İleride "AI ile İyileştir" butonu eklenebilir (Phase 11+)
- **Schema validation** — JSON-LD validator (schema.org uyumluluğu kontrolü) — Phase 11'de QA scoring kapsamında değerlendirilebilir
- **Rich schema types** — BreadcrumbList, SiteLinksSearchBox vs. — Phase 10 kapsamı dışı

</deferred>

---

*Phase: 10-schema-center*
*Context gathered: 2026-04-24*
