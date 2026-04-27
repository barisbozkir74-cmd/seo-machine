# Phase 14: GSC Integration - Research

**Researched:** 2026-04-27
**Domain:** Google OAuth 2.0, Google Search Console API (URL Inspection + Search Analytics), n8n workflow, Supabase JSONB token storage
**Confidence:** HIGH (core API mechanics verified via official docs; n8n integration approach based on codebase patterns and D-12 decision)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** API route `/api/gsc/callback` — Google OAuth kodunu bu endpoint'e redirect eder; server action token'ları Supabase'e yazar. NextAuth veya n8n kullanılmaz.
- **D-02:** OAuth state → HttpOnly cookie (CSRF koruması). Access token expire olunca refresh_token ile otomatik yenileme (server action içinde).
- **D-03:** Scopes: `https://www.googleapis.com/auth/webmasters.readonly` + `https://www.googleapis.com/auth/webmasters` (URL Inspection için)
- **D-04:** OAuth callback tamamlanınca kullanıcı proje detay sayfasına yönlendirilir; GSC bölümünde Search Console API'den çekilen property listesi inline dropdown olarak açılır. Kullanıcı seçim yapar → `projects.gsc_property_url` güncellenir.
- **D-05:** GSC bağlantı bölümü, WordPress bölümüyle aynı pattern — proje detay sayfasında (`/projeler/[id]`) `GscConnectionSection` client component olarak.
- **D-06:** Index kontrolü manuel: İçerik Studio'da "Index Durumunu Kontrol Et" butonu → server action → GSC URL Inspection API → sonuç `page_packages.gsc_index_status` sütununa kaydedilir.
- **D-07:** Index badge her iki yerde görünür: Sayfa Paketi listesinde (sol panel) ve İçerik Studio'da (HtmlReadyBanner veya sayfa başlığında)
- **D-08:** `gsc_index_status` ve `gsc_index_checked_at` kolonları `page_packages` tablosuna migration ile eklenir.
- **D-09:** Self-hosted n8n instance'a yeni workflow eklenir. Günlük schedule + kullanıcı manuel tetikleyebilir ("Senkronize Et" butonu → n8n webhook endpoint'i çağırır).
- **D-10:** n8n → GSC Search Analytics API → Supabase REST (service role key) upsert.
- **D-11:** Yeni `gsc_metrics` tablosu: `(id uuid, project_id uuid, page_id uuid REFERENCES pages(id), date date, keyword text, clicks integer, impressions integer, avg_position numeric(5,2), created_at timestamptz, UNIQUE(page_id, date, keyword))`
- **D-12:** n8n için GSC token erişimi: Next.js server action bir "sync trigger" endpoint'i sağlar (POST /api/gsc/sync); n8n bu endpoint'i çağırır, uygulama kendi Supabase'inden token'ı okur ve GSC API'yi çağırır.

### Claude's Discretion
- n8n'in GSC token'a erişim yöntemi — D-12'nin birinci alternatifi seçilmiş (POST /api/gsc/sync); planner implementasyon detaylarını belirler
- gsc_metrics tablo index'leri (page_id + date bileşik index vs. tek tek)
- "Senkronize Et" butonunun tam konumu (proje detay sayfası GSC bölümü — GscConnectionSection içinde önerilir)

### Deferred Ideas (OUT OF SCOPE)
- Monitoring dashboard (decay alert, cluster trafik özeti) → Phase 15
- GSC verisi ile keyword opportunity score güncelleme → Phase 17
- Otomatik yayın sonrası index submission (IndexNow veya GSC Request Indexing) → ileride tartışılabilir
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GSC-01 | Kullanıcı proje başına Google Search Console property OAuth ile bağlayabilir | D-01..D-05 — OAuth flow, callback route, JSONB token storage, property dropdown |
| GSC-02 | Sistem yayınlanan sayfalar için index durumunu GSC'den çeker ve gösterir | D-06..D-08 — URL Inspection API, badge, migration |
| GSC-03 | Sistem sayfa ve keyword bazında tıklama, gösterim, ortalama pozisyon verisini GSC'den çeker | D-09..D-12 — n8n workflow, Search Analytics API, gsc_metrics table |
</phase_requirements>

---

## Summary

Phase 14 entegre üç ayrı GSC capability'si içerir: (1) Google OAuth 2.0 authorization code flow ile proje başına token edinimi; (2) URL Inspection API ile manuel index durumu kontrolü; (3) Search Analytics API ile n8n aracılı günlük/manuel performans verisi sync.

OAuth flow standart server-side Google OAuth 2.0 pattern'ını izler: Next.js API route ile başlatma, HttpOnly cookie ile state saklama, `/api/gsc/callback` endpoint'inde token exchange, Supabase `projects.gsc_tokens` JSONB'ye yazma. Bu pattern Next.js Route Handler + server action kombinasyonu ile implemente edilir; NextAuth veya üçüncü taraf OAuth lib gerekmez.

