# Phase 21: Site Blueprint Auto-Generation Gate — Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 4
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts` | service / server-action | CRUD + UPDATE branch | `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts` (self — extend existing `generatePagesFromClusters`) | exact |
| `src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx` | component | request-response (form, useTransition) | `src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx` (self — modify existing dialog) | exact |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordStratejisiToolbar.tsx` | component | event-driven (state, router) | `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordStratejisiToolbar.tsx` (self — add button) | exact |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` | page (SSR) | CRUD (Supabase select, derived data) | `src/app/(dashboard)/projeler/[id]/site-blueprint/page.tsx` (dialogRows computation pattern) | role-match |

---

## Pattern Assignments

### `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts`
(server-action, CRUD + UPDATE branch)

**Analog:** Self — extend existing `generatePagesFromClusters` in the same file.

**Type extensions to add** (after line 156, before function body):

```typescript
// BEFORE (line 151-161):
export type GenerateRowInput = {
  clusterId: string
  pageName: string
  pageType: string
  focusKeywordId: string | null
}

export type GenerateResult =
  | { success: true; created: number; skipped: number }
  | { success: false; error: string }

// AFTER — Phase 21 additions:
export type GenerateRowInput = {
  clusterId: string
  pageName: string
  pageType: string
  focusKeywordId: string | null
  overwrite?: boolean          // D-03: true → UPDATE existing page
}

export type GenerateResult =
  | { success: true; created: number; updated: number; skipped: number }
  | { success: false; error: string }
```

**Existing duplicate guard pattern** (lines 221-235) — used as structural anchor for the UPDATE branch:

```typescript
// Duplicate guard: bu projede cluster_id'si eşleşen mevcut sayfaları çek
const { data: existingPages } = await supabase
  .from('pages')
  .select('id, cluster_id, slug, sort_order')
  .eq('project_id', projectId)
  .eq('user_id', user.id)

