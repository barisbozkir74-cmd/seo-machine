# Phase 17: Keyword Intelligence - Pattern Map

**Mapped:** 2026-05-07
**Files analyzed:** 7 (3 yeni, 4 mevcut modifikasyon)
**Analogs found:** 7 / 7

---

## File Classification

| Yeni/Değiştirilecek Dosya | Rol | Veri Akışı | En Yakın Analog | Eşleşme Kalitesi |
|---------------------------|-----|------------|-----------------|------------------|
| `src/lib/keywords/niche-scoring.ts` | utility | transform | `src/lib/keywords/scoring.ts` | exact |
| `src/lib/keywords/niche-scoring.test.ts` | test | transform | `src/lib/keywords/scoring.test.ts` | exact |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/RevenueBadge.tsx` | component | request-response | `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/IntentBadge.tsx` | exact |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/RevenueOverrideSelect.tsx` | component | request-response | `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx` | role-match |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` | service | CRUD | `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` | self (modify) |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx` | component | request-response | `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx` | self (modify) |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` | controller | request-response | `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` | self (modify) |

---

## Pattern Assignments

### `src/lib/keywords/niche-scoring.ts` (utility, transform)

**Analog:** `src/lib/keywords/scoring.ts`

**Imports pattern** (satır 1 — import yok, pure math):
```typescript
// Pure math — no imports needed
// scoring.ts ile aynı pattern: sıfır dış bağımlılık
```

**Core pattern** (satır 11-36 — scoring.ts'den doğrudan adapte):
```typescript
// scoring.ts — min-max normalize, sabit ağırlıklar, 0-100 aralığı, 1 decimal
function normalizeVolume(volume: number, maxVolume: number): number {
  if (maxVolume === 0) return 0
  return Math.min(volume / maxVolume, 1)
}

function normalizeCpc(cpc: number, maxCpc: number): number {
  if (maxCpc === 0) return 0
  return Math.min(cpc / maxCpc, 1)
}

export function calculateOpportunityScore(
  keyword: { volume: number | null; cpc: number | null; difficulty: number | null; search_intent: string | null },
  context: { maxVolume: number; maxCpc: number }
): number {
  const volumeScore = normalizeVolume(keyword.volume ?? 0, context.maxVolume)
  const cpcScore    = normalizeCpc(keyword.cpc ?? 0, context.maxCpc)
  const kdScore     = (100 - (keyword.difficulty ?? 50)) / 100
  const intentMult  = INTENT_MULTIPLIERS[keyword.search_intent?.toLowerCase() ?? 'unknown'] ?? 0.5
  const raw = (volumeScore * 0.40) + (cpcScore * 0.25) + (kdScore * 0.15) + (intentMult * 0.20)
  return Math.round(raw * 100 * 10) / 10  // 0-100, 1 decimal
}

export function buildScoringContext(
  keywords: Array<{ volume: number | null; cpc: number | null }>
): { maxVolume: number; maxCpc: number } {
  return {
    maxVolume: Math.max(...keywords.map((k) => k.volume ?? 0), 0),
    maxCpc:    Math.max(...keywords.map((k) => k.cpc ?? 0), 0),
  }
}
```

**Niche-scoring adaptasyonu:** `intentMult` yerine `avgDifficulty` ters normalize; bireysel keyword değil cluster aggregate.
Formül: `niche_score = (volume_score * 0.4) + (competition_score * 0.35) + (cpc_score * 0.25)`

**Context builder pattern** (satır 39-46 — `buildScoringContext` analogu):
```typescript
// niche-scoring.ts için: buildNicheScoringContext
// Cluster'ların total_volume listesinden maxClusterVolume hesapla
// Keywords üzerinden maxCpc hesapla
// scoring.ts'deki buildScoringContext ile aynı yapı
```

---

### `src/lib/keywords/niche-scoring.test.ts` (test, transform)

**Analog:** `src/lib/keywords/scoring.test.ts`

**Test yapısı pattern** (satır 1-5):
```typescript
import { describe, it, expect } from 'vitest'
import { calculateOpportunityScore, buildScoringContext, INTENT_MULTIPLIERS } from './scoring'

