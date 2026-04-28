# Phase 15: Monitoring Dashboard — Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/(dashboard)/projeler/[id]/izleme/page.tsx` | page (server component) | request-response + CRUD read | `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx` | exact |
| `src/app/(dashboard)/projeler/[id]/ProjectNav.tsx` | navigation component | — | `src/app/(dashboard)/projeler/[id]/ProjectNav.tsx` (self) | exact |
| `src/app/(dashboard)/projeler/[id]/izleme/cluster-summary-table.tsx` | component (table) | CRUD read | `src/app/(dashboard)/projeler/[id]/rakipler/page.tsx` (Table pattern) | role-match |
| `src/app/(dashboard)/projeler/[id]/izleme/page-metrics-table.tsx` | component (table + badge) | CRUD read | `src/app/(dashboard)/projeler/[id]/rakipler/page.tsx` (Badge + Table) | exact |
| `src/app/api/monitoring/clusters/route.ts` | API route (GET) | request-response + CRUD read | `src/app/api/gsc/properties/route.ts` | exact |
| `src/app/api/monitoring/pages/route.ts` | API route (GET) | request-response + CRUD read | `src/app/api/gsc/properties/route.ts` | exact |

---

## Pattern Assignments

### `src/app/(dashboard)/projeler/[id]/izleme/page.tsx` (server component, request-response)

**Analog:** `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx`

**Imports pattern** (lines 1-14):
```typescript
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProjectNav } from '../ProjectNav'
```

**searchParams pattern** — from `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` (lines 54-63):
```typescript
export default async function IzlemePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ period?: string }>
}) {
  const { id } = await params
  const { period } = await searchParams
  const activePeriod = period === '7' ? 7 : period === '90' ? 90 : 28  // default 28
```

**Auth + ownership guard pattern** (lines 24-34):
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) notFound()

const { data: project } = await supabase
  .from('projects')
  .select('id, name, domain, gsc_property_url')
  .eq('id', id)
  .eq('user_id', user.id)
  .single()

if (!project) notFound()
```

**GSC not-connected empty state gate** — from `src/app/(dashboard)/projeler/[id]/gsc-section.tsx` badge pattern:
```typescript
// If project.gsc_property_url is null, render empty state instead of tables
if (!project.gsc_property_url) {
  return (
    <div className="...">
      {/* ProjectNav + empty state card */}
    </div>
  )
}
```

**Two-column layout pattern** (lines 74-97 of kurallar/page.tsx):
```typescript
return (
  <div className="flex flex-col h-screen">
    <div className="p-8 pb-4">
      <Link
        href={`/projeler/${id}`}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
      >
        ← {project.name}
      </Link>
      <h1 className="text-xl font-semibold">İzleme</h1>
    </div>

    <div className="flex flex-1 min-h-0">
      {/* Sol navigasyon */}
      <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
        <ProjectNav projectId={id} activePath={`/projeler/${id}/izleme`} />
      </div>

      {/* Sağ sütun */}
      <div className="flex-1 min-w-0 overflow-y-auto p-8">
        {/* Period tab bar + tables */}
      </div>
    </div>
  </div>
)
```

---

### `src/app/(dashboard)/projeler/[id]/ProjectNav.tsx` (navigation, —)

**Analog:** `src/app/(dashboard)/projeler/[id]/ProjectNav.tsx` (self — add one item)

**Existing NavItem array** (lines 10-23) — append one entry to `getNavItems`:
```typescript
function getNavItems(projectId: string): NavItem[] {
  return [
    { label: 'Proje Bilgileri',    href: `/projeler/${projectId}`,                   built: true },
    { label: 'Araştırma',          href: `/projeler/${projectId}/arastirma`,          built: true },
    // ... existing items unchanged ...
    { label: 'Proje Kuralları',    href: `/projeler/${projectId}/kurallar`,           built: true },
    // ADD this line:
    { label: 'İzleme',             href: `/projeler/${projectId}/izleme`,             built: true },
  ]
}
```

**Active/inactive link pattern** (lines 52-65):
```typescript
<Link
  href={item.href}
  className={cn(
    'flex items-center px-3 py-2 rounded-md text-sm transition-colors',
    isActive
      ? 'bg-secondary text-foreground font-medium'
      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
  )}
