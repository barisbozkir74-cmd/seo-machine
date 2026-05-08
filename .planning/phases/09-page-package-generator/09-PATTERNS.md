# Phase 9: Page Package Generator - Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 8 (4 evolve/update + 1 migration + 3 new components)
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `sayfa-paketi/page.tsx` | page (server component) | request-response + CRUD read | `sayfa-paketi/page.tsx` (itself — evolve) | exact |
| `sayfa-paketi/PagePackageEditor.tsx` | component (client) | CRUD + streaming | `sayfa-paketi/PagePackageEditor.tsx` (itself — migrate) | exact |
| `sayfa-paketi/actions.ts` | server action | CRUD write | `ic-link-haritasi/actions.ts` | exact |
| `api/ai/generate-page-package/route.ts` | API route | streaming | `api/ai/generate-page-package/route.ts` (itself — update) | exact |
| `supabase/migrations/XXXX_create_page_packages.sql` | migration | — | `20260423000003_product_layers_schema.sql` + `20260423000004_product_layers_rls.sql` | exact |
| `sayfa-paketi/QaBadge.tsx` | component (client) | transform (client-side compute) | `sayfa-paketi/page.tsx` → `StatusBadge` inline (adapt) | role-match |
| `sayfa-paketi/PackageStatusBadge.tsx` | component (client) | transform | `sayfa-paketi/page.tsx` → `StatusBadge` inline | exact |
| `sayfa-paketi/LockedBanner.tsx` | component (display) | — | `ic-link-haritasi/SuggestLinksDialog.tsx` → amber inline pattern | partial |

---

## Pattern Assignments

### `sayfa-paketi/page.tsx` (server component, request-response + CRUD read — evolve)

**Analog:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx` (mevcut, evolve edilecek)

**Temel değişiklikler:**
- `PageRow` type artık `page_packages` join verisini taşır (`pkg_status`, `pkg_id` gibi alanlar)
- `pages` sorgusu sade kalır (sadece identity alanları: id, title, slug, page_type, focus_keyword_id)
- Ek sorgu: `page_packages` tablosundan `page_id IN (...)` ile paket durumları çekilir
- Sayfa listesi her satırda `PackageStatusBadge` gösterir + paket yoksa inline "Üret"/"Manuel Başlat" butonları

**İmport pattern** (mevcut, lines 1-6):
```typescript
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProjectNav } from '../ProjectNav'
import { PagePackageEditor, type PageData } from './PagePackageEditor'
import { cn } from '@/lib/utils'
```

**Yeni importlar eklenecek:**
```typescript
import { PackageStatusBadge } from './PackageStatusBadge'
```

**Auth + ownership pattern** (lines 59-72):
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) notFound()

const { data: project } = await supabase
  .from('projects')
  .select('id, name, domain')
  .eq('id', id)
  .eq('user_id', user.id)
  .single()
if (!project) notFound()
```

**Çift sorgu pattern** (mevcut lines 74-105 — aynen korunur, ancak pages sorgusu sadeleşir):
```typescript
// pages: sadece identity alanları
const { data: pagesRaw } = await supabase
  .from('pages')
  .select('id, title, slug, page_type, focus_keyword_id')
  .eq('project_id', id)
  .eq('user_id', user.id)
  .order('title', { ascending: true })

// page_packages: paket durumları
const pageIds = (pagesRaw ?? []).map((p) => p.id)
const { data: packagesRaw } = pageIds.length > 0
  ? await supabase
      .from('page_packages')
      .select('id, page_id, status, generated_by')
      .in('page_id', pageIds)
  : { data: [] }

const packageMap = new Map(
  (packagesRaw ?? []).map((pkg) => [pkg.page_id, pkg])
)
```

