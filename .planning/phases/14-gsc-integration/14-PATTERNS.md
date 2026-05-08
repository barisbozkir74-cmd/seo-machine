# Phase 14: GSC Integration - Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 11 (new/modified files)
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/api/gsc/callback/route.ts` | route (Route Handler) | request-response | `src/app/api/ai/generate-page-package/route.ts` | role-match |
| `src/app/api/gsc/sync/route.ts` | route (Route Handler) | request-response | `src/app/api/ai/generate-page-package/route.ts` | role-match |
| `src/app/(dashboard)/projeler/[id]/gsc-section.tsx` | component (client) | request-response | `src/app/(dashboard)/projeler/[id]/wordpress-section.tsx` | exact |
| `src/lib/gsc/auth.ts` | utility (server-only) | request-response | `src/lib/supabase/vault.ts` | role-match |
| `src/lib/gsc/index-check.ts` | utility (server-only) | request-response | `src/lib/supabase/vault.ts` | role-match |
| `src/lib/gsc/search-analytics.ts` | utility (server-only) | request-response | `src/lib/supabase/vault.ts` | role-match |
| `src/app/(dashboard)/projeler/[id]/actions.ts` | server action | CRUD | `src/app/(dashboard)/projeler/[id]/actions.ts` (existing) | exact |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` | server action | CRUD | `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` (existing, publishToWordPress) | exact |
| `src/app/(dashboard)/projeler/[id]/page.tsx` | page (server component) | request-response | `src/app/(dashboard)/projeler/[id]/page.tsx` (existing) | exact |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` | component (client) | request-response | `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PackageStatusBadge.tsx` | role-match |
| `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx` | component (client) | request-response | `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx` (existing) | exact |
| `supabase/migrations/*.sql` | migration | batch | `supabase/migrations/20260426000002_add_wp_columns.sql` | exact |

---

## Pattern Assignments

### `src/app/api/gsc/callback/route.ts` (route, request-response)

**Analog:** `src/app/api/ai/generate-page-package/route.ts`

**Imports pattern** (lines 1-4):
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
```

**Auth + ownership pattern** (analog lines 8-10, 24-30):
```typescript
// Route Handler — supabase.auth.getUser() ile user doğrula; user yoksa 401/redirect
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.redirect(new URL('/login', request.url))

// Ownership: her DB write'ta .eq('user_id', user.id) şartı zorunlu
await supabase
  .from('projects')
  .update({ gsc_tokens: { ... } })
  .eq('id', projectId)
  .eq('user_id', user.id)  // <— ownership guarantee
```

**Core pattern — CSRF + token exchange:**
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // CSRF: cookie ile karşılaştır
  const cookieStore = await cookies()
  const savedState = cookieStore.get('gsc_oauth_state')?.value
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL('/projeler?error=gsc_csrf', request.url))
  }
  cookieStore.delete('gsc_oauth_state')

  if (error || !code) {
    return NextResponse.redirect(new URL('/projeler?error=gsc_denied', request.url))
  }

  // projectId = state.split(':')[0]  (format: "projectId:uuid")
  const projectId = state.split(':')[0]

  // Token exchange — doğrudan fetch, googleapis paketi yok
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

  // DB'ye yaz — gsc_tokens JSONB
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
    .eq('user_id', user.id)

  return NextResponse.redirect(new URL(`/projeler/${projectId}`, request.url))
}
```

**Error handling pattern** (analog lines 14-20):
```typescript
// JSON parse hatalarını yakala; HTTP hata kodlarını döndür
try {
  body = await req.json()
} catch {
  return new Response('Invalid JSON body', { status: 400 })
}
// Ownership fail → redirect veya 404 (Route Handler'da redirect, server action'da { success: false })
if (!project) return new Response('Project not found', { status: 404 })
```

---

### `src/app/api/gsc/sync/route.ts` (route, request-response)

**Analog:** `src/app/api/ai/generate-page-package/route.ts`

**Imports pattern** (analog lines 1-4):
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
```

**Core pattern — webhook secret auth + sync trigger:**
```typescript
export async function POST(req: NextRequest) {
  // N8n webhook secret doğrulama (Pitfall 4)
  const secret = req.headers.get('x-n8n-webhook-secret')
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }
  const { projectId } = body as { projectId?: string }
  if (!projectId) return new Response('projectId required', { status: 400 })

  // lib/gsc/auth.ts'den token al (service role context)
  // lib/gsc/search-analytics.ts ile GSC çağır
  // gsc_metrics UPSERT
}
```

---

### `src/app/(dashboard)/projeler/[id]/gsc-section.tsx` (component, request-response)

**Analog:** `src/app/(dashboard)/projeler/[id]/wordpress-section.tsx` — birebir model

**Imports pattern** (lines 1-9):
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { initiateGscOAuth, selectGscProperty, triggerGscSync } from './actions'
```

**Props pattern** (lines 11-14):
```typescript
type Props = {
  projectId: string
  isConnected: boolean          // SSR'da projects.gsc_tokens NULL check
  selectedProperty: string | null  // projects.gsc_property_url
  properties?: string[]         // OAuth sonrası Sites.list — SSR'da prop olarak gelir
}
```

**Core component pattern** (analog lines 16-145):
```typescript
export function GscConnectionSection({ projectId, isConnected, selectedProperty, properties }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(isConnected)

  return (
    <div className="space-y-4">
      {/* Başlık + Durum Badge — wordpress-section.tsx lines 59-71 pattern */}
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold">Google Search Console</h2>
        <Badge
          aria-live="polite"
          className={
            connected
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }
        >
          {connected ? 'Bağlı' : 'Bağlı Değil'}
        </Badge>
      </div>

      {/* Bağlanmamış: "GSC Bağla" butonu */}
      {/* Bağlı ama property seçilmemiş: dropdown */}
      {/* Bağlı + property seçili: "Senkronize Et" butonu */}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
