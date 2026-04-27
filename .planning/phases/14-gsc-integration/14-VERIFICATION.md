---
phase: 14-gsc-integration
verified: 2026-04-27T12:00:00Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 11/12
  gaps_closed:
    - "middleware.ts /api/gsc/sync pathname exception eklendi — n8n server-to-server POST 307 almaz"
    - "GscConnectionSection handleSync body'e userId eklendi — route 400 döndürmez"
  gaps_remaining: []
  regressions: []
gaps: []
human_verification:
  - test: "OAuth Flow Uçtan Uca — 'GSC Bağla' butonuna tıkla → Google consent screen → authorize → proje sayfasına dön → badge durumunu doğrula"
    expected: "Badge 'Yapılandırılmadı'dan 'Bağlı'ya döner; property dropdown görünür ve GSC hesabındaki property'ler listelenir"
    why_human: "Gerçek GOOGLE_CLIENT_ID/SECRET gerekli; Google OAuth interaktif; tarayıcı cookie akışı programatik test edilemez"
  - test: "Property Seçimi ve Kaydetme — OAuth sonrası dropdown'dan property seç → 'Seçimi Kaydet' → sayfayı yenile → property URL'nin kalıcı göründüğünü doğrula"
    expected: "gsc_property_url veritabanına yazılmış; sayfa yenilemesinde dropdown yerine seçili property gösteriliyor"
    why_human: "Gerçek GSC hesabı ve kayıtlı OAuth token gerekli"
  - test: "Index Kontrolü — Yayınlanmış sayfası olan bir projede 'Index Durumunu Kontrol Et' butonuna tıkla → badge'in güncellenmesini doğrula"
    expected: "Badge 'indexed', 'not_indexed' veya 'crawled_not_indexed' olarak güncellenir; son kontrol zamanı görünür"
    why_human: "Gerçek GSC bağlantısı ve URL Inspection API erişimi gerekli; wp_post_url dolu sayfa paketi gerekli"
  - test: "GSC Sync — middleware fix sonrası n8n webhook POST /api/gsc/sync (X-N8n-Webhook-Secret header ile) → gsc_metrics tablosunun dolduğunu doğrula"
    expected: "{ synced: N } response; DB'de gsc_metrics satırları; isGscConnected=true olan projede 'Senkronize Et' butonundan da çalışır"
    why_human: "n8n kurulumu ve gerçek GSC Search Analytics verisi gerekli; DB gsc_metrics satırları manual inspection"
---

# Phase 14: GSC Integration Verification Report (Re-verification)

**Phase Goal:** Kullanıcı proje başına Google Search Console property'sini OAuth ile bağlayabilir; sistem yayınlanan sayfalar için index durumunu ve sayfa/keyword bazlı tıklama, gösterim, pozisyon verisini GSC'den çekebilir
**Verified:** 2026-04-27T12:00:00Z
**Status:** human_needed
**Re-verification:** Evet — 14-06 gap closure planı sonrası

---

## Re-verification Özeti

Önceki doğrulamada 2 gap tespit edilmişti:

1. `middleware.ts` — `/api/gsc/sync` için pathname exception yoktu; n8n server-to-server çağrısı 307 redirect alıyordu.
2. `gsc-section.tsx` — `handleSync` body'de yalnızca `{ projectId }` gönderiyordu; route `userId` de beklediğinden 400 dönerdi.

Plan 14-06 her ikisini de kapattı. Kodda doğrulandı:

- `middleware.ts` satır 8: `if (pathname.startsWith('/api/gsc/sync')) { return NextResponse.next({ request }) }` — erken exit, Supabase client öncesi.
- `gsc-section.tsx` satır 96: `body: JSON.stringify({ projectId, userId })` — userId prop'tan geliyor.
- `page.tsx` satır 99: `userId={user.id}` — SSR'dan geçiriliyor.