**Sayfa listesi row pattern** (mevcut lines 151-170 — status badge kısmı genişletilir):
```typescript
<Link
  href={`/projeler/${id}/sayfa-paketi?page=${page.id}`}
  className={cn(
    'flex flex-col gap-1 px-4 py-3 text-sm transition-colors border-l-2',
    isActive
      ? 'bg-secondary border-l-foreground'
      : 'border-l-transparent hover:bg-secondary/50 hover:border-l-border'
  )}
>
  <span className={cn('leading-tight', isActive ? 'text-foreground' : 'text-foreground/80')}>
    {page.title}
  </span>
  <div className="flex items-center gap-2">
    {page.page_type && (
      <span className="text-xs text-muted-foreground">{page.page_type}</span>
    )}
    <PackageStatusBadge status={packageMap.get(page.id)?.status ?? null} />
  </div>
</Link>
```

**NOT:** Mevcut `StatusBadge` inline fonksiyonu `PackageStatusBadge.tsx` bileşenine taşınır ve `page.tsx`'den silinir.

---

### `sayfa-paketi/PagePackageEditor.tsx` (client component, CRUD + streaming — migrate)

**Analog:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` (itself — migrate)

**Temel değişiklikler:**
- `PageData` type artık `page_packages` alanlarını taşır (pages identity ayrı, package SEO alanları ayrı)
- `handleSave` → `updatePagePackage(projectId, pageId, data)` — yeni tabloya yazar
- Header'a `QaBadge` + `PackageStatusBadge` + status aksiyon butonları eklenir
- `status === 'locked'` ise tüm `Input`/`Textarea` bileşenleri `disabled` prop alır, `LockedBanner` render edilir
- `font-medium` yasak — mevcut dosyadaki line 43 ve 161 düzeltilmeli (`font-medium` → kaldır)

**Korunan import pattern** (lines 1-10):
```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { updatePagePackage } from './actions'
```

**Yeni importlar:**
```typescript
import { QaBadge } from './QaBadge'
import { PackageStatusBadge } from './PackageStatusBadge'
import { LockedBanner } from './LockedBanner'
```

**jsonString / parseJsonField helpers** (lines 38-52 — aynen korunur):
```typescript
function jsonString(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  return JSON.stringify(val, null, 2)
}

function parseJsonField(val: string): unknown {
  const trimmed = val.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}
```

**Field component** (lines 54-99 — disabled prop eklenerek korunur):
```typescript
type FieldProps = {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  rows?: number
  placeholder?: string
  mono?: boolean
  maxLen?: number
  maxLenWarning?: number  // YENİ: warning threshold (soft limit)
  disabled?: boolean       // YENİ: locked state için
}
```

**AI streaming pattern** (lines 177-215 — aynen korunur):
```typescript
async function handleAiGenerate() {
  setAiStatus('loading')
  setAiError('')
  try {
    const res = await fetch('/api/ai/generate-page-package', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, pageId: page.id }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `HTTP ${res.status}`)
    }
    const reader = res.body?.getReader()
    if (!reader) throw new Error('Stream alınamadı')
    const decoder = new TextDecoder()
    let accumulated = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      accumulated += decoder.decode(value, { stream: true })
    }
    const jsonMatch = accumulated.match(/```json\s*([\s\S]*?)```/) ?? accumulated.match(/(\{[\s\S]*\})/)
    const jsonText = jsonMatch ? jsonMatch[1] : accumulated
    const parsed = JSON.parse(jsonText.trim()) as AiGeneratedFields
    applyAiFields(parsed)
    setAiStatus('done')
  } catch (err) {
    setAiError(err instanceof Error ? err.message : 'Bilinmeyen hata')
    setAiStatus('error')
  }
}
```

**Save + useTransition pattern** (lines 218-248 — aynen korunur):
```typescript
function handleSave() {
  setSaveStatus('idle')
  startTransition(async () => {
    const result = await updatePagePackage(projectId, page.id, { ... })
    if (result.success) {
      setSaveStatus('success')
      router.refresh()
    } else {
      setSaveStatus('error')
      setErrorMsg(result.error)
    }
  })
}
```

**Status aksiyon butonları pattern** (header'a eklenecek — yeni):
```typescript
// Draft durumu
{pkg.status === 'draft' && (
  <Button size="sm" onClick={handleApprove} disabled={isPending}>Onayla</Button>
)}
// Approved durumu  
{pkg.status === 'approved' && (
  <>
    <Button size="sm" onClick={handleLock} disabled={isPending}>Kilitle</Button>
    <Button variant="ghost" size="sm" onClick={handleRevertToDraft} disabled={isPending}>Taslağa Al</Button>
  </>
)}
// Locked durumu — Dialog ile onay
{pkg.status === 'locked' && (
  <UnlockDialog onConfirm={handleUnlock} isPending={isPending} />
)}
```

---

### `sayfa-paketi/actions.ts` (server action, CRUD write — update)

**Analog:** `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/actions.ts`

**Auth + ownership pattern** (lines 25-38 — aynen kopyalanır):
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { success: true } | { success: false; error: string }

export async function updatePagePackage(
  projectId: string,
  pageId: string,
  data: PagePackageData
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Proje sahipliğini doğrula
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return { success: false, error: 'Proje bulunamadı.' }
  ...
}
```

