# Phase 6: Keyword Clustering & Scoring — Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/keywords/clustering.ts` | utility | transform | `src/lib/keywords/clustering.ts` (self — extend) | exact |
| `src/lib/keywords/scoring.ts` | utility | transform | `src/lib/keywords/clustering.ts` | role-match |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` | service | CRUD | `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` (self — extend) | exact |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` | component | request-response | `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` (self — extend) | exact |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx` | component | request-response | `src/app/(dashboard)/projeler/[id]/rakipler/page.tsx` | role-match |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/MoveKeywordDialog.tsx` | component | request-response | `src/app/(dashboard)/projeler/[id]/rakipler/CompetitorDiscoveryDialog.tsx` | exact |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterButton.tsx` | component | request-response | `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordImport.tsx` | role-match |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/PrimaryKeywordStar.tsx` | component | request-response | `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordDeleteButton.tsx` | exact |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ViewToggle.tsx` | component | request-response | `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordImport.tsx` | role-match |

---

## Pattern Assignments

### `src/lib/keywords/clustering.ts` (utility, transform — EXTEND)

**Analog:** self (`src/lib/keywords/clustering.ts`)

**Current type signature** (lines 1–7):
```typescript
import type { ParsedKeyword } from './parser'

export type Cluster = {
  name: string
  totalVolume: number
  keywords: ParsedKeyword[]
}
```

**New input type needed** — add alongside existing `ParsedKeyword`-based types:
```typescript
// New type for enriched keywords from DB (Phase 6 clustering)
export type ClusterInput = {
  id: string
  keyword: string
  volume: number | null
  difficulty: number | null
  cpc: number | null
  search_intent: string | null
}

export type ClusterResult = {
  name: string          // "${head_keyword} (${intent})" to avoid UNIQUE conflict
  intent: string | null
  totalVolume: number
  keywords: ClusterInput[]
}
```

**Core algorithm to preserve** (lines 34–50) — `overlapsWithCluster` and `getSignificantWords` are reused as-is for within-intent sub-clustering:
```typescript
function overlapsWithCluster(keyword: string, headKeyword: string): boolean {
  const kWords = getSignificantWords(keyword)
  const hWords = getSignificantWords(headKeyword)
  if (kWords.size === 0 || hWords.size === 0) return false
  const shared = new Set([...kWords].filter((w) => hWords.has(w)))
  if (shared.size === 0) return false
  if (shared.size === kWords.size || shared.size === hWords.size) return true
  const shorter = Math.min(kWords.size, hWords.size)
  return shared.size / shorter >= 0.5
}
```

**Extension pattern — new exported function (append after existing `clusterKeywords`)**:
```typescript
// Phase 6: intent-first clustering for enriched DB keywords
export function clusterEnrichedKeywords(keywords: ClusterInput[]): ClusterResult[] {
  // Group by intent first
  const intentGroups = new Map<string, ClusterInput[]>()
  for (const kw of keywords) {
    const intent = kw.search_intent?.toLowerCase() ?? 'unknown'
    if (!intentGroups.has(intent)) intentGroups.set(intent, [])
    intentGroups.get(intent)!.push(kw)
  }

  const results: ClusterResult[] = []

  for (const [intent, group] of intentGroups) {
    // Sort by volume DESC within intent group
    const sorted = [...group].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    // Sub-cluster by text overlap within intent group
    const subClusters: Array<{ head: ClusterInput; members: ClusterInput[] }> = []
    const assigned = new Set<string>()

    for (const kw of sorted) {
      if (assigned.has(kw.keyword)) continue
      let placed = false
      for (const sc of subClusters) {
        if (overlapsWithCluster(kw.keyword, sc.head.keyword)) {
          sc.members.push(kw)
          assigned.add(kw.keyword)
          placed = true
          break
        }
      }
      if (!placed) {
        subClusters.push({ head: kw, members: [kw] })
        assigned.add(kw.keyword)
      }
    }

    for (const sc of subClusters) {
      const members = sc.members.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      const totalVolume = members.reduce((sum, k) => sum + (k.volume ?? 0), 0)
      results.push({
        // Pitfall 3: append intent to avoid UNIQUE constraint clash
        name: `${sc.head.keyword} (${intent})`,
        intent,
        totalVolume,
        keywords: members,
      })
    }
  }

  return results.sort((a, b) => b.totalVolume - a.totalVolume)
}
```

---

### `src/lib/keywords/scoring.ts` (utility, transform — NEW)

**Analog:** `src/lib/keywords/clustering.ts` (pure TypeScript utility, no imports needed)

**Full file pattern** — pure functions, no external deps:
```typescript
// No imports needed — pure math

