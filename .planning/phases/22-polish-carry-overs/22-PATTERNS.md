# Phase 22: Polish & Carry-overs — Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 8
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/(dashboard)/projeler/[id]/izleme/page.tsx` | page (server component) | request-response | self (modify existing) | exact |
| `src/lib/monitoring/aggregation.ts` | service / utility | CRUD + transform | self (modify existing) | exact |
| `src/app/(dashboard)/projeler/[id]/izleme/page-metrics-table.tsx` | component | request-response | self (modify existing) | exact |
| `supabase/migrations/` | migration | CRUD | `20260424000005_create_page_packages.sql` | exact |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` | server action | CRUD | self (modify existing) | exact |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/RevisionHistorySheet.tsx` | component | request-response | `PagePackageEditor.tsx` (QA dialog pattern) | role-match |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/RevisionPreviewDialog.tsx` | component | request-response | `MoveKeywordDialog.tsx` | exact |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` | component | request-response | self (modify existing) | exact |

---

## Pattern Assignments

### `src/app/(dashboard)/projeler/[id]/izleme/page.tsx` (server component, request-response)

**Change:** Extract `project_imported_pages` fetch outside the `gscConnected` gate. Move `pages` tab render outside the `!gscConnected` block (or add imported pages to the non-GSC path).

**Current gate pattern** (lines 57–63) — the entire triple-fetch is gated:
```typescript
const [clusters, pages, recoveryTasks] = gscConnected
  ? await Promise.all([
      getClusterMetrics(supabase, id, period),
      getPageMetrics(supabase, id, period),
      getRecoveryTasks(supabase, id, true),
    ])
  : [[], [], []]
```

**Target pattern — split into two fetches:**
```typescript
// Always fetch imported pages (gscConnected-independent)
const { data: importedPagesRaw } = await supabase
  .from('project_imported_pages')
  .select('id, title, link, slug')
  .eq('project_id', id)
  .order('title')

const importedPages = importedPagesRaw ?? []

// GSC-dependent fetches unchanged
const [clusters, pages, recoveryTasks] = gscConnected
  ? await Promise.all([
      getClusterMetrics(supabase, id, period),
      getPageMetrics(supabase, id, period),
      getRecoveryTasks(supabase, id, true),
    ])
  : [[], [], []]
```

**Non-GSC gate rendering pattern** (lines 83–95) — the entire content div is gated on `gscConnected`. The `pages` tab section (lines 108–113) currently lives inside the gated block. The modification needs to make `pages` + imported pages accessible when `!gscConnected` (via `?tab=pages` URL). Approach: move the `pages` section render outside the `!gscConnected` card, or restructure so `pages` tab shows imported rows unconditionally.

**Props to pass down to PageMetricsTable** (lines 108–112):
```tsx
{activeTab === 'pages' && (
  <section>
    <h2 className="text-base font-semibold mb-4">Sayfa Performansı</h2>
    <PageMetricsTable pages={pages} importedPages={importedPages} gscConnected={gscConnected} />
  </section>
)}
```

**Supabase client + auth pattern** (lines 36–38) — copy verbatim for the new fetch:
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) notFound()
```

---

### `src/lib/monitoring/aggregation.ts` (service, CRUD + transform)

**Change:** Add `ImportedPageRow` type and `getImportedPageMetrics` function (or extend `getPageMetrics` to accept/return imported rows alongside GSC rows — approach depends on planner decision; separate function is cleaner).

**Existing type pattern** (lines 19–28) — new type follows same shape with nullable metrics:
```typescript
export type PageMetricRow = {
  pageId: string
  pageUrl: string
  title: string
  clicks: number
  impressions: number
  avgPosition: number
  deltaPosition: number | null
  isDecayed: boolean
}
```

**New type to add:**
```typescript
export type ImportedPageRow = {
  pageId: string      // project_imported_pages.id
  pageUrl: string     // link || `/${slug}` fallback
  title: string
  // All metric fields null — no GSC data
  clicks: null
  impressions: null
  avgPosition: null
  deltaPosition: null
  isDecayed: false
  rowType: 'imported'  // discriminant for PageMetricsTable rendering
}
```