>
  {item.label}
</Link>
```

---

### `src/app/(dashboard)/projeler/[id]/izleme/cluster-summary-table.tsx` (component, CRUD read)

**Analog:** `src/app/(dashboard)/projeler/[id]/rakipler/page.tsx` (Table/TableHeader/TableBody pattern, lines 216-324)

**Imports pattern**:
```typescript
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
```

**Table header pattern** (from kurallar/page.tsx lines 110-119):
```typescript
<TableHeader>
  <TableRow>
    <TableHead className="text-xs font-normal uppercase text-muted-foreground">
      Cluster
    </TableHead>
    <TableHead className="text-xs font-normal uppercase text-muted-foreground">
      Tıklama
    </TableHead>
    {/* ... remaining columns ... */}
  </TableRow>
</TableHeader>
```

**Empty state pattern** (from rakipler/page.tsx lines 210-213):
```typescript
{clusters.length === 0 ? (
  <div className="text-sm text-muted-foreground py-8 text-center">
    GSC verisi bulunamadı
  </div>
) : (
  <Table>...</Table>
)}
```

**Metric value with tabular-nums** (from rakipler/page.tsx lines 265-269):
```typescript
<TableCell className="text-right">
  <span className="text-sm tabular-nums text-foreground">{row.clicks.toLocaleString('tr-TR')}</span>
</TableCell>
```

---

### `src/app/(dashboard)/projeler/[id]/izleme/page-metrics-table.tsx` (component, CRUD read + badge)

**Analog:** `src/app/(dashboard)/projeler/[id]/rakipler/page.tsx` (Badge inline pattern, lines 236-243 and 300-303)

**Imports pattern**:
```typescript
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
```

**Inline badge color pattern** (lines 236-243 of rakipler/page.tsx):
```typescript
// Badge uses className-direct color, no variant prop — established codebase pattern
<Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs">
  Manuel
</Badge>
// DecayBadge equivalent:
<Badge className="bg-red-500/15 text-red-400 border border-red-500/30 text-xs rounded-full px-2 py-0.5">
  Düşüş
</Badge>
```

**Conditional badge render** (from rakipler/page.tsx lines 300-307):
```typescript
<TableCell>
  {decayCondition ? (
    <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 text-xs rounded-full px-2 py-0.5">
      Düşüş
    </Badge>
  ) : (
    <span className="text-muted-foreground text-xs">—</span>
  )}
</TableCell>
```

**Truncated URL cell** (from rakipler/page.tsx Link + truncate pattern):
```typescript
<TableCell>
  <span
    className="text-sm text-muted-foreground truncate max-w-[240px] block"
    title={row.pageUrl}
  >
    {row.pageUrl}
  </span>
</TableCell>
```

**Delta position coloring** — adapted from rakipler competition level conditional:
```typescript
// positive delta = position worsened (red), negative = improved (green)
<TableCell className={cn(
  'text-sm tabular-nums',
  row.deltaPosition > 0 ? 'text-red-400' :
  row.deltaPosition < 0 ? 'text-emerald-400' :
  'text-muted-foreground'
)}>
  {row.deltaPosition > 0 ? `+${row.deltaPosition.toFixed(1)}` : row.deltaPosition.toFixed(1)}
</TableCell>
```

**Row hover pattern** (from rakipler/page.tsx implicit TableRow usage + UI spec):
```typescript
<TableRow className="hover:bg-muted/50 transition-colors">
```

---

### `src/app/api/monitoring/clusters/route.ts` (API route GET, request-response + CRUD read)

**Analog:** `src/app/api/gsc/properties/route.ts` (lines 1-46)

**Full GET handler pattern** (lines 1-46):
```typescript
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const projectId = searchParams.get('projectId')
  const period = searchParams.get('period') ?? '28'

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Ownership check
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  try {
    // SQL aggregation query here
    return NextResponse.json({ clusters: [...] })
  } catch (err) {
    console.error('[monitoring/clusters]', err)
    return NextResponse.json({ error: 'Failed to fetch cluster metrics' }, { status: 500 })
  }
}
```

**Date range computation** — from `src/app/api/gsc/sync/route.ts` (lines 62-64):
```typescript
const endDate = new Date()
const startDate = new Date()
startDate.setDate(startDate.getDate() - Number(period))  // period = 7 | 28 | 90
const fmt = (d: Date) => d.toISOString().split('T')[0]
```

**Supabase server client** (properties/route.ts lines 15-16):
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
```

