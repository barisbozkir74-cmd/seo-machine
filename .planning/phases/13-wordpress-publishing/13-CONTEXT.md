---
phase: 13-wordpress-publishing
type: context
created: "2026-04-26T00:00:00Z"
status: ready-for-planning
decisions_count: 4
---

# Phase 13: WordPress Publishing — Context

**Phase Goal:** Kullanıcı, HTML içeriği hazır olan kilitli sayfa paketlerini WordPress sitesine gönderebilir. Kimlik bilgileri Supabase Vault'ta saklanır; meta veriler (title, meta_description, schema_jsonld) SEO plugin'e uygun formatta iletilir.

---

## Requirements

| ID | Requirement |
|----|-------------|
| PUBL-01 | WordPress URL + Application Password proje başına saklanır (Supabase Vault) |
| PUBL-02 | Kullanıcı içeriği WordPress'e post/draft olarak gönderebilir |
| PUBL-03 | Meta veriler (title, meta_description, schema) SEO plugin formatında iletilir |
| PUBL-04 | Gönderim sonucu (WP post ID, URL, tarih) page_packages'a kaydedilir |

---

## Decisions

### D-01: Kimlik Bilgisi UI'ı
**Karar:** WordPress URL + Application Password formu **proje detay sayfasında** (/projeler/[id]) — yeni "WordPress Bağlantısı" bölümü.

**Uygulama:**
- Mevcut `ProjectInfoSection` pattern'ini genişlet (server component + server action)
- Form alanları: `wp_url` (URL input), `wp_app_password` (password input, masked)
- Kaydetme: `vault.ts` server-only — `SUPABASE_SERVICE_ROLE_KEY` ile Vault write
- Vault key isimleri: `wp_url_{projectId}`, `wp_app_password_{projectId}`
- Form submit → server action → vault.ts → `supabase.vault.createSecret()` / `updateSecret()`
- Bağlantı durumu göstergesi: saved/not-configured badge (Vault'ta key var mı kontrol)
- Form: sadece "Kaydet" butonu — kimlik bilgisi doğrulama (`GET /wp-json/wp/v2/posts?per_page=1`) opsiyonel

### D-02: Gönderim Akışı
**Karar:** "WordPress'e Gönder" butonu **Content Studio'da**, HtmlReadyBanner yanında — tüm bölümler onaylandığında görünür.

**Uygulama:**
- `HtmlReadyBanner.tsx` genişletilir: mevcut yeşil banner'a buton eklenir
- Buton tıklanınca Dialog açılır (inline modal, not route): "Hemen Yayınla" / "Taslak Kaydet" seçimi
- Dialog içinde: post title (page_packages.focus_keyword veya title), seçim radyo butonları, [Gönder] + [Vazgeç]
- Gönderim: client-side fetch → Server Action → WordPress REST API
- Sayfa Paketi editöründe gönderim butonu yok (tek entry point)

### D-03: WP Meta & SEO Plugin
**Karar:** REST API `meta` alanlarına yaz, **plugin algılanarak** doğru anahtarlar seçilir.

**Uygulama:**
- `GET /wp-json/wp/v2/plugins` ile plugin listesi çekimi (Application Password ile)
- Plugin tespiti:
  - Yoast SEO: `{ _yoast_wpseo_title, _yoast_wpseo_metadesc }` + schema → `_yoast_wpseo_schema` (JSON string)
  - RankMath: `{ rank_math_title, rank_math_description }` + schema → `rank_math_schema` (JSON string)
  - Plugin yoksa: WP native `meta.description` alanı + schema skip
- Gönderilen payload:
  - `title`: page_packages.focus_keyword veya page_packages'taki başlık
  - `content`: page_packages.html_content (assembled HTML)
  - `meta_description`: page_packages.meta_description (mevcut alan)
  - `schema_jsonld`: page_packages.schema_jsonld (mevcut alan, JSON string)
- Plugin algılaması her gönderimde yapılır (cache yok — basitlik)

### D-04: Zamanlama UX
**Karar:** Dialog içinde 2 seçenek — **"Hemen Yayınla"** (`status=publish`) veya **"Taslak Kaydet"** (`status=draft`). Tarih/saat picker yok.

**Uygulama:**
- Dialog: RadioGroup ile iki seçenek (varsayılan: Hemen Yayınla)
- WP REST `POST /wp-json/wp/v2/posts` payload'ına `status` eklenir
- Gönderim başarılıysa response'tan `{ id, link, date }` alınır → page_packages'a yazılır
- Başarı durumu: HtmlReadyBanner güncellenir "WordPress'te yayında" + post URL linki

---

## Data Model Changes

### Yeni Vault Keys (per project)
```
wp_url_{projectId}           — WordPress site URL (https://example.com)
wp_app_password_{projectId}  — WordPress Application Password
```

### page_packages Yeni Alanlar (migration gerekli)
```sql
ALTER TABLE public.page_packages
  ADD COLUMN IF NOT EXISTS wp_post_id    INTEGER,
  ADD COLUMN IF NOT EXISTS wp_post_url   TEXT,
  ADD COLUMN IF NOT EXISTS wp_published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wp_status     TEXT;  -- 'publish' | 'draft'
```

---

## Architecture

```
[Content Studio — HtmlReadyBanner]
  └─ [WordPress'e Gönder] butonu
       └─ PublishDialog (client component)
            ├─ Hemen Yayınla / Taslak Kaydet (RadioGroup)
            └─ [Gönder] → Server Action: publishToWordPress(projectId, pageId, status)
                               ├─ vault.ts → wp_url + wp_app_password oku
                               ├─ GET /wp-json/wp/v2/plugins → plugin algıla
                               ├─ POST /wp-json/wp/v2/posts (Basic Auth: user:app_password)
                               └─ page_packages UPDATE: wp_post_id, wp_post_url, wp_status, wp_published_at

[Proje Detay Sayfası — /projeler/[id]]
  └─ "WordPress Bağlantısı" bölümü
       ├─ wp_url input
       ├─ wp_app_password input (masked)
       └─ [Kaydet] → Server Action: saveWordPressCredentials(projectId, url, password)
                          └─ vault.ts → Vault write/update
```

---

## Carry-Forward Constraints (STATE.md'den)

- `vault.ts` server-only — `SUPABASE_SERVICE_ROLE_KEY` hiçbir zaman `NEXT_PUBLIC_` olmaz
- WP credentials asla client bundle'a sızmaz (T-03-01 analogu)
- Tüm WP API çağrıları Server Action veya API route üzerinden yapılır
- Basic Auth: `Authorization: Basic base64(username:application_password)` — WP REST API standardı
- `wp_app_password` loglanmaz, response'ta gösterilmez

---

## Out of Scope (Bu Fazda)

- WP kategori/etiket atama — manuel
- WP ortam dosyası yükleme (medya) — manuel
- Revizyon yönetimi (WP post versioning)
- n8n entegrasyonu — Phase 16'ya ertelendi
- Tarih/saat zamanlama (future status) — ertelendi

---

## Deferred Ideas

| Fikir | Neden Ertelendi |
|-------|-----------------|
| Kategorisi atama dialog'u | Scope artışı; WP'de manuel yeterli |
| Medya upload | Ayrı bir Phase gerektiriyor |
| Scheduled publish (future status) | UX karmaşıklığı; Taslak + manuel yeterli |
| WP credentials test butonu | PUBL-01 doğrulama optional; bağlantı hatası publish'te anlaşılır |