**Function signature pattern** (lines 163–167) — new function mirrors `getPageMetrics`:
```typescript
export async function getImportedPageMetrics(
  supabase: SupabaseClient,
  projectId: string
): Promise<ImportedPageRow[]> {
  const { data } = await supabase
    .from('project_imported_pages')
    .select('id, title, link, slug')
    .eq('project_id', projectId)
    .order('title')

  return (data ?? []).map((p) => ({
    pageId: p.id,
    pageUrl: p.link ?? (p.slug ? `/${p.slug}` : ''),
    title: p.title,
    clicks: null,
    impressions: null,
    avgPosition: null,
    deltaPosition: null,
    isDecayed: false,
    rowType: 'imported' as const,
  }))
}
```

**Parallel fetch pattern** (lines 171–183) — used in `getPageMetrics`; same pattern for the page.tsx parallel fetch:
```typescript
const [currentResult, priorResult] = await Promise.all([
  supabase.from('gsc_metrics').select(...).eq('project_id', projectId).gte('date', fmt(currentStart)),
  supabase.from('gsc_metrics').select(...).eq('project_id', projectId).gte('date', fmt(priorStart)).lte('date', fmt(priorEnd)),
])
```

---

### `src/app/(dashboard)/projeler/[id]/izleme/page-metrics-table.tsx` (component, request-response)

**Change:** Accept new `importedPages` prop and `gscConnected` prop; render imported rows with dash values; update empty-state copy.

**Imports pattern** (lines 1–6) — add `ImportedPageRow` to import:
```typescript
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PageMetricRow, ImportedPageRow } from '@/lib/monitoring/aggregation'
```

**Empty state pattern** (lines 23–29) — update copy per UI-SPEC:
```tsx
// Current:
<p className="text-sm text-muted-foreground">GSC verisi bulunamadı</p>

// New (when both pages[] and importedPages[] are empty):
<p className="text-base font-semibold">Henüz sayfa verisi yok</p>
// When gscConnected=false and importedPages also empty:
<p className="text-sm text-muted-foreground mt-2">
  GSC bağlantısı yok — yalnızca içe aktarılan sayfalar listelenir.
</p>
```

**Existing GSC row render** (lines 44–75) — imported rows follow same `<TableRow>` structure but with dash rendering:
```tsx
// Existing Düşüş badge pattern (line 68):
<Badge className="bg-red-500/15 text-red-400 border border-red-500/30 text-xs rounded-full px-2 py-0.5">
  Düşüş
</Badge>

// New İçe Aktarıldı badge (same pattern, blue):
<Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs rounded-full px-2 py-0.5">
  İçe Aktarıldı
</Badge>
```

**Dash cell pattern** — for null metric columns in imported rows:
```tsx
<TableCell className="text-right text-sm tabular-nums text-muted-foreground">—</TableCell>
```

**Component signature change:**
```tsx
export function PageMetricsTable({
  pages,
  importedPages = [],
  gscConnected = true,
}: {
  pages: PageMetricRow[]
  importedPages?: ImportedPageRow[]
  gscConnected?: boolean
})
```

**Row render order:** GSC rows first (sorted by clicks DESC, existing behavior), imported rows appended after. Each imported row gets `key={p.pageId}` and `className="hover:bg-muted/50 transition-colors"` (line 45 pattern).

---

### `supabase/migrations/` — new `page_package_revisions` table

**Analog:** `supabase/migrations/20260424000005_create_page_packages.sql`

**Migration file naming convention** — most recent is `20260509000010_clustering_approval.sql`. New file: `20260510000001_page_package_revisions.sql`.