URL Inspection API, `POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect` endpoint'ine token ile çağrı yapar; response'daki `indexStatusResult.verdict` (PASS/FAIL/NEUTRAL) değeri `indexed`/`not_indexed`/`crawled_not_indexed` badge state'ine çevrilir. Search Analytics API ise `page_id + date + keyword` boyutlarında satır döner; bu veriler n8n üzerinden Supabase REST upsert ile `gsc_metrics` tablosuna yazılır. Her iki GSC API için `googleapis` npm paketi (v171) veya doğrudan `fetch` kullanılabilir; uygulama şu anda `googleapis` bağımlılığı içermediğinden doğrudan `fetch` daha hafif bir tercih olabilir.

**Primary recommendation:** `googleapis` npm paketi yerine doğrudan `fetch` + `google-auth-library` kullanın; böylece bundle ağırlığı minimumda kalır ve mevcut `vault.ts` pattern'ına paralel server-only yapı korunur. n8n'in GSC token'a erişimi için D-12'nin ilk alternatifi (POST /api/gsc/sync) tercih edilir çünkü token decode ve refresh mantığı tek bir yerde (uygulama içinde) kalır ve n8n'e Supabase service role key vermek gerekmez.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OAuth authorization URL oluşturma | API / Backend (server action) | — | Client secret'ı gizli tutmak için server-only; state cookie yazma da burada |
| OAuth callback + token exchange | API / Backend (Route Handler) | — | Google, `redirect_uri` olan `/api/gsc/callback`'e geri döner; cookie okuma + token yazma burada |
| Token storage (gsc_tokens JSONB) | Database / Storage (Supabase) | API tier | projects tablosunda JSONB sütun; server action yazma, server component okuma |
| Token auto-refresh | API / Backend (server action) | — | expires_at kontrol + refresh_token akışı server-only |
| Property list fetching | API / Backend (server action) | — | Token kullanarak Sites.list çağrısı; client'a sadece listesi gelir |
| GscConnectionSection UI | Frontend (Client Component) | — | WordPressConnectionSection'ı mirror eden 'use client' component |
| Index check (URL Inspection) | API / Backend (server action) | — | Token okuma + GSC API çağrısı + page_packages write — server-only |
| Index badge render | Frontend (Client Component) | — | Sayfa listesi + ContentStudio'da salt görüntüleme; SSR'dan prop olarak gelir |
| GSC Search Analytics sync | n8n Workflow | API/Backend (trigger endpoint) | n8n schedule/webhook → POST /api/gsc/sync → server action token okur, GSC çağırır, gsc_metrics'e yazar |
| gsc_metrics persistence | Database / Storage (Supabase) | API tier | Upsert ile idempotent yazma; UNIQUE constraint sağlar |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `google-auth-library` | 10.6.2 [VERIFIED: npm view] | OAuth2 token exchange, refresh, Google API auth | Google'ın resmi Node.js auth kütüphanesi; googleapis'nin auth altyapısı da bunu kullanır |
| `@supabase/supabase-js` | 2.104.0 [VERIFIED: package.json] | Supabase client (server action + service role) | Projenin mevcut DB client'ı |
| `next` | 16.2.4 [VERIFIED: package.json] | Route Handler + Server Actions | Projenin framework'ü |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `googleapis` | 171.4.0 [VERIFIED: npm view] | Tüm Google API istemcisi (webmasters, searchconsole) | Daha az kod; ancak ekstra ~30MB bağımlılık; bu fazda doğrudan fetch yeterli |
| `zod` | 4.3.6 [VERIFIED: package.json] | JSONB token shape doğrulama, API response parse | Mevcut codebase standardı |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Doğrudan fetch + google-auth-library | googleapis tam paketi | googleapis daha az boilerplate sağlar; ancak ekstra ağırlık ve projeye yeni bağımlılık ekler. Fetch tercih edilirse google-auth-library zaten yeterli. |
| gsc_tokens JSONB on projects | Vault per-field | D-12 karar: JSONB tercih edildi çünkü access_token + refresh_token + expires_at atomik olarak birlikte saklanır ve Vault multi-key pattern daha karmaşık |
| HttpOnly cookie state | DB'de state saklama | Cookie daha basit, stateless, DB round-trip yok |

**Installation (eğer google-auth-library henüz ekli değilse):**
```bash
npm install google-auth-library
```

**Version verification:** [VERIFIED: npm view googleapis version → 171.4.0; npm view google-auth-library version → 10.6.2]

---

## Architecture Patterns

### System Architecture Diagram