---

### `src/app/api/monitoring/pages/route.ts` (API route GET, request-response + CRUD read)

**Analog:** `src/app/api/gsc/properties/route.ts` — identical GET skeleton as clusters route above.

**Additional: delta_position computation** requires two date-range queries (current period vs prior period):
```typescript
// Current period: last N days
// Prior period: N days before that
// delta_position = AVG(current avg_position) - AVG(prior avg_position)
// Positive delta = position number got larger = ranking dropped = decay
```

**Service role client** — from `src/app/api/gsc/sync/route.ts` (lines 7-11) for cases needing RLS bypass:
```typescript
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```
Note: monitoring routes use the standard `createClient()` (user-scoped RLS), not service role — user ownership is sufficient. Service role pattern shown for reference only.

---

## Shared Patterns

### Auth + Ownership Guard
**Source:** `src/app/api/gsc/properties/route.ts` lines 14-31
**Apply to:** Both API routes (`monitoring/clusters`, `monitoring/pages`)
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
const { data: project } = await supabase
  .from('projects')
  .select('id')
  .eq('id', projectId)
  .eq('user_id', user.id)
  .single()
if (!project) {
  return NextResponse.json({ error: 'Project not found' }, { status: 404 })
}
```

### Page-Level Auth Guard (Server Component)
**Source:** `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx` lines 23-34
**Apply to:** `izleme/page.tsx`
```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user) notFound()
const { data: project } = await supabase
  .from('projects')
  .select('id, name, domain, gsc_property_url')
  .eq('id', id)
  .eq('user_id', user.id)
  .single()
if (!project) notFound()
```

### Badge Color (className-direct, no variant prop)
**Source:** `src/app/(dashboard)/projeler/[id]/rakipler/page.tsx` lines 258-263, 300-303
**Apply to:** `page-metrics-table.tsx` DecayBadge, `gsc-section.tsx` reference
```typescript
// Pattern: always className-direct, never variant="destructive" etc.
<Badge className="bg-{color}-500/20 text-{color}-400 border border-{color}-500/30 text-xs">
  Label
</Badge>
```

### Table Header Style
**Source:** `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx` lines 111-118
**Apply to:** `cluster-summary-table.tsx`, `page-metrics-table.tsx`
```typescript
<TableHead className="text-xs font-normal uppercase text-muted-foreground">
  Column Label
</TableHead>
```

### Two-Column Page Layout (ProjectNav + content)
**Source:** `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx` lines 74-97
**Apply to:** `izleme/page.tsx`
```typescript
<div className="flex flex-col h-screen">
  <div className="p-8 pb-4">{/* title */}</div>
  <div className="flex flex-1 min-h-0">
    <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
      <ProjectNav projectId={id} activePath={...} />
    </div>
    <div className="flex-1 min-w-0 overflow-y-auto p-8">
      {/* content */}
    </div>
  </div>
</div>
```

### Error/Loading Text
**Source:** `src/app/(dashboard)/projeler/[id]/gsc-section.tsx` lines 183-186
**Apply to:** All new components that render async errors
```typescript
{error && (
  <p className="text-xs text-destructive" role="alert">
    {error}
  </p>
)}
```

### searchParams for Query Params (Server Component)
**Source:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` lines 54-63
**Apply to:** `izleme/page.tsx`
```typescript
export default async function IzlemePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ period?: string }>
}) {
  const { id } = await params
  const { period } = await searchParams
```

---

## No Analog Found

All files have close analogs. No entries required here.

---

## Metadata

**Analog search scope:** `src/app/(dashboard)/projeler/[id]/`, `src/app/api/gsc/`, `src/components/`
**Files scanned:** 7
**Pattern extraction date:** 2026-04-28