const takenClusterIds = new Set(
  (existingPages ?? [])
    .filter((p: { cluster_id: string | null }) => p.cluster_id !== null)
    .map((p: { cluster_id: string | null }) => p.cluster_id as string)
)
```

**UPDATE branch — new logic to add** (replace lines 247-251 skip block):

Current skip logic (lines 247-251):
```typescript
for (const r of rows) {
  if (takenClusterIds.has(r.clusterId)) {
    skipped++
    continue
  }
```

New branch logic (D-03 semantics):
```typescript
const updatePayloads: Array<{ id: string; fields: Record<string, unknown> }> = []

for (const r of rows) {
  if (takenClusterIds.has(r.clusterId)) {
    if (r.overwrite) {
      // Find existing page id for this cluster
      const existingPage = (existingPages ?? []).find(
        (p: { cluster_id: string | null; id: string }) => p.cluster_id === r.clusterId
      )
      if (existingPage) {
        updatePayloads.push({
          id: existingPage.id,
          fields: {
            title: r.pageName.trim(),
            page_type: r.pageType || 'blog',
            focus_keyword_id: r.focusKeywordId,
          },
        })
      }
    } else {
      skipped++
    }
    continue
  }
  // ... existing INSERT payload build ...
}
```

**UPDATE execution pattern** — model from `reorderPage` (lines 362-370):
```typescript
// Step 2: move neighbor to current's old position
const r2 = await supabase
  .from('pages')
  .update({ sort_order: current.sort_order })
  .eq('id', neighbor.id)
  .eq('user_id', user.id)

if (r2.error || r3.error) {
  return { success: false, error: 'Sıralama güncellenemedi.' }
}
```

For UPDATE batch, use the pattern:
```typescript
let updated = 0
for (const u of updatePayloads) {
  const { error } = await supabase
    .from('pages')
    .update(u.fields)
    .eq('id', u.id)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
  if (!error) updated++
}
```

**Return value** — extend line 282:
```typescript
// BEFORE:
return { success: true, created, skipped }
// AFTER:
return { success: true, created, updated, skipped }
```

**Auth / ownership pattern** (lines 26-40) — unchanged, copy verbatim for any new action:
```typescript
async function verifyProjectOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()
  return !!data
}
```

---

### `src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx`
(component, request-response, form state + useTransition)

**Analog:** Self — modify existing file.

**Imports pattern** (lines 1-12) — unchanged:
```typescript
'use client'

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { generatePagesFromClusters, type GenerateRowInput } from './actions'
```

Add `useRouter` import for D-04 navigation:
```typescript
import { useRouter } from 'next/navigation'
```

**Router instantiation** — copy from `KeywordStratejisiToolbar.tsx` line 4:
```typescript
const router = useRouter()
```

**Row disabled logic change** (line 144):
```typescript
// BEFORE:
const disabled = r.alreadyExists || isPending
// AFTER (Phase 21 — D-08):
const disabled = isPending
```

**Row background logic** (line 145) — amber highlight for alreadyExists rows regardless of include state (UI-SPEC table):
```typescript
// BEFORE:
const rowBg = r.alreadyExists ? 'bg-amber-500/10' : ''
// AFTER — same, no change needed (amber shows for both include=true and include=false per UI-SPEC)
const rowBg = r.alreadyExists ? 'bg-amber-500/10' : ''
```

**Input disabled** (line 163) — remove `disabled` from input, only isPending:
```typescript
// BEFORE:
disabled={disabled}
className={`w-full bg-transparent border-b border-border ... ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
// AFTER:
disabled={isPending}
className={`w-full bg-transparent border-b border-border focus:outline-none focus:border-ring text-sm py-0.5`}
```

**Payload build** — add overwrite field (line 100-105):
```typescript
// BEFORE:
payload.push({
  clusterId: rows[i].clusterId,
  pageName: state[i].pageName.trim(),
  pageType: state[i].pageType,
  focusKeywordId: rows[i].focusKeywordId,
})
// AFTER (D-03):
payload.push({
  clusterId: rows[i].clusterId,
  pageName: state[i].pageName.trim(),
  pageType: state[i].pageType,
  focusKeywordId: rows[i].focusKeywordId,
  overwrite: rows[i].alreadyExists ? true : undefined,
})
```

**Success handler** — extend lines 108-115 (D-04):
```typescript
startTransition(async () => {
  const result = await generatePagesFromClusters(projectId, payload)
  if (!result.success) {
    setError(result.error)
    return
  }
  handleOpenChange(false)
  // D-04: Navigate to blueprint page after success
  // Toast copy from UI-SPEC:
  // created > 0 && updated > 0 → "{created} sayfa oluşturuldu, {updated} güncellendi"
  // created > 0 && updated === 0 → "{created} sayfa oluşturuldu"
  // created === 0 && updated > 0 → "{updated} sayfa güncellendi"
  router.push(`/projeler/${projectId}/site-blueprint`)
})
```

**hasOverwrite computation** — add before return (UI-SPEC footer copy):
```typescript
const hasOverwrite = state.some((r, i) => r.include && rows[i]?.alreadyExists)
```

**Footer sayaç copy** (line 216):
```typescript
// BEFORE:
{includedCount} sayfa oluşturulacak
// AFTER (UI-SPEC):
{includedCount} sayfa {hasOverwrite ? 'oluşturulacak / güncellenecek' : 'oluşturulacak'}
```

**Footer button label** (line 233):
```typescript
// BEFORE:
{isPending ? 'Oluşturuluyor…' : 'Oluştur'}
// AFTER (D-08 — always "Oluştur / Güncelle"):
{isPending ? 'Oluşturuluyor…' : 'Oluştur / Güncelle'}
```

**Empty state copy** (line 128-130) — update for approved-only filter context:
```typescript
// AFTER (D-02 filter):
<p className="text-sm text-muted-foreground py-8 text-center">
  Onaylanmış küme bulunamadı. Önce keyword stratejisi sayfasından kümeleme yapın.
</p>
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordStratejisiToolbar.tsx`
(component, event-driven, client state + router)

**Analog:** Self — add "Sistemi Kur" button to existing toolbar. Full current file (lines 1-59) is the base.

**Imports to add** (lines 1-8 current):
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClusterButton } from './ClusterButton'
import { ClusteringApprovalOverlay } from './ClusteringApprovalOverlay'
import { StratejiOnaylaButton } from './StratejiOnaylaButton'
import { type DraftCluster } from './actions'
// ADD:
import { Button } from '@/components/ui/button'
import { GeneratePagesDialog, type DialogRow } from '../site-blueprint/GeneratePagesDialog'
```

**Props interface extension** (lines 10-15):
```typescript
// BEFORE:
interface KeywordStratejisiToolbarProps {
  projectId: string
  hasExistingClusters: boolean
  hasApprovedCluster: boolean
  isStrategyApproved: boolean
}
// AFTER — add approvedDialogRows:
interface KeywordStratejisiToolbarProps {
  projectId: string
  hasExistingClusters: boolean
  hasApprovedCluster: boolean
  isStrategyApproved: boolean
  approvedDialogRows: DialogRow[]   // D-02: SSR computed, approved only
}
```

**State additions** (after line 25):
```typescript
const [overlayOpen, setOverlayOpen] = useState(false)
const [draftClusters, setDraftClusters] = useState<DraftCluster[]>([])
// ADD:
const [sistemiKurOpen, setSistemiKurOpen] = useState(false)
```

**"Sistemi Kur" button pattern** — copy from `StratejiOnaylaButton.tsx` disabled/active pattern (lines 29-64):

```typescript
// Disabled state (isStrategyApproved = false) — from UI-SPEC:
<Button
  variant="ghost"
  disabled
  className="h-9 text-xs opacity-40 cursor-not-allowed"
  title="Önce stratejiyi onaylayın"