const INTENT_MULTIPLIERS: Record<string, number> = {
  transactional: 1.0,
  commercial:    0.85,
  informational: 0.5,
  navigational:  0.3,
  unknown:       0.5,
}

function normalizeVolume(volume: number, maxVolume: number): number {
  if (maxVolume === 0) return 0
  return Math.min(volume / maxVolume, 1)
}

function normalizeCpc(cpc: number, maxCpc: number): number {
  if (maxCpc === 0) return 0
  return Math.min(cpc / maxCpc, 1)
}

export function calculateOpportunityScore(
  keyword: {
    volume: number | null
    cpc: number | null
    difficulty: number | null
    search_intent: string | null
  },
  context: { maxVolume: number; maxCpc: number }
): number {
  const volumeScore = normalizeVolume(keyword.volume ?? 0, context.maxVolume)
  const cpcScore    = normalizeCpc(keyword.cpc ?? 0, context.maxCpc)
  const kdScore     = (100 - (keyword.difficulty ?? 50)) / 100
  const intentMult  = INTENT_MULTIPLIERS[keyword.search_intent?.toLowerCase() ?? 'unknown'] ?? 0.5

  const raw = (volumeScore * 0.40) + (cpcScore * 0.25) + (kdScore * 0.15) + (intentMult * 0.20)
  return Math.round(raw * 100 * 10) / 10  // 0–100, 1 decimal
}

// Batch helper — call this to get context before scoring each keyword
export function buildScoringContext(
  keywords: Array<{ volume: number | null; cpc: number | null }>
): { maxVolume: number; maxCpc: number } {
  return {
    maxVolume: Math.max(...keywords.map((k) => k.volume ?? 0), 0),
    maxCpc:    Math.max(...keywords.map((k) => k.cpc ?? 0), 0),
  }
}
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` (service, CRUD — EXTEND)

**Analog:** self — copy the auth + ownership + revalidatePath + return-type patterns already in the file.

**Existing imports block** (lines 1–8) — new actions add these imports:
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
// Add for new actions:
import { clusterEnrichedKeywords } from '@/lib/keywords/clustering'
import { calculateOpportunityScore, buildScoringContext } from '@/lib/keywords/scoring'
```

**Auth + ownership pattern** (lines 21–31) — copy verbatim for every new action:
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

**Keyword ownership pattern** (lines 148–156) — use in `moveKeywordToCluster` and `setPrimaryKeyword`:
```typescript
const { data: kw } = await supabase
  .from('keywords')
  .select('id, cluster_id')
  .eq('id', keywordId)
  .eq('project_id', projectId)
  .eq('user_id', user.id)
  .single()
if (!kw) return { success: false, error: 'Keyword bulunamadı.' }
```

**Cluster upsert pattern** (lines 42–55) — reuse in `clusterAndScoreKeywords`:
```typescript
const { data: clusterRow, error: clusterErr } = await supabase
  .from('keyword_clusters')
  .upsert(
    {
      user_id: user.id,
      project_id: projectId,
      cluster_name: cluster.name,
      total_volume: cluster.totalVolume,
    },
    { onConflict: 'project_id,cluster_name', ignoreDuplicates: false }
  )
  .select('id')
  .single()
if (clusterErr || !clusterRow) continue
```