**Full migration pattern** (from `create_page_packages.sql`, lines 1–68):
```sql
-- =============================================================================
-- SEO Machine — Page Package Revisions Table
-- Phase 22: Her kaydet aksiyonunda otomatik snapshot
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.page_package_revisions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id  UUID NOT NULL REFERENCES public.page_packages(id) ON DELETE CASCADE,
  page_id     UUID NOT NULL,
  project_id  UUID NOT NULL,
  user_id     UUID NOT NULL,
  snapshot    JSONB NOT NULL,
  version_num INTEGER NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_package_revisions_package_id
  ON public.page_package_revisions(package_id);
CREATE INDEX IF NOT EXISTS idx_page_package_revisions_project_id
  ON public.page_package_revisions(project_id);

ALTER TABLE public.page_package_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_package_revisions_select_own" ON public.page_package_revisions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "page_package_revisions_insert_own" ON public.page_package_revisions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

Note: No UPDATE/DELETE policies — revisions are append-only (no cleanup in this phase per CONTEXT.md Out of Scope).

---

### `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` (server action, CRUD)

**Change:** Modify `updatePagePackage` to insert a revision snapshot before the UPDATE. Add `getRevisions` fetch action for the Sheet to call.

**Existing `updatePagePackage` ownership + auth pattern** (lines 275–307) — copy exactly:
```typescript
export async function updatePagePackage(
  projectId: string,
  pageId: string,
  data: PagePackageData
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const project = await verifyOwnership(supabase, projectId, user.id)
  if (!project) return { success: false, error: 'Proje bulunamadı.' }
  // ...
}
```

**Revision insert before UPDATE** — add between ownership check and upsert call:
```typescript
// 1. Fetch current package state for snapshot
const { data: currentPkg } = await supabase
  .from('page_packages')
  .select('*')
  .eq('page_id', pageId)
  .eq('project_id', projectId)
  .eq('user_id', user.id)
  .maybeSingle()

if (currentPkg) {
  // 2. Compute next version_num
  const { count } = await supabase
    .from('page_package_revisions')
    .select('id', { count: 'exact', head: true })
    .eq('package_id', currentPkg.id)

  const versionNum = (count ?? 0) + 1

  // 3. Insert revision (non-fatal — do not block save on failure)
  await supabase.from('page_package_revisions').insert({
    package_id: currentPkg.id,
    page_id: pageId,
    project_id: projectId,
    user_id: user.id,
    snapshot: currentPkg,
    version_num: versionNum,
  })
}
```

**New `getRevisions` server action** — follows same auth + ownership guard pattern:
```typescript
export type RevisionRow = {
  id: string
  version_num: number
  snapshot: Record<string, unknown>
  created_at: string
}

export async function getRevisions(
  projectId: string,
  pageId: string
): Promise<{ success: true; revisions: RevisionRow[] } | { success: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const project = await verifyOwnership(supabase, projectId, user.id)
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  // Resolve package_id from page_id
  const { data: pkg } = await supabase
    .from('page_packages')
    .select('id')
    .eq('page_id', pageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!pkg) return { success: true, revisions: [] }

  const { data, error } = await supabase
    .from('page_package_revisions')
    .select('id, version_num, snapshot, created_at')
    .eq('package_id', pkg.id)
    .order('version_num', { ascending: false })

  if (error) return { success: false, error: 'Revizyon geçmişi yüklenemedi.' }

  return { success: true, revisions: data ?? [] }
}
```

**`revalidatePath` pattern** (lines 305–306) — after a successful save, replicate:
```typescript
revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
```

---

### `src/app/(dashboard)/projeler/[id]/sayfa-paketi/RevisionHistorySheet.tsx` (NEW component, request-response)

**No Sheet analog exists** — Sheet component is not yet installed (`npx shadcn add sheet` required in wave 1). Pattern is constructed from the QA dialog state machine inside `PagePackageEditor.tsx` (lines 295–300, 441–481).

**'use client' + imports pattern** (from `PagePackageEditor.tsx` lines 1–22):
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { getRevisions, type RevisionRow } from './actions'
```