Tüm 12 must-have geçti. Otomatik doğrulama kısmı tamamlandı; human verification items mevcut.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GSC için veritabanı altyapısı hazır — OAuth token ve performans metrikleri saklanabilir | VERIFIED | `supabase/migrations/20260427000002_gsc_schema.sql` mevcuttur — 3 blok tam |
| 2 | gsc_tokens JSONB ve gsc_property_url TEXT kolonları projects tablosunda mevcuttur | VERIFIED | Migration SQL satır 6-8; `ADD COLUMN IF NOT EXISTS gsc_tokens JSONB, gsc_property_url TEXT` |
| 3 | gsc_index_status ve gsc_index_checked_at kolonları page_packages tablosunda mevcuttur | VERIFIED | Migration SQL satır 14-16; CHECK constraint ile `NULL\|indexed\|not_indexed\|crawled_not_indexed` |
| 4 | gsc_metrics tablosu UNIQUE(page_id, date, keyword) constraint ve RLS ile mevcuttur | VERIFIED | Migration SQL satır 31, 44-51; RLS policy `gsc_metrics_select_own` oluşturulmuş |
| 5 | GSC token okuma, yenileme ve geçerlilik kontrolü tek helper'da kapsüllenmiştir | VERIFIED | `src/lib/gsc/auth.ts` — `getValidGscToken`, `saveGscTokens`, `GscTokensSchema` export ediyor; `import 'server-only'` guard mevcut |
| 6 | URL Inspection API verdict (PASS/FAIL/NEUTRAL) doğru badge state'ine map edilir | VERIFIED | `src/lib/gsc/index-check.ts` satır 26-29 — PASS→indexed, FAIL→not_indexed, NEUTRAL→crawled_not_indexed |
| 7 | OAuth callback route CSRF state kontrolü yapar, token exchange gerçekleştirir | VERIFIED | `src/app/api/gsc/callback/route.ts` — `gsc_oauth_state` cookie kontrolü, delete, `savedState !== state` check, `saveGscTokens` çağrısı, `/projeler/[id]` redirect |
| 8 | GscConnectionSection proje detay sayfasında görünür ve doğru prop'larla wired | VERIFIED | `page.tsx` satır 97-102 — Separator + GscConnectionSection; `userId={user.id}` prop geçilmiş; `gsc_tokens` ana SELECT'e dahil edilmemiş |
| 9 | Bağlı değilse 'GSC Bağla' butonu; property seçiliyse 'Senkronize Et' butonu mevcuttur | VERIFIED | `gsc-section.tsx` — GSC Bağla (isConnected=false), Senkronize Et (isConnected && gscPropertyUrl) |
| 10 | GscIndexBadge 3 renk state ile doğru render edilir (indexed/not_indexed/crawled_not_indexed) | VERIFIED | `GscIndexBadge.tsx` — emerald/red/amber className'ler; `aria-live="polite"`; null → null return |
| 11 | HtmlReadyBanner'da 'Index Durumunu Kontrol Et' butonu mevcuttur ve checkIndexStatus action'ı çağırır | VERIFIED | `HtmlReadyBanner.tsx` satır 55, 82 — `checkIndexStatus` import + handler; 3 banner varyantında mevcut |
| 12 | n8n server-to-server POST /api/gsc/sync middleware'i bypass eder ve route 400 döndürmez | VERIFIED | `middleware.ts` satır 8: erken exit; `gsc-section.tsx` satır 96: `{ projectId, userId }` body; `page.tsx` satır 99: `userId={user.id}` |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `supabase/migrations/20260427000002_gsc_schema.sql` | VERIFIED | 3 migration bloğu, UNIQUE constraint, RLS policy, 2 composite index |
| `src/lib/gsc/auth.ts` | VERIFIED | `import 'server-only'` + GscTokensSchema (Zod) + getValidGscToken (refresh logic) + saveGscTokens |
| `src/lib/gsc/properties.ts` | VERIFIED | `import 'server-only'` + listGscProperties (accessToken param) |
| `src/lib/gsc/index-check.ts` | VERIFIED | `import 'server-only'` + checkUrlIndexStatus + PASS/FAIL/NEUTRAL mapping |
| `src/lib/gsc/search-analytics.ts` | VERIFIED | `import 'server-only'` + fetchSearchAnalytics + keys[0]/keys[1] parse + avgPosition rounding |
| `src/lib/gsc/__tests__/auth.test.ts` | VERIFIED | 4 test case — geçerli token, null tokens, refresh tetikleme, refresh başarısız |
| `src/lib/gsc/__tests__/index-check.test.ts` | VERIFIED | 5 test case — PASS/FAIL/NEUTRAL/bilinmeyen/res.ok false |
| `src/lib/gsc/__tests__/search-analytics.test.ts` | VERIFIED | 3 test case — rows parse, boş rows, res.ok false |
| `src/app/api/gsc/callback/route.ts` | VERIFIED | GET handler — CSRF check, cookie delete, token exchange, saveGscTokens, origin-safe redirect |
| `src/app/(dashboard)/projeler/[id]/actions.ts` | VERIFIED | `initiateGscOAuth` (state cookie + Google redirect) + `saveGscProperty` eklendi |
| `.env.local.example` | VERIFIED | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_APP_URL, N8N_WEBHOOK_URL, N8N_WEBHOOK_SECRET |
| `src/app/api/gsc/properties/route.ts` | VERIFIED | GET handler — auth + ownership + getValidGscToken + listGscProperties(accessToken) |
| `src/app/(dashboard)/projeler/[id]/gsc-section.tsx` | VERIFIED | GscConnectionSection — userId prop, D-04 useEffect, property dropdown, badge, { projectId, userId } sync body |
| `src/app/api/gsc/sync/route.ts` | VERIFIED | POST handler — X-N8n-Webhook-Secret check, ownership, fetchSearchAnalytics, gsc_metrics upsert |
| `middleware.ts` | VERIFIED | `/api/gsc/sync` için erken exit (satır 8) — Supabase client öncesi |
| `src/app/(dashboard)/projeler/[id]/page.tsx` | VERIFIED | GscConnectionSection import + render; `userId={user.id}` prop; gsc_tokens ayrı sorgu (SELECT'e dahil edilmemiş) |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/GscIndexBadge.tsx` | VERIFIED | 3 renk state + null guard + aria-live="polite" |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` | VERIFIED | `checkIndexStatus` — triple-check + URL Inspection API + gsc_index_status/gsc_index_checked_at update |
| `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx` | VERIFIED | Yeni props + handleCheckIndex + "Index Durumunu Kontrol Et" butonu + GscIndexBadge |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` | VERIFIED | gsc_index_status tipi eklendi + GscIndexBadge sol panelde render |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `gsc_metrics.page_id` | `pages.id` | `REFERENCES public.pages(id) ON DELETE CASCADE` | WIRED | Migration SQL |
| `gsc_metrics.project_id` | `projects.id` | `REFERENCES public.projects(id) ON DELETE CASCADE` | WIRED | Migration SQL |
| `src/lib/gsc/auth.ts` | `projects.gsc_tokens` | `from('projects').select('gsc_tokens').eq('user_id', userId)` | WIRED | auth.ts satır 30-36 |
| `src/lib/gsc/index-check.ts` | GSC URL Inspection API | `urlInspection/index:inspect` POST | WIRED | index-check.ts satır 6-9 |
| `initiateGscOAuth` | `/api/gsc/callback` | `redirect_uri` query param | WIRED | actions.ts satır 216 |
| `/api/gsc/callback` | `projects.gsc_tokens` | `saveGscTokens(projectId, user.id, ...)` | WIRED | callback/route.ts satır 60-65 |
| `/api/gsc/callback` | `gsc_oauth_state cookie` | `cookieStore.get + cookieStore.delete` | WIRED | callback/route.ts satır 14-15 |
| `GscConnectionSection (useEffect)` | `/api/gsc/properties` | `fetch('/api/gsc/properties?projectId=...')` | WIRED | gsc-section.tsx satır 39 |
| `GscConnectionSection` | `initiateGscOAuth` | `onClick → handleConnect → initiateGscOAuth(projectId)` | WIRED | gsc-section.tsx satır 64 |
| `GscConnectionSection` | `saveGscProperty` | `handleSaveProperty → saveGscProperty(projectId, selectedProperty)` | WIRED | gsc-section.tsx satır 76 |
| `GscConnectionSection handleSync` | `/api/gsc/sync` | `fetch POST + { projectId, userId }` | WIRED | gsc-section.tsx satır 93-97 |
| `middleware.ts` | `/api/gsc/sync route.ts` | `pathname.startsWith('/api/gsc/sync')` erken exit | WIRED | middleware.ts satır 8 |
| `page.tsx` | `GscConnectionSection` | SSR props: projectId, userId, isGscConnected, gscPropertyUrl | WIRED | page.tsx satır 97-102 |
| `/api/gsc/sync` | `fetchSearchAnalytics` | `getValidGscToken + fetchSearchAnalytics(...)` | WIRED | sync/route.ts satır 52, 66 |
| `/api/gsc/sync` | `gsc_metrics upsert` | `.upsert(metricsToUpsert, { onConflict: 'page_id,date,keyword' })` | WIRED | sync/route.ts satır 110 |
| `HtmlReadyBanner` | `checkIndexStatus` | `handleCheckIndex → checkIndexStatus(pagePackageId, projectId, ...)` | WIRED | HtmlReadyBanner.tsx satır 55 |
| `checkIndexStatus` | `page_packages.gsc_index_status` | `.update({ gsc_index_status, gsc_index_checked_at })` | WIRED | sayfa-paketi/actions.ts satır 692-693 |
| `PagePackageEditor` | `GscIndexBadge` | `page.pkg?.gsc_index_status` prop | WIRED | PagePackageEditor.tsx satır 615 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `gsc-section.tsx` | `properties` state | `fetch('/api/gsc/properties')` → `getValidGscToken` → `listGscProperties(accessToken)` → GSC Sites.list API | Evet — gerçek API çağrısı | FLOWING |
| `gsc-section.tsx` | `syncSuccess` | `POST /api/gsc/sync` → `fetchSearchAnalytics` → `gsc_metrics.upsert` | Evet — middleware bypass + userId wired | FLOWING |
| `HtmlReadyBanner.tsx` | `indexStatus` | `checkIndexStatus(...)` → `checkUrlIndexStatus(...)` → GSC URL Inspection API → DB write | Evet — gerçek API + DB yazma | FLOWING |
| `PagePackageEditor.tsx` | `pkg?.gsc_index_status` | SSR: page_packages DB'den okunuyor (çağıran geçiriyor) | SSR caller'a bağlı; tip eklendi | FLOWING |
| `page.tsx` | `isGscConnected` | Ayrı Supabase sorgusu `select('gsc_tokens')` null check | Evet — gerçek DB sorgusu | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Migration tüm gerekli string'leri içeriyor | `grep "gsc_tokens\|gsc_metrics\|UNIQUE" migration SQL` | Tüm eşleşmeler bulundu | PASS |
| 4 lib dosyasında server-only guard var | `grep "import 'server-only'" 4 dosya` | 4/4 bulunan; satır 1'de | PASS |
| middleware /api/gsc/sync exception var | `grep "pathname.startsWith('/api/gsc/sync')" middleware.ts` | Satır 8'de bulundu | PASS |
| sync route webhook secret kontrolü var | `grep "X-N8n-Webhook-Secret" sync/route.ts` | Satır 16'da bulundu | PASS |
| gsc-section.tsx userId sync body'de | `grep "projectId, userId" gsc-section.tsx` | Satır 96'da bulundu | PASS |
| page.tsx userId prop geçişi | `grep "userId={user.id}" page.tsx` | Satır 99'da bulundu | PASS |
| checkIndexStatus triple-check var | `grep "gsc_index_status\|gsc_index_checked_at" sayfa-paketi/actions.ts` | Satır 692-693'de bulundu | PASS |
| HtmlReadyBanner "Index Durumunu Kontrol Et" | `grep "Index Durumunu Kontrol Et" HtmlReadyBanner.tsx` | Satır 82'de bulundu | PASS |
| GscIndexBadge PagePackageEditor'a wired | `grep "GscIndexBadge" PagePackageEditor.tsx` | Satır 13, 615'de bulundu | PASS |

---

### Requirements Coverage

| Requirement | Kaynak Plan(lar) | Açıklama | Status | Kanıt |
|-------------|-----------------|----------|--------|-------|
| GSC-01 | 14-01, 14-02, 14-03, 14-04 | Kullanıcı proje başına Google Search Console property OAuth ile bağlayabilir | SATISFIED | OAuth flow eksiksiz: `initiateGscOAuth` (state cookie + Google redirect), `/api/gsc/callback` (CSRF check, token exchange, `saveGscTokens`), `saveGscProperty` (property URL), `GscConnectionSection` (UI ile bağlama). Token güvenli saklanıyor (gsc_tokens JSONB, server-only, ana SELECT'e dahil edilmemiş). |
| GSC-02 | 14-01, 14-05 | Sistem yayınlanan sayfalar için index durumunu GSC'den çeker ve gösterir | SATISFIED | `checkIndexStatus` server action (URL Inspection API → gsc_index_status), `GscIndexBadge` (3 durum, emerald/red/amber), `HtmlReadyBanner` entegrasyonu ("Index Durumunu Kontrol Et"), `PagePackageEditor` sol panel badge. |
| GSC-03 | 14-01, 14-02, 14-04, 14-06 | Sistem sayfa ve keyword bazında tıklama, gösterim, ortalama pozisyon verisini GSC'den çeker | SATISFIED | `fetchSearchAnalytics` (keys[0]=page, keys[1]=keyword, position→avgPosition), `gsc_metrics` tablosu (UNIQUE constraint, RLS), `/api/gsc/sync` (webhook secret + ownership + upsert), middleware bypass (satır 8 erken exit), userId prop zinciri (page.tsx → gsc-section.tsx → sync body). |

**REQUIREMENTS.md'de Phase 14'e atanan gereksinimler:** GSC-01, GSC-02, GSC-03 — tümü hesapta. Orphan requirement yok.

---

### Anti-Patterns Found

Yeniden doğrulama kapsamında önceki iki blocker/warning her ikisi de giderildi:

| Dosya | Önceki Sorun | Durum |
|-------|-------------|-------|
| `middleware.ts` | `/api/gsc/sync` exception yoktu — n8n 307 alırdı | FIXED — satır 8 erken exit |
| `src/app/(dashboard)/projeler/[id]/gsc-section.tsx` | `{ projectId }` body eksik userId — route 400 dönerdi | FIXED — `{ projectId, userId }` |

Kalan önemli kod notu: `page.tsx` satır 39'da `gsc_tokens` için ayrı bir SELECT sorgusu var (null check amacıyla). Bu kasıtlı bir güvenlik kararı — ana `select(...)` string'ine dahil edilmemiş. Mimari doğru, stub değil.

---

### Human Verification Required

#### 1. OAuth Flow Uçtan Uca

**Test:** Bir projede "GSC Bağla" butonuna tıkla → Google OAuth consent screen'e yönlendirildiğini doğrula → Google hesabıyla izin ver → proje sayfasına döndüğünde "Bağlı" badge'inin göründüğünü doğrula
**Expected:** Badge "Yapılandırılmadı"dan "Bağlı"ya döner; property dropdown görünür ve GSC hesabındaki property'ler listelenir
**Why human:** Gerçek GOOGLE_CLIENT_ID/SECRET gerekli; Google OAuth interaktif; tarayıcı cookie akışı programatik test edilemez

#### 2. Property Seçimi ve Kaydetme

**Test:** OAuth sonrası property dropdown'dan bir property seç → "Seçimi Kaydet" → sayfayı yenile → property URL'nin kalıcı göründüğünü doğrula
**Expected:** `gsc_property_url` veritabanına yazılmış; sayfa yenilemesinde dropdown yerine seçili property string'i gösteriliyor
**Why human:** Gerçek GSC hesabı ve kayıtlı OAuth token gerekli

#### 3. Index Durumu Kontrolü

**Test:** Yayınlanmış sayfası (`wp_post_url` dolu) olan bir projede "Index Durumunu Kontrol Et" butonuna tıkla → badge güncellemesini doğrula
**Expected:** Badge `indexed`, `not_indexed` veya `crawled_not_indexed` olarak güncellenir; son kontrol zamanı görünür; DB'de `gsc_index_status` ve `gsc_index_checked_at` güncellendi
**Why human:** Gerçek GSC bağlantısı, URL Inspection API erişimi ve `wp_post_url` dolu sayfa paketi gerekli

#### 4. GSC Sync Uçtan Uca

**Test:** n8n webhook'undan `POST /api/gsc/sync` çağrısı yap (X-N8n-Webhook-Secret header ile, `{ projectId, userId }` body ile) → `{ synced: N }` response → `gsc_metrics` tablosunu kontrol et
**Expected:** HTTP 200 + synced count; DB'de `gsc_metrics` satırları; "Senkronize Et" butonundan da çalışır
**Why human:** n8n kurulumu ve gerçek GSC Search Analytics verisi gerekli; DB satırları manual inspection

---

### Gaps Summary

Önceki doğrulamadaki 2 gap Plan 14-06 ile kapatıldı. Yeni gap bulunmadı.

Tüm 12 must-have doğrulandı. Otomatik doğrulama kapsamı tamam. Human verification items OAuth akışı, property yönetimi, index kontrolü ve sync tetikleme için gerçek Google hesabı gerektiriyor — bu programatik doğrulamanın dışında.

---

_Verified: 2026-04-27T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Plan 14-06 gap closure sonrası_