**revalidatePath pattern** (line 104) — end of every mutating action:
```typescript
revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
return { success: true }
```

**New return type pattern** — follow existing `DeleteClusterResult` style:
```typescript
export type ClusterAndScoreResult =
  | { success: true; clusterCount: number }
  | { success: false; error: string }

export type MoveKeywordResult = { success: true } | { success: false; error: string }
export type SetPrimaryKeywordResult = { success: true } | { success: false; error: string }
```

**Pitfall 2 guard in `moveKeywordToCluster`** — after update, clear primary_keyword_id if the moved keyword was the primary:
```typescript
// If keyword was primary of its old cluster, clear it
if (kw.cluster_id) {
  await supabase
    .from('keyword_clusters')
    .update({ primary_keyword_id: null })
    .eq('id', kw.cluster_id)
    .eq('primary_keyword_id', keywordId)
    .eq('user_id', user.id)
}
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` (component, request-response — EXTEND)

**Analog:** self — extend the existing Server Component.

**searchParams pattern** — add to function signature (follows Next.js 14 App Router convention seen in project):
```typescript
export default async function KeywordStratejisiPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string }>
}) {
  const { id } = await params
  const { view } = await searchParams
  const isClusterView = view === 'cluster'
  // ...
}
```

**Cluster data query** — add after existing `clustersRaw` query (currently only selects id+cluster_name):
```typescript
// Extended cluster query for cluster panel
const { data: clustersWithKeywords } = await supabase
  .from('keyword_clusters')
  .select('id, cluster_name, intent, primary_keyword_id')
  .eq('project_id', id)
  .eq('user_id', user.id)
```

**Opportunity score badge pattern** — new in Skor column, follow existing Badge pattern (IntentBadge.tsx line 22):
```typescript
// Skor sütun hücre — null check first, then tiered badge
{kw.opportunity_score === null ? (
  <span className="text-sm text-muted-foreground">—</span>
) : kw.opportunity_score >= 70 ? (
  <Badge className="bg-violet-500/20 text-violet-400 text-xs border-0">
    {kw.opportunity_score.toFixed(1)}
  </Badge>
) : kw.opportunity_score >= 40 ? (
  <Badge className="bg-amber-500/20 text-amber-400 text-xs border-0">
    {kw.opportunity_score.toFixed(1)}
  </Badge>
) : (
  <Badge className="bg-secondary text-muted-foreground text-xs border-0">
    {kw.opportunity_score.toFixed(1)}
  </Badge>
)}
```

**Section header with ClusterButton** — follow existing section header pattern (lines 122–139):
```typescript
<div className="flex items-center justify-between">
  <div className="space-y-1">
    <h2 className="text-base font-semibold">
      Keyword Listesi
      {totalKeywords > 0 && (
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          {totalKeywords} keyword · {totalClusters} küme
        </span>
      )}
    </h2>
  </div>
  <div className="flex items-center gap-2">
    <ViewToggle currentView={view ?? 'flat'} />
    <ClusterButton projectId={id} hasExistingClusters={totalClusters > 0} />
  </div>
</div>
```

**Enrichment uyarı banner** — insert below section header, above the toggle/table:
```typescript
{pendingEnrichment > 0 && (
  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
    {pendingEnrichment} keyword zenginleştirilmemiş — bunlar yalnızca metin benzerliğiyle kümelenecek.
  </div>
)}
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx` (component, request-response — NEW)

**Analog:** `src/app/(dashboard)/projeler/[id]/rakipler/page.tsx` (complex data grouping display)
and `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` (table rendering patterns)

**File header — Server Component (no 'use client' directive)**:
```typescript
import { Badge } from '@/components/ui/badge'
import { IntentBadge } from './IntentBadge'
import { ClusterDeleteButton } from './ClusterDeleteButton'
import { PrimaryKeywordStar } from './PrimaryKeywordStar'
import { MoveKeywordDialog } from './MoveKeywordDialog'
```