>
  Sistemi Kur
</Button>

// Active state (isStrategyApproved = true):
<Button
  variant="default"
  className="h-9 text-xs"
  onClick={() => setSistemiKurOpen(true)}
>
  Sistemi Kur
</Button>
```

**Dialog mount pattern** — copy from `GenerateFromClustersButton.tsx` (lines 27-38):
```typescript
// In JSX return, after StratejiOnaylaButton and before ClusteringApprovalOverlay:
<GeneratePagesDialog
  projectId={projectId}
  rows={approvedDialogRows}
  open={sistemiKurOpen}
  onOpenChange={setSistemiKurOpen}
/>
```

**Full return JSX structure** (lines 38-59) — "Sistemi Kur" slot placement:
```tsx
return (
  <>
    <ClusterButton ... />
    <StratejiOnaylaButton ... />
    {isStrategyApproved ? (
      <Button variant="default" className="h-9 text-xs" onClick={() => setSistemiKurOpen(true)}>
        Sistemi Kur
      </Button>
    ) : (
      <Button variant="ghost" disabled className="h-9 text-xs opacity-40 cursor-not-allowed" title="Önce stratejiyi onaylayın">
        Sistemi Kur
      </Button>
    )}
    <GeneratePagesDialog
      projectId={projectId}
      rows={approvedDialogRows}
      open={sistemiKurOpen}
      onOpenChange={setSistemiKurOpen}
    />
    {overlayOpen && (
      <ClusteringApprovalOverlay ... />
    )}
  </>
)
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx`
(SSR page, CRUD — add pages query + compute `approvedDialogRows`)

**Analog:** `src/app/(dashboard)/projeler/[id]/site-blueprint/page.tsx` — lines 137-208 contain the exact `dialogRows` computation pattern to copy.

**Imports to add** (after line 22):
```typescript
import { intentToPageType } from '../site-blueprint/page-utils'
import { type DialogRow } from '../site-blueprint/GeneratePagesDialog'
```

**`stripIntentSuffix` — inline 3-line copy** (D-05, from site-blueprint/page.tsx lines 96-105):
```typescript
function stripIntentSuffix(name: string): string {
  return name
    .replace(/\s*\((commercial|informational|navigational|transactional|unknown)\)\s*$/i, '')
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ')
}
```

**Pages query for `alreadyExists`** (D-06) — add after clusters query (after line 107), model from site-blueprint/page.tsx lines 138-143:
```typescript
// D-06: cluster_id'si sayfalara bağlı olanları tespit et
const { data: pagesWithClusters } = await supabase
  .from('pages')
  .select('cluster_id')
  .eq('project_id', id)
  .eq('user_id', user.id)
  .not('cluster_id', 'is', null)

