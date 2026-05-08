# Phase 12: Content Studio — Pattern Map

**Mapped:** 2026-04-26
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/page.tsx` | page (SSR) | request-response | `src/app/(dashboard)/projeler/[id]/rakipler/[competitorId]/page.tsx` | exact |
| `src/app/api/ai/generate-section/route.ts` | API route | streaming | `src/app/api/ai/generate-page-package/route.ts` | exact |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx` | page (SSR) | CRUD | self (modify) | self |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` | server actions | CRUD | self (modify) | self |
| `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/ContentStudioHeader.tsx` | component | event-driven | `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` | role-match |
| `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/SectionCard.tsx` | component | event-driven | `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` | role-match |
| `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/StreamingText.tsx` | component | streaming | `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` (handleAiGenerate) | role-match |
| `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx` | component | request-response | `src/app/(dashboard)/projeler/[id]/rakipler/[competitorId]/page.tsx` (banner patterns) | partial |
| `supabase/migrations/YYYYMMDD_add_content_studio_columns.sql` | migration | CRUD | `supabase/migrations/20260425000001_add_schema_jsonld.sql` | exact |

---

## Pattern Assignments

---

### `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/page.tsx` (SSR page, request-response)

**Analog:** `src/app/(dashboard)/projeler/[id]/rakipler/[competitorId]/page.tsx`

**Imports pattern** (lines 1–18):
```typescript
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ProjectNav } from '../../ProjectNav'
```

**Auth + nested params pattern** (lines 63–93):
```typescript
export default async function CompetitorDetailPage({
  params,
}: {
  params: Promise<{ id: string; competitorId: string }>
}) {
  const { id, competitorId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain, own_category_structure')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const { data: comp } = await supabase
    .from('competitors')
    .select('id, domain, source, ...')
    .eq('id', competitorId)
    .eq('project_id', id)
    .eq('user_id', user.id)
    .single()
  if (!comp) notFound()
```

**Layout pattern — dual-param route with sticky header** (lines 124–148):
```typescript
return (
  <div className="flex flex-col h-screen">
    <div className="p-8 pb-4">
      <Link
        href={`/projeler/${id}/rakipler`}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
      >
        ← Rakipler
      </Link>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{competitor.domain}</h1>
          <p className="text-sm text-muted-foreground mt-1">{project.name} projesi rakibi</p>
        </div>
        {/* Right-side CTA button */}
      </div>
    </div>

    <div className="flex flex-1 min-h-0">
      {/* Sol sütun — nav */}
      <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
        <ProjectNav projectId={id} activePath={`/projeler/${id}/rakipler`} />
      </div>
      {/* Sağ sütun — content */}
      <div className="flex-1 min-w-0 overflow-y-auto p-8 space-y-8">
        ...
      </div>
    </div>
  </div>
)
```

**Notes for Content Studio page.tsx:**
- Params shape: `{ id: string; pageId: string }` — mirror the `competitorId` param pattern
- Must query `page_packages` selecting `id, status, heading_hierarchy, content_sections, html_content, seo_title, h1, focus_keyword_id, search_intent, page_type, strategic_purpose`
- Gate: if `pkg.status !== 'locked'` render an inline warning instead of `notFound()`
- Pass raw `content_sections` JSONB and `heading_hierarchy` JSONB as props to a `'use client'` ContentStudioShell component
- Rules query: mirror `sayfa-paketi/page.tsx` lines 51–80 (`resolvedRules` pattern)

---

### `src/app/api/ai/generate-section/route.ts` (API route, streaming)

**Analog:** `src/app/api/ai/generate-page-package/route.ts`

**Full file is the canonical reference.** Key excerpts:

**Imports + client singleton** (lines 1–5):
```typescript
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
```

**Auth + body validation pattern** (lines 7–21):
```typescript
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }
  const { projectId, pageId } = body as { projectId?: string; pageId?: string }
  if (!projectId || !pageId) {
    return new Response('projectId and pageId are required', { status: 400 })
  }
```

**Ownership verify pattern** (lines 24–30):
```typescript
const { data: project } = await supabase
  .from('projects')
  .select('id, name, domain, sector, target_country, target_language, business_model, site_type, brand_tone, target_customer, main_goal')
  .eq('id', projectId)
  .eq('user_id', user.id)
  .single()
if (!project) return new Response('Project not found', { status: 404 })
```

**Streaming response pattern** (lines 96–123):
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

**Notes for generate-section/route.ts:**
- Body shape: `{ projectId, pageId, sectionIndex, headingHierarchy, approvedSections?, isRegenerate? }`
- Gate: if `pkg.status !== 'locked'` return `new Response('Package not locked', { status: 403 })`
- `buildPrompt()` receives section context per D-03: page package fields + project fields + rules + full heading_hierarchy + target H2 block; for regenerate mode also passes approved sections
- Model: `'claude-sonnet-4-6'` (locked in STATE.md)
- No JSON extraction needed — stream is plain prose text (not JSON)

---

### `src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx` (modify — add "İçerik Üret" button)

**File is already read in full.** Modification is additive only — no structural changes.

**Existing page list item pattern to extend** (lines 188–221):
```typescript
{pages.map((page) => {
  const isActive = page.id === selectedPageId
  const pkg = packageMap.get(page.id)

  return (
    <li key={page.id}>
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
        <div className="flex items-center gap-2 flex-wrap">
          {page.page_type && (
            <span className="text-xs text-muted-foreground">{page.page_type}</span>
          )}
          <PackageStatusBadge status={pkg?.status ?? null} />
        </div>
      </Link>
    </li>
  )
})}
```

**Add after `<PackageStatusBadge />`** — insert conditional `Link` button:
```typescript
{pkg?.status === 'locked' && (
  <Link
    href={`/projeler/${id}/icerik-studio/${page.id}`}
    className="text-xs px-2 py-0.5 rounded bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
    onClick={(e) => e.stopPropagation()}
  >
    İçerik Üret
  </Link>
)}
```

**Note:** `PackageRow` type (line 18) also needs `status` — already present. No type changes needed.

---

### `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` (modify — add 3 new actions)

**Analog:** Same file — extend following existing `updatePackageStatus` pattern.

**Existing action skeleton to copy** (lines 159–212):
```typescript
export async function updatePackageStatus(
  projectId: string,
  packageId: string,
  newStatus: 'draft' | 'approved' | 'locked'
): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const project = await verifyOwnership(supabase, projectId, user.id)
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  // ... DB update ...

  revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
  return { success: true }
}
```

**`verifyOwnership` helper is reusable** (lines 44–52):
```typescript
async function verifyOwnership(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string, userId: string) {
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()
  return data
}
```

**New actions to add — signatures and pattern:**
```typescript
// 1. approveSection — sets content_sections[sectionIndex].status = 'approved',
//    saves edited content, triggers html_content assembly if all approved
export async function approveSection(
  projectId: string,
  pageId: string,
  sectionIndex: number,
  content: string
): Promise<ActionResult>

