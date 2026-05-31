# Phase 24: DataForSEO Validation Layer — Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 10 (4 yeni, 5 modifikasyon, 1 migration grubu)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/dataforseo/cache.ts` | utility/service | request-response (cache-first) | `src/lib/dataforseo/orchestrator.ts` | exact |
| `supabase/migrations/YYYYMMDD_strategy_decisions.sql` | migration | CRUD | `supabase/migrations/20260512000001_ai_memory.sql` | exact |
| `supabase/migrations/YYYYMMDD_dfs_fetched_at.sql` | migration | CRUD | `supabase/migrations/20260520000001_keyword_command_center_fields.sql` | exact |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/AnalysisButtons.tsx` | component | request-response | `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterButton.tsx` + `AiAcquireButton.tsx` | role-match |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/DeepAnalysisPoller.tsx` | component | event-driven/polling | `src/app/(dashboard)/projeler/[id]/arastirma/ResearchAutoTrigger.tsx` | exact |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` | server action | CRUD + request-response | same file (mevcut actions.ts) | exact |
| `src/app/api/dataforseo/deep-analysis/route.ts` | route handler | request-response (n8n trigger) | `src/app/api/recovery/detect/route.ts` | exact |
| `src/app/api/dataforseo/deep-analysis/callback/route.ts` | route handler | event-driven (n8n callback) | `src/app/api/recovery/detect/route.ts` | role-match |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` | server component | CRUD (SSR query) | same file (mevcut page.tsx) | exact |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordFlatList.tsx` | component | CRUD (tablo görünümü) | same file (mevcut) | exact |

---

## Pattern Assignments

### `src/lib/dataforseo/cache.ts` (utility, request-response cache-first)

**Analog:** `src/lib/dataforseo/orchestrator.ts`

**Imports pattern** (lines 1-10):
```typescript
import 'server-only'
import crypto from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import {
  type TaskSpec,
  type CacheResult,
  type SkipReason,
  ENDPOINT_TTL,
  DAILY_BUDGET_UNITS,
} from './types'
```

**Core wrapper pattern** — `getCachedOrFetch` sadece `fetchWithCache` etrafında ince ergonomi katmanı:
```typescript
// Tüm guard mantığı (budget, backoff, running, cache hit) fetchWithCache'de
// cache.ts yalnızca tip dönüşümü + null normalizasyonu yapar
export async function getCachedOrFetch<T>(opts: {
  projectId: string
  userId: string
  spec: TaskSpec
  fetcher: () => Promise<T>
}): Promise<{ data: T; fromCache: boolean } | null> {
  const result = await fetchWithCache({ ...opts })
  if (result.skipped) return null
  return { data: result.data as T, fromCache: result.fromCache }
}
```

**SHA-256 fingerprint pattern** (orchestrator.ts lines 41-66) — doğrudan `makeFingerprint(spec)` çağır, hand-roll etme:
```typescript
// orchestrator.ts'den: keywords array sort+normalize → SHA-256 → .slice(0,16)
import crypto from 'node:crypto'
const hash = crypto.createHash('sha256')
  .update(normalised)
  .digest('hex')
  .slice(0, 16)
```

**Cache hit dönüş yapısı** (orchestrator.ts lines 215-228):
```typescript
// status='done' + isStale() kontrolü
const { data: cached } = await supabase
  .from('dataforseo_task_cache')
  .select('result, expires_at')
  .eq('project_id', projectId)
  .eq('fingerprint', fingerprint)
  .eq('status', 'done')
  .maybeSingle()