```

**Badge durum renkleri** (analog lines 62-70):
```typescript
// Bağlı: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
// Bağlı Değil: 'bg-slate-800 text-slate-400 border-slate-700'
// WordPress-section badge pattern — birebir kopyala
```

---

### `src/lib/gsc/auth.ts` (utility, request-response)

**Analog:** `src/lib/supabase/vault.ts`

**Imports + server-only declaration** (vault.ts lines 1-8):
```typescript
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
```

**Core pattern — JSONB token read + refresh:**
```typescript
// vault.ts pattern: service client değil createClient() (user context yeterli)
// getWordPressCredentials → getValidGscToken olarak mirror
export type GscTokens = {
  access_token: string
  refresh_token: string
  expires_at: number   // ms timestamp
  token_type: string
}

export async function getValidGscToken(projectId: string, userId: string): Promise<string | null> {
  const supabase = await createClient()
  // NOT: gsc_tokens hiçbir zaman select('*') ile çekilmez — explicit column
  const { data: project } = await supabase
    .from('projects')
    .select('gsc_tokens')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (!project?.gsc_tokens) return null
  const tokens = project.gsc_tokens as GscTokens

  // 5 dakika tolerans
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

  // JSONB güncelle — ownership şartıyla
  await supabase
    .from('projects')
    .update({ gsc_tokens: { ...tokens, access_token: refreshed.access_token, expires_at: Date.now() + refreshed.expires_in * 1000 } })
    .eq('id', projectId)
    .eq('user_id', userId)

  return refreshed.access_token
}

// vault.ts hasWordPressCredentials → hasGscConnected pattern
export async function hasGscConnected(projectId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('gsc_tokens')
    .eq('id', projectId)
    .single()
  return !!(data?.gsc_tokens as GscTokens | null)?.refresh_token
}
```

---

### `src/lib/gsc/index-check.ts` (utility, request-response)

**Analog:** `src/lib/supabase/vault.ts` (server-only helper pattern)

**Imports pattern:**
```typescript
import 'server-only'
```

**Core pattern — URL Inspection API fetch:**
```typescript
// assertSafeWpUrl → assertSafeGscUrl pattern (sayfa-paketi/actions.ts lines 514-531)
function assertSafeGscUrl(raw: string): void {
  let parsed: URL
  try { parsed = new URL(raw) } catch { throw new Error('URL geçersiz.') }
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('URL HTTPS/HTTP olmalı.')
}

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