// 2. rejectSection — sets content_sections[sectionIndex].status = 'rejected'
export async function rejectSection(
  projectId: string,
  pageId: string,
  sectionIndex: number
): Promise<ActionResult>

// 3. saveContentSections — bulk write after streaming completes (called by client)
export async function saveContentSections(
  projectId: string,
  pageId: string,
  sections: ContentSection[]
): Promise<ActionResult>
```

**revalidatePath pattern for content studio:**
```typescript
revalidatePath(`/projeler/${projectId}/icerik-studio/${pageId}`)
revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
```

---

### `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/ContentStudioHeader.tsx` (component, event-driven)

**Analog:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` — header area + useTransition pattern.

**`'use client'` + state + transition pattern** (PagePackageEditor.tsx lines 1–12):
```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
```

**Button disabled + loading label pattern** (PagePackageEditor.tsx lines 363–374):
```typescript
async function handleStatusChange(newStatus: 'draft' | 'approved' | 'locked') {
  if (!pkg?.id) return
  startTransition(async () => {
    const result = await updatePackageStatus(projectId, pkg.id, newStatus)
    if (result.success) {
      router.refresh()
    } else {
      setSaveStatus('error')
      setErrorMsg(result.error)
    }
  })
}
```

**Badge className pattern** (rakipler/page.tsx lines 101–107):
```typescript
{ label: 'Yüksek', cls: 'bg-red-500/20 text-red-400 border-red-500/30' }
{ label: 'Orta',   cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
{ label: 'Düşük',  cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
```

**ContentStudioHeader props shape:**
```typescript
type ContentStudioHeaderProps = {
  projectId: string
  pageId: string
  pageTitle: string
  totalSections: number
  approvedCount: number
  isGenerating: boolean
  generatingCount: number
  onGenerateAll: () => void
}
```

**Progress badge className logic** (from UI-SPEC):
```typescript
const allApproved = approvedCount === totalSections && totalSections > 0
const badgeClass = allApproved
  ? 'bg-emerald-500/20 text-emerald-400'
  : 'bg-slate-800 text-slate-400'
```

