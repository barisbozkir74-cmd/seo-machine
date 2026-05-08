# Phase 4: Competitor Intelligence - Pattern Map

**Mapped:** 2026-04-23
**Files analyzed:** 8 (new/modified files)
**Analogs found:** 7 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/(dashboard)/projeler/[id]/rakipler/page.tsx` | page (Server Component) | request-response + CRUD read | `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx` | exact |
| `src/app/(dashboard)/projeler/[id]/rakipler/actions.ts` | server action | CRUD + external API | `src/app/(dashboard)/projeler/[id]/kurallar/actions.ts` | role-match |
| `src/app/(dashboard)/projeler/[id]/page.tsx` | page (Server Component) | request-response | kendisi (modify) | — |
| `src/lib/supabase/vault.ts` | utility (server-only) | request-response | `src/lib/supabase/server.ts` | partial |
| `src/lib/dataforseo/client.ts` | utility / API client | request-response (external) | yok | no analog |
| `src/lib/competitors/url-categories.ts` | utility | transform | yok | no analog |
| `src/app/(dashboard)/projeler/[id]/rakipler/CompetitorDiscoveryDialog.tsx` | component (Client) | event-driven | `src/components/rules/RuleToggleRow.tsx` | partial |
| `src/components/competitors/` (genel) | component | event-driven | `src/components/rules/RuleToggleRow.tsx` | partial |

---

## Pattern Assignments

### `src/app/(dashboard)/projeler/[id]/rakipler/page.tsx`
**Role:** page — Server Component  
**Analog:** `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx`

**Imports pattern** (kurallar/page.tsx satır 1–18):
```typescript
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HugeiconsIcon } from '@hugeicons/react'
import { Tick02Icon, RadioButtonIcon, CircleIcon } from '@hugeicons/core-free-icons'
```

**Auth guard pattern** (kurallar/page.tsx satır 31–36):
```typescript
const supabase = await createClient()

const {
  data: { user },
} = await supabase.auth.getUser()
if (!user) notFound()
```

**Ownership check pattern** (kurallar/page.tsx satır 38–45):
```typescript
const { data: project } = await supabase
  .from('projects')
  .select('id, name, domain')
  .eq('id', id)
  .eq('user_id', user.id)
  .single()

if (!project) notFound()
```

**Competitors tablosu sorgu pattern** — kurallar sayfasındaki rules sorgusuyla aynı yapı:
```typescript
// rules tablosu yerine competitors tablosu
const { data: competitors } = await supabase
  .from('competitors')
  .select('id, domain, source, top_pages, category_structure, updated_at')
  .eq('project_id', id)
  .eq('user_id', user.id)
  .order('created_at', { ascending: true })