```
Kullanıcı tarayıcısı
        │
        │ 1. "GSC Bağla" tıklar
        ▼
GscConnectionSection (Client)
        │
        │ server action: initiateGscOAuth()
        ▼
Server Action: initiateGscOAuth
  • state = randomUUID()
  • state HttpOnly cookie'ye yaz (gsc_oauth_state, 10 dk TTL)
  • Google authorization URL oluştur (client_id, redirect_uri, scope, state, access_type=offline)
  • router.push(authUrl)
        │
        │ Google OAuth consent screen
        ▼
/api/gsc/callback (Route Handler)
  • code + state query param'larını al
  • state cookie ile karşılaştır (CSRF)
  • token exchange (POST oauth2.googleapis.com/token)
  • gsc_tokens JSONB → projects tablosuna yaz
  • state cookie sil
  • redirect /projeler/[id]
        │
        ▼
GscConnectionSection (yenilendi)
  • isConnected = true → badge güncellendi
  • Sites.list çağrısı → property dropdown görünür
  • Kullanıcı property seçer → saveGscProperty() server action
        │
        ▼
projects.gsc_property_url güncellendi
─────────────────────────────────────────────
INDEX CHECK FLOW (GSC-02):

HtmlReadyBanner / ContentStudioHeader
  • "Index Durumunu Kontrol Et" butonu
        │
        ▼
Server Action: checkIndexStatus(pageId, projectId)
  • getGscTokens() → gsc_tokens JSONB oku
  • token expired? → refreshGscToken() → JSONB güncelle
  • POST searchconsole.googleapis.com/v1/urlInspection/index:inspect
    { inspectionUrl: wp_post_url, siteUrl: gsc_property_url }
  • verdict → map → 'indexed'|'not_indexed'|'crawled_not_indexed'
  • page_packages.gsc_index_status + gsc_index_checked_at güncelle
        │
        ▼
GscIndexBadge (Client) — sayfa listesi + İçerik Studio
─────────────────────────────────────────────
SYNC FLOW (GSC-03):

n8n workflow (schedule: günlük 06:00 OR webhook)
        │
        │ POST /api/gsc/sync  { projectId }
        ▼
/api/gsc/sync (Route Handler veya Server Action endpoint)
  • API key / secret doğrulama (isteğe bağlı HMAC imzası)
  • getGscTokens(projectId) → JSONB
  • token refresh gerekirse → güncelle
  • GSC Search Analytics API çağrısı
    POST webmasters/v3/sites/{siteUrl}/searchAnalytics/query
    { startDate, endDate, dimensions: ['page','query'], rowLimit: 25000 }
  • Her satır → page url → pages tablosundan page_id çöz
  • gsc_metrics UPSERT (page_id, date, keyword, clicks, impressions, avg_position)
        │
        ▼
gsc_metrics tablosu güncellendi
```

### Recommended Project Structure
```
src/
├── app/
│   └── api/
│       └── gsc/
│           ├── callback/
│           │   └── route.ts          # OAuth callback Route Handler
│           └── sync/
│               └── route.ts          # n8n sync trigger endpoint
├── lib/
│   └── gsc/
│       ├── auth.ts                   # getGscTokens, saveGscTokens, refreshGscToken
│       ├── properties.ts             # listGscProperties (Sites.list)
│       ├── index-check.ts            # callUrlInspectionApi
│       └── search-analytics.ts       # callSearchAnalyticsApi
└── app/(dashboard)/projeler/[id]/
    └── gsc-section.tsx               # GscConnectionSection client component
```

### Pattern 1: OAuth State Cookie (CSRF Koruması)

**What:** HttpOnly cookie ile state parametresi saklama; callback'te karşılaştırma
**When to use:** OAuth flow başlatıldığında; state 10 dakika geçerli olmalı

```typescript
// Source: Next.js docs (nextjs.org/docs/app/api-reference/functions/cookies) + Google OAuth docs
// Server Action: initiateGscOAuth
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function initiateGscOAuth(projectId: string) {
  const state = `${projectId}:${crypto.randomUUID()}`
  const cookieStore = await cookies()
  
  cookieStore.set('gsc_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 dakika
    path: '/',
  })

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!)
  authUrl.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/gsc/callback`)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/webmasters',
  ].join(' '))
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent') // refresh_token garantisi için
  authUrl.searchParams.set('state', state)

  redirect(authUrl.toString())
}
```

**Kritik:** `prompt=consent` olmadan Google her zaman refresh_token dönmez. Token mevcut değilse sadece access_token döner ve 1 saat sonra işlevsiz kalır. [VERIFIED: Google OAuth2 docs]

### Pattern 2: Callback Route Handler — Token Exchange

```typescript
// Source: Google OAuth2 docs (developers.google.com/identity/protocols/oauth2/web-server)
// app/api/gsc/callback/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // CSRF kontrol
  const cookieStore = await cookies()
  const savedState = cookieStore.get('gsc_oauth_state')?.value
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL('/projeler?error=gsc_csrf', request.url))
  }
  cookieStore.delete('gsc_oauth_state')

  if (error || !code) {
    return NextResponse.redirect(new URL('/projeler?error=gsc_denied', request.url))
  }

  // projectId state'ten çıkar (format: "projectId:uuid")
  const projectId = state.split(':')[0]

  // Token exchange
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/gsc/callback`,
      grant_type: 'authorization_code',
    }),
  })
  const tokens = await tokenRes.json()
  // tokens: { access_token, refresh_token, expires_in, token_type, scope }

  // Supabase'e kaydet — ownership doğrula
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  await supabase
    .from('projects')
    .update({
      gsc_tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
        token_type: tokens.token_type,
      }
    })
    .eq('id', projectId)
    .eq('user_id', user.id) // ownership garantisi

  return NextResponse.redirect(new URL(`/projeler/${projectId}`, request.url))
}
```

