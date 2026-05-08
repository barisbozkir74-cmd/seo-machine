# Phase 16: Recovery Engine — Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 9
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/YYYYMMDD_recovery_tasks.sql` | migration | CRUD | `supabase/migrations/20260428000001_imported_pages.sql` | exact |
| `src/lib/monitoring/recovery-tasks.ts` | service | CRUD | `src/lib/monitoring/aggregation.ts` | exact |
| `src/app/(dashboard)/projeler/[id]/izleme/page.tsx` (modify) | page | request-response | self | exact |
| `src/app/(dashboard)/projeler/[id]/izleme/recovery-task-table.tsx` | component | CRUD | `src/app/(dashboard)/projeler/[id]/izleme/page-metrics-table.tsx` | exact |
| `src/app/(dashboard)/projeler/[id]/izleme/content-tab-bar.tsx` | component | request-response | `src/app/(dashboard)/projeler/[id]/izleme/period-tab-bar.tsx` | exact |
| `src/app/(dashboard)/projeler/[id]/izleme/actions.ts` (new) | server-action | CRUD | `src/app/(dashboard)/projeler/[id]/actions.ts` | role-match |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` (modify `publishToWordPress`) | server-action | CRUD | self | exact |
| `src/app/api/recovery/detect/route.ts` | route | event-driven | `src/app/api/gsc/sync/route.ts` | exact |

---

## Pattern Assignments

### `supabase/migrations/YYYYMMDD_recovery_tasks.sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260428000001_imported_pages.sql`

**Header comment pattern** (lines 1-5 of analog):
```sql
-- ============================================================
-- Phase 16: Recovery Engine — Schema Changes
-- ============================================================
```

**CREATE TABLE pattern** (analog lines 18-50):
```sql
CREATE TABLE IF NOT EXISTS public.recovery_tasks (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id       UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  source           TEXT NOT NULL
    CHECK (source IN ('page_package', 'imported_page')),
  source_id        UUID NOT NULL,
  title            TEXT NOT NULL,
  page_url         TEXT NOT NULL,
  position_before  NUMERIC(5,2),
  position_after   NUMERIC(5,2),
  detected_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

**Index pattern** (analog lines 53-54):
```sql
CREATE INDEX IF NOT EXISTS idx_recovery_tasks_project
  ON public.recovery_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_recovery_tasks_project_status
  ON public.recovery_tasks(project_id, status);
```

**Trigger pattern** — copy from `supabase/migrations/20260424000005_create_page_packages.sql` lines 47-50:
```sql
CREATE TRIGGER set_recovery_tasks_updated_at
  BEFORE UPDATE ON public.recovery_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

**RLS pattern** (analog lines 57-68):
```sql
ALTER TABLE public.recovery_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recovery_tasks_select_own"
  ON public.recovery_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = recovery_tasks.project_id
        AND p.user_id = auth.uid()
    )
  );
-- INSERT/UPDATE: n8n service role key ile yapılır — service role RLS bypass eder
-- User-initiated status changes (dismiss, in_progress): server action via service client
```

**Duplicate prevention constraint** — add UNIQUE to prevent re-detection of same open task per source:
```sql
-- Prevent duplicate open tasks for the same source_id
-- Application-level check preferred (see detect route) to allow re-open after resolve
```

---

### `src/lib/monitoring/recovery-tasks.ts` (service, CRUD)

**Analog:** `src/lib/monitoring/aggregation.ts`

**Imports pattern** (analog lines 1):
```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
```

**Type definitions pattern** (analog lines 7-28):
```typescript
export type RecoveryTaskStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed'

export type RecoveryTaskRow = {
  id: string
  projectId: string
  source: 'page_package' | 'imported_page'
  sourceId: string
  title: string
  pageUrl: string
  positionBefore: number | null
  positionAfter: number | null
  detectedAt: string
  status: RecoveryTaskStatus
  createdAt: string
}
```

**Query function pattern** (analog lines 163-180 — parallel SELECTs, typed result):
```typescript
export async function getRecoveryTasks(
  supabase: SupabaseClient,
  projectId: string,
  includesDismissed = false
): Promise<RecoveryTaskRow[]> {
  let query = supabase
    .from('recovery_tasks')
    .select('id, project_id, source, source_id, title, page_url, position_before, position_after, detected_at, status, created_at')
    .eq('project_id', projectId)
    .order('detected_at', { ascending: false })

  if (!includesDismissed) {
    query = query.neq('status', 'dismissed')
  }

  const { data } = await query
  // ... map to RecoveryTaskRow[]
}
```