**Upsert pattern** (`page_packages` için — yeni tabloya uyarlanır):
```typescript
const { error } = await supabase
  .from('page_packages')
  .upsert({
    page_id: pageId,
    project_id: projectId,
    user_id: user.id,
    ...data,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'page_id' })  // page_id UNIQUE constraint

if (error) return { success: false, error: 'Paket kaydedilemedi: ' + error.message }

revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
return { success: true }
```

**Status transition actions** (yeni — ic-link-haritasi action pattern baz alınır):
```typescript
export async function updatePackageStatus(
  projectId: string,
  packageId: string,
  newStatus: 'draft' | 'approved' | 'locked'
): Promise<ActionResult> {
  // auth + ownership check (aynı pattern)
  // status-specific timestamp güncellemesi:
  const timestampField =
    newStatus === 'approved' ? { approved_at: new Date().toISOString() } :
    newStatus === 'locked'   ? { locked_at: new Date().toISOString() } :
    {}

  const { error } = await supabase
    .from('page_packages')
    .update({ status: newStatus, ...timestampField, updated_at: new Date().toISOString() })
    .eq('id', packageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
  ...
}
```

**createPackage action** (Manuel Başlat için — yeni):
```typescript
export async function createPagePackage(
  projectId: string,
  pageId: string,
  generatedBy: 'ai' | 'manual'
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  // auth + ownership
  const { data, error } = await supabase
    .from('page_packages')
    .insert({
      page_id: pageId,
      project_id: projectId,
      user_id: user.id,
      status: 'draft',
      generated_by: generatedBy,
      ai_model: generatedBy === 'ai' ? 'claude-sonnet-4-6' : null,
    })
    .select('id')
    .single()
  ...
}
```

---

### `api/ai/generate-page-package/route.ts` (API route, streaming — update)

**Analog:** `src/app/api/ai/generate-page-package/route.ts` (itself — update)

**Korunan core pattern** (lines 1-102 — büyük çoğunluğu korunur):
```typescript
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  ...
}
```

**Temel değişiklik — sayfa sorgusu `page_packages` durumunu kontrol eder:**
```typescript
// Locked package kontrolü — locked ise AI generate reddedilir
const { data: existingPkg } = await supabase
  .from('page_packages')
  .select('id, status')
  .eq('page_id', pageId)
  .eq('project_id', projectId)
  .single()

if (existingPkg?.status === 'locked') {
  return new Response('Package is locked. Unlock before regenerating.', { status: 403 })
}
```