**Cluster card container pattern** — `rounded-md border border-border bg-card`:
```typescript
<div className="space-y-4">
  {clusters.map((cluster) => (
    <div key={cluster.id} className="rounded-md border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-secondary/40 px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{cluster.cluster_name}</span>
          <IntentBadge intent={cluster.intent} />
        </div>
        <ClusterDeleteButton
          projectId={projectId}
          clusterId={cluster.id}
          clusterName={cluster.cluster_name}
        />
      </div>

      {/* Keyword rows */}
      {cluster.keywords.map((kw) => {
        const isPrimary = kw.id === cluster.primary_keyword_id
        return (
          <div key={kw.id} className="group flex items-center px-3 py-2 border-t border-border/50 hover:bg-secondary/20">
            <PrimaryKeywordStar
              clusterId={cluster.id}
              keywordId={kw.id}
              projectId={projectId}
              isPrimary={isPrimary}
            />
            <span className={`flex-1 text-sm ${isPrimary ? 'font-semibold' : 'font-normal'}`}>
              {kw.keyword}
            </span>
            {/* Volume, CPC, KD, Skor columns follow page.tsx table cell patterns */}
          </div>
        )
      })}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border/50 bg-secondary/20">
        <MoveKeywordDialog projectId={projectId} clusterId={cluster.id} allClusters={allClusters} />
        <span className="text-xs text-muted-foreground">{cluster.keywords.length} keyword</span>
      </div>
    </div>
  ))}

  {clusters.length === 0 && (
    <div className="py-8 text-center">
      <p className="text-sm text-muted-foreground">Henüz küme oluşturulmadı.</p>
      <p className="text-sm text-muted-foreground">"Kümelere Böl" butonuna basarak keyword'leri otomatik gruplandır.</p>
    </div>
  )}
</div>
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/MoveKeywordDialog.tsx` (component, request-response — NEW)

**Analog:** `src/app/(dashboard)/projeler/[id]/rakipler/CompetitorDiscoveryDialog.tsx` — exact match on Dialog pattern + selection list + Server Action call + error display.

**Imports pattern** (CompetitorDiscoveryDialog.tsx lines 1–14):
```typescript
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { moveKeywordToCluster } from './actions'
import { IntentBadge } from './IntentBadge'
```

**Dialog trigger pattern** (CompetitorDiscoveryDialog.tsx line 107) — `render` prop, NOT `asChild`:
```typescript
<Dialog open={open} onOpenChange={handleOpenChange}>
  <DialogTrigger
    render={
      <button className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
        Taşı →
      </button>
    }
  />
  <DialogContent className="max-w-md">
```

**Selection list pattern** (CompetitorDiscoveryDialog.tsx lines 151–164) — adapt checkbox to radio-style click:
```typescript
<div className="max-h-64 overflow-y-auto space-y-2 border border-border rounded-md p-3">
  {allClusters
    .filter((c) => c.id !== currentClusterId)
    .map((cluster) => (
      <button
        key={cluster.id}
        onClick={() => setSelectedClusterId(cluster.id)}
        className={`w-full flex items-center gap-3 px-2 py-1.5 rounded text-left hover:bg-secondary/50 ${
          selectedClusterId === cluster.id ? 'bg-secondary' : ''
        }`}
      >
        <span className="text-sm flex-1">{cluster.cluster_name}</span>
        <IntentBadge intent={cluster.intent} />
      </button>
    ))}
</div>
```

**Error display pattern** (CompetitorDiscoveryDialog.tsx line 133) — inline in dialog, not toast:
```typescript
{error && <p className="text-sm text-destructive">{error}</p>}
```