**Decay detection helper** — copy isDecayed logic from `src/lib/monitoring/aggregation.ts` lines 263-265:
```typescript
// Threshold: delta_position >= 5 AND impressions > 10 (D-05)
const isDecayed =
  deltaPosition !== null && deltaPosition >= 5 && curr.impressions > 10
```

---

### `src/app/(dashboard)/projeler/[id]/izleme/page.tsx` (modify, page, request-response)

**Analog:** self — `src/app/(dashboard)/projeler/[id]/izleme/page.tsx`

**SSR auth pattern** (lines 21-31 of current file):
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

**searchParams pattern** (lines 17-19) — extend to handle `tab` param:
```typescript
const { period: periodRaw, tab: tabRaw } = await searchParams
const period: MonitoringPeriod = periodRaw === '7' ? 7 : periodRaw === '90' ? 90 : 28
const activeTab: 'clusters' | 'pages' | 'recovery' =
  tabRaw === 'clusters' ? 'clusters' : tabRaw === 'recovery' ? 'recovery' : 'pages'
```

**Parallel fetch pattern** (lines 36-41):
```typescript
const [clusters, pages, recoveryTasks] = gscConnected
  ? await Promise.all([
      getClusterMetrics(supabase, id, period),
      getPageMetrics(supabase, id, period),
      getRecoveryTasks(supabase, id),
    ])
  : [[], [], []]
```

**Content structure** (lines 75-90) — add ContentTabBar above existing sections, replace `<section>` blocks with tab-conditional rendering:
```typescript
<ContentTabBar projectId={id} active={activeTab} />

{activeTab === 'clusters' && (
  <section>
    <h2 className="text-base font-semibold mb-4">Cluster Performansı</h2>
    <ClusterSummaryTable clusters={clusters} />
  </section>
)}
{activeTab === 'pages' && (
  <section>
    <h2 className="text-base font-semibold mb-4">Sayfa Performansı</h2>
    <PageMetricsTable pages={pages} />
  </section>
)}
{activeTab === 'recovery' && (
  <section>
    <h2 className="text-base font-semibold mb-4">Recovery Görevleri</h2>
    <RecoveryTaskTable tasks={recoveryTasks} projectId={id} />
  </section>
)}
```

---

### `src/app/(dashboard)/projeler/[id]/izleme/recovery-task-table.tsx` (component, CRUD)

**Analog:** `src/app/(dashboard)/projeler/[id]/izleme/page-metrics-table.tsx`

**Imports pattern** (analog lines 1-6):
```typescript
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RecoveryTaskRow } from '@/lib/monitoring/recovery-tasks'
```

**Empty state pattern** (analog lines 23-29):
```typescript
if (tasks.length === 0) {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center">
      <p className="text-sm text-muted-foreground">
        Tespit edilen pozisyon düşüşü yok — sayfalar sağlıklı görünüyor.
      </p>
    </div>
  )
}
```

**Badge coloring pattern** (analog lines 66-72):
```typescript
// Status badge — copy className pattern from PageMetricsTable "Düşüş" badge
// open:       bg-red-500/15 text-red-400 border border-red-500/30
// in_progress: bg-yellow-500/15 text-yellow-400 border border-yellow-500/30
// dismissed:  bg-muted/30 text-muted-foreground border border-border
function StatusBadge({ status }: { status: RecoveryTaskRow['status'] }) {
  const classes = {
    open: 'bg-red-500/15 text-red-400 border border-red-500/30',
    in_progress: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
    resolved: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    dismissed: 'bg-muted/30 text-muted-foreground border border-border',
  }
  const labels = {
    open: 'Açık', in_progress: 'Devam Ediyor', resolved: 'Çözüldü', dismissed: 'Görmezden Gelindi',
  }
  return (
    <Badge className={cn('text-xs rounded-full px-2 py-0.5', classes[status])}>
      {labels[status]}
    </Badge>
  )
}
```

**formatDelta pattern** (analog lines 16-20) — reuse for position loss display:
```typescript
function formatPositionLoss(delta: number | null): string {
  if (delta === null) return '—'
  // positive delta = position worsened (higher number = worse rank)
  return delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)
}
```