const clusterIdsWithPages = new Set(
  (pagesWithClusters ?? []).map((p: { cluster_id: string }) => p.cluster_id)
)
```

**`approvedDialogRows` computation** (D-02 filter + D-06 alreadyExists) — copy structure from site-blueprint/page.tsx lines 179-208:

```typescript
// primary keyword id → keyword text (needed for focusKeyword label)
// NOTE: keyword_clusters select already includes keywords join if needed;
// alternatively re-use clustersWithKeywords which already has keywords array
const primaryKeywordTextById = new Map<string, string>()
for (const c of clustersWithKeywords) {
  if (c.primary_keyword_id) {
    const pk = c.keywords.find((kw) => kw.id === c.primary_keyword_id)
    if (pk) primaryKeywordTextById.set(c.primary_keyword_id, pk.keyword)
  }
}

// D-02 filter: only approved clusters with primary_keyword_id
const approvedDialogRows: DialogRow[] = clustersWithKeywords
  .filter((c) => c.status === 'approved' && c.primary_keyword_id !== null)
  .map((c) => ({
    clusterId: c.id,
    clusterName: c.cluster_name,
    proposedName: stripIntentSuffix(c.cluster_name),
    proposedType: intentToPageType(c.intent),
    focusKeyword: c.primary_keyword_id
      ? (primaryKeywordTextById.get(c.primary_keyword_id) ?? null)
      : null,
    focusKeywordId: c.primary_keyword_id,
    alreadyExists: clusterIdsWithPages.has(c.id),
  }))
```

**Prop threading to toolbar** (line 173-178 current) — add `approvedDialogRows`:
```tsx
// BEFORE:
<KeywordStratejisiToolbar
  projectId={id}
  hasExistingClusters={totalClusters > 0}
  hasApprovedCluster={clusters.some((c) => (c as unknown as { status: string }).status === 'approved')}
  isStrategyApproved={(project as unknown as { keyword_strategy_approved: boolean | null }).keyword_strategy_approved ?? false}
/>
// AFTER:
<KeywordStratejisiToolbar
  projectId={id}
  hasExistingClusters={totalClusters > 0}
  hasApprovedCluster={clusters.some((c) => (c as unknown as { status: string }).status === 'approved')}
  isStrategyApproved={(project as unknown as { keyword_strategy_approved: boolean | null }).keyword_strategy_approved ?? false}
  approvedDialogRows={approvedDialogRows}
/>
```

**Note on clusters query extension:** The current clusters query (line 100-105) must include `keywords ( id, keyword )` join so `primaryKeywordTextById` can be built. Check if clustersWithKeywords already carries `.keywords` array — it does via `clusterKeywordMap`, but that only contains `KeywordRow[]` (no keyword text join from cluster query directly). Two options:
1. Re-use `keywords` array already fetched separately (lines 89-95) — match by `cluster_id` to find primary keyword text. This is zero extra query.
2. Model: In `site-blueprint/page.tsx` line 163-173, a `keywords!inner ( id, keyword )` join is used. For keyword-stratejisi/page.tsx, `keywords` is already fully fetched; build `keywordIdToText` map from the existing `keywords` array.

**Zero-query approach** (preferred — uses data already in scope):
```typescript
// After keywords array is built (after line 95):
const keywordIdToText = new Map<string, string>()
for (const kw of keywords) {
  keywordIdToText.set(kw.id, kw.keyword)
}