```

**2-sütunlu layout pattern** (kurallar/page.tsx satır 94–169):
```tsx
return (
  <div className="flex flex-col h-screen">
    {/* Breadcrumb + başlık */}
    <div className="p-8 pb-4">
      <Link
        href={`/projeler/${id}`}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
      >
        ← {project.name}
      </Link>
      <h1 className="text-xl font-semibold">Rakipler</h1>
    </div>

    {/* 2 sütunlu içerik */}
    <div className="flex flex-1 min-h-0">
      {/* Sol sütun */}
      <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
        {/* Stage listesi — kurallar sayfasından kopyalanır */}
        <Separator className="my-4" />
        {/* Rakipler linki — aktif (bg-secondary font-semibold) */}
        <Link
          href={`/projeler/${id}/rakipler`}
          className="text-sm text-foreground font-semibold flex items-center gap-1 px-3 py-2 rounded-md bg-secondary"
        >
          Rakipler
        </Link>
        {/* Kurallar linki — pasif */}
        <Link
          href={`/projeler/${id}/kurallar`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 py-2 rounded-md hover:bg-secondary"
        >
          Proje Kuralları
        </Link>
      </div>

      {/* Sağ sütun */}
      <div className="flex-1 min-w-0 overflow-y-auto p-8">
        {/* Rakip tablosu + Gap raporu bölümü buraya */}
      </div>
    </div>
  </div>
)
```

**Badge kullanım pattern** — RuleToggleRow'dan:
```tsx
// Kaynak badge'i — variant prop değil, doğrudan className
<Badge className="bg-slate-500/20 text-slate-400 border border-slate-500/30 text-xs">
  Manuel
</Badge>
<Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs">
  SERP
</Badge>
```

---

### `src/app/(dashboard)/projeler/[id]/rakipler/actions.ts`
**Role:** server action  
**Analog:** `src/app/(dashboard)/projeler/[id]/kurallar/actions.ts`

**File header + return type pattern** (actions.ts satır 1–9):
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ActionResult =
  | { success: true }
  | { success: false; error: string }
```

**Auth guard + ownership check pattern** (actions.ts satır 15–30):
```typescript
export async function addCompetitor(
  projectId: string,
  domain: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' }
  }

  // Ownership check
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) {
    return { success: false, error: 'Proje bulunamadı.' }
  }

  // INSERT competitors
  const { error } = await supabase.from('competitors').insert({
    user_id: user.id,
    project_id: projectId,
    domain: domain.replace(/^www\./, ''),
    source: 'manual',
  })

  if (error) {
    return { success: false, error: 'Rakip eklenemedi. Lütfen tekrar deneyin.' }
  }

  revalidatePath(`/projeler/${projectId}/rakipler`)
  return { success: true }
}
```

**revalidatePath pattern** (actions.ts satır 50–51):
```typescript
revalidatePath(`/projeler/${projectId}/kurallar`)
// Rakipler için:
revalidatePath(`/projeler/${projectId}/rakipler`)
return { success: true }
```

**Error response format** (actions.ts satır 18–20 ve 45–47):
```typescript
if (!user) {
  return { success: false, error: 'Oturum bulunamadı.' }
}
// ...
if (error) {
  return { success: false, error: 'Kural güncellenemedi. Lütfen tekrar deneyin.' }
}
```

**DataForSEO Server Action pattern** — actions.ts'e eklenecek, kurallar pattern'ı genişletilir:
```typescript
// DataForSEO çağrısı — getDataForSeoCredentials server-only import
import { getDataForSeoCredentials } from '@/lib/supabase/vault'
import { fetchSerpDomains, fetchTopPages } from '@/lib/dataforseo/client'
import { extractCategories } from '@/lib/competitors/url-categories'

export async function discoverCompetitors(
  projectId: string,
  keywords: string[]
): Promise<{ success: true; domains: string[] } | { success: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // ownership check (aynı pattern)
  // ...

  try {
    const domains = await fetchSerpDomains(keywords)
    return { success: true, domains }
  } catch {
    return { success: false, error: 'Rakip keşfi başarısız. Lütfen tekrar deneyin.' }
  }
}
```

---

### `src/app/(dashboard)/projeler/[id]/page.tsx` (modify)
**Role:** page — Server Component (modification)  
**Target lines:** 167–174 (Kurallar linki bloğu)

**Mevcut nav linki pattern** (page.tsx satır 168–175):
```tsx
{/* Proje Kuralları — Separator + nav linki (Phase 3) */}
<Separator className="my-4" />
<Link
  href={`/projeler/${id}/kurallar`}
  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 py-2 rounded-md hover:bg-secondary"
>
  Proje Kuralları
</Link>
```

**Rakipler linki ekleme — Kurallar'ın üstüne:**
```tsx
<Separator className="my-4" />
{/* Rakipler linki — Kurallar'ın üstüne eklenir */}
<Link
  href={`/projeler/${id}/rakipler`}
  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 py-2 rounded-md hover:bg-secondary"
>
  Rakipler
</Link>
<Link
  href={`/projeler/${id}/kurallar`}
  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 py-2 rounded-md hover:bg-secondary"
>
  Proje Kuralları
</Link>
```

---

### `src/lib/supabase/vault.ts` (new)
**Role:** utility — server-only  
**Analog:** `src/lib/supabase/server.ts` (partial — aynı dizin, Supabase client oluşturma pattern'ı)

**server.ts'ten import pattern** (server.ts satır 1–4):
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
```

**vault.ts için pattern** — server.ts'in service role adaptasyonu:
```typescript
import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Anon key değil, service role key — Vault okuma için gerekli
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getDataForSeoCredentials(): Promise<{ login: string; password: string }> {
  // Önce env var fallback dene (Phase 1'de Vault kurulmamışsa)
  if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
    return {
      login: process.env.DATAFORSEO_LOGIN,
      password: process.env.DATAFORSEO_PASSWORD,
    }
  }

  // Supabase Vault'tan oku
  const { data, error } = await serviceClient
    .from('vault.decrypted_secrets')
    .select('name, decrypted_secret')
    .in('name', ['dataforseo_login', 'dataforseo_password'])

  if (error || !data?.length) {
    throw new Error('DataForSEO credentials okunamadı. DATAFORSEO_LOGIN ve DATAFORSEO_PASSWORD env var olarak ayarlayın.')
  }

  const loginRow = data.find((s) => s.name === 'dataforseo_login')
  const passwordRow = data.find((s) => s.name === 'dataforseo_password')

  if (!loginRow || !passwordRow) {
    throw new Error('DataForSEO credentials eksik.')
  }

  return { login: loginRow.decrypted_secret, password: passwordRow.decrypted_secret }
}
```

---

### `src/lib/dataforseo/client.ts` (new)
**Role:** utility — external API client  
**Analog:** Yok (codebase'de external HTTP client yok)  
**Kaynak:** RESEARCH.md Pattern 2 ve Pattern 3

**SERP endpoint çağrı pattern** (RESEARCH.md satır 248–286):
```typescript
import 'server-only'

export async function fetchSerpDomains(
  keywords: string[],
  credentials: { login: string; password: string }
): Promise<string[]> {
  const authHeader = `Basic ${Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64')}`

  const tasks = keywords.map((kw) => ({
    keyword: kw,
    location_code: 2792, // Turkey
    language_code: 'tr',
    depth: 10,
  }))

  const response = await fetch(
    'https://api.dataforseo.com/v3/serp/google/organic/live/regular',
    {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tasks),
    }
  )

  if (!response.ok) {
    throw new Error(`DataForSEO SERP API hatası: ${response.status}`)
  }

  const data = await response.json()
  const domains = new Set<string>()

  for (const task of data.tasks ?? []) {
    for (const result of task.result ?? []) {
      for (const item of result.items ?? []) {
        if (item.type === 'organic' && item.domain) {
          domains.add(item.domain.replace(/^www\./, ''))
        }
      }
    }
  }

  return Array.from(domains)
}
```

**Relevant Pages endpoint çağrı pattern** (RESEARCH.md satır 315–338):
```typescript
export async function fetchTopPages(
  domain: string,
  credentials: { login: string; password: string }
): Promise<TopPageItem[]> {
  const authHeader = `Basic ${Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64')}`

  const response = await fetch(
    'https://api.dataforseo.com/v3/dataforseo_labs/google/relevant_pages/live',
    {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        target: domain.replace(/^https?:\/\//, '').replace(/^www\./, ''),
        location_code: 2792,
        language_code: 'tr',
        limit: 10,
        order_by: [['metrics.organic.etv', 'desc']],
      }]),
    }
  )

  if (!response.ok) {
    throw new Error(`DataForSEO Relevant Pages API hatası: ${response.status}`)
  }

  const data = await response.json()
  return data.tasks?.[0]?.result?.[0]?.items ?? []
}
```

---

### `src/lib/competitors/url-categories.ts` (new)
**Role:** utility — transform / pure function  
**Analog:** Yok (codebase'de URL analiz fonksiyonu yok)  
**Kaynak:** RESEARCH.md Pattern 4

**Pure function pattern** (RESEARCH.md satır 350–408) — değişiklik yok, doğrudan kopyalanabilir:
```typescript
// server-only değil — test edilebilir pure function, client da kullanabilir
export type TopPageItem = {
  page_address: string
  metrics?: { organic?: { etv?: number } }
}