**TableRow pattern** (analog lines 44-76) — each row: title + URL + position loss + status badge + "Güncelle" button (Link to `/projeler/[id]/sayfalar` for page_package, `/projeler/[id]/site-analizi` for imported_page).

**'use client' directive** — this component needs `useTransition` or Link; add `'use client'` at top if interactive dismiss button is included. For static navigation links, no directive needed.

---

### `src/app/(dashboard)/projeler/[id]/izleme/content-tab-bar.tsx` (component, request-response)

**Analog:** `src/app/(dashboard)/projeler/[id]/izleme/period-tab-bar.tsx` — copy file structure nearly verbatim.

**Full file pattern** (analog lines 1-40):
```typescript
'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type ContentTab = 'clusters' | 'pages' | 'recovery'

export function ContentTabBar({
  projectId,
  active,
  period,
}: {
  projectId: string
  active: ContentTab
  period: number
}) {
  const router = useRouter()
  const tabs: { id: ContentTab; label: string }[] = [
    { id: 'clusters', label: 'Cluster Performansı' },
    { id: 'pages', label: 'Sayfa Performansı' },
    { id: 'recovery', label: 'Recovery' },
  ]

  return (
    <div className="inline-flex items-center gap-1 bg-card border border-border rounded-lg p-1">
      {tabs.map((t) => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            type="button"
            onClick={() =>
              router.push(`/projeler/${projectId}/izleme?period=${period}&tab=${t.id}`)
            }
            className={cn(
              'px-4 py-2 rounded-md text-sm transition-colors min-h-[44px]',
              isActive
                ? 'bg-secondary text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
```

Note: period must be threaded through to preserve it when switching tabs.

---

### `src/app/(dashboard)/projeler/[id]/izleme/actions.ts` (new server-action file, CRUD)

**Analog:** `src/app/(dashboard)/projeler/[id]/actions.ts`

**File header pattern** (analog line 1):
```typescript
'use server'
```

**Imports pattern** (analog lines 2-9):
```typescript
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
```

**Auth + ownership pattern** (analog lines 20-44 — advanceStage):
```typescript
export type RecoveryTaskActionResult =
  | { success: true }
  | { success: false; error: string }

export async function updateRecoveryTaskStatus(
  taskId: string,
  projectId: string,
  status: 'in_progress' | 'dismissed'
): Promise<RecoveryTaskActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Ownership: verify task belongs to this project, which belongs to this user
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  const { error } = await supabase
    .from('recovery_tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('project_id', projectId)  // double-check ownership via project_id

  if (error) return { success: false, error: 'Görev güncellenemedi.' }

  revalidatePath(`/projeler/${projectId}/izleme`)
  return { success: true }
}
```

---

### `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` — modify `publishToWordPress` (server-action, CRUD)

**Analog:** self — `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts`

**Location to insert recovery_tasks resolved transition** — after the `page_packages` update succeeds (after line 629, before `revalidatePath` calls):

```typescript
// Phase 16: Recovery task auto-resolve — D-04
// After successful wp_published_at update, mark any open/in_progress recovery task resolved
await supabase
  .from('recovery_tasks')
  .update({ status: 'resolved', updated_at: new Date().toISOString() })
  .eq('source_id', pkg.id)         // pkg.id = page_packages.id
  .eq('source', 'page_package')
  .in('status', ['open', 'in_progress'])
  // No project_id filter needed — source_id is already unique to this package
```

**Error handling pattern** (analog lines 631-636) — a recovery_tasks update failure is non-fatal; log it but still return success with the publish result. Do not block the user.

---

### `src/app/api/recovery/detect/route.ts` (route, event-driven)

**Analog:** `src/app/api/gsc/sync/route.ts`

**Service client pattern** (analog lines 7-11):
```typescript
import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

**Webhook secret auth pattern** (analog lines 14-20):
```typescript
export async function POST(request: NextRequest) {
  const secret = request.headers.get('X-N8n-Webhook-Secret')
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ...
}
```

**Body parsing + validation pattern** (analog lines 22-30):
```typescript
let body: { projectId?: string; userId?: string }
try {
  body = await request.json()
} catch {
  return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
}

const { projectId, userId } = body
if (!projectId || !userId) {
  return NextResponse.json({ error: 'projectId and userId required' }, { status: 400 })
}
```

**Ownership verification pattern** (analog lines 34-49):
```typescript
const { data: project } = await serviceClient
  .from('projects')
  .select('id, gsc_property_url')
  .eq('id', projectId)
  .eq('user_id', userId)
  .single()

