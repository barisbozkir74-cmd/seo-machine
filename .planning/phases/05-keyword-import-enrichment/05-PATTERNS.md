# Phase 5: Keyword Import & Enrichment - Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 7 (4 modify + 2 new + 1 keep-as-is)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` | page (Server Component) | CRUD read | kendisi (mevcut, genişletilecek) | exact |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` | server action | CRUD + request-response | `src/app/(dashboard)/projeler/[id]/rakipler/actions.ts` | exact |
| `src/lib/dataforseo/client.ts` | service | request-response | kendisi (mevcut, yeni fonksiyon eklenecek) | exact |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordDeleteButton.tsx` | client component | request-response | `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterDeleteButton.tsx` | exact |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/IntentBadge.tsx` | utility component | transform | `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` (kdColor helper) | role-match |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterBadge.tsx` | utility component | transform | yukarıdaki IntentBadge ile aynı pattern | role-match |
| `src/lib/keywords/parser.ts` | utility | transform | değişmez — kapsam dışı | — |
| `src/lib/keywords/clustering.ts` | utility | transform | değişmez — kapsam dışı | — |

---

## Pattern Assignments

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` (Server Component, CRUD read)

**Analog:** kendisi — mevcut dosya genişletilecek.

**Import pattern** (lines 1-15):
```typescript
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { KeywordImport } from './KeywordImport'
import { ProjectNav } from '../ProjectNav'
// Yeni eklenecekler:
import { KeywordDeleteButton } from './KeywordDeleteButton'
import { IntentBadge } from './IntentBadge'
```

**Auth + ownership pattern** (lines 50-60):
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

**Düz tablo sorgusu — mevcut cluster-grouped sorgu YERINE geçecek:**
```typescript
// Mevcut cluster grouping kaldırılır. Yeni: tek düz sorgu, volume azalan sıra (D-13).
const { data: keywordsRaw } = await supabase
  .from('keywords')
  .select('id, keyword, volume, cpc, difficulty, search_intent, enriched_at, cluster_id')
  .eq('project_id', id)
  .eq('user_id', user.id)
  .order('volume', { ascending: false, nullsFirst: false })

// Cluster adları için ayrı sorgu (badge gösterimi):
const { data: clustersRaw } = await supabase
  .from('keyword_clusters')
  .select('id, cluster_name')
  .eq('project_id', id)
  .eq('user_id', user.id)

const clusterMap: Record<string, string> = {}
for (const c of clustersRaw ?? []) {
  clusterMap[c.id] = c.cluster_name
}
```

**Tablo layout pattern** — mevcut `bg-secondary/40` başlık satırı korunur (line 169):
```tsx
<div className="rounded-md border border-border overflow-hidden">
  <Table>
    <TableHeader>
      <TableRow className="bg-secondary/40">
        <TableHead className="text-xs w-10">{/* × sütunu — boş */}</TableHead>
        <TableHead className="text-xs">Keyword</TableHead>
        <TableHead className="text-xs text-right w-20">Volume</TableHead>
        <TableHead className="text-xs text-right w-18">CPC</TableHead>
        <TableHead className="text-xs text-right w-16">KD</TableHead>
        <TableHead className="text-xs w-28">Küme</TableHead>
        <TableHead className="text-xs w-28">Intent</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {keywords.map((kw) => (
        <TableRow key={kw.id} className="group">
          <TableCell className="w-10">
            <KeywordDeleteButton projectId={id} keywordId={kw.id} />
          </TableCell>
          <TableCell className={`text-sm ${!kw.enriched_at ? 'opacity-50' : ''}`}>
            {kw.keyword}
          </TableCell>
          {/* ... diğer sütunlar */}
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

**Boş durum pattern** — mevcut satır 141-143 pattern:
```tsx
{keywords.length === 0 && (
  <p className="text-sm text-muted-foreground py-8 text-center">
    Henüz keyword eklenmemiş. Yukarıdan keyword listeni içe aktar.
  </p>
)}
```

**kdColor helper** (lines 17-21) — korunur, KD sütununda kullanılmaya devam eder:
```typescript
function kdColor(kd: number): { dot: string; label: string } {
  if (kd < 30) return { dot: 'bg-emerald-400', label: 'Kolay' }
  if (kd <= 60) return { dot: 'bg-amber-400', label: 'Orta' }
  return { dot: 'bg-red-400', label: 'Zor' }
}
```

**formatVolume helper** (lines 23-27) — korunur:
```typescript
function formatVolume(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (v >= 1000) return (v / 1000).toFixed(1).replace('.0', '') + 'K'
  return v.toString()
}
```

**TypeRow tipi — genişletilecek:**
```typescript
// Mevcut KeywordRow (line 29-34) yerine:
type KeywordRow = {
  id: string
  keyword: string
  volume: number | null
  cpc: number | null           // YENİ
  difficulty: number | null
  search_intent: string | null // YENİ
  enriched_at: string | null   // YENİ
  cluster_id: string | null
}
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` (Server Action, CRUD + request-response)

**Analog:** `src/app/(dashboard)/projeler/[id]/rakipler/actions.ts`

**Import pattern** (rakipler/actions.ts lines 1-9):
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getDataForSeoCredentials } from '@/lib/supabase/vault'
import { fetchKeywordData } from '@/lib/dataforseo/client'  // YENİ — bu fazda eklenecek
import { parseKeywordText } from '@/lib/keywords/parser'
import { clusterKeywords } from '@/lib/keywords/clustering'
```

