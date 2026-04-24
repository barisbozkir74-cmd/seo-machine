# Phase 9: Page Package Generator - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 9 yeni bir `page_packages` tablosu ve bunu destekleyen tüm UI/action altyapısını kurar. Mevcut `sayfa-paketi` ekranı (`/projeler/[id]/sayfa-paketi`) bu yeni tabloya migrate edilir: AI üretimi, manuel düzenleme, basit QA validator ve 3 aşamalı status workflow (draft → approved → locked) dahil. Bulk generation, versioning, ikinci model QA ve publishing payload Phase 12'ye ertelenir.

**Zaten mevcut (dokunulmaz veya evolved):**
- `/projeler/[id]/sayfa-paketi` route ve 3-panel layout
- `PagePackageEditor.tsx` — formu ve state yönetimi (mevcut `pages` tablosu okuyordu, `page_packages`'a taşınır)
- `/api/ai/generate-page-package/route.ts` — Anthropic streaming
- `updatePagePackage` server action (yeni tabloya yazacak şekilde güncellenir)

**Phase 9 kapsamı dışı:**
- Bulk generation (Phase 10+)
- Versioning/diff (Phase 12)
- İkinci model QA scoring (Phase 10)
- Publishing payload / WordPress export (Phase 12)
- Lock history audit trail (Phase 12)

</domain>

<decisions>
## Implementation Decisions

### D-01: Tablo Mimarisi — Ayrı `page_packages` Tablosu

`page_packages` ayrı tablo olarak kurulur. `pages` sadece site blueprint identity tutar.

```
pages (korunur, dokunulmaz):
  id, title, slug, page_type, priority, parent_id,
  focus_keyword_id, user_id, project_id, status, sort_order

  NOT: Mevcut package columns (seo_title, meta_description, h1, heading_hierarchy,
  content_blocks, cta_blocks, image_plan, alt_texts, secondary_keywords, faq,
  schema_type, canonical_url, search_intent, strategic_purpose, trust_blocks,
  audit_scores) fiziksel olarak pages'te kalır ama UI artık bunları OKUMAZ,
  YAZMAZ — dondurulur. Yeni UI canonical olarak page_packages okur.

page_packages (yeni):
  id uuid PK
  page_id uuid → pages(id) CASCADE
  project_id uuid → projects(id) CASCADE
  user_id uuid
  status text DEFAULT 'draft'   -- draft | approved | locked
  -- SEO Fields
  seo_title text
  meta_description text
  h1 text
  slug text
  search_intent text
  strategic_purpose text
  secondary_keywords jsonb
  heading_hierarchy jsonb
  content_blocks jsonb
  cta_blocks jsonb
  image_plan jsonb
  alt_texts jsonb
  schema_type text
  canonical_url text
  faq jsonb
  -- QA (client-side hesaplanan scores burada saklanabilir)
  qa_scores jsonb
  -- Traceability
  generated_by text            -- 'ai' | 'manual'
  ai_model text                -- 'claude-sonnet-4-6'
  -- Timestamps
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()
  approved_at timestamptz
  locked_at timestamptz
```

**Kısıt:** Bir `page_id` için en fazla 1 aktif package (Phase 9'da). Versioning Phase 12'de gelir.

### D-02: Package Doğuş Anı

Package satırı, kullanıcı "AI ile Üret" veya "Manuel Başlat" aksiyonunu aldığında oluşur. Sayfa eklenince otomatik oluşmaz. Sayfa listesinde package olmayan sayfalar "Paket Yok" badge gösterir + Generate/Başlat butonu.

### D-03: Status Workflow — 3 Adım

```
draft → approved → locked
```

- `draft`: Üretilmiş, düzenlenebilir. AI generate sonrası otomatik.
- `approved`: Kullanıcı onayladı. Düzenlenebilir ama "onaylandı" işaretli.
- `locked`: Kilitli. UI edit alanlarını `disabled` gösterir. "Kilidini Aç" butonu unlock eder (status → approved).

Locked package AI regenerate ile değiştirilemez — kullanıcı önce kilidini açmalı.

### D-04: QA — Basit Client-Side Validator

İkinci model yok. Sadece anında client-side kurallar:

| Kural | Şart | Severity |
|-------|------|----------|
| SEO Title uzunluğu | ≤60 karakter | warning (>60) / error (>70) |
| Meta Description uzunluğu | ≤155 karakter | warning (>155) / error (>170) |
| H1 dolu mu | boş olmamalı | error |
| Focus keyword title'da var mı | seo_title.toLowerCase().includes(focusKw) | warning |

QA indicator: Package editor header'ında küçük badge — "✓ QA Geçti" / "⚠ 2 Uyarı" / "✕ Hata".
Phase 10'da rules engine + ikinci model entegrasyonu gelecek.

### D-05: Migration Stratejisi

`pages` tablosuna dokunulmaz. Mevcut package columns (seo_title vb.) fiziksel olarak pages'te kalır ama dondurulur:
- `sayfa-paketi/page.tsx` artık `page_packages` tablosunu sorgular
- `updatePagePackage` action artık `page_packages` tablosuna yazar
- Mevcut `pages` package columns için herhangi bir veri migration yapılmaz
- Mevcut veri varsa kaybolur (Phase 9 fresh start — production'da veri yok)

### D-06: Bulk Generation

Phase 9 dışı. Tek sayfa generation Phase 9'da. Bulk Phase 10+.

### D-07: Versioning

Phase 12'ye ertelendi. Phase 9'da page_id UNIQUE constraint — bir sayfada tek package.

### D-08: AI Provider

Doğrudan `@anthropic-ai/sdk` kullanımı korunur. Adapter katmanı eklenmez.
`/api/ai/generate-page-package/route.ts` stream endpoint güncellenir: artık `page_packages` tablosuna yazar (veya response'u client'a döner, client save eder).

### Claude's Discretion

- `page_packages` tablosuna RLS policy nasıl yazılacak (standart user_id + project_id pattern — önceki fazlarla tutarlı)
- `updated_at` trigger vs manual set (manual set pattern mevcut kodda yerleşik)
- Package editor içinde section ordering ve layout iyileştirmeleri

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Implementation
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx` — Mevcut 3-panel layout (evolve edilecek)
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` — Mevcut editör (page_packages'a migrate)
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` — `updatePagePackage` (yeni tabloya yazacak şekilde güncellenir)
- `src/app/api/ai/generate-page-package/route.ts` — AI streaming endpoint (güncellenir)

### DB Schema (mevcut pages tablosu için)
- `supabase/migrations/` — Mevcut migration'lar, pages tablosu yapısı
- `src/app/(dashboard)/projeler/[id]/sayfalar/actions.ts` — `updatePageAttributes` ownership check pattern (D-01 migration için referans)

### Prior Phase Patterns
- `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/actions.ts` — Phase 8 server action pattern (auth + ownership + Supabase upsert)
- `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/SuggestLinksDialog.tsx` — `useTransition` + `router.refresh()` pattern

### UI Constraints (önceki fazlardan yerleşik)
- base-ui `DialogTrigger` → `render={}` prop, NOT `asChild`
- Badge → `className` ile doğrudan renk, `variant` prop YOK
- `font-medium` YASAK (UI-SPEC constraint — tüm önceki fazlarda uygulandı)
- Tailwind v4 CSS-first: `tailwind.config.ts` yok

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Button`, `Input`, `Textarea`, `Label` — mevcut shadcn bileşenleri, PagePackageEditor'da zaten kullanılıyor
- `cn()` — tüm conditional className'ler için
- `useTransition` + `router.refresh()` — save/action sonrası refresh pattern
- `createClient()` — server-side Supabase client
- `ProjectNav` — sol nav bileşeni, değişmez

### Established Patterns
- Server Actions: `'use server'` + auth check + ownership verify + DB op + revalidatePath
- Client state: `useState` per field + `useTransition` for pending
- Status badges: `STATUS_LABELS` record pattern (zaten sayfa-paketi/page.tsx'te var)
- JSONB fields: `jsonString()` / `parseJsonField()` helper pattern (zaten PagePackageEditor'da)

### Integration Points
- `page_packages` tablosu `pages.id` foreign key üzerinden bağlanır
- `sayfa-paketi/page.tsx`: `pages` sorgusuna ek olarak `page_packages` join veya ayrı sorgu
- Sayfa listesinde package status badge gösterimi: package kaydı yoksa "Paket Yok"
- AI route: `page_packages` tablosuna yazar veya client-side apply pattern korunur

### Existing pages Table Package Columns (dondurulacak)
Aşağıdaki columns fiziksel olarak pages'te kalır ama artık UI bunları kullanmayacak:
`seo_title, meta_description, h1, heading_hierarchy, content_blocks, cta_blocks,
image_plan, alt_texts, secondary_keywords, faq, schema_type, canonical_url,
search_intent, strategic_purpose, trust_blocks, audit_scores`

</code_context>

<specifics>
## Specific Ideas

- Sayfa listesi paneli (sol orta): Her satırda `package_status` badge — `draft` / `approved` / `locked` / `—` (yok). Package yoksa "Üret" / "Manuel Başlat" inline aksiyonu.
- Package editor header: QA badge + status badge + Onayla / Kilitle / Kilidini Aç aksiyonları.
- Locked state: Tüm form alanları `disabled`. Sarı border veya opacity overlay. "Bu paket kilitli — düzenlemek için kilidini aç" banner.
- "Manuel Başlat" seçeneği: Boş form açılır, kullanıcı sıfırdan doldurur. AI generate zorunlu değil.
- AI generate flow: Mevcut streaming pattern korunur. Generate sonrası otomatik `draft` status ile `page_packages` kaydı oluşur.

</specifics>

<deferred>
## Deferred Ideas

- **Versioning / diff görünümü** — Phase 12. Phase 9'da page_id UNIQUE constraint.
- **Bulk generation dialog** — Phase 10+. "Package olmayan tüm sayfalar" seçimi + sırayla generate.
- **İkinci model QA engine** — Phase 10. Rules engine entegrasyonu + QA score hesaplama.
- **Publishing payload / WordPress export** — Phase 12.
- **Lock history audit trail** — Phase 12.
- **page_packages_qa_results ayrı tablosu** — Phase 10.
- **Schema JSON-LD preview** — Phase 11.
- **Competitor angle summary alanı** — Phase 9 kapsamına dahil edilmedi, package üretiminde AI prompt içinde dolaylı olarak kapsanabilir.

</deferred>

---

*Phase: 09-page-package-generator*
*Context gathered: 2026-04-24*