// Then in approvedDialogRows:
focusKeyword: c.primary_keyword_id
  ? (keywordIdToText.get(c.primary_keyword_id) ?? null)
  : null,
```

---

## Shared Patterns

### Auth / User Guard
**Source:** `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts` lines 198-205
**Apply to:** `generatePagesFromClusters` (already present — do not duplicate)
```typescript
const supabase = await createClient()
const {
  data: { user },
} = await supabase.auth.getUser()
if (!user) return { success: false, error: 'Oturum bulunamadı.' }

const isOwner = await verifyProjectOwnership(supabase, projectId, user.id)
if (!isOwner) return { success: false, error: 'Proje bulunamadı.' }
```

### useTransition Pattern (client actions)
**Source:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/StratejiOnaylaButton.tsx` lines 18-24
**Apply to:** `GeneratePagesDialog.tsx` (already present)
```typescript
const [isPending, startTransition] = useTransition()

const handleClick = () => {
  startTransition(async () => {
    await someServerAction(...)
  })
}
```

### revalidatePath Convention
**Source:** `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts` line 281
**Apply to:** `generatePagesFromClusters` after both INSERT and UPDATE paths
```typescript
revalidatePath(`/projeler/${projectId}/site-blueprint`)
```

### router.push Navigation (client)
**Source:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordStratejisiToolbar.tsx` lines 4, 36
**Apply to:** `GeneratePagesDialog.tsx` (add `useRouter`) and `KeywordStratejisiToolbar.tsx`
```typescript
import { useRouter } from 'next/navigation'
// ...
const router = useRouter()
// ...
router.refresh()   // existing pattern
// New pattern (D-04):
router.push(`/projeler/${projectId}/site-blueprint`)
```

### Disabled Button Tooltip Pattern (native title)
**Source:** `src/app/(dashboard)/projeler/[id]/site-blueprint/GenerateFromClustersButton.tsx` lines 17-23
**Apply to:** "Sistemi Kur" disabled state in `KeywordStratejisiToolbar.tsx`
```typescript
<span title="Önce stratejiyi onaylayın" className="inline-flex">
  <Button variant="ghost" disabled className="h-9 text-xs opacity-40 cursor-not-allowed">
    Sistemi Kur
  </Button>
</span>
```
Note: UI-SPEC allows native `title` attribute directly on Button (no wrapping span needed for non-pointer-events reason). Use whichever matches existing pattern in the component.

### intentToPageType Import
**Source:** `src/app/(dashboard)/projeler/[id]/site-blueprint/page-utils.ts` (3 lines)
**Apply to:** `keyword-stratejisi/page.tsx` — import from `'../site-blueprint/page-utils'`
```typescript
export function intentToPageType(intent: string | null | undefined): string {
  if (!intent) return 'blog'
  const key = intent.toLowerCase().trim()
  return INTENT_TO_PAGE_TYPE[key] ?? 'blog'
}
```

---

## No Analog Found

None. All four files have exact or role-match analogs in the codebase.

---

## Metadata

**Analog search scope:** `src/app/(dashboard)/projeler/[id]/site-blueprint/`, `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/`
**Files scanned:** 8 (actions.ts, GeneratePagesDialog.tsx, GenerateFromClustersButton.tsx, page.tsx, page-utils.ts, KeywordStratejisiToolbar.tsx, StratejiOnaylaButton.tsx, keyword-stratejisi/page.tsx)
**Pattern extraction date:** 2026-05-10