---

### `src/lib/gsc/search-analytics.ts` (utility, request-response)

**Analog:** `src/lib/supabase/vault.ts` (server-only helper pattern)

**Core pattern — Search Analytics API + Supabase upsert:**
```typescript
import 'server-only'

export async function fetchSearchAnalytics(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string
) {
  const encodedSite = encodeURIComponent(siteUrl)  // sc-domain: prefix için kritik
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
  // response.rows[]: { keys: [pageUrl, keyword], clicks, impressions, ctr, position }
}
```

---

### `src/app/(dashboard)/projeler/[id]/actions.ts` — Yeni GSC action'lar (server action, CRUD)

**Analog:** `src/app/(dashboard)/projeler/[id]/actions.ts` (mevcut, saveWordPressCredentials pattern)

**Imports pattern** (lines 1-5):
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getValidGscToken } from '@/lib/gsc/auth'
```

**Ownership triple-check pattern** (analog lines 139-174):
```typescript
// saveWordPressCredentials pattern — tüm write action'larda zorunlu
export async function saveGscProperty(projectId: string, propertyUrl: string): Promise<SaveResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Ownership: project user_id kontrolü
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  const { error } = await supabase
    .from('projects')
    .update({ gsc_property_url: propertyUrl })
    .eq('id', projectId)
    .eq('user_id', user.id)
  if (error) return { success: false, error: 'Property kaydedilemedi.' }

  revalidatePath(`/projeler/${projectId}`)
  return { success: true }
}
```

**initiateGscOAuth action pattern:**
```typescript
// redirect() + cookies() — next/navigation ve next/headers kullanımı
export async function initiateGscOAuth(projectId: string) {
  const state = `${projectId}:${crypto.randomUUID()}`
  const cookieStore = await cookies()
  cookieStore.set('gsc_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  })
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  // ... params ...
  redirect(authUrl.toString())
}
```

**checkIndexStatus action pattern** (publishToWordPress pattern, analog lines 468-642):
```typescript
export async function checkIndexStatus(projectId: string, pageId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Project ownership
  const { data: project } = await supabase.from('projects').select('id, gsc_property_url').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  // Page + package ownership (triple-check)
  const { data: pkg } = await supabase
    .from('page_packages')
    .select('id, wp_post_url')
    .eq('page_id', pageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!pkg) return { success: false, error: 'Paket bulunamadı.' }

  const accessToken = await getValidGscToken(projectId, user.id)
  if (!accessToken) return { success: false, error: 'GSC bağlantısı bulunamadı.' }

  // checkUrlIndexStatus çağrısı → status → DB güncelle
  const { error } = await supabase
    .from('page_packages')
    .update({
      gsc_index_status: status,
      gsc_index_checked_at: new Date().toISOString(),
    })
    .eq('id', pkg.id)
    .eq('user_id', user.id)

  revalidatePath(`/projeler/${projectId}/icerik-studio/${pageId}`)
  revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
  return { success: true }
}
```

---

### `src/app/(dashboard)/projeler/[id]/page.tsx` — GscConnectionSection entegrasyonu (page, request-response)

**Analog:** `src/app/(dashboard)/projeler/[id]/page.tsx` (mevcut)

**Integration pattern** (lines 1-34, WordPress entegrasyon modeli):
```typescript
// Mevcut dosyaya ekleme — iki import satırı + SSR kontrolü + section render

// 1. Import ekle (lines 7-8 pattern):
import { hasGscConnected } from '@/lib/gsc/auth'
import { GscConnectionSection } from './gsc-section'

// 2. SSR kontrolü (lines 33-34 pattern):
const isWpConfigured = await hasWordPressCredentials(id)
const isGscConnected = await hasGscConnected(id)  // ← aynı pattern

// 3. Select'e gsc_property_url ekle — gsc_tokens dahil etme (Pitfall 5)
const { data: project } = await supabase
  .from('projects')
  .select('id, name, domain, ..., gsc_property_url')  // gsc_tokens YOK
  .eq('id', id).eq('user_id', user.id).single()

// 4. Section render (lines 78-82 WordPress pattern):
<Separator className="my-8" />
<GscConnectionSection
  projectId={project.id}
  isConnected={isGscConnected}
  selectedProperty={project.gsc_property_url ?? null}
/>
```

---

### `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` — GscIndexBadge ekleme (component, request-response)

**Analog:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PackageStatusBadge.tsx`

**GscIndexBadge component pattern** (PackageStatusBadge lines 1-34):
```typescript
'use client'
import { cn } from '@/lib/utils'

// PackageStatusBadge ile aynı pattern — config map + span
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

**PagePackageEditor'a ekleme noktası** — mevcut `PackageStatusBadge` yanına:
```typescript
// Mevcut (lines 10-13):
import { PackageStatusBadge } from './PackageStatusBadge'

// Eklenecek:
import { GscIndexBadge } from './GscIndexBadge'  // ayrı dosya

// pkg prop'una eklenecek alanlar:
pkg?: {
  // ... mevcut alanlar ...
  gsc_index_status?: string | null   // ← yeni
  gsc_index_checked_at?: string | null  // ← yeni
}

// Render'a ekleme — WP badge yanında:
<PackageStatusBadge status={page.pkg?.status ?? null} />
<GscIndexBadge status={page.pkg?.gsc_index_status ?? null} />  // ← ekle
```

---

### `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx` — Index check butonu (component, request-response)

**Analog:** `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx` (mevcut)

**Props pattern genişletme** (mevcut lines 9-15):
```typescript
type Props = {
  projectId: string
  pageId: string
  wpPostUrl?: string | null
  wpStatus?: string | null
  isWpConfigured: boolean
  // Yeni alanlar:
  isGscConnected?: boolean
  gscIndexStatus?: string | null
  gscIndexCheckedAt?: string | null
}
```

**Buton ekleme pattern** (mevcut lines 91-98 — "WordPress'e Gönder" butonu):
```typescript
// Mevcut butonun yanına — aynı flex container içinde
<Button
  onClick={handleCheckIndex}
  disabled={checkingIndex || !isGscConnected || !wpPostUrl}
  variant="outline"
  className="shrink-0"
  title={!isGscConnected ? 'GSC bağlantısı yapılandırılmamış' : undefined}
>
  {checkingIndex ? 'Kontrol ediliyor...' : 'Index Durumunu Kontrol Et'}
</Button>

// GscIndexBadge durum gösterimi — mevcut Tick02Icon yanına
<GscIndexBadge status={localGscIndexStatus} />
```

**useState + action call pattern** (mevcut lines 25-31):
```typescript
const [checkingIndex, setCheckingIndex] = useState(false)
const [localGscIndexStatus, setLocalGscIndexStatus] = useState(gscIndexStatus ?? null)

const handleCheckIndex = async () => {
  setCheckingIndex(true)
  try {
    const result = await checkIndexStatus(projectId, pageId)
    if (result.success && result.status) setLocalGscIndexStatus(result.status)
  } finally {
    setCheckingIndex(false)
  }
}
```

---

### `supabase/migrations/*.sql` — GSC tabloları ve kolonları (migration, batch)

**Analog:** `supabase/migrations/20260426000002_add_wp_columns.sql`

**Migration file adlandırma pattern** (mevcut dosyalar):
```
20260427000001_add_wp_status_check.sql  ← son mevcut
20260428000001_add_gsc_columns.sql      ← yeni: projects + page_packages kolonları
20260428000002_create_gsc_metrics.sql   ← yeni: gsc_metrics tablosu + RLS
```

**projects + page_packages kolonları migration pattern** (analog lines 1-11):
```sql
-- Phase 14: GSC integration — projects tablosuna token sütunları
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS gsc_tokens      JSONB,
  ADD COLUMN IF NOT EXISTS gsc_property_url TEXT;
-- NOT: gsc_tokens RLS SELECT politikalarından hariç tutulmaz (JSONB sütun RLS'i bypass etmez)
-- Uygulama kodu gsc_tokens'ı hiçbir zaman select(*) ile çekmez.

-- Phase 14: GSC index status tracking
ALTER TABLE public.page_packages
  ADD COLUMN IF NOT EXISTS gsc_index_status     TEXT
    CHECK (gsc_index_status IS NULL OR gsc_index_status IN ('indexed','not_indexed','crawled_not_indexed')),
  ADD COLUMN IF NOT EXISTS gsc_index_checked_at TIMESTAMPTZ;
```

**gsc_metrics tablo migration pattern** (RLS policy analog lines 14-22):
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

-- Composite index (Phase 15 sorgularına hazır)
CREATE INDEX IF NOT EXISTS idx_gsc_metrics_page_date    ON public.gsc_metrics(page_id, date DESC);
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
-- INSERT/UPDATE: n8n service role key ile (RLS bypass eder)
```

---

## Shared Patterns

### Ownership Triple-Check (Tüm write action'lara uygulanır)

**Source:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` — `publishToWordPress` (lines 468-500) ve `verifyOwnership` helper (lines 75-83)

**Apply to:** `initiateGscOAuth`, `saveGscProperty`, `checkIndexStatus`, `triggerGscSync` server action'ları

```typescript
// Pattern: user → project → page/package — her seviye ayrı doğrulama
async function verifyOwnership(supabase, projectId: string, userId: string) {
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()
  return data  // null ise action { success: false, error: 'Proje bulunamadı.' } döner
}
```

### Action Result Type (Tüm server action'lar)

**Source:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` (line 7)

**Apply to:** Tüm yeni GSC server action'ları

```typescript
export type ActionResult = { success: true } | { success: false; error: string }
// Daha zengin dönüş gereken action'lar için genişlet:
export type CheckIndexResult =
  | { success: true; status: 'indexed' | 'not_indexed' | 'crawled_not_indexed' | 'unknown' }
  | { success: false; error: string }
```

### server-only Import (Tüm lib/gsc/* dosyaları)

**Source:** `src/lib/supabase/vault.ts` (line 1)

**Apply to:** `src/lib/gsc/auth.ts`, `src/lib/gsc/index-check.ts`, `src/lib/gsc/search-analytics.ts`

```typescript
import 'server-only'  // ← her lib/gsc/* dosyasının ilk satırı
```

### revalidatePath Pattern (Tüm write action'lar)

**Source:** `src/app/(dashboard)/projeler/[id]/actions.ts` (line 74, 131)

**Apply to:** `saveGscProperty`, `checkIndexStatus`, `triggerGscSync`

```typescript
revalidatePath(`/projeler/${projectId}`)
revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
revalidatePath(`/projeler/${projectId}/icerik-studio/${pageId}`)
// Etkilenen sayfalara göre seçerek uygula
```

### gsc_tokens Güvenlik Kuralı (SELECT sorgularında)

**Source:** `src/app/(dashboard)/projeler/[id]/page.tsx` (lines 22-28) — select listesinde `gsc_tokens` YOK

**Apply to:** Proje detay sayfası, tüm server component'ler

```typescript
// YANLIS — gsc_tokens'ı expose eder:
.select('id, name, ..., gsc_tokens')  // ← YAPMA

// DOGRU — sadece ihtiyaç duyulan kolonlar:
.select('id, name, domain, ..., gsc_property_url')  // gsc_tokens dahil ETME
// gsc_tokens sadece src/lib/gsc/auth.ts üzerinden okunur
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/gsc/__tests__/auth.test.ts` | test | — | Codebase'de henüz lib/gsc/ test altyapısı yok; RESEARCH.md'deki Wave 0 gap listesinden |
| `src/lib/gsc/__tests__/index-check.test.ts` | test | — | Aynı sebep |
| `src/lib/gsc/__tests__/search-analytics.test.ts` | test | — | Aynı sebep; vitest 4.1.5 mevcut, framework hazır |

**Test dosyaları için:** Mevcut `vitest.config.ts` + `npm test` komutunu kullan. Test pattern'ı için varsa başka test dosyalarına bak; yoksa vitest temel `describe/it/expect` pattern'ı uygula.

---

## Metadata

**Analog search scope:** `src/app/api/`, `src/app/(dashboard)/projeler/`, `src/lib/supabase/`, `supabase/migrations/`
**Files scanned:** 12
**Pattern extraction date:** 2026-04-27