### Pattern 3: Token Auto-Refresh

```typescript
// Source: Google OAuth2 docs — token refresh
// lib/gsc/auth.ts
import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type GscTokens = {
  access_token: string
  refresh_token: string
  expires_at: number
  token_type: string
}

export async function getValidGscToken(projectId: string, userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: project } = await supabase
    .from('projects')
    .select('gsc_tokens')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (!project?.gsc_tokens) return null
  const tokens = project.gsc_tokens as GscTokens

  // Token hala geçerli (5 dakika tolerans)
  if (tokens.expires_at > Date.now() + 5 * 60 * 1000) {
    return tokens.access_token
  }

  // Refresh
  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const refreshed = await refreshRes.json()
  if (!refreshed.access_token) return null

  const newTokens: GscTokens = {
    ...tokens,
    access_token: refreshed.access_token,
    expires_at: Date.now() + refreshed.expires_in * 1000,
  }

  // JSONB güncelle — service role gerekmez, server action user context'i kullanır
  await supabase
    .from('projects')
    .update({ gsc_tokens: newTokens })
    .eq('id', projectId)
    .eq('user_id', userId)

  return newTokens.access_token
}
```

### Pattern 4: URL Inspection API Çağrısı

```typescript
// Source: developers.google.com/webmaster-tools/v1/urlInspection.index/inspect
export async function checkUrlIndexStatus(
  accessToken: string,
  inspectionUrl: string,
  siteUrl: string
): Promise<'indexed' | 'not_indexed' | 'crawled_not_indexed' | 'unknown'> {
  const res = await fetch(
    'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inspectionUrl, siteUrl }),
    }
  )
  const data = await res.json()
  const verdict = data?.inspectionResult?.indexStatusResult?.verdict

  // PASS = indexed, FAIL = not_indexed, NEUTRAL = crawled_not_indexed
  if (verdict === 'PASS') return 'indexed'
  if (verdict === 'FAIL') return 'not_indexed'
  if (verdict === 'NEUTRAL') return 'crawled_not_indexed'
  return 'unknown'
}
```

### Pattern 5: Search Analytics API Çağrısı