**Streaming response pattern** (lines 74-102 — aynen korunur):
```typescript
const stream = await client.messages.stream({
  model: 'claude-sonnet-4-6',
  max_tokens: 4000,
  messages: [{ role: 'user', content: prompt }],
})

const encoder = new TextEncoder()
const readable = new ReadableStream({
  async start(controller) {
    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        controller.enqueue(encoder.encode(chunk.delta.text))
      }
    }
    controller.close()
  },
})

return new Response(readable, {
  headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache',
  },
})
```

---

### `supabase/migrations/XXXX_create_page_packages.sql` (migration — new)

**Analog:** `supabase/migrations/20260423000003_product_layers_schema.sql` + `20260423000004_product_layers_rls.sql`

**Tablo oluşturma pattern** (product_layers_schema.sql lines 42-50 baz alınır):
```sql
-- =============================================================================
-- SEO Machine — Page Packages Table
-- Phase 9: Ayrı page_packages tablosu (page_id UNIQUE — Phase 9 versioning yok)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.page_packages (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id           UUID REFERENCES public.pages(id) ON DELETE CASCADE NOT NULL,
  project_id        UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft',
  -- SEO Fields
  seo_title         TEXT,
  meta_description  TEXT,
  h1                TEXT,
  slug              TEXT,
  search_intent     TEXT,
  strategic_purpose TEXT,
  secondary_keywords JSONB DEFAULT '[]',
  heading_hierarchy  JSONB DEFAULT '[]',
  content_blocks     JSONB DEFAULT '[]',
  cta_blocks         JSONB DEFAULT '[]',
  image_plan         JSONB DEFAULT '[]',
  alt_texts          JSONB DEFAULT '[]',
  schema_type        TEXT,
  canonical_url      TEXT,
  faq                JSONB DEFAULT '[]',
  -- QA
  qa_scores          JSONB DEFAULT '{}',
  -- Traceability
  generated_by       TEXT NOT NULL DEFAULT 'manual',
  ai_model           TEXT,
  -- Timestamps
  created_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  approved_at        TIMESTAMPTZ,
  locked_at          TIMESTAMPTZ,
  -- Phase 9: tek package per page
  UNIQUE(page_id)
);

CREATE INDEX IF NOT EXISTS idx_page_packages_project_id ON public.page_packages(project_id);
CREATE INDEX IF NOT EXISTS idx_page_packages_page_id ON public.page_packages(page_id);
CREATE INDEX IF NOT EXISTS idx_page_packages_user_id ON public.page_packages(user_id);

-- updated_at trigger (set_updated_at fonksiyonu mevcut tablolarda tanımlı)
CREATE TRIGGER set_page_packages_updated_at
  BEFORE UPDATE ON public.page_packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

**RLS policy pattern** (product_layers_rls.sql lines 10-34 baz alınır):
```sql
-- RLS
ALTER TABLE public.page_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_packages_select_own" ON public.page_packages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "page_packages_insert_own" ON public.page_packages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "page_packages_update_own" ON public.page_packages
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "page_packages_delete_own" ON public.page_packages
  FOR DELETE USING (auth.uid() = user_id);
```

---

### `sayfa-paketi/QaBadge.tsx` (client component, transform — new)

**Analog:** `sayfa-paketi/page.tsx` → `StatusBadge` inline fonksiyonu (role-match; badge pattern adapt edilir)

**Badge temel pattern** (sayfa-paketi/page.tsx lines 39-47):
```typescript
function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? 'draft'
  const cfg = STATUS_LABELS[s] ?? { label: s, className: 'bg-secondary text-muted-foreground' }
  return (
    <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[10px]', cfg.className)}>
      {cfg.label}
    </span>
  )
}
```

**QaBadge — client-side compute pattern** (yeni, bu pattern baz alınır):
```typescript
'use client'

import { cn } from '@/lib/utils'

type QaRule = {
  id: string
  severity: 'warning' | 'error'
}

type QaBadgeProps = {
  seoTitle: string
  metaDescription: string
  h1: string
  focusKeyword: string | null
}