**Sticky header layout** (from UI-SPEC layout contract):
```typescript
<div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
  <div className="flex items-center gap-3">
    <Link href={`/projeler/${projectId}/sayfa-paketi`}>
      <Button variant="ghost" size="sm">← Geri</Button>
    </Link>
    <h1 className="text-lg font-semibold">{pageTitle} — İçerik Stüdyosu</h1>
  </div>
  <div className="flex items-center gap-3">
    <Badge className={badgeClass}>{progressLabel}</Badge>
    <Button disabled={isGenerating} onClick={onGenerateAll}>
      {isGenerating ? `Üretiliyor... (${generatingCount}/${totalSections})` : 'Tümünü Üret'}
    </Button>
  </div>
</div>
```

---

### `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/SectionCard.tsx` (component, event-driven)

**Analog:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` — Field + Textarea pattern.

**Textarea pattern** (PagePackageEditor.tsx lines 140–150):
```typescript
<Textarea
  id={id}
  value={value}
  onChange={(e) => onChange(e.target.value)}
  rows={rows}
  placeholder={placeholder}
  disabled={disabled}
  className={cn('text-sm resize-y', mono && 'font-mono text-xs')}
/>
```

**cn() conditional border pattern** (rakipler/page.tsx lines 178):
```typescript
<Badge className={`${competitionLevel.cls} border text-sm font-semibold mt-0.5`}>
```

**SectionCard state-driven border** (from UI-SPEC):
```typescript
const borderClass = {
  pending:    'border-l-4 border-slate-700',
  generating: 'border-l-4 border-blue-500',
  draft:      'border-l-4 border-slate-500',
  approved:   'border-l-4 border-emerald-400',
  rejected:   'border-l-4 border-red-500',
}[section.status]
```

**SectionCard props shape:**
```typescript
type SectionCardProps = {
  projectId: string
  pageId: string
  sectionIndex: number
  section: ContentSection   // { heading, level, sub_headings, content, status }
  onRegenerate: (index: number) => void
  onApprove: (index: number, content: string) => void
  onReject: (index: number) => void
  streamingContent?: string  // live text while generating
}
```

**Action button pattern** (from UI-SPEC and existing Button usage):
```typescript
// Footer action row
<div className="flex items-center justify-between pt-2">
  <Button variant="secondary" size="sm" onClick={() => onRegenerate(sectionIndex)}>
    Yeniden Üret
  </Button>
  {section.status !== 'approved' && (
    <div className="flex gap-2">
      <Button variant="destructive" size="sm" onClick={() => onReject(sectionIndex)}>
        Reddet
      </Button>
      <Button size="sm" onClick={() => onApprove(sectionIndex, localContent)}>
        Onayla
      </Button>
    </div>
  )}
  {section.status === 'approved' && (
    <Button variant="secondary" size="sm" onClick={() => onRegenerate(sectionIndex)}>
      Yeniden Üret
    </Button>
  )}
</div>
```

---

### `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/StreamingText.tsx` (component, streaming)

**Analog:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` — `handleAiGenerate` (lines 309–349).

**Client-side stream reading pattern** (PagePackageEditor.tsx lines 313–348):
```typescript
const res = await fetch('/api/ai/generate-section', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ projectId, pageId, sectionIndex }),
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
  // For StreamingText: call setLiveText(accumulated) on each chunk
}
```

**StreamingText props shape:**
```typescript
type StreamingTextProps = {
  text: string          // accumulated so far
  isStreaming: boolean  // shows cursor when true
}
```

**Cursor animation** (from UI-SPEC):
```typescript
// Append blinking cursor while streaming
<span className="whitespace-pre-wrap text-sm text-foreground">{text}</span>
{isStreaming && <span className="animate-pulse text-muted-foreground">▋</span>}
```

---

### `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx` (component, request-response)

**Analog:** Inline conditional banner pattern from `rakipler/page.tsx` (lines 150–155):
```typescript
{!hasSeenData && (
  <div className="p-4 rounded-md border border-border bg-secondary/30 text-sm text-muted-foreground">
    Bu rakip için henüz veri çekilmemiş.
  </div>
)}
```

**HtmlReadyBanner design** (from UI-SPEC):
```typescript
// Sticky bottom, shown only when all sections approved
<div className="sticky bottom-0 z-10 mx-6 mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
  {/* Tick02Icon emerald-400 */}
  <div>
    <p className="text-sm font-semibold text-emerald-400">HTML Çıktısı Hazır</p>
    <p className="text-sm text-muted-foreground">
      Tüm bölümler onaylandı. İçerik WordPress'e yayınlanmaya hazır.
    </p>
  </div>
</div>
```