const ctx = { maxVolume: 10000, maxCpc: 5.0 }
```

**Test case pattern** (satır 7-46 — her işlev için describe bloğu):
```typescript
describe('calculateNicheScore', () => {
  it('returns a number between 0 and 100', () => { ... })
  it('handles all-null inputs without throwing', () => { ... })
  it('returns 1 decimal precision', () => {
    expect(score.toString()).toMatch(/^\d+(\.\d)?$/)
  })
})

describe('classifyRevenueType', () => {
  it('çoğunluk informational → bilgi döner', () => { ... })
  it('çoğunluk commercial → ticari döner', () => { ... })
  it('karma dağılım → mixed döner', () => { ... })
  it('boş keywords için mixed döner', () => { ... })
})
```

**Null guard test pattern** (satır 31-37):
```typescript
it('handles all-null inputs without throwing', () => {
  const score = calculateOpportunityScore(
    { volume: null, cpc: null, difficulty: null, search_intent: null },
    { maxVolume: 0, maxCpc: 0 }
  )
  expect(score).toBeGreaterThanOrEqual(0)
  expect(score).toBeLessThanOrEqual(100)
})
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/RevenueBadge.tsx` (component, request-response)

**Analog:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/IntentBadge.tsx`

**Imports pattern** (satır 1):
```typescript
import { Badge } from '@/components/ui/badge'
```