**Auth + ownership pattern** — mevcut actions.ts lines 19-29 korunur, aynı yapı:
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

**importKeywords genişletme — enrichment akışı eklenir** (mevcut lines 12-73 üzerine):
```typescript
// Mevcut DB insert tamamlandıktan SONRA enrichment başlatılır (D-05)
// Enrichment: DataForSEO'dan volume/CPC/KD/intent çek, keywords tablosunu güncelle
try {
  const credentials = await getDataForSeoCredentials()
  const keywords = parsed.map((p) => p.keyword)
  const enriched = await fetchKeywordData(keywords, credentials)

  // Toplu update — enriched_at ile işaretle (D-07)
  for (const item of enriched) {
    await supabase
      .from('keywords')
      .update({
        volume: item.search_volume ?? undefined,      // D-06: DataForSEO değeri kazanır
        cpc: item.cpc ?? undefined,
        difficulty: item.keyword_difficulty ?? undefined,
        search_intent: item.search_intent ?? undefined,
        enriched_at: new Date().toISOString(),
      })
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .eq('keyword', item.keyword)
  }
} catch (err) {
  // Enrichment başarısız — import başarılı sayılır, satırlar enriched_at=null kalır
  // Kullanıcı DataForSEO kota mesajı görmez (sessiz fail) — satırlar opacity-50 kalır
  console.error('[importKeywords] enrichment failed:', err)
}

revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
return {
  success: true,
  clusterCount: clusters.length,
  keywordCount: parsed.length,
}
```

**deleteKeyword Server Action — YENİ:**
```typescript
// Analog: rakipler/actions.ts deleteCompetitor (lines 263-288)
export type DeleteKeywordResult = { success: true } | { success: false; error: string }

export async function deleteKeyword(
  keywordId: string,
  projectId: string
): Promise<DeleteKeywordResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Ownership: keyword'ün bu projeye ve bu user'a ait olduğunu doğrula
  const { data: kw } = await supabase
    .from('keywords')
    .select('id, cluster_id')
    .eq('id', keywordId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!kw) return { success: false, error: 'Keyword bulunamadı.' }

  const { error } = await supabase
    .from('keywords')
    .delete()
    .eq('id', keywordId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Keyword silinemedi.' }

  // Kümedeki son keyword ise kümeyi de sil (D-12 interaction contract)
  if (kw.cluster_id) {
    const { count } = await supabase
      .from('keywords')
      .select('id', { count: 'exact', head: true })
      .eq('cluster_id', kw.cluster_id)
    if ((count ?? 0) === 0) {
      await supabase
        .from('keyword_clusters')
        .delete()
        .eq('id', kw.cluster_id)
        .eq('user_id', user.id)
    }
  }

  revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
  return { success: true }
}
```