if (cached?.result && !isStale(cached.expires_at)) {
  return { data: cached.result as T, fromCache: true, skipped: false }
}
```

**Running guard pattern** (orchestrator.ts lines 117-130) — `isAlreadyRunning()` fonksiyonu DFS-08 için:
```typescript
async function isAlreadyRunning(projectId: string, fingerprint: string): Promise<boolean> {
  const { data } = await supabase
    .from('dataforseo_task_cache')
    .select('updated_at')
    .eq('project_id', projectId)
    .eq('fingerprint', fingerprint)
    .eq('status', 'running')
    .maybeSingle()

  if (!data) return false
  return Date.now() - new Date(data.updated_at).getTime() < RUNNING_TIMEOUT_MS
}
```

**Kritik not:** `getCachedOrFetch` wrapper'ında `'server-only'` ilk satır zorunlu (import guard).

---

### `supabase/migrations/YYYYMMDD_strategy_decisions.sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260512000001_ai_memory.sql`

**UNIQUE constraint pattern** (ai_memory.sql lines 13):
```sql
UNIQUE(project_id, module, key)
```

**RLS pattern** (ai_memory.sql lines 22-28):
```sql
ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their ai_memory"
  ON public.ai_memory
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**Index pattern** (ai_memory.sql lines 16-22):
```sql
CREATE INDEX IF NOT EXISTS idx_ai_memory_project_id
  ON public.ai_memory(project_id);

CREATE INDEX IF NOT EXISTS idx_ai_memory_project_module
  ON public.ai_memory(project_id, module);
```