**Open/close state pattern** — mirrors `qaDialogOpen` + `qaDialogPhase` in PagePackageEditor:
```typescript
type SheetState = 'idle' | 'loading' | 'loaded' | 'empty' | 'error'

const [open, setOpen] = useState(false)
const [state, setState] = useState<SheetState>('idle')
const [revisions, setRevisions] = useState<RevisionRow[]>([])
const [selectedRevision, setSelectedRevision] = useState<RevisionRow | null>(null)
const [previewOpen, setPreviewOpen] = useState(false)
```

**Fetch-on-open pattern** — mirrors `proceedToQA` async fetch in PagePackageEditor (lines 435–481):
```typescript
async function handleOpenChange(nextOpen: boolean) {
  setOpen(nextOpen)
  if (!nextOpen) return
  setState('loading')
  const result = await getRevisions(projectId, pageId)
  if (!result.success) {
    setState('error')
    return
  }
  if (result.revisions.length === 0) {
    setState('empty')
    setRevisions([])
    return
  }
  setRevisions(result.revisions)
  setState('loaded')
}
```

**Spinner pattern** (from PagePackageEditor lines 775–778) — used in `loading` state:
```tsx
<div className="w-5 h-5 rounded-full border-2 border-muted border-t-foreground animate-spin mx-auto mt-8"
     aria-label="Revizyon geçmişi yükleniyor" />
```

**Revision list row pattern** — follows `RecoveryTaskTable` row structure (lines 181–230), with `border-b border-border` separator (UI-SPEC):
```tsx
{revisions.map((rev) => (
  <div key={rev.id} className="flex items-center justify-between py-3 border-b border-border">
    <div className="flex items-center gap-3">
      <span className="text-sm font-semibold text-foreground">v{rev.version_num}</span>
      <span className="text-xs text-muted-foreground">
        {new Date(rev.created_at).toLocaleString('tr-TR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}
      </span>
    </div>
    <Button
      variant="outline"
      size="sm"
      onClick={() => { setSelectedRevision(rev); setPreviewOpen(true) }}
    >
      Önizle
    </Button>
  </div>
))}
```

**Empty state pattern** (from `RecoveryTaskTable` lines 96–105, `PageMetricsTable` lines 23–29):
```tsx
<p className="text-sm text-muted-foreground py-8 text-center">
  Henüz kayıtlı revizyon yok. İlk kaydetme işleminde otomatik oluşturulur.
</p>
```

**Error state pattern** — mirrors PagePackageEditor `aiStatus === 'error'` (line 843):
```tsx
<p className="text-sm text-red-400">
  Revizyon listesi yüklenemedi. Lütfen sayfayı yenile.
</p>
```

**Props interface:**
```typescript
export function RevisionHistorySheet({
  projectId,
  pageId,
  onLoadRevision,
}: {
  projectId: string
  pageId: string
  onLoadRevision: (snapshot: Record<string, unknown>) => void
})
```

**Sheet JSX skeleton** (shadcn Sheet API — side="right", w-[420px]):
```tsx
<Sheet open={open} onOpenChange={handleOpenChange}>
  <SheetContent side="right" className="w-[420px]">
    <SheetHeader>
      <SheetTitle>Revizyon Geçmişi</SheetTitle>
      <SheetDescription>
        Kaydedilen sürümler — bir revizyonu yükleyerek geri alabilirsin.
      </SheetDescription>
    </SheetHeader>
    <div className="mt-4">
      {state === 'loading' && <spinner />}
      {state === 'empty' && <empty-state />}
      {state === 'error' && <error-state />}
      {state === 'loaded' && <revision-list />}
    </div>
  </SheetContent>
</Sheet>
```

---

### `src/app/(dashboard)/projeler/[id]/sayfa-paketi/RevisionPreviewDialog.tsx` (NEW component, request-response)

**Analog:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/MoveKeywordDialog.tsx` (exact Dialog pattern).

**'use client' + Dialog imports** (MoveKeywordDialog lines 1–14):
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
```

**Controlled open pattern** (MoveKeywordDialog lines 36–49):
```typescript
const [isLoading, setIsLoading] = useState(false)

const handleLoadRevision = () => {
  setIsLoading(true)
  onLoadRevision(revision.snapshot)   // callback to PagePackageEditor state
  setIsLoading(false)
  onClose()
}
```