function computeQaRules(props: QaBadgeProps): QaRule[] {
  const rules: QaRule[] = []
  // QA-01
  if (props.seoTitle.length > 70) rules.push({ id: 'QA-01', severity: 'error' })
  else if (props.seoTitle.length > 60) rules.push({ id: 'QA-01', severity: 'warning' })
  // QA-02
  if (props.metaDescription.length > 170) rules.push({ id: 'QA-02', severity: 'error' })
  else if (props.metaDescription.length > 155) rules.push({ id: 'QA-02', severity: 'warning' })
  // QA-03
  if (!props.h1.trim()) rules.push({ id: 'QA-03', severity: 'error' })
  // QA-04
  if (
    props.focusKeyword &&
    !props.seoTitle.toLowerCase().includes(props.focusKeyword.toLowerCase())
  ) rules.push({ id: 'QA-04', severity: 'warning' })
  return rules
}

export function QaBadge(props: QaBadgeProps) {
  const rules = computeQaRules(props)
  const errors = rules.filter((r) => r.severity === 'error')
  const warnings = rules.filter((r) => r.severity === 'warning')

  if (errors.length > 0) {
    return (
      <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-red-400')}>
        ✕ Hata
      </span>
    )
  }
  if (warnings.length > 0) {
    return (
      <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-amber-400')}>
        ⚠ {warnings.length} Uyarı
      </span>
    )
  }
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-emerald-400')}>
      ✓ QA Geçti
    </span>
  )
}
```

---

### `sayfa-paketi/PackageStatusBadge.tsx` (client component, transform — new)

**Analog:** `sayfa-paketi/page.tsx` → `StatusBadge` inline fonksiyonu (exact — doğrudan bileşene dönüştürülür)

**Mevcut STATUS_LABELS pattern** (sayfa-paketi/page.tsx lines 33-47 — Phase 9 değerleriyle yeniden tanımlanır):
```typescript
'use client'

import { cn } from '@/lib/utils'

const PACKAGE_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft:    { label: 'Taslak',    className: 'bg-secondary text-muted-foreground' },
  approved: { label: 'Onaylandı', className: 'bg-blue-900/40 text-blue-400' },
  locked:   { label: 'Kilitli',   className: 'bg-amber-900/40 text-amber-400' },
}

export function PackageStatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground opacity-60')}>
        Paket Yok
      </span>
    )
  }
  const cfg = PACKAGE_STATUS_LABELS[status] ?? { label: status, className: 'bg-secondary text-muted-foreground' }
  return (
    <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[10px]', cfg.className)}>
      {cfg.label}
    </span>
  )
}
```

**Dikkat:** Badge `variant` prop kullanılmaz — className ile doğrudan renk (UI-SPEC constraint).

---

### `sayfa-paketi/LockedBanner.tsx` (client component, display — new)

**Analog:** `ic-link-haritasi/SuggestLinksDialog.tsx` → amber uyarı pattern (partial — renk sistemi kopyalanır)

**Amber uyarı renk pattern** (SuggestLinksDialog.tsx line 143):
```typescript
// Referans: amber renk kullanımı
className="bg-amber-500/20 text-amber-400 border border-amber-500/30"
```

**LockedBanner tam implementasyon:**
```typescript
'use client'

type LockedBannerProps = {
  onUnlockClick: () => void
  isPending?: boolean
}