**Error handling pattern** — rakipler/actions.ts lines 109-117 (try/catch + message extract):
```typescript
try {
  const credentials = await getDataForSeoCredentials()
  // ... DataForSEO çağrısı
} catch (err) {
  const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
  return { success: false, error: `İçe aktarma başarısız: ${message}` }
}
```

---

### `src/lib/dataforseo/client.ts` — `fetchKeywordData` fonksiyonu eklenir

**Analog:** kendisi — mevcut `fetchRankedKeywords` fonksiyonu (lines 119-150) aynı pattern:

**Import / header — zaten mevcut:**
```typescript
import 'server-only'
// authHeader pattern (line 125):
const authHeader = `Basic ${Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64')}`
```

**Yeni fonksiyon — fetchKeywordData** (fetchRankedKeywords analog):
```typescript
export type KeywordDataItem = {
  keyword: string
  search_volume: number | null
  cpc: number | null
  keyword_difficulty: number | null
  search_intent: string | null  // 'commercial' | 'informational' | 'navigational' | 'transactional'
}

export async function fetchKeywordData(
  keywords: string[],
  credentials: { login: string; password: string },
  location: { locationCode: number; languageCode: string } = { locationCode: 2792, languageCode: 'tr' }
): Promise<KeywordDataItem[]> {
  // Analog: fetchRankedKeywords auth pattern (line 125)
  const authHeader = `Basic ${Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64')}`

  // D-08: keywords_data/google/search_volume/live — toplu çağrı
  const response = await fetch(
    'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
    {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        {
          keywords,
          location_code: location.locationCode,
          language_code: location.languageCode,
        },
      ]),
    }
  )

  // Analog: fetchRankedKeywords error pattern (line 146)
  if (!response.ok) throw new Error(`DataForSEO Keyword Data API hatası: ${response.status}`)

  const data = await response.json()
  // Analog: task/result yapısı (line 148)
  const items = data.tasks?.[0]?.result ?? []

  return items.map((item: Record<string, unknown>) => ({
    keyword: item.keyword as string,
    search_volume: (item.search_volume as number) ?? null,
    cpc: (item.cpc as number) ?? null,
    keyword_difficulty: (item.keyword_difficulty as number) ?? null,
    search_intent: (item.search_intent as string) ?? null,
  }))
}
```

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordDeleteButton.tsx` (Client Component)

**Analog:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterDeleteButton.tsx` — EXACT MATCH.

ClusterDeleteButton `useTransition` + ghost Button pattern kullanır; KeywordDeleteButton da aynı yapıyı kullanır ancak:
- AlertDialog yok (D-12: onay dialogu overkill)
- × ikonu gösterir, `opacity-0 group-hover:opacity-100` ile görünür
- Destructive hover rengi

**Import pattern** (ClusterDeleteButton.tsx lines 1-5):
```typescript
'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { deleteKeyword } from './actions'
```

**Core pattern** (ClusterDeleteButton.tsx lines 7-34, sadeleştirilecek):
```typescript
export function KeywordDeleteButton({
  projectId,
  keywordId,
}: {
  projectId: string
  keywordId: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      title="Keyword'ü sil"
      disabled={isPending}
      // UI-SPEC: opacity-0 group-hover:opacity-100, destructive hover
      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      onClick={() => {
        startTransition(async () => {
          await deleteKeyword(keywordId, projectId)
        })
      }}
    >
      {isPending ? (
        <span className="animate-spin text-xs">⟳</span>
      ) : (
        '×'
      )}
    </Button>
  )
}
```

**NOT:** ClusterDeleteButton `confirm()` kullanıyor (line 24) — KeywordDeleteButton KULLANMAZ. D-12 kararı gereği onay yok.

---

### `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/IntentBadge.tsx` (Utility Component)

**Analog:** `page.tsx` içindeki `kdColor` helper (lines 17-21) — aynı string → className mapping pattern.

**Core pattern** — kdColor analog:
```typescript
// Analog: kdColor helper (page.tsx line 17)
// kdColor: number → { dot, label }
// IntentBadge: string → className

import { Badge } from '@/components/ui/badge'