```typescript
// Source: developers.google.com/webmaster-tools/v1/searchanalytics/query
export async function fetchSearchAnalytics(
  accessToken: string,
  siteUrl: string,
  startDate: string, // YYYY-MM-DD
  endDate: string
) {
  const encodedSite = encodeURIComponent(siteUrl)
  const res = await fetch(
    `https://www.googleapis.com/webmaster/v3/sites/${encodedSite}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ['page', 'query'],
        rowLimit: 25000,
        dataState: 'final',
      }),
    }
  )
  return res.json()
  // response.rows: [{ keys: [pageUrl, keyword], clicks, impressions, ctr, position }]
}
```

### Pattern 6: GscIndexBadge (badge renk pattern)

WordPress badge ile tutarlı — direkt className, variant prop kullanılmaz:

```typescript
// Established pattern: PackageStatusBadge'den türetilir
const GSC_INDEX_STATUS: Record<string, { label: string; className: string }> = {
  indexed:              { label: 'İndekslendi',        className: 'bg-emerald-900/40 text-emerald-400' },
  not_indexed:          { label: 'İndekslenmedi',      className: 'bg-red-900/40 text-red-400' },
  crawled_not_indexed:  { label: 'Tarandı/İndekslenmedi', className: 'bg-amber-900/40 text-amber-400' },
}
```

### Anti-Patterns to Avoid

- **`prompt=consent` eksikliği:** `access_type=offline` yeterli değildir. Kullanıcı daha önce izin vermişse Google refresh_token dönmez. Her zaman `prompt=consent` kullanın. [VERIFIED: Google OAuth docs]
- **Token'ı client'a gönderme:** `gsc_tokens` JSONB asla `select` sorgusuna dahil edilmemeli; sadece server action/Route Handler okur.
- **State'i DB'de saklama:** HttpOnly cookie yeterli, DB round-trip gereksiz karmaşıklık ekler.
- **googleapis full bundle:** Sadece `webmasters` + `searchconsole` endpoint'leri lazım; `google-auth-library` + `fetch` çok daha hafif.
- **RLS bypass:** `gsc_tokens` güncellemesinde `.eq('user_id', userId)` şartı atlanmamalı; service role kullanılsa bile ownership check zorunlu (T-09-01-01 mitigasyonu).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth2 token exchange | Manuel URL encode / hash | `google-auth-library` OAuth2Client veya doğrudan `fetch` (örnekler yukarıda) | Google endpoint parametreleri hassas; encoding hatası 400 döner |
| Token expiry check | Timestamp karşılaştırma kendi başına | `getValidGscToken()` helper (Pattern 3) — refresh mantığını kapsüler | 5 dakika tolerans olmadan kenar durumlarda token expired error alınır |
| gsc_metrics upsert race | INSERT + UPDATE ayrı sorgular | Supabase `.upsert()` + `onConflict` | UNIQUE constraint + upsert idempotent n8n yeniden çalışmasına karşı güvenli |
| property URL encode | Manuel encode | `encodeURIComponent(siteUrl)` | sc-domain: prefix'li domain-property URL'leri özel karakter içerir |

**Key insight:** GSC OAuth'ta en tehlikeli alan refresh_token yönetimidir — `prompt=consent` eksikse token'lar ilk oturumdan sonra kullanılamaz hale gelir ve kullanıcı tekrar OAuth yapmak zorunda kalır.

---

## Common Pitfalls

### Pitfall 1: refresh_token Sadece İlk İzinde Döner
**What goes wrong:** Kullanıcı daha önce aynı Google hesabıyla aynı client_id için izin vermişse, Google yeni OAuth'ta `refresh_token` alanını response'a dahil etmez.
**Why it happens:** Google, `access_type=offline` + `prompt=consent` yoksa mevcut izni yeniden kullanır ve sadece access_token döner.
**How to avoid:** Her zaman `prompt=consent` ekleyin. Token exchange response'ında `refresh_token` yoksa kullanıcıyı tekrar OAuth'a yönlendirin.
**Warning signs:** `gsc_tokens.refresh_token` null; 1 saat sonra tüm GSC API çağrıları 401 döner.
[VERIFIED: Google OAuth2 web-server docs]

### Pitfall 2: siteUrl Format Uyumsuzluğu
**What goes wrong:** URL Inspection ve Search Analytics API'ye gönderilen `siteUrl`, Search Console'a kayıtlı property URL ile birebir eşleşmek zorunda. Trailing slash, http vs https, sc-domain: prefix farkı 403 veya boş sonuç üretir.
**Why it happens:** Google iki tür property kabul eder: URL-prefix (`https://example.com/`) ve Domain (`sc-domain:example.com`). Her ikisi de farklı format.
**How to avoid:** `gsc_property_url` kaydederken Sites.list API'den dönen değeri kullanın — kullanıcının girdiği string'i kullanmayın.
**Warning signs:** 403 "Caller does not have access to this site" veya `rows: []` empty response.
[VERIFIED: Search Analytics API docs]

### Pitfall 3: URL Inspection API Rate Limit
**What goes wrong:** Kısa sürede çok sayıda URL için index check tetiklenirse API quota aşılır.
**Why it happens:** URL Inspection API günde 2000 istek, dakikada 600 istek sınırına sahip. [VERIFIED: Google URL Inspection API docs]
**How to avoid:** Manuel "Kontrol Et" butonu sayfa başına tek tıkla sınırlandırılmalı; son kontrol zamanı `gsc_index_checked_at`'te saklanır — 1 saatten daha sık kontrol önlenebilir.
**Warning signs:** API 429 response; `gsc_index_status` güncellenmiyor.

### Pitfall 4: n8n Webhook Secret Eksikliği
**What goes wrong:** `/api/gsc/sync` endpoint'i herkese açıksa herhangi biri projectId ile sync tetikleyebilir.
**Why it happens:** Webhook endpoint'leri varsayılan olarak auth gerektirmez.
**How to avoid:** Endpoint'e basit bir shared secret header kontrolü ekleyin (`X-N8n-Webhook-Secret: <env_var>`). Next.js auth middleware bu rotayı kapsamaz çünkü n8n server-to-server çağırır.
**Warning signs:** Log'da beklenmedik sync istekleri.
[ASSUMED] — Standart webhook güvenlik pattern; projeye özgü uygulama detayı.

### Pitfall 5: JSONB gsc_tokens RLS Sızması
**What goes wrong:** Herhangi bir server component, `projects` select sorgusuna `gsc_tokens` dahil ederse token browser bundle'a sızabilir.
**Why it happens:** JSONB sütun diğer sütunlardan farklı değil; özellikle `select('*')` kullanıldığında dahil olur.
**How to avoid:** `projects` tablosundan yapılan tüm SELECT sorgularında `gsc_tokens` eksplisit olarak dahil edilmemeli. `lib/gsc/auth.ts` içindeki dedicated helper ile okuma merkezi tutulmalı.
**Warning signs:** Network tab'da `gsc_tokens` içeren response body.