**Loading state pattern** (CompetitorDiscoveryDialog.tsx lines 138–140):
```typescript
<Button
  onClick={handleMove}
  disabled={isPending || !selectedClusterId}
  className={isPending ? 'opacity-50 cursor-wait' : ''}
>
  {isPending ? 'Taşınıyor...' : 'Taşı'}
</Button>
```

**useTransition vs useState(isPending)** — this component uses async Server Action inside dialog. Follow `CompetitorDiscoveryDialog` pattern of `useState(false)` for isPending (not `useTransition`) since we need finally-block cleanup:
```typescript
const [isPending, setIsPending] = useState(false)

const handleMove = async () => {
  if (!selectedClusterId) return
  setIsPending(true)
  setError(null)
  try {
    const result = await moveKeywordToCluster(keywordId, selectedClusterId, projectId)
    if (!result.success) {
      setError(result.error)
    } else {
      setOpen(false)
    }
  } catch {
    setError('Küme ataması başarısız. Lütfen tekrar deneyin.')
  } finally {
    setIsPending(false)
  }
}
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterButton.tsx` (component, request-response — NEW)

**Analog:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordImport.tsx` — Client Component with useTransition, error state, Server Action call.

**Imports + directive** (KeywordImport.tsx lines 1–5):
```typescript
'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { clusterAndScoreKeywords } from './actions'
```

**useTransition pattern** (KeywordImport.tsx lines 11, 16–24) — prefer `useTransition` over `useState(isPending)` for simple fire-and-forget Server Actions with no finally-block cleanup:
```typescript
const [isPending, startTransition] = useTransition()
const [error, setError] = useState<string | null>(null)

const handleCluster = () => {
  setError(null)
  startTransition(async () => {
    const result = await clusterAndScoreKeywords(projectId)
    if (!result.success) {
      setError(result.error)
    }
    // success: revalidatePath handles UI update, no toast needed
  })
}
```

**Primary button styling** — this is the primary CTA (not outline/ghost). Follow UI-SPEC "Kümelere Böl" spec:
```typescript
<Button
  onClick={handleCluster}
  disabled={isPending}
  className={`h-9 ${isPending ? 'opacity-50' : ''}`}
  // shadcn default Button = bg-primary text-primary-foreground
>
  {isPending ? (
    <span className="flex items-center gap-2">
      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Kümeleniyor...
    </span>
  ) : hasExistingClusters ? 'Yeniden Kümeleme' : 'Kümelere Böl'}
</Button>
```

**Error display** (KeywordImport.tsx line 35) — below button, not toast:
```typescript
{error && <p className="text-sm text-destructive">{error}</p>}
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/PrimaryKeywordStar.tsx` (component, request-response — NEW)

**Analog:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordDeleteButton.tsx` — exact pattern: Client Component, `useTransition`, single-action button with hover visibility, `opacity-0 group-hover:opacity-100`.

**Full pattern** (KeywordDeleteButton.tsx lines 1–57):
```typescript
'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { setPrimaryKeyword } from './actions'

export function PrimaryKeywordStar({
  clusterId,
  keywordId,
  projectId,
  isPrimary,
}: {
  clusterId: string
  keywordId: string
  projectId: string
  isPrimary: boolean
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      title={isPrimary ? 'Primary keyword (en yüksek hacim)' : 'Primary yap'}
      disabled={isPending || isPrimary}
      // Primary: always visible text-primary; others: hover-reveal (group pattern from KeywordDeleteButton)
      className={`h-7 w-7 p-0 transition-opacity ${
        isPrimary
          ? 'text-primary'
          : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary'
      } ${isPending ? 'opacity-50' : ''}`}
      onClick={() => {
        if (isPrimary) return
        startTransition(async () => {
          await setPrimaryKeyword(clusterId, keywordId, projectId)
        })
      }}
    >
      {isPending ? (
        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        // Star icon — use hugeicons or SVG; filled for primary, outline for others
        <span>{isPrimary ? '★' : '☆'}</span>
      )}
    </Button>
  )
}
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ViewToggle.tsx` (component, request-response — NEW)