export function LockedBanner({ onUnlockClick, isPending }: LockedBannerProps) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-md bg-amber-900/20 border border-amber-700/40">
      <p className="text-xs text-amber-400">
        Bu paket kilitli — düzenlemek için kilidini aç.
      </p>
      <button
        onClick={onUnlockClick}
        disabled={isPending}
        className="text-xs text-amber-400 hover:text-amber-300 underline disabled:opacity-50"
      >
        Kilidini Aç
      </button>
    </div>
  )
}
```

**NOT:** Kilidini Aç aksiyonu için ayrı confirmation Dialog gerekir. Dialog pattern için `SuggestLinksDialog.tsx` baz alınır — ancak base-ui `DialogTrigger render={}` kullanılır (`asChild` yasak).

---

## Shared Patterns

### Authentication + Ownership Check
**Kaynak:** `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/actions.ts` (lines 25-38)
**Uygulama:** Tüm server action fonksiyonları (`updatePagePackage`, `updatePackageStatus`, `createPagePackage`)
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { success: false, error: 'Oturum bulunamadı.' }

const { data: project } = await supabase
  .from('projects')
  .select('id')
  .eq('id', projectId)
  .eq('user_id', user.id)
  .single()
if (!project) return { success: false, error: 'Proje bulunamadı.' }
```

### Error Handling (ActionResult)
**Kaynak:** `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/actions.ts` (line 6)
**Uygulama:** Tüm server actions
```typescript
export type ActionResult = { success: true } | { success: false; error: string }
```

### useTransition + router.refresh()
**Kaynak:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` (lines 122, 218-248)
**Uygulama:** `PagePackageEditor.tsx` — save, status transition, createPackage aksiyon handler'ları
```typescript
const router = useRouter()
const [isPending, startTransition] = useTransition()

startTransition(async () => {
  const result = await serverAction(...)
  if (result.success) {
    setSaveStatus('success')
    router.refresh()
  } else {
    setSaveStatus('error')
    setErrorMsg(result.error)
  }
})
```

### revalidatePath
**Kaynak:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` (line 84)
**Uygulama:** Tüm actions
```typescript
revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
```

### Updated_at Trigger
**Kaynak:** `supabase/migrations/20260423000003_product_layers_schema.sql` (lines 67-68)
**Uygulama:** `page_packages` migrasyonu
```sql
CREATE TRIGGER set_page_packages_updated_at
  BEFORE UPDATE ON public.page_packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### Badge Renk (className, variant yok)
**Kaynak:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx` (lines 33-47)
**Uygulama:** `PackageStatusBadge.tsx`, `QaBadge.tsx`, `LockedBanner.tsx`
```typescript
// DOĞRU: className ile doğrudan renk
<span className={cn('inline-flex px-1.5 py-0.5 rounded text-[10px]', cfg.className)}>

// YANLIŞ — YOK: <Badge variant="destructive">
```

### font-medium Yasağı
**Uygulama:** Tüm Phase 9 bileşenleri
- Mevcut `PagePackageEditor.tsx` line 43'teki `font-medium` label'da ve line 161'deki `font-medium` span'da kaldırılmalı
- Yeni bileşenlerde `font-semibold` (600) veya `font-normal` (400) kullanılır

### Dialog Pattern (base-ui)
**Kaynak:** `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/SuggestLinksDialog.tsx` (dialog yapısı)
**Uygulama:** Kilidini Aç confirmation dialog
```typescript
// DOĞRU: render={} prop
<DialogTrigger render={<Button variant="outline" size="sm">Kilidini Aç</Button>} />

// YANLIŞ — YASAK: asChild prop kullanımı
```

---

## No Analog Found

Tüm dosyalar için yeterli analog bulundu. Kısmi eşleşme olan dosyalar:

| File | Role | Data Flow | Durum |
|------|------|-----------|-------|
| `QaBadge.tsx` | component | client-side compute | Yakın analog yok; `StatusBadge` inline pattern adapt edilir. QA kuralları logic tamamen yeni. |

---

## Metadata

**Analog arama kapsamı:**
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/` (3 dosya)
- `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/` (2 dosya)
- `src/app/(dashboard)/projeler/[id]/kurallar/` (1 dosya)
- `src/app/api/ai/generate-page-package/` (1 dosya)
- `supabase/migrations/` (11 dosya — 2 relevantta derinlemesine okundu)

**Taranan dosya sayısı:** 11
**Pattern extraction tarihi:** 2026-04-24