if (!project) {
  return NextResponse.json({ error: 'Project not found' }, { status: 404 })
}
```

**Decay detection logic** — embed `getPageMetrics` logic from `src/lib/monitoring/aggregation.ts` lines 163-284, or import it directly. Filter to `isDecayed === true` rows only.

**Duplicate prevention pattern** (D-07 — check for existing open task before INSERT):
```typescript
// For each decayed page, check for existing open task before inserting
const { data: existing } = await serviceClient
  .from('recovery_tasks')
  .select('id')
  .eq('source_id', packageId)
  .eq('source', 'page_package')
  .eq('status', 'open')
  .maybeSingle()

if (!existing) {
  await serviceClient.from('recovery_tasks').insert({
    project_id: projectId,
    source: 'page_package',
    source_id: packageId,
    title: pageTitle,
    page_url: pageUrl,
    position_before: priorAvgPos,
    position_after: currentAvgPos,
    status: 'open',
  })
}
```

**Imported pages scan** — second pass after page_packages scan:
```typescript
// REC-03: scan project_imported_pages for flag_weak_page=true AND gsc_avg_position > 20
const { data: weakPages } = await serviceClient
  .from('project_imported_pages')
  .select('id, title, link, gsc_avg_position, flag_weak_page')
  .eq('project_id', projectId)
  .eq('flag_weak_page', true)
  .gt('gsc_avg_position', 20)
```

**Response pattern** (analog line 113):
```typescript
return NextResponse.json({ inserted: insertCount, skipped: skipCount })
```

---

## Shared Patterns

### Auth: Session Check
**Source:** `src/app/(dashboard)/projeler/[id]/actions.ts` lines 20-22
**Apply to:** All new server actions in `izleme/actions.ts`
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { success: false, error: 'Oturum bulunamadı.' }
```

### Auth: Webhook Secret (n8n routes)
**Source:** `src/app/api/gsc/sync/route.ts` lines 15-19
**Apply to:** `src/app/api/recovery/detect/route.ts`
```typescript
const secret = request.headers.get('X-N8n-Webhook-Secret')
const expectedSecret = process.env.N8N_WEBHOOK_SECRET
if (expectedSecret && secret !== expectedSecret) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### Error Response: ActionResult Union Type
**Source:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` line 9
**Apply to:** All new server actions
```typescript
export type ActionResult = { success: true } | { success: false; error: string }
```

### Ownership: Project + user_id
**Source:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` lines 77-85
**Apply to:** `izleme/actions.ts` updateRecoveryTaskStatus
```typescript
async function verifyOwnership(supabase, projectId, userId) {
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()
  return data
}
```

### DB: service role client (API routes)
**Source:** `src/app/api/gsc/sync/route.ts` lines 7-11
**Apply to:** `src/app/api/recovery/detect/route.ts`
```typescript
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

### RLS: project ownership via EXISTS
**Source:** `supabase/migrations/20260428000001_imported_pages.sql` lines 59-67
**Apply to:** `recovery_tasks` RLS SELECT policy
```sql
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = recovery_tasks.project_id
      AND p.user_id = auth.uid()
  )
);
```

### UI: revalidatePath after mutation
**Source:** `src/app/(dashboard)/projeler/[id]/actions.ts` line 78
**Apply to:** All server actions that mutate `recovery_tasks`
```typescript
revalidatePath(`/projeler/${projectId}/izleme`)
```

### UI: Turkish text convention
**Source:** All existing UI files — `page-metrics-table.tsx`, `izleme/page.tsx`
**Apply to:** `recovery-task-table.tsx`, `content-tab-bar.tsx`
- Column headers: "Sayfa", "Pozisyon Kaybı", "Durum", "Aksiyon"
- Button text: "Güncelle"
- Empty state: "Tespit edilen pozisyon düşüşü yok — sayfalar sağlıklı görünüyor."
- Toggle label: "Görmezden gelinenleri göster"

---

## No Analog Found

All files have sufficient analogs. No file requires falling back to RESEARCH.md patterns alone.

---

## Metadata

**Analog search scope:** `src/app/(dashboard)/projeler/[id]/`, `src/lib/monitoring/`, `src/app/api/gsc/`, `supabase/migrations/`
**Files scanned:** 11
**Pattern extraction date:** 2026-04-30