---

### `supabase/migrations/YYYYMMDD_add_content_studio_columns.sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260425000001_add_schema_jsonld.sql`

Read that file for the exact ALTER TABLE pattern:
```sql
-- Pattern to copy (add_schema_jsonld.sql):
ALTER TABLE public.page_packages
  ADD COLUMN IF NOT EXISTS schema_jsonld JSONB;
```

**New migration content:**
```sql
-- Phase 12: Content Studio columns
ALTER TABLE public.page_packages
  ADD COLUMN IF NOT EXISTS content_sections JSONB,
  ADD COLUMN IF NOT EXISTS html_content     TEXT;
```

**No RLS changes needed** — existing `page_packages` RLS policies (UPDATE policy) already cover these new columns.

---

## Shared Patterns

### Auth + Ownership Check
**Source:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` lines 44–52 (`verifyOwnership`) and lines 65–71 (`getUser` + check)
**Apply to:** All new server actions in `icerik-studio` actions file; `generate-section/route.ts`
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { success: false, error: 'Oturum bulunamadı.' }

const project = await verifyOwnership(supabase, projectId, user.id)
if (!project) return { success: false, error: 'Proje bulunamadı.' }
```

### revalidatePath After Mutation
**Source:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` lines 88–90, 150, 210
**Apply to:** All new server actions
```typescript
revalidatePath(`/projeler/${projectId}/icerik-studio/${pageId}`)
revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
return { success: true }
```

### ActionResult Return Type
**Source:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` line 6
**Apply to:** All new server actions
```typescript
export type ActionResult = { success: true } | { success: false; error: string }
```

### Badge Without `variant` Prop
**Source:** `src/app/(dashboard)/projeler/[id]/rakipler/[competitorId]/page.tsx` lines 178–181
**Apply to:** All Badge usages in ContentStudioHeader, SectionCard, HtmlReadyBanner
```typescript
// CORRECT
<Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
  Onaylandı
</Badge>
// WRONG — never use variant prop
<Badge variant="success">Onaylandı</Badge>
```

### `cn()` for Conditional ClassNames
**Source:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` line 9; `sayfa-paketi/page.tsx` line 8
**Apply to:** SectionCard (border-l color by status), ContentStudioHeader (badge class)
```typescript
import { cn } from '@/lib/utils'
// usage:
className={cn('border-l-4', statusBorderMap[section.status])}
```

### `useTransition` + `router.refresh()` After Server Action
**Source:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` lines 363–374
**Apply to:** ContentStudioHeader `onGenerateAll` trigger; SectionCard approve/reject handlers
```typescript
const [isPending, startTransition] = useTransition()
const router = useRouter()

startTransition(async () => {
  const result = await approveSection(projectId, pageId, sectionIndex, content)
  if (result.success) {
    router.refresh()
  }
})
```

### Fetch Stream Pattern (Client-Side)
**Source:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` lines 309–348
**Apply to:** StreamingText component's internal fetch trigger; the parent shell's `generateSection()` function
```typescript
const res = await fetch('/api/ai/generate-section', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ projectId, pageId, sectionIndex }),
})
if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`)

const reader = res.body?.getReader()
if (!reader) throw new Error('Stream alınamadı')
const decoder = new TextDecoder()
let accumulated = ''
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  accumulated += decoder.decode(value, { stream: true })
  setLiveText(accumulated)  // update UI per chunk
}
```

### Locked Package Check in API Route
**Source:** `src/app/api/ai/generate-page-package/route.ts` lines 43–53
**Apply to:** `generate-section/route.ts` — invert the logic (require locked, not forbid locked)
```typescript
// In generate-page-package: forbids locked
if (existingPkg?.status === 'locked') {
  return new Response('Package is locked. Unlock before regenerating.', { status: 403 })
}
// In generate-section: REQUIRE locked
if (existingPkg?.status !== 'locked') {
  return new Response('Package must be locked to generate content.', { status: 403 })
}
```

### Font Weight Constraints (Locked)
**Source:** Phase 12 CONTEXT.md D-05; UI-SPEC Typography table
**Apply to:** All new components
```
font-medium  → FORBIDDEN
font-normal  → body text, labels (400)
font-semibold → headings, card titles, CTA labels (600)
```

---

## No Analog Found

All files have analogs in the codebase. No RESEARCH.md fallback needed.

---

## Metadata

**Analog search scope:** `src/app/(dashboard)/projeler/`, `src/app/api/ai/`, `supabase/migrations/`
**Files scanned:** 9
**Pattern extraction date:** 2026-04-26