export type CategoryStructure = {
  [category: string]: {
    pageCount: number
    sampleUrls: string[]
    totalEtv: number
  }
}

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\/blog\//i,           category: 'Blog' },
  { pattern: /\/urunler?\//i,       category: 'Ürün Sayfaları' },
  { pattern: /\/hizmetler?\//i,     category: 'Hizmetler' },
  // ... (RESEARCH.md'deki tam liste)
]

export function extractCategories(pages: TopPageItem[]): CategoryStructure {
  // RESEARCH.md Pattern 4 — tam implementasyon
}
```

---

### `src/app/(dashboard)/projeler/[id]/rakipler/CompetitorDiscoveryDialog.tsx` (new)
**Role:** component — Client Component  
**Analog (partial):** `src/components/rules/RuleToggleRow.tsx` (Client Component + Server Action çağrısı pattern'ı)

**Client Component header pattern** (RuleToggleRow.tsx satır 1–7):
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
```

**useState + isPending + error pattern** (RuleToggleRow.tsx satır 29–50):
```typescript
const [isPending, setIsPending] = useState(false)
const [error, setError] = useState<string | null>(null)

const handleAction = async () => {
  setIsPending(true)
  setError(null)
  try {
    const result = await serverAction(...)
    if (!result.success) {
      setError(result.error ?? 'İşlem başarısız.')
    }
  } catch {
    setError('İşlem başarısız. Lütfen tekrar deneyin.')
  } finally {
    setIsPending(false)
  }
}
```

**Dialog kullanım pattern** (dialog.tsx satır 11–157):
```tsx
// @base-ui/react Dialog — render prop pattern (asChild YOK)
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { DialogPrimitive } from "@base-ui/react/dialog"

// Trigger — render prop kullanılır
<DialogTrigger
  render={<Button variant="outline">Rakip Keşfet</Button>}
/>

// Close button içinde render prop
<DialogPrimitive.Close render={<Button variant="outline" />}>
  İptal
</DialogPrimitive.Close>
```

**Button loading state pattern** (login-form.tsx satır 135–145):
```tsx
<Button
  type="submit"
  disabled={isPending}
>
  {isPending ? (
    <>
      <Loader2 className="animate-spin" />
      Aranıyor...
    </>
  ) : (
    'Ara'
  )}
</Button>
```

**Switch disabled + opacity pattern** (RuleToggleRow.tsx satır 109–111):
```tsx
// "Veri Çek" butonu loading state için:
<Button
  disabled={isPending}
  className={isPending ? 'opacity-50 cursor-wait' : ''}
>
  Veri Çek
</Button>
```

---

## Shared Patterns

### Auth Guard (tüm Server Action ve page.tsx dosyalarına uygulanır)
**Kaynak:** `src/app/(dashboard)/projeler/[id]/kurallar/actions.ts` satır 15–19
```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  return { success: false, error: 'Oturum bulunamadı.' }
}
```

### Ownership Check (tüm Server Action ve page.tsx dosyalarına uygulanır)
**Kaynak:** `src/app/(dashboard)/projeler/[id]/kurallar/actions.ts` satır 21–29
```typescript
const { data: project } = await supabase
  .from('projects')
  .select('id')
  .eq('id', projectId)
  .eq('user_id', user.id)
  .single()

if (!project) {
  return { success: false, error: 'Proje bulunamadı.' }
}
```

### Error Response Format (tüm Server Action'lara uygulanır)
**Kaynak:** `src/app/(dashboard)/projeler/[id]/kurallar/actions.ts` satır 6–8
```typescript
export type ActionResult =
  | { success: true }
  | { success: false; error: string }
```

### Badge Styling (component variant yerine doğrudan className)
**Kaynak:** `src/components/rules/RuleToggleRow.tsx` satır 75–80
```tsx
// variant prop kullanılmaz — doğrudan className ile renklendirme
<Badge className="bg-slate-500/20 text-slate-400 border border-slate-500/30 text-xs">
  Manuel
</Badge>
<Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs">
  SERP
</Badge>
```

### Sol Sütun Aktif Link Stili
**Kaynak:** `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx` satır 163–168
```tsx
// Aktif sayfa linki:
className="text-sm text-foreground font-semibold flex items-center gap-1 px-3 py-2 rounded-md bg-secondary"
// Pasif link:
className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 py-2 rounded-md hover:bg-secondary"
```

### DialogTrigger Render Prop (asChild yok — @base-ui/react)
**Kaynak:** `src/components/ui/dialog.tsx` satır 64–73
```tsx
// YANLIŞ: <DialogTrigger asChild><Button>...</Button></DialogTrigger>
// DOGRU:
<DialogPrimitive.Close
  render={<Button variant="ghost" size="icon-sm" />}
>
  İçerik
</DialogPrimitive.Close>
```

### www. Domain Normalizasyonu (tüm domain kaydetme noktalarına uygulanır)
**Kaynak:** RESEARCH.md Pitfall 3
```typescript
domain.replace(/^www\./, '')
// INSERT öncesi ve SERP response'dan domain çıkarırken uygulanır
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/dataforseo/client.ts` | utility — API client | request-response (external HTTP) | Codebase'de external REST API çağrısı yapan dosya yok |
| `src/lib/competitors/url-categories.ts` | utility — transform | transform | Codebase'de URL pattern analizi yapan dosya yok |

Bu dosyalar için RESEARCH.md'deki Pattern 2, Pattern 3 ve Pattern 4 doğrudan referans olarak kullanılmalı.

---

## Metadata

**Analog search scope:** `src/app/(dashboard)/projeler/`, `src/components/`, `src/lib/supabase/`
**Files scanned:** 8 (kurallar/page.tsx, kurallar/actions.ts, projeler/[id]/page.tsx, lib/supabase/server.ts, components/ui/dialog.tsx, components/rules/RuleToggleRow.tsx, components/auth/login-form.tsx, components/ui/badge.tsx)
**Pattern extraction date:** 2026-04-23