**Read-only Field pattern** — from PagePackageEditor `Field` component (lines 111–169) — all fields rendered `disabled={true}`. The same `Field` component is already defined in `PagePackageEditor.tsx` and should be imported or co-located. Since `Field` is not exported, replicate the disabled input pattern:
```tsx
<Textarea
  value={String(revision.snapshot.seo_title ?? '')}
  disabled
  className="text-sm resize-y"
/>
```

**Dialog size + scroll wrapper** (UI-SPEC: `max-w-2xl`, `max-h-[60vh] overflow-y-auto`):
```tsx
<DialogContent className="max-w-2xl">
  <DialogHeader>
    <DialogTitle>Revizyon {revision.version_num} — Önizleme</DialogTitle>
    <DialogDescription>
      Bu sürüm {formattedDate} tarihinde kaydedildi. Salt okunur görünüm.
    </DialogDescription>
  </DialogHeader>
  <div className="max-h-[60vh] overflow-y-auto space-y-4 py-2">
    {/* disabled Field elements for each snapshot key */}
  </div>
  <DialogFooter>
    <DialogClose render={<Button variant="ghost" size="sm">Kapat</Button>} />
    <Button size="sm" onClick={handleLoadRevision} disabled={isLoading}>
      {isLoading ? 'Yükleniyor...' : 'Bunu Yükle'}
    </Button>
  </DialogFooter>
</DialogContent>
```

Note: `DialogClose` uses `render` prop (same Radix API as PagePackageEditor line 713). Do not use `asChild`.

**Props interface:**
```typescript
export function RevisionPreviewDialog({
  revision,
  open,
  onClose,
  onLoadRevision,
}: {
  revision: RevisionRow | null
  open: boolean
  onClose: () => void
  onLoadRevision: (snapshot: Record<string, unknown>) => void
})
```

---

### `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` (component, modify)

**Change:** Add `historyOpen` state, `RevisionHistorySheet` mount, `applyRevision` callback, and "Geçmiş" ghost button to the toolbar.

**Existing state declaration pattern** (lines 283–298) — add alongside existing state:
```typescript
// Revision history state
const [historyOpen, setHistoryOpen] = useState(false)
```

**"Geçmiş" button position** — inside the `<div className="flex items-center gap-2 shrink-0">` (line 638), as the FIRST child (leftmost in the row), only when `pkg !== null`:
```tsx
<div className="flex items-center gap-2 shrink-0">
  {pkg !== null && (
    <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
      Geçmiş
    </Button>
  )}
  {/* existing buttons follow */}
```

**`applyRevision` callback** — mirrors `applyAiFields` (lines 303–314):
```typescript
function applyRevision(snapshot: Record<string, unknown>) {
  // Set editor state from snapshot fields (same field names as PagePackageData)
  if (snapshot.seo_title) setSeoTitle(String(snapshot.seo_title))
  if (snapshot.meta_description) setMetaDescription(String(snapshot.meta_description))
  if (snapshot.h1) setH1(String(snapshot.h1))
  if (snapshot.slug) setSlug(String(snapshot.slug))
  if (snapshot.canonical_url) setCanonicalUrl(String(snapshot.canonical_url))
  if (snapshot.strategic_purpose) setStrategicPurpose(String(snapshot.strategic_purpose))
  if (snapshot.search_intent) setSearchIntent(String(snapshot.search_intent))
  if (snapshot.schema_type) setSchemaType(String(snapshot.schema_type))
  if (snapshot.page_type) setPageType(String(snapshot.page_type))
  if (snapshot.heading_hierarchy) setHeadingHierarchy(jsonString(snapshot.heading_hierarchy))
  if (snapshot.content_blocks) setContentBlocks(jsonString(snapshot.content_blocks))
  if (snapshot.cta_blocks) setCtaBlocks(jsonString(snapshot.cta_blocks))
  if (snapshot.image_plan) setImagePlan(jsonString(snapshot.image_plan))
  if (snapshot.alt_texts) setAltTexts(jsonString(snapshot.alt_texts))
  if (snapshot.secondary_keywords) setSecondaryKeywords(jsonString(snapshot.secondary_keywords))
  if (snapshot.faq) setFaq(jsonString(snapshot.faq))
  if (snapshot.schema_jsonld) setSchemaJsonLd(jsonString(snapshot.schema_jsonld))
  setHistoryOpen(false)  // close sheet after load (per D-06 flow)
}
```