**strategy_decisions tam DDL** (RESEARCH.md Code Examples'tan):
```sql
CREATE TABLE public.strategy_decisions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id  UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  module      TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       JSONB NOT NULL DEFAULT '{}',
  reason      TEXT,
  locked_at   TIMESTAMPTZ,
  locked_by   UUID REFERENCES auth.users(id),
  is_locked   BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(project_id, module, key)
);
```

**UPSERT pattern** (actions.ts lines 1374-1421 — ai_memory upsert):
```typescript
await supabase
  .from('strategy_decisions')
  .upsert(
    {
      user_id: userId,
      project_id: projectId,
      module: 'cluster_priority',
      key: clusterId,
      value: { priority: 'high' },
      reason: 'Manuel kilit',
      is_locked: true,
      is_active: true,
      locked_at: new Date().toISOString(),
      locked_by: userId,
    },
    { onConflict: 'project_id,module,key' }
  )
```

---

### `supabase/migrations/YYYYMMDD_dfs_fetched_at.sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260520000001_keyword_command_center_fields.sql`

**ADD COLUMN IF NOT EXISTS pattern** (keyword_command_center_fields.sql lines 4-11):
```sql
ALTER TABLE public.keywords
  ADD COLUMN IF NOT EXISTS keyword_role       TEXT,
  ADD COLUMN IF NOT EXISTS category           TEXT,
  -- ...
```

**dfs_fetched_at migration** — DEFAULT YOK, NULL bırak (RESEARCH.md Pitfall 1):
```sql
-- DEFAULT YOK — mevcut keywordler NULL kalır (stale check tetiklenir)
-- DEFAULT now() kesinlikle EKLEME — mevcut satırlar yanlış timestamp alır
ALTER TABLE public.keywords
  ADD COLUMN IF NOT EXISTS dfs_fetched_at TIMESTAMPTZ;

-- İndeks: stale check sorguları için
CREATE INDEX IF NOT EXISTS idx_keywords_dfs_fetched_at
  ON public.keywords(project_id, dfs_fetched_at)
  WHERE dfs_fetched_at IS NOT NULL;
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/AnalysisButtons.tsx` (component, request-response)

**Analog:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterButton.tsx` (useTransition pattern) + `AiAcquireButton.tsx` (inline result gösterimi)

**Imports pattern** (ClusterButton.tsx lines 1-5):
```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
```

**Dialog için ek import** (shadcn Dialog — mevcut components/ui/dialog.tsx):
```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
```

**useTransition + Server Action çağrısı pattern** (ClusterButton.tsx lines 40-50):
```typescript
const [isPending, startTransition] = useTransition()
const [error, setError] = useState<string | null>(null)

const handleAnalysis = () => {
  setError(null)
  startTransition(async () => {
    const result = await lightAnalysisAction(projectId)
    if (!result.success) {
      setError(result.error)
    } else {
      router.refresh()
    }
  })
}
```

**Spinner + loading label pattern** (ClusterButton.tsx lines 68-76):
```typescript
{isPending ? (
  <span className="flex items-center gap-2">
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    Veriler Çekiliyor...
  </span>
) : 'Temel Verileri Al'}
```

**Cyan buton stil pattern** (UI-SPEC.md — Phase 24'e özel):
```typescript
// 3 analiz butonunun ortak className:
className="h-9 text-xs border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"

// Concurrent guard / disabled state:
className="h-9 text-xs opacity-40 cursor-not-allowed border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
```

**Toolbar separator pattern** (page.tsx line 288):
```typescript
<span className="h-4 w-px bg-border/50 shrink-0" />
```

**Inline result mesajı pattern** (AiAcquireButton.tsx lines 66-67):
```typescript
{lastResult && <p className="text-xs text-muted-foreground">{lastResult}</p>}
{error && <p className="text-sm text-destructive">{error}</p>}
```
Phase 24 için renkler farklı (UI-SPEC):
```typescript
// Success: text-emerald-400 text-xs
// Cache hit: text-muted-foreground text-xs
// Partial: text-amber-400 text-xs
// Error: text-destructive text-xs (kalıcı, otomatik kaybolmaz)
```

**Concurrent guard banner pattern** (page.tsx lines 342-345 — amber banner):
```typescript
<div className="px-4 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
  Analiz devam ediyor. Tamamlanmasını bekleyin.
</div>
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/DeepAnalysisPoller.tsx` (component, event-driven polling)

**Analog:** `src/app/(dashboard)/projeler/[id]/arastirma/ResearchAutoTrigger.tsx`

**Imports pattern** (ResearchAutoTrigger.tsx lines 1-5):
```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
```

**5s polling core pattern** (ResearchAutoTrigger.tsx lines 47-64):
```typescript
// ResearchAutoTrigger 3s poll kullanıyor — DeepAnalysisPoller 5s kullanacak (RESEARCH.md)
let pollInterval: ReturnType<typeof setInterval> | null = null

pollInterval = setInterval(async () => {
  try {
    // router.refresh() → SSR page yeniden render → workflow_runs durumunu okur
    router.refresh()
    // status kontrolü: 'done' veya 'failed' → clearInterval
  } catch {
    // ignore poll errors
  }
}, 5000)  // 5000ms — ResearchAutoTrigger'dan farklı olarak 5s

return () => {
  if (pollInterval) clearInterval(pollInterval)
}
```

**Phase + triggered guard pattern** (ResearchAutoTrigger.tsx lines 16-18):
```typescript
type Phase = 'starting' | 'running' | 'done' | 'error'
const [phase, setPhase] = useState<Phase>('starting')
const triggered = useRef(false)
```

**Timeout guard** (UI-SPEC — 12 dakika = 144 döngü × 5 saniye):
```typescript
let loopCount = 0
const MAX_LOOPS = 144 // 12 dakika timeout

pollInterval = setInterval(async () => {
  loopCount++
  if (loopCount >= MAX_LOOPS) {
    clearInterval(pollInterval!)
    setPhase('timeout')
    return
  }
  router.refresh()
}, 5000)
```

**Polling başlangıç koşulu** — yalnızca `workflow_runs.status IN ('pending', 'running')` olduğunda mount et:
```typescript
// page.tsx'den prop olarak gelir: initialStatus: 'pending' | 'running' | null
// null → poller mount edilmez
if (!initialStatus) return null
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` (server action, CRUD)

**Analog:** aynı dosya (mevcut actions.ts)

**'use server' + imports başlığı** (actions.ts lines 1-13):
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getDataForSeoCredentials } from '@/lib/supabase/vault'
import { fetchKeywordData, fetchRelatedKeywords } from '@/lib/dataforseo/client'
// Phase 24 eklentisi:
import { fetchWithCache } from '@/lib/dataforseo/orchestrator'
import { makeFingerprint } from '@/lib/dataforseo/orchestrator'
import type { TaskSpec } from '@/lib/dataforseo/types'
```

**Auth + ownership guard pattern** (actions.ts lines 81-91 — importKeywords'den):
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { success: false, error: 'Oturum bulunamadı.' }

const { data: project } = await supabase
  .from('projects')
  .select('id, target_country')
  .eq('id', projectId)
  .eq('user_id', user.id)
  .single()
if (!project) return { success: false, error: 'Proje bulunamadı.' }
```

**UUID validation pattern** (actions.ts lines 292-294):
```typescript
const uuidRegex = /^[0-9a-f-]{36}$/i
if (!uuidRegex.test(projectId)) return { success: false, error: 'Geçersiz proje ID.' }
```

**dfs_fetched_at güncelleme pattern** (actions.ts line 149 — enriched_at analog):
```typescript
// lightAnalysis / standardAnalysis tamamlandıktan sonra:
await supabase
  .from('keywords')
  .update({ dfs_fetched_at: new Date().toISOString() })
  .in('id', processedKeywordIds)
  .eq('user_id', user.id)
```

**revalidatePath pattern** (actions.ts lines 171-173):
```typescript
revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
revalidatePath(`/control-center/projects/${projectId}`, 'layout')
return { success: true, count: updatedCount, fromCache }
```

**Result type pattern** (actions.ts lines 70-73):
```typescript
export type LightAnalysisResult =
  | { success: true; count: number; fromCache: boolean }
  | { success: false; error: string }
```

---

### `src/app/api/dataforseo/deep-analysis/route.ts` (route handler, n8n trigger)

**Analog:** `src/app/api/recovery/detect/route.ts`

**Imports + service client pattern** (detect/route.ts lines 1-11):
```typescript
import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
```

**Webhook secret auth pattern** (detect/route.ts lines 27-32):
```typescript
export async function POST(request: NextRequest) {
  const secret = request.headers.get('X-N8n-Webhook-Secret')
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
```

**Body parse + validation pattern** (detect/route.ts lines 34-48):
```typescript
let body: { projectId?: string; userId?: string }
try {
  body = await request.json()
} catch {
  return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
}

const { projectId, userId } = body
if (!projectId || !userId) {
  return NextResponse.json(
    { error: 'projectId and userId required' },
    { status: 400 },
  )
}
```

**Ownership check pattern** (detect/route.ts lines 51-59):
```typescript
const serviceClient = getServiceClient()

const { data: project } = await serviceClient
  .from('projects')
  .select('id')
  .eq('id', projectId)
  .eq('user_id', userId)
  .single()

if (!project) {
  return NextResponse.json({ error: 'Project not found' }, { status: 404 })
}
```

**workflow_runs INSERT (deep analysis trigger için ek):
```typescript
// detect/route.ts pattern'ına ek — workflow_runs'a pending INSERT
const { data: workflowRun } = await serviceClient
  .from('workflow_runs')
  .insert({
    user_id: userId,
    project_id: projectId,
    workflow_type: 'dfs_deep_analysis',
    status: 'pending',
    input_payload: { keywordIds, analysisLevel: 'deep' },
  })
  .select('id')
  .single()

// n8n webhook çağrısı
const n8nUrl = process.env.N8N_DEEP_ANALYSIS_WEBHOOK_URL
if (n8nUrl) {
  await fetch(n8nUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-N8n-Webhook-Secret': process.env.N8N_WEBHOOK_SECRET ?? '' },
    body: JSON.stringify({ projectId, userId, workflowRunId: workflowRun?.id }),
  })
}
```

---

### `src/app/api/dataforseo/deep-analysis/callback/route.ts` (route handler, n8n callback)

**Analog:** `src/app/api/recovery/detect/route.ts` (aynı pattern, farklı iş mantığı)

**Core pattern** — detect/route.ts ile özdeş auth + service client; fark: workflow_runs UPDATE:
```typescript
// callback route — n8n tamamladıktan sonra çağırır
// 1. Webhook secret check (detect/route.ts lines 27-32 ile aynı)
// 2. Body: { projectId, userId, workflowRunId, status: 'done'|'failed', result?: unknown }
// 3. ownership check (detect/route.ts lines 51-59 ile aynı)
// 4. workflow_runs UPDATE:
await serviceClient
  .from('workflow_runs')
  .update({
    status: body.status,          // 'done' | 'failed'
    result_payload: body.result ?? null,
    error_message: body.status === 'failed' ? (body.error ?? null) : null,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  .eq('id', body.workflowRunId)
  .eq('project_id', body.projectId)

// 5. dfs_fetched_at bulk update (status='done' ise)
if (body.status === 'done' && Array.isArray(body.keywordIds)) {
  await serviceClient
    .from('keywords')
    .update({ dfs_fetched_at: new Date().toISOString() })
    .in('id', body.keywordIds)
    .eq('project_id', body.projectId)
}
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` (server component, SSR query modification)

**Analog:** aynı dosya (mevcut page.tsx)

**Keywords select query** (page.tsx lines 118-125) — `dfs_fetched_at` eklentisi:
```typescript
// Mevcut select string'e 'dfs_fetched_at' ekle:
const { data: keywordsRaw } = await supabase
  .from('keywords')
  .select('id, keyword, volume, cpc, difficulty, search_intent, enriched_at, dfs_fetched_at, cluster_id, opportunity_score, source, parent_keyword_id, is_starred, is_ai_suggested, long_tail_flag, faq_flag, comparison_flag, keyword_role')
  .eq('project_id', id)
  .eq('user_id', user.id)
  .order('volume', { ascending: false, nullsFirst: false })
```

**KeywordRow type genişletme** (page.tsx lines 29-47):
```typescript
type KeywordRow = {
  // ... mevcut alanlar ...
  dfs_fetched_at: string | null  // YENİ — Phase 24
}
```

**workflow_runs deep analysis sorgusu** (yeni eklenti — DeepAnalysisPoller için):
```typescript
// Projenin aktif deep analysis workflow'u var mı? SSR'da çek.
const { data: activeWorkflow } = await supabase
  .from('workflow_runs')
  .select('id, status, created_at')
  .eq('project_id', id)
  .eq('user_id', user.id)
  .eq('workflow_type', 'dfs_deep_analysis')
  .in('status', ['pending', 'running'])
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
```

**DeepAnalysisPoller mount pattern** (ResearchAutoTrigger'ın SSR'dan koşullu mount'una benzer):
```typescript
// page.tsx JSX içinde — aktif workflow varsa poller'ı mount et
{activeWorkflow && (
  <DeepAnalysisPoller initialStatus={activeWorkflow.status as 'pending' | 'running'} />
)}
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordFlatList.tsx` (component, tablo modifikasyonu)

**Analog:** aynı dosya (mevcut KeywordFlatList.tsx)

**TableHead ekleme pattern** (KeywordFlatList.tsx lines 453-463 — mevcut sütunlar):
```typescript
// Mevcut son sütun: "Rol" w-28
// Yeni sütun SONRA eklenir:
<TableHead className="text-xs w-28 py-2">Rol</TableHead>
{/* YENİ — Phase 24 */}
<TableHead className="text-xs w-28 py-2 text-cyan-400/70">DFS Tarihi</TableHead>
```

**TableCell render pattern** (KeywordFlatList.tsx lines 564-570 — "Rol" hücresi analogu):
```typescript
{/* YENİ — dfs_fetched_at hücresi, "Rol" TableCell'in SONRASINA */}
<TableCell className="py-1 w-28">
  {kw.dfs_fetched_at === null ? (
    <Badge className="bg-secondary text-muted-foreground/50 text-[10px] border-0 px-1.5 py-0">
      Veri yok
    </Badge>
  ) : isStale(kw.dfs_fetched_at, ttlDays) ? (
    <Badge className="bg-amber-500/20 text-amber-400 text-[10px] border-0 px-1.5 py-0">
      Güncel değil
    </Badge>
  ) : (
    <span
      className="text-[11px] text-muted-foreground"
      title={`Son güncelleme: ${kw.dfs_fetched_at} · ${daysSince(kw.dfs_fetched_at)} gün önce`}
    >
      {formatDate(kw.dfs_fetched_at)}
    </span>
  )}
</TableCell>
```

**KeywordRow type** — `dfs_fetched_at` props'a eklenmeli (page.tsx'den KeywordFlatList'e geçirilir):
```typescript
type KeywordRow = {
  // ... mevcut alanlar ...
  dfs_fetched_at: string | null
}
```

---

## Shared Patterns

### Authentication (tüm Server Actions)
**Source:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` lines 81-91
**Apply to:** `lightAnalysisAction`, `standardAnalysisAction` (yeni), tüm mevcut action'lar
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { success: false, error: 'Oturum bulunamadı.' }
```

### Ownership Check
**Source:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` lines 84-91
**Apply to:** tüm yeni Server Actions + route handler'lar
```typescript
const { data: project } = await supabase
  .from('projects')
  .select('id')
  .eq('id', projectId)
  .eq('user_id', user.id)
  .single()
if (!project) return { success: false, error: 'Proje bulunamadı.' }
```

### Service Role Client (n8n route'ları)
**Source:** `src/app/api/recovery/detect/route.ts` lines 5-11
**Apply to:** `deep-analysis/route.ts`, `deep-analysis/callback/route.ts`
```typescript
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
```

### Webhook Secret Auth
**Source:** `src/app/api/recovery/detect/route.ts` lines 27-32
**Apply to:** `deep-analysis/route.ts`, `deep-analysis/callback/route.ts`
```typescript
const secret = request.headers.get('X-N8n-Webhook-Secret')
const expectedSecret = process.env.N8N_WEBHOOK_SECRET
if (expectedSecret && secret !== expectedSecret) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### revalidatePath Convention
**Source:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` lines 171-173
**Apply to:** `lightAnalysisAction`, `standardAnalysisAction`
```typescript
revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
revalidatePath(`/control-center/projects/${projectId}`, 'layout')
```

### Amber Banner (uyarı/gate mesajları)
**Source:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` lines 342-345
**Apply to:** Concurrent guard banner (AnalysisButtons.tsx)
```typescript
className="px-4 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300"
```

### Result Union Type
**Source:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` lines 70-73
**Apply to:** `LightAnalysisResult`, `StandardAnalysisResult`
```typescript
export type LightAnalysisResult =
  | { success: true; count: number; fromCache: boolean }
  | { success: false; error: string }
```

### DataForSEO Credentials
**Source:** `src/lib/supabase/vault.ts` — `getDataForSeoCredentials()`
**Apply to:** `lightAnalysisAction`, `standardAnalysisAction`
```typescript
import { getDataForSeoCredentials } from '@/lib/supabase/vault'

// Actions içinde:
let credentials: { login: string; password: string }
try {
  credentials = await getDataForSeoCredentials()
} catch {
  return { success: false, error: 'DataForSEO credentials bulunamadı.' }
}
```

---

## No Analog Found

Phase 24'te tüm dosyaların yakın analogu mevcut. Ancak şu alt-pattern'lar codebase'de henüz yok:

| Pattern | Durum | Çözüm |
|---|---|---|
| Cost approval Dialog içeriği (light/standard/deep farklı state) | UI-SPEC'te tanımlandı, codebase'de yok | RESEARCH.md + UI-SPEC copywriting bölümünden implement et |
| `dfs_fetched_at` TTL hesaplama (`isStale` helper) | Benzer `isStale(expiresAt)` orchestrator.ts'de var (line 70-73) | `isStale(dfs_fetched_at, ttlDays)` — orchestrator'daki ile aynı mantık, farklı parametre |
| Polling timeout (144 döngü guard) | ResearchAutoTrigger'da yok | UI-SPEC'te tanımlandı — `loopCount` counter ile implement et |

---

## Critical Anti-Patterns (Planlamaya Notlar)

| Anti-Pattern | Açıklama | Kaynak |
|---|---|---|
| `dfs_fetched_at DEFAULT now()` | Migration'da DEFAULT koyma — mevcut satırlar yanlış timestamp alır | RESEARCH.md Pitfall 1 |
| `keyword_data_cache` ayrı tablo açmak | `dataforseo_task_cache` zaten var — duplication riski | RESEARCH.md Pitfall 2 |
| `strategy_decisions` → `ai_memory`'ye yazmak | Farklı retention contract, `is_locked` flag yok | RESEARCH.md Pitfall 3 |
| n8n callback'te anon key | `workflow_runs` RLS'e takılır — service role zorunlu | RESEARCH.md Pitfall 6 |
| `fetchWithCache` yerine hand-roll cache | Budget guard + backoff + running guard zaten var | RESEARCH.md Don't Hand-Roll |

---

## Metadata

**Analog search scope:**
- `src/lib/dataforseo/` — orchestrator.ts, client.ts, types.ts
- `src/app/api/recovery/` — detect/route.ts (n8n pattern)
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/` — actions.ts, page.tsx, ClusterButton.tsx, AiAcquireButton.tsx
- `src/app/(dashboard)/projeler/[id]/arastirma/` — ResearchAutoTrigger.tsx
- `supabase/migrations/` — ai_memory.sql, keyword_command_center_fields.sql, dataforseo_task_cache.sql, project_decisions.sql

**Files scanned:** 12 analog dosya
**Pattern extraction date:** 2026-05-31