// D-11 + UI-SPEC renk atamaları
const intentConfig: Record<string, { className: string; label: string }> = {
  commercial:     { className: 'bg-blue-500/20 text-blue-400',    label: 'Commercial' },
  informational:  { className: 'bg-emerald-500/20 text-emerald-400', label: 'Informational' },
  navigational:   { className: 'bg-gray-500/20 text-gray-400',   label: 'Navigational' },
  transactional:  { className: 'bg-orange-500/20 text-orange-400', label: 'Transactional' },
}

export function IntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return <span className="text-sm text-muted-foreground">—</span>

  // Intent normalizasyonu: DataForSEO farklı case döndürebilir (D-08)
  const key = intent.toLowerCase().trim()
  const config = intentConfig[key]

  if (!config) return <span className="text-sm text-muted-foreground">{intent}</span>

  // UI-SPEC: variant prop kullanılmaz — className ile direkt
  return (
    <Badge className={`${config.className} text-xs border-0`}>
      {config.label}
    </Badge>
  )
}
```

---

### `ClusterBadge` — inline veya küçük yardımcı

**Analog:** `IntentBadge` ile aynı yapı; ayrı dosyaya gerek yok, page.tsx içinde inline yazılabilir.

**Inline pattern:**
```tsx
// UI-SPEC: bg-secondary text-muted-foreground text-xs — nötr badge
{clusterMap[kw.cluster_id ?? '']
  ? <Badge className="bg-secondary text-muted-foreground text-xs border-0">
      {clusterMap[kw.cluster_id ?? '']}
    </Badge>
  : <span className="text-sm text-muted-foreground">—</span>
}
```

---

## Shared Patterns

### Auth Guard (Ownership Check)
**Source:** `src/app/(dashboard)/projeler/[id]/rakipler/actions.ts` — `verifyProjectOwnership` helper (lines 19-32)
**Apply to:** `actions.ts` içindeki tüm Server Action'lar
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

### Vault Credentials Okuma
**Source:** `src/lib/supabase/vault.ts` — `getDataForSeoCredentials()` (lines 10-39)
**Apply to:** `actions.ts` enrichment bölümü, `client.ts` yeni fonksiyon çağrısından önce
```typescript
// Env var fallback (line 12-16):
if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
  return { login: process.env.DATAFORSEO_LOGIN, password: process.env.DATAFORSEO_PASSWORD }
}
// Vault okuma (line 19-38)
```

### DataForSEO Auth Header
**Source:** `src/lib/dataforseo/client.ts` — tüm `fetch*` fonksiyonlarında tekrar eden pattern (örn. line 21):
```typescript
const authHeader = `Basic ${Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64')}`
```
**Apply to:** `fetchKeywordData` yeni fonksiyonu

### useTransition Loading State
**Source:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordImport.tsx` (lines 1-42)
**Apply to:** `KeywordDeleteButton.tsx`
```typescript
const [isPending, startTransition] = useTransition()
// ...
startTransition(async () => {
  await serverAction(...)
})
```

### revalidatePath Sayfa Yenileme
**Source:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` (line 71)
**Apply to:** `deleteKeyword` action + `importKeywords` action sonu
```typescript
revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
```

### DataForSEO Error Pattern
**Source:** `src/lib/dataforseo/client.ts` (line 146):
```typescript
if (!response.ok) throw new Error(`DataForSEO [EndpointAdı] API hatası: ${response.status}`)
```
**Apply to:** `fetchKeywordData` yeni fonksiyonu

---

## No Analog Found

Tüm dosyalar için yakın analog bulundu. Kapsam dışı kalan (değişmeyecek) dosyalar:

| File | Reason |
|---|---|
| `src/lib/keywords/parser.ts` | Değişmez — D-01 kararı |
| `src/lib/keywords/clustering.ts` | Değişmez — D-04 kararı |

---

## Metadata

**Analog search scope:** `src/app/(dashboard)/projeler/[id]/`, `src/lib/dataforseo/`, `src/lib/supabase/`, `supabase/migrations/`
**Files scanned:** 8 kaynak dosya okundu
**Pattern extraction date:** 2026-04-24