**Sheet mount placement** — alongside the existing QA Dialog (lines 742–835), just before the closing `</div>` of the header section:
```tsx
<RevisionHistorySheet
  projectId={projectId}
  pageId={page.id}
  open={historyOpen}
  onOpenChange={setHistoryOpen}
  onLoadRevision={applyRevision}
/>
```

---

## Shared Patterns

### Auth + Ownership Guard
**Source:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` lines 77–85 + 282–289
**Apply to:** `getRevisions` action and the revision insert inside `updatePagePackage`
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { success: false, error: 'Oturum bulunamadı.' }

const project = await verifyOwnership(supabase, projectId, user.id)
if (!project) return { success: false, error: 'Proje bulunamadı.' }
```

### Error Handling (ActionResult)
**Source:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` line 9
**Apply to:** `getRevisions`, any new server action
```typescript
export type ActionResult = { success: true } | { success: false; error: string }
```

### Badge Color Convention
**Source:** `src/app/(dashboard)/projeler/[id]/izleme/page-metrics-table.tsx` lines 67–72, `recovery-task-table.tsx` lines 41–46
**Apply to:** `PageMetricsTable` imported row badge, `RevisionHistorySheet` (none needed), `RevisionPreviewDialog` (none needed)
```typescript
// Pattern: bg-{color}-500/15 text-{color}-400 border border-{color}-500/30
// Düşüş: red; İçe Aktarıldı: blue; Açık: red; Çözüldü: emerald
```

### Spinner (loading state)
**Source:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` lines 775–778
**Apply to:** `RevisionHistorySheet` loading state
```tsx
<div className="w-5 h-5 rounded-full border-2 border-muted border-t-foreground animate-spin mx-auto mt-8"
     aria-label="Revizyon geçmişi yükleniyor" />
```

### Dialog API (Radix render prop)
**Source:** `PagePackageEditor.tsx` lines 712–737
**Apply to:** `RevisionPreviewDialog`, any new dialog
```tsx
// Use render prop, NOT asChild:
<DialogClose render={<Button variant="ghost" size="sm">İptal</Button>} />
<DialogTrigger render={<Button variant="outline" size="sm">...</Button>} />
```

### revalidatePath
**Source:** `actions.ts` lines 305–306
**Apply to:** `updatePagePackage` after revision insert + upsert
```typescript
revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
```

### Empty State Card
**Source:** `src/app/(dashboard)/projeler/[id]/izleme/page-metrics-table.tsx` lines 23–29, `recovery-task-table.tsx` lines 96–117
**Apply to:** `PageMetricsTable` updated empty state, `RevisionHistorySheet` empty state
```tsx
<div className="rounded-lg border border-border bg-card p-8 text-center">
  <p className="text-base font-semibold">...</p>
  <p className="text-sm text-muted-foreground mt-2">...</p>
</div>
```

---

## No Analog Found

No files in this phase lack a codebase analog. All 8 files have either an exact self-reference (modify existing) or a strong role-match.

| File | Note |
|------|------|
| `RevisionHistorySheet.tsx` | Sheet component is new (not yet installed), but state machine + fetch-on-open pattern is directly cloned from `PagePackageEditor` QA dialog. shadcn Sheet API is standard. |

---

## Metadata

**Analog search scope:** `src/app/(dashboard)/projeler/[id]/izleme/`, `src/app/(dashboard)/projeler/[id]/sayfa-paketi/`, `src/lib/monitoring/`, `supabase/migrations/`, `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/`
**Files scanned:** 10 source files + 2 migration files
**Pattern extraction date:** 2026-05-10
