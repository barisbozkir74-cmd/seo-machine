# Phase 14: GSC Integration - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Kullanıcı proje başına Google Search Console property'sini OAuth ile bağlar; yayınlanan sayfalar için index durumunu manuel kontrol eder; sayfa ve keyword bazlı tıklama/gösterim/pozisyon verisi self-hosted n8n + manuel tetikleyici ile günlük olarak Supabase'e çekilir.

**In scope:**
- Google OAuth 2.0 flow (API route callback + state cookie)
- Token refresh otomatik (server action içinde)
- Property selection dropdown (OAuth sonrası, proje detay sayfasında)
- gsc_tokens JSONB on projects (zaten kararlaştırılmış)
- Index durumu: manuel "Kontrol Et" — GSC URL Inspection API
- Index badge: hem Sayfa Paketi hem İçerik Studio
- GSC Search Analytics günlük sync: self-hosted n8n + manuel "Senkronize Et" butonu
- Yeni `gsc_metrics` tablosu (page_id, date, keyword, clicks, impressions, avg_position)

**Out of scope:**
- Monitoring dashboard, decay alert (Phase 15)
- Recovery engine (Phase 16)
- Otomatik yayın sonrası index check (kullanıcı manuel tetikler)

</domain>

<decisions>
## Implementation Decisions

### OAuth Flow
- **D-01:** API route `/api/gsc/callback` — Google OAuth kodunu bu endpoint'e redirect eder; server action token'ları Supabase'e yazar. NextAuth veya n8n kullanılmaz.
- **D-02:** OAuth state → HttpOnly cookie (CSRF koruması). Access token expire olunca refresh_token ile otomatik yenileme (server action içinde).
- **D-03:** Scopes: `https://www.googleapis.com/auth/webmasters.readonly` + `https://www.googleapis.com/auth/webmasters` (URL Inspection için)

### Property Seçimi
- **D-04:** OAuth callback tamamlanınca kullanıcı proje detay sayfasına yönlendirilir; GSC bölümünde Search Console API'den çekilen property listesi inline dropdown olarak açılır. Kullanıcı seçim yapar → `projects.gsc_property_url` güncellenir.
- **D-05:** GSC bağlantı bölümü, WordPress bölümüyle aynı pattern — proje detay sayfasında (`/projeler/[id]`) `GscConnectionSection` client component olarak.

### Index Durumu (GSC-02)
- **D-06:** Index kontrolü manuel: İçerik Studio'da "Index Durumunu Kontrol Et" butonu → server action → GSC URL Inspection API → sonuç `page_packages.gsc_index_status` (text: `'indexed' | 'not_indexed' | 'crawled_not_indexed'`) sütununa kaydedilir.
- **D-07:** Index badge her iki yerde görünür:
  - Sayfa Paketi listesinde (sol panel, WP badge'lerinin yanında)
  - İçerik Studio'da (HtmlReadyBanner veya sayfa başlığında)
- **D-08:** `gsc_index_status` ve `gsc_index_checked_at` kolonları `page_packages` tablosuna migration ile eklenir.

### Performans Verisi Sync (GSC-03)
- **D-09:** Self-hosted n8n instance'a yeni workflow eklenir. Günlük schedule + kullanıcı manuel tetikleyebilir ("Senkronize Et" butonu → n8n webhook endpoint'i çağırır).
- **D-10:** n8n → GSC Search Analytics API → Supabase REST (service role key) upsert.
- **D-11:** Yeni `gsc_metrics` tablosu:
  ```sql
  gsc_metrics (
    id uuid,
    project_id uuid,
    page_id uuid REFERENCES pages(id),
    date date,
    keyword text,
    clicks integer,
    impressions integer,
    avg_position numeric(5,2),
    created_at timestamptz
    -- UNIQUE(page_id, date, keyword) for upsert
  )
  ```
- **D-12:** n8n için Supabase service role key + GSC token (projects tablosundan okunur) gerekli. GSC token'ı n8n'e nasıl iletilir: Next.js server action bir "sync trigger" endpoint'i sağlar (POST /api/gsc/sync); n8n bu endpoint'i çağırır, uygulama kendi Supabase'inden token'ı okur ve GSC API'yi çağırır. Alternatif: n8n doğrudan Supabase'den token okur.

### Claude'un Kararına Bırakılanlar
- n8n'in GSC token'a erişim yöntemi (D-12 alternatif seçimi) — implementasyon kolaylığına göre planner karar verir
- gsc_metrics tablo index'leri (page_id + date bileşik index vs. tek tek)
- "Senkronize Et" butonunun tam konumu (proje detay sayfası GSC bölümü)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §GSC & Monitoring — GSC-01, GSC-02, GSC-03 gereksinimleri

### Roadmap
- `.planning/ROADMAP.md` §Phase 14 — success criteria ve depends-on

### Mevcut Pattern Referansları
- `src/app/(dashboard)/projeler/[id]/wordpress-section.tsx` — GscConnectionSection için model (client component, badge, form pattern)
- `src/lib/supabase/vault.ts` — credential storage pattern (WordPress → GSC token için farklı: JSONB on projects, not vault)
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` — publishToWordPress pattern (server action, ownership check, assertSafe guard)
- `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx` — index badge'i buraya ekleme noktası

### State Decisions (kararlaştırılmış, tekrar sorma)
- `.planning/STATE.md` §Decisions — "v3.0 GSC OAuth tokens: gsc_tokens JSONB column on projects — server-only"
- `.planning/STATE.md` §Decisions — "v3.0 n8n is available from Phase 14+ for GSC sync"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WordPressConnectionSection` pattern → GscConnectionSection için birebir model
- `hasWordPressCredentials()` in vault.ts → `hasGscConnected()` (projects tablosundan gsc_tokens kontrol)
- `assertSafeWpUrl()` guard pattern → GSC API URL'leri için de uygulanabilir
- `PackageStatusBadge` → index status badge için yeniden kullanılabilir veya yeni `GscIndexBadge`

### Established Patterns
- Server action + ownership triple-check (user + project + page) — tüm write action'larda zorunlu
- JSONB on projects — gsc_tokens bu pattern'ı kullanır (wp credentials vault'ta, gsc tokens projects tablosunda — farklı)
- Migration ile yeni kolon/tablo ekleme (supabase db push)
- `'use client'` + server action import (form interaktivitesi)

### Integration Points
- `src/app/(dashboard)/projeler/[id]/page.tsx` — GscConnectionSection buraya eklenir (WordPress gibi)
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` — index badge burada
- `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx` — index check butonu buraya
- `src/app/api/` — yeni `/api/gsc/callback` ve opsiyonel `/api/gsc/sync` route'ları

</code_context>

<specifics>
## Specific Ideas

- Index durumu için 3 state: `indexed` (yeşil), `not_indexed` (kırmızı), `crawled_not_indexed` (sarı) — WordPress badge renk pattern'ıyla tutarlı
- Property dropdown sonraki sohbette açıkça onaylandı: callback → proje sayfası → liste açılır
- self-hosted n8n: mevcut instance, yeni workflow olarak eklenir (ayrı kurulum yok)

</specifics>

<deferred>
## Deferred Ideas

- Monitoring dashboard (decay alert, cluster trafik özeti) → Phase 15
- GSC verisi ile keyword opportunity score güncelleme → Phase 17
- Otomatik yayın sonrası index submission (IndexNow veya GSC Request Indexing) → ileride tartışılabilir

</deferred>

---

*Phase: 14-gsc-integration*
*Context gathered: 2026-04-27*