**Config objesi pattern** (satır 3-9 — IntentBadge'den bire bir kopyala, sadece değerleri değiştir):
```typescript
// D-11 + UI-SPEC renk atamaları — className ile direkt, variant prop kullanılmaz
const intentConfig: Record<string, { className: string; label: string }> = {
  commercial:    { className: 'bg-blue-500/20 text-blue-400',      label: 'Commercial' },
  informational: { className: 'bg-emerald-500/20 text-emerald-400', label: 'Informational' },
  navigational:  { className: 'bg-gray-500/20 text-gray-400',      label: 'Navigational' },
  transactional: { className: 'bg-orange-500/20 text-orange-400',  label: 'Transactional' },
}
```

RevenueBadge için:
```typescript
const revenueConfig: Record<string, { className: string; label: string }> = {
  bilgi:   { className: 'bg-emerald-500/20 text-emerald-400', label: 'Bilgi' },
  mixed:   { className: 'bg-yellow-500/20 text-yellow-400',   label: 'Mixed' },
  ticari:  { className: 'bg-red-500/20 text-red-400',         label: 'Ticari' },
}
```

**Component pattern** (satır 11-26 — IntentBadge'den bire bir kopyala):
```typescript
export function IntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return <span className="text-sm text-muted-foreground">—</span>

  // DataForSEO farklı case döndürebilir — normalize et
  const key = intent.toLowerCase().trim()
  const config = intentConfig[key]

  if (!config) return <span className="text-sm text-muted-foreground">{intent}</span>

  // variant prop kullanılmaz — STATE.md karar notu
  return (
    <Badge className={`${config.className} text-xs border-0`}>
      {config.label}
    </Badge>
  )
}
```

**Kritik kural:** `variant` prop KULLANILMAZ — `className` direkt atanır (tüm projedeki Badge pattern).

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/RevenueOverrideSelect.tsx` (component, request-response)

**Analog:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx` (client component pattern)

Bu dosya yeni bir client component. Mevcut `ClusterDeleteButton.tsx` veya `MoveKeywordDialog.tsx` gibi client action caller pattern'i izler.

**'use client' directive pattern:**
```typescript
'use client'
// Client component — revenue override dropdown
// shadcn Select veya native <select> — proje geneli shadcn tercih eder
```

**Server action çağırma pattern** (actions.ts'deki herhangi bir action'dan):
```typescript
// actions.ts server action'ı import edilerek çağrılır
// revalidatePath actions.ts içinde yapılır — client optimistic update gereksiz
import { updateClusterRevenue } from './actions'

// onChange handler:
async function handleChange(newValue: string) {
  await updateClusterRevenue(clusterId, newValue, projectId)
  // revalidatePath actions.ts içinde çalışır, sayfa güncellenir
}
```

**Whitelist validation pattern** (actions.ts'deki UUID regex analogu):
```typescript
// actions.ts satır 196-199:
if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) {
  return { success: false, error: 'Geçersiz proje ID.' }
}
// Revenue için: sadece 'bilgi' | 'mixed' | 'ticari' kabul et
const VALID_REVENUE_TYPES = ['bilgi', 'mixed', 'ticari'] as const
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` (service, CRUD) — modifikasyon

**Analog:** Kendisi (mevcut dosya modifiye edilir)

**Yeni action ekleme pattern** (mevcut action yapısından — satır 109-137):
```typescript
// Her action: Result type → auth check → ownership check → DB op → revalidatePath
export type DeleteClusterResult = { success: true } | { success: false; error: string }

export async function deleteCluster(
  projectId: string,
  clusterId: string
): Promise<DeleteClusterResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // ... ownership check + DB op ...

  revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
  return { success: true }
}
```

**updateClusterRevenue için eklenecek whitelist pattern:**
```typescript
const VALID_REVENUE_TYPES = ['bilgi', 'mixed', 'ticari'] as const
type RevenueType = typeof VALID_REVENUE_TYPES[number]

// Input validation:
if (!VALID_REVENUE_TYPES.includes(revenueType as RevenueType)) {
  return { success: false, error: 'Geçersiz gelir tipi.' }
}
```

**recalculateClusterNicheScore helper inject etme noktaları:**

- `deleteKeyword` (satır 141-183): keyword silindikten sonra, `revalidatePath` çağrısından önce
- `moveKeywordToCluster` (satır 292-348): keyword taşındıktan sonra, hem eski hem yeni cluster için
- `clusterAndScoreKeywords` (satır 192-288): her cluster için batch hesaplama; normalizasyon bağlamı tüm cluster'lar üzerinden oluşturulmalı

**Ownership + user_id filtresi pattern** (satır 307-315):
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

**Supabase UPDATE pattern** (satır 267-274 — Promise.all ile toplu UPDATE):
```typescript
await Promise.all(
  updates.map((u) =>
    supabase
      .from('keywords')
      .update({ cluster_id: u.cluster_id, opportunity_score: u.opportunity_score })
      .eq('id', u.id)
      .eq('user_id', user.id)
  )
)
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx` (component, request-response) — modifikasyon

**Analog:** Kendisi (mevcut dosya modifiye edilir)

**ClusterData tipi genişletme** (mevcut tip satır 16-22):
```typescript
// MEVCUT:
type ClusterData = {
  id: string
  cluster_name: string
  intent: string | null
  primary_keyword_id: string | null
  keywords: ClusterKeyword[]
}
// EKLENECEKler:
//   opportunity_score: number | null
//   revenue_type: string | null
```

**ScoreBadge — değiştirilmeden kullanılır** (satır 43-48):
```typescript
function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-sm text-muted-foreground">—</span>
  if (score >= 70) return <Badge className="bg-violet-500/20 text-violet-400 text-xs border-0">{score.toFixed(1)}</Badge>
  if (score >= 40) return <Badge className="bg-amber-500/20 text-amber-400 text-xs border-0">{score.toFixed(1)}</Badge>
  return <Badge className="bg-secondary text-muted-foreground text-xs border-0">{score.toFixed(1)}</Badge>
}
```

**Cluster header layout genişletme** (satır 75-85):
```typescript
// MEVCUT cluster header:
<div className="group flex items-center justify-between bg-secondary/40 px-3 py-3">
  <div className="flex items-center gap-2 min-w-0">
    <span className="text-sm font-semibold truncate">{cluster.cluster_name}</span>
    <IntentBadge intent={cluster.intent} />
  </div>
  <ClusterDeleteButton ... />
</div>

// PHASE 17 sonrası (RevenueBadge + ScoreBadge cluster header'a eklenir):
// [ cluster_name + IntentBadge ] ... [ RevenueOverrideSelect w-28 ] [ ScoreBadge w-24 ] [ ClusterDeleteButton ]
```

**Sıralama butonu pattern** — sütun başlığına tıklanınca URL searchParams güncellenir:
```typescript
// page.tsx'deki searchParams pattern'ini izle
// ClusterPanel'de client-side sort YAPILMAZ — SSR + URL-driven (anti-pattern)
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` (controller, request-response) — modifikasyon

**Analog:** Kendisi (mevcut dosya modifiye edilir)

**searchParams pattern** (satır 54-63):
```typescript
export default async function KeywordStratejisiPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string }>  // 'sort' ve 'dir' EKLENECEK
}) {
  const { id } = await params
  const { view } = await searchParams  // sort, dir de buraya eklenir
```

**Cluster SELECT sorgusu güncelleme** (satır 89-94):
```typescript
// MEVCUT (eksik):
const { data: clustersRaw } = await supabase
  .from('keyword_clusters')
  .select('id, cluster_name, intent, primary_keyword_id')  // opportunity_score, revenue_type YOK
  .eq('project_id', id)
  .eq('user_id', user.id)
  .order('total_volume', { ascending: false, nullsFirst: false })

// GÜNCELLENECEK:
// SELECT'e 'opportunity_score, revenue_type' eklenir
// .order() dinamik hale getirilir: sort=niche_score → ORDER BY opportunity_score
```

**ORDER BY dinamik pattern** (RESEARCH.md Pattern 4'ten):
```typescript
const sortColumn = sort === 'niche_score' ? 'opportunity_score' : 'total_volume'
const ascending = dir === 'asc'
.order(sortColumn, { ascending, nullsFirst: false })
```

**ClusterWithKeywords tip genişletme** (satır 46-52):
```typescript
// MEVCUT:
type ClusterWithKeywords = {
  id: string
  cluster_name: string
  intent: string | null
  primary_keyword_id: string | null
  keywords: KeywordRow[]
}
// EKLENECEKler:
//   opportunity_score: number | null
//   revenue_type: string | null
```

---

## Shared Patterns

### Authentication / Ownership Check
**Kaynak:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` (satır 199-209)
**Uygulanacak:** `updateClusterRevenue` ve `recalculateClusterNicheScore` helper dahil tüm yeni action'lar

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

### revalidatePath Pattern
**Kaynak:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` (satır 105, 135, 182, 286, 346)
**Uygulanacak:** Her DB mutasyonundan sonra

```typescript
revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
```

### Badge Renk Kodlama (variant prop yok)
**Kaynak:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/IntentBadge.tsx` (satır 20-25)
**Uygulanacak:** `RevenueBadge.tsx`

```typescript
// variant prop kullanılmaz — STATE.md karar notu
return (
  <Badge className={`${config.className} text-xs border-0`}>
    {config.label}
  </Badge>
)
```

### ScoreBadge (null → dash)
**Kaynak:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx` (satır 43-48)
**Uygulanacak:** Cluster header'daki niche skor gösterimi

```typescript
function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-sm text-muted-foreground">—</span>
  // ...
}
```

Skoru henüz hesaplanmamış cluster'larda `null` → `—` gösterilir (skeleton değil, dash). Bu ClusterPanel.tsx'deki mevcut keyword satırı pattern'i ile tutarlıdır.

### UUID Validation Pattern
**Kaynak:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` (satır 196-199)
**Uygulanacak:** `updateClusterRevenue` ve recalculate action'ları

```typescript
const uuidRegex = /^[0-9a-f-]{36}$/i
if (!uuidRegex.test(clusterId)) {
  return { success: false, error: 'Geçersiz ID formatı.' }
}
```

---

## No Analog Found

Bu fazda tüm dosyalar için codebase'de yakın analog bulundu. Analog eksikliği yok.

| Dosya | Rol | Veri Akışı | Durum |
|-------|-----|------------|-------|
| — | — | — | Tüm dosyalar eşleşti |

---

## Metadata

**Analog arama kapsamı:**
- `src/lib/keywords/` — scoring.ts, scoring.test.ts, clustering.test.ts
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/` — actions.ts, ClusterPanel.tsx, IntentBadge.tsx, page.tsx

**Taranan dosya sayısı:** 7
**Pattern extraction tarihi:** 2026-05-07