### Pitfall 6: Search Analytics Satır Limiti
**What goes wrong:** Büyük siteler için Search Analytics günlük 25.000 satır limitini aşar; ilk batch'ten sonra veri kaybolur.
**Why it happens:** API maksimum 25.000 satır döner; sayfalama için `startRow` artırılmalı.
**How to avoid:** Sync akışında: `rowCount < rowLimit` olduğu sürece döngüden çıkılabilir; büyük siteler için `startRow` ile sayfalama ekleyin.
**Warning signs:** Bazı sayfalar için gsc_metrics hiç oluşturulmuyor; satır sayısı tam 25.000.
[VERIFIED: Search Analytics API docs — "request data in batches of 25,000 rows at a time by incrementing startRow"]

---

## Runtime State Inventory

> Bu faz yeniden adlandırma/refactor değil, yeni özellik ekleme. Ancak n8n workflow'u canlı bir external system olduğu için ilgili runtime state belgelenmiştir.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `projects` tablosunda `gsc_tokens` JSONB sütunu yok — migration ile eklenecek; `gsc_property_url` TEXT sütunu yok — migration ile eklenecek | Migration: 2 yeni sütun projects tablosuna |
| Stored data | `page_packages` tablosunda `gsc_index_status` + `gsc_index_checked_at` yok | Migration: 2 yeni sütun page_packages tablosuna |
| Stored data | `gsc_metrics` tablosu yok | Migration: yeni tablo oluşturma |
| Live service config | self-hosted n8n instance çalışıyor (localhost:5678 dev'de erişilemiyor — production ortamında mevcut per STATE.md) | Yeni n8n workflow el ile oluşturulacak; planner belge/adım üretmeli |
| OS-registered state | None — verified: n8n şu an faz dışı | — |
| Secrets/env vars | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL` — henüz `.env.local`'de yok | `.env.local.example`'e eklenecek; Google Cloud Console'da OAuth client oluşturulacak |
| Build artifacts | None | — |

**n8n environment:** `localhost:5678` dev ortamında erişilemiyor (max-time 3s timeout). STATE.md'de "n8n is available from Phase 14+" yazıyor; production ortamında mevcut olduğu varsayılır. Planner n8n kurulum adımlarını varsayılabilir olarak işaretlemeli veya n8n'in çalıştığı adresi env var ile konfigüre etmeli. [ASSUMED: n8n production URL ve API key env var ile sağlanacak]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | google-auth-library, fetch | ✓ | v25.9.0 | — |
| `@supabase/supabase-js` | Token storage, gsc_metrics upsert | ✓ | 2.104.0 | — |
| `google-auth-library` | Token exchange ve refresh (alternatif) | ✗ | — | Doğrudan `fetch` ile token exchange (örnekler yukarıda) |
| `googleapis` | Webmasters + SearchConsole API | ✗ | — | Doğrudan `fetch` tercih edilir |
| Google Cloud OAuth2 Client | GSC-01 | ✗ | — | **Blocker**: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET oluşturulmalı |
| self-hosted n8n | GSC-03 | Bilinmiyor (dev'de erişilemiyor) | — | Planner n8n URL'yi env var olarak işaretlemeli |
| `vitest` | Test altyapısı | ✓ | 4.1.5 | — |

**Missing dependencies with no fallback:**
- Google Cloud OAuth2 credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) — Wave 0 prereq; planner belge etmeli

**Missing dependencies with fallback:**
- `google-auth-library` — doğrudan `fetch` ile karşılanabilir (Pattern 3 yukarıda gösterildi)
- n8n production URL — env var `N8N_WEBHOOK_URL` ile konfigüre edilir

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 |
| Config file | `vitest.config.ts` (veya package.json scripts: `"test": "vitest run"`) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GSC-01 | OAuth state CSRF koruması — yanlış state redirect'e yol açar | unit | `npm test -- gsc` | ❌ Wave 0 |
| GSC-01 | Token exchange response parse — refresh_token yoksa null döner | unit | `npm test -- gsc` | ❌ Wave 0 |
| GSC-01 | getValidGscToken refresh tetikleme — expires_at < şimdi + 5dk | unit | `npm test -- gsc` | ❌ Wave 0 |
| GSC-02 | verdict → status map: PASS→indexed, FAIL→not_indexed, NEUTRAL→crawled_not_indexed | unit | `npm test -- gsc` | ❌ Wave 0 |
| GSC-03 | Search Analytics satır parse — keys[0]=page, keys[1]=keyword, clicks/impressions/position | unit | `npm test -- gsc` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/gsc/__tests__/auth.test.ts` — GSC-01 token yönetimi testleri
- [ ] `src/lib/gsc/__tests__/index-check.test.ts` — GSC-02 verdict mapping testi
- [ ] `src/lib/gsc/__tests__/search-analytics.test.ts` — GSC-03 row parse testi

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Google OAuth2 authorization code flow — server-side only |
| V3 Session Management | yes | state HttpOnly cookie (10 dk TTL, SameSite=lax) |
| V4 Access Control | yes | Tüm server action'larda user.id + project.user_id triple-check |
| V5 Input Validation | yes | Zod ile token response parse; siteUrl format doğrulama |
| V6 Cryptography | no | Token Google tarafından sağlanır; local crypto sadece state UUID |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSRF — sahte OAuth callback | Spoofing | HttpOnly state cookie + callback'te cookie == query param karşılaştırması |
| Token exfiltration via SELECT * | Information Disclosure | gsc_tokens asla explicit select'e dahil edilmez; lib/gsc/auth.ts üzerinden erişim |
| Unauthorized sync trigger | Elevation of Privilege | POST /api/gsc/sync → X-N8n-Webhook-Secret header kontrolü |
| Ownership bypass in token update | Tampering | Her DB write'ta `.eq('user_id', userId)` şartı — RLS UPDATE policy mirror |
| refresh_token exposure in logs | Information Disclosure | refresh_token loglanmaz; WordPress appPassword pattern ile paralel |

---

## Code Examples

### gsc_tokens JSONB Schema (Zod)
```typescript
// Source: [ASSUMED] — Zod v4 syntax, projenin mevcut standardı
import { z } from 'zod'

export const GscTokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number(), // ms timestamp
  token_type: z.string().default('Bearer'),
})
export type GscTokens = z.infer<typeof GscTokensSchema>
```

### GscIndexBadge Bileşeni (WordPress badge pattern'ı izler)
```typescript
// Derived from: PackageStatusBadge.tsx pattern
// src/app/(dashboard)/projeler/[id]/sayfa-paketi/PackageStatusBadge.tsx
'use client'
import { cn } from '@/lib/utils'

const GSC_INDEX_STATUS_CONFIG = {
  indexed:             { label: 'İndekslendi',           className: 'bg-emerald-900/40 text-emerald-400' },
  not_indexed:         { label: 'İndekslenmedi',         className: 'bg-red-900/40 text-red-400' },
  crawled_not_indexed: { label: 'Tarandı/İndekslenmedi', className: 'bg-amber-900/40 text-amber-400' },
} as const

export function GscIndexBadge({ status }: { status: string | null }) {
  if (!status) return null
  const cfg = GSC_INDEX_STATUS_CONFIG[status as keyof typeof GSC_INDEX_STATUS_CONFIG]
  if (!cfg) return null
  return (
    <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[10px]', cfg.className)}>
      {cfg.label}
    </span>
  )
}
```

### gsc_metrics Migration SQL
```sql
-- Phase 14: GSC metrics tablosu
CREATE TABLE IF NOT EXISTS public.gsc_metrics (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id    UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  page_id       UUID REFERENCES public.pages(id) ON DELETE CASCADE NOT NULL,
  date          DATE NOT NULL,
  keyword       TEXT NOT NULL,
  clicks        INTEGER NOT NULL DEFAULT 0,
  impressions   INTEGER NOT NULL DEFAULT 0,
  avg_position  NUMERIC(5,2),
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(page_id, date, keyword)
);

-- Composite index: Phase 15 Monitoring Dashboard sorgularına hazır
CREATE INDEX IF NOT EXISTS idx_gsc_metrics_page_date ON public.gsc_metrics(page_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_metrics_project_date ON public.gsc_metrics(project_id, date DESC);

-- RLS
ALTER TABLE public.gsc_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gsc_metrics_select_own" ON public.gsc_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = gsc_metrics.project_id AND p.user_id = auth.uid()
    )
  );
-- INSERT/UPDATE n8n service role key ile yapılır — RLS bypass gerekir (service role zaten bypass eder)
```

### projects Tablosu Yeni Sütunlar Migration
```sql
-- Phase 14: GSC integration sütunları
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS gsc_tokens      JSONB,
  ADD COLUMN IF NOT EXISTS gsc_property_url TEXT;
-- gsc_tokens: server-only; RLS SELECT politikaları bu sütunu expose etmez
-- Not: RLS anon/user role SELECT politikası projects'i tüm sütunlarla expose eder.
-- Uygulama kodu gsc_tokens'ı select'e hiçbir zaman dahil etmez.
```

### page_packages Yeni Sütunlar Migration
```sql
-- Phase 14: GSC index status tracking
ALTER TABLE public.page_packages
  ADD COLUMN IF NOT EXISTS gsc_index_status     TEXT
    CHECK (gsc_index_status IS NULL OR gsc_index_status IN ('indexed','not_indexed','crawled_not_indexed')),
  ADD COLUMN IF NOT EXISTS gsc_index_checked_at TIMESTAMPTZ;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NextAuth.js for Google OAuth | Custom Route Handler + server action | 2023+ Next.js App Router | Daha az bağımlılık; tam kontrol; D-01 kararı |
| googleapis full client | Doğrudan fetch + google-auth-library | 2022+ | Küçük bundle; sadece ihtiyaç duyulan endpoint'ler |
| URL Inspection UI-only | API olarak mevcut (2022) | Ocak 2022 | Programmatic index status check mümkün [VERIFIED: Google Search Central Blog] |
| n8n Google Search Console node | HTTP Request node + OAuth2 | 2024 | Daha esnek; herhangi bir GSC endpoint çağrılabilir |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | n8n production instance mevcut ve erişilebilir; D-09 workflow eklenebilir | Runtime State Inventory | D-09, D-10, GSC-03 implemente edilemez; fallback: Supabase Edge Function veya Next.js cron |
| A2 | POST /api/gsc/sync endpoint'ine X-N8n-Webhook-Secret header ile basit auth yeterli | Common Pitfalls (Pitfall 4) | Yetersiz auth → unauthorized sync tetikleme riski |
| A3 | projects tablosunda gsc_tokens JSONB sütunu henüz yok; migration gerekli | Standard Stack + Code Examples | Migration zaten varsa duplicate sütun hatası — `ADD COLUMN IF NOT EXISTS` bu riski azaltır |
| A4 | Tek proje için günlük GSC satır sayısı 25.000'in altında kalır | Common Pitfalls (Pitfall 6) | Büyük siteler için pagination gerekebilir; ilk versiyon için basit tek-batch sync yeterli |

---

## Open Questions (RESOLVED)

1. **n8n Üretim Adresi** — RESOLVED
   - What we know: n8n "Phase 14+'dan itibaren mevcut" (STATE.md); dev'de localhost:5678 erişilemiyor
   - Resolution: Plan 05'te `NEXT_PUBLIC_N8N_WEBHOOK_URL` env var olarak çözüldü. GscConnectionSection "Senkronize Et" butonu bu env var'ı okuyarak n8n webhook'unu çağırır. Kullanıcı setup gereksinimi olarak Plan 05 user_setup frontmatter'ına belgelenmiştir.

2. **Google Cloud Project ve OAuth Consent Screen** — RESOLVED
   - What we know: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET gerekli; henüz `.env.local`'de yok
   - Resolution: Plan 02'de `user_setup` frontmatter bloğu ile belgelenmiştir. Google Cloud Console'da OAuth2 client oluşturma, consent screen konfigürasyonu ve `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `NEXT_PUBLIC_APP_URL` env var'larının ayarlanması kullanıcı kurulum gereksinimleri olarak listelenmiştir. Execute-plan bu adımları kullanıcıya sunar.

3. **gsc_metrics için page_id Çözümü** — RESOLVED
   - What we know: GSC Search Analytics `page` dimension URL döner; `page_id` UUID gerekli
   - Resolution: Plan 04 Task 2'deki `/api/gsc/sync` endpoint'inde wp_post_url üzerinden eşleştirme yapılır: `page_packages.wp_post_url IN (gsc_page_urls)` sorgusu ile URL → page_id map oluşturulur; eşleşmeyen satırlar atlanır (Phase 15'te orphan handling). Bu yaklaşım Plan 04'te implement edilmiştir.

---

## Sources

### Primary (HIGH confidence)
- [Google OAuth2 Web Server Flow](https://developers.google.com/identity/protocols/oauth2/web-server) — authorization URL params, token exchange, token refresh format
- [URL Inspection API](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect) — request body, auth scopes
- [UrlInspectionResult](https://developers.google.com/webmaster-tools/v1/urlInspection.index/UrlInspectionResult) — verdict enum (PASS/FAIL/NEUTRAL) mapping
- [Search Analytics API](https://developers.google.com/webmaster-tools/v1/searchanalytics/query) — dimensions, rowLimit, row structure
- [npm: googleapis](https://www.npmjs.com/package/googleapis) v171.4.0 — `npm view googleapis version`
- [npm: google-auth-library](https://www.npmjs.com/package/google-auth-library) v10.6.2 — `npm view google-auth-library version`
- Codebase: `src/app/(dashboard)/projeler/[id]/wordpress-section.tsx` — GscConnectionSection için model
- Codebase: `src/lib/supabase/vault.ts` — server-only credential pattern
- Codebase: `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PackageStatusBadge.tsx` — badge renk pattern
- Codebase: `package.json`, `middleware.ts` — mevcut stack versiyonları

### Secondary (MEDIUM confidence)
- [n8n Google OAuth2 Docs](https://docs.n8n.io/integrations/builtin/credentials/google/oauth-single-service/) — GSC scope konfigürasyonu
- [URL Inspection API Node.js example](https://jlhernando.com/blog/google-url-inspection-api-nodejs/) — Node.js entegrasyon pattern'ı
- [Search Analytics Node.js guide](https://stateful.com/blog/google-search-console-nodejs) — Search Analytics API kullanım pattern'ı

### Tertiary (LOW confidence)
- n8n production availability — STATE.md'ye dayanılarak [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm view ile versiyon doğrulandı; mevcut codebase incelendi
- Architecture: HIGH — tüm kararlar CONTEXT.md D-01..D-12'den; API mekanikleri resmi dokümandan
- Pitfalls: HIGH — Google OAuth pitfall'ları resmi dokümanda explicit olarak belirtilmiş; diğerleri API spesifikasyonundan türetilmiş
- n8n integration: MEDIUM — D-12 kararı net; n8n production erişimi [ASSUMED]

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (Google API'leri stabil; 30 gün)