**Analog:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordImport.tsx` — Client Component pattern. Also reference `page.tsx` for URL/searchParams pattern.

**URL query param toggle pattern** — UI-SPEC specifies `?view=flat` / `?view=cluster`:
```typescript
'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function ViewToggle({ currentView }: { currentView: string }) {
  const router = useRouter()
  const pathname = usePathname()

  const setView = (view: string) => {
    router.push(`${pathname}?view=${view}`)
  }

  return (
    // UI-SPEC: "flex rounded-md border border-border overflow-hidden" toggle group
    <div className="flex rounded-md border border-border overflow-hidden">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setView('flat')}
        className={`rounded-none h-8 px-3 text-xs ${
          currentView !== 'cluster'
            ? 'bg-secondary text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Düz Liste
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setView('cluster')}
        className={`rounded-none h-8 px-3 text-xs border-l border-border ${
          currentView === 'cluster'
            ? 'bg-secondary text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Küme Görünümü
      </Button>
    </div>
  )
}
```

---

## Shared Patterns

### Authentication + Ownership (V4 Access Control)

**Source:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` lines 21–31
**Apply to:** `clusterAndScoreKeywords`, `moveKeywordToCluster`, `setPrimaryKeyword` in actions.ts

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

### Badge Color Pattern (D-11)

**Source:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/IntentBadge.tsx` lines 1–26
**Apply to:** All badge renders in `ClusterPanel.tsx` and `page.tsx` Skor column
**Rule:** `className="bg-X-500/20 text-X-400 text-xs border-0"` — never use `variant` prop.

### Loading State (animate-spin SVG)

**Source:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordDeleteButton.tsx` lines 32–49
**Apply to:** `ClusterButton.tsx`, `PrimaryKeywordStar.tsx`, `MoveKeywordDialog.tsx`

```typescript
<svg
  className="animate-spin h-3 w-3"
  xmlns="http://www.w3.org/2000/svg"
  fill="none"
  viewBox="0 0 24 24"
>
  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
</svg>
```

### Hover-Reveal Button (group pattern)

**Source:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordDeleteButton.tsx` line 23
**Apply to:** `PrimaryKeywordStar.tsx` (non-primary stars), `MoveKeywordDialog.tsx` trigger button
**Rule:** Parent element must have `className="group"`, child button uses `opacity-0 group-hover:opacity-100 transition-opacity`.

### Server Action Error (inline, not toast)

**Source:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordImport.tsx` line 35
**Apply to:** `ClusterButton.tsx`, `MoveKeywordDialog.tsx`

```typescript
{error && <p className="text-sm text-destructive">{error}</p>}
```

### revalidatePath

**Source:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` line 104
**Apply to:** Every mutating Server Action in actions.ts

```typescript
revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
```

### Dialog Trigger (render prop, NOT asChild)

**Source:** `src/app/(dashboard)/projeler/[id]/rakipler/CompetitorDiscoveryDialog.tsx` line 107
**Apply to:** `MoveKeywordDialog.tsx`

```typescript
<DialogTrigger render={<Button variant="outline">...</Button>} />
// NOT: <DialogTrigger asChild> — base-ui pattern requires render prop
```

### Typography Rules

**Source:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` lines 97–98, 125–128
**Apply to:** All new components

- Page title: `text-xl font-semibold`
- Section heading: `text-base font-semibold`
- Body / table cells: `text-sm font-normal`
- Badge / meta: `text-xs font-normal`
- **BANNED:** `font-medium` — use only `font-normal` or `font-semibold`

---

## No Analog Found

All 9 files have close analogs in the existing codebase. No file requires falling back to RESEARCH.md patterns exclusively.

---

## Metadata

**Analog search scope:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/`, `src/app/(dashboard)/projeler/[id]/rakipler/`, `src/lib/keywords/`
**Files scanned:** 12
**Pattern extraction date:** 2026-04-24
