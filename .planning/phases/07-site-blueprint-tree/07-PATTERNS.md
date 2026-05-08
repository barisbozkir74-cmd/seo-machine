# Phase 7: Site Blueprint & Tree — Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 8 (3 new actions, 2 new client components, 2 page edits, 1 SSR query)
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `site-blueprint/actions.ts` — `generatePagesFromClusters` | server-action | CRUD batch insert | `keyword-stratejisi/actions.ts` → `clusterAndScoreKeywords` | exact |
| `site-blueprint/actions.ts` — `reorderPage` | server-action | CRUD swap | `site-blueprint/actions.ts` → `deletePage` (ownership pattern) | role-match |
| `GeneratePagesDialog.tsx` | client-component | request-response | `site-blueprint/AddPageModal.tsx` + `keyword-stratejisi/MoveKeywordDialog.tsx` | exact composite |
| `GenerateFromClustersButton.tsx` | client-component | request-response | `keyword-stratejisi/ClusterButton.tsx` | exact |
| `site-blueprint/page.tsx` — tab switcher | page-edit | request-response | `keyword-stratejisi/page.tsx` → `searchParams` + `ViewToggle.tsx` | exact |
| `site-blueprint/page.tsx` — Keyword Eşleme tab | page-edit | CRUD read | `keyword-stratejisi/page.tsx` düz tablo bölümü | role-match |
| `site-blueprint/page.tsx` — reorder arrows | page-edit | request-response | `site-blueprint/page.tsx` mevcut delete form pattern | role-match |
| Conflict detection SSR query | SSR query | CRUD read | `keyword-stratejisi/page.tsx` Supabase sorgu bloğu | role-match |

---

## Pattern Assignments

### `generatePagesFromClusters` Server Action — `site-blueprint/actions.ts`

**Analog:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` — `clusterAndScoreKeywords` (satır 192–288)

**Imports pattern** (satır 1–9):
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
```

**UUID guard pattern** (satır 195–197):
```typescript
if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) {
  return { success: false, error: 'Geçersiz proje ID.' }
}
```

**Auth + ownership pattern** (satır 199–209):
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

**Toplu insert pattern** (satır 238–283):
```typescript
// Batch döngüsü: her küme için UPSERT + bağımlı UPDATE
for (const cluster of clusters) {
  const { data: clusterRow, error: clusterErr } = await supabase
    .from('keyword_clusters')
    .upsert({ ... }, { onConflict: 'project_id,cluster_name', ignoreDuplicates: false })
    .select('id')
    .single()
  if (clusterErr || !clusterRow) continue

  // Toplu UPDATE — Promise.all ile
  await Promise.all(
    updates.map((u) =>
      supabase.from('keywords').update({ ... }).eq('id', u.id).eq('user_id', user.id)
    )
  )
}
```

**`generatePagesFromClusters` için adaptation notları:**
- `keyword_clusters` tablosunu oku (`cluster_id, cluster_name, intent, primary_keyword_id`)
- Duplicate check: `pages` tablosunda `cluster_id IN (clusterIds) AND project_id = ?` sorgusu
- `pages` tablosuna batch INSERT (onConflict: skip — `ignoreDuplicates: true`)
- slug utility function içinde tanımla (D-06 kuralları: lowercase, tr char, max 60, `-2` suffix)
- `revalidatePath('/projeler/${projectId}/site-blueprint')`
- Return type: `{ success: true; created: number; skipped: number } | { success: false; error: string }`

---

### `reorderPage` Server Action — `site-blueprint/actions.ts`

**Analog:** `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts` — `deletePage` + `verifyProjectOwnership` (satır 25–106)

**Ownership helper pattern** (satır 25–39):
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

**`reorderPage` için adaptation notları:**
```typescript
export async function reorderPage(
  pageId: string,
  direction: 'up' | 'down',
  projectId: string
): Promise<ActionResult> {
  // 1. Auth + verifyProjectOwnership (mevcut helper'ı kullan)
  // 2. Hedef sayfayı çek: parent_id + sort_order
  // 3. Kardeş sayfaları çek: .eq('parent_id', page.parent_id).order('sort_order')
  // 4. Bitişik kardeşi bul (direction'a göre)
  // 5. sort_order değerlerini swap et (iki ayrı UPDATE veya Promise.all)
  // 6. revalidatePath
}
```
Swap mantığı: `direction === 'up'` → mevcut index-1'deki kardeş; `direction === 'down'` → index+1'deki kardeş. Kenar durumlar: ilk/son satırda buton `disabled`.

---

### `GeneratePagesDialog.tsx` Client Component — Yeni

**Primary analog:** `src/app/(dashboard)/projeler/[id]/site-blueprint/AddPageModal.tsx` (tam dosya)
**Secondary analog:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/MoveKeywordDialog.tsx` (tam dosya)

**Dialog shell pattern** — AddPageModal satır 90–97:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// Dialog open/close state
const [open, setOpen] = useState(false)
const [isPending, startTransition] = useTransition()
const [error, setError] = useState<string | null>(null)
```

**DialogTrigger render prop pattern** — AddPageModal satır 91–93 ve MoveKeywordDialog satır 71–77:
```tsx
// AddPageModal pattern (Button olarak):
<DialogTrigger render={<Button variant="outline" size="sm" />}>
  + Sayfa Ekle
</DialogTrigger>

// MoveKeywordDialog pattern (bare button olarak):
<DialogTrigger
  render={
    <button className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
      Taşı →
    </button>
  }
/>
```

**CRITICAL:** `asChild` prop kullanılmaz. `render={}` prop pattern zorunludur (base-ui convention).

**Select dropdown pattern** — AddPageModal satır 143–157:
```tsx
<select
  id="page_type"
  name="page_type"
  value={form.page_type}
  onChange={handleChange}
  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
>
  <option value="hizmet">Hizmet Sayfası</option>
  <option value="blog">Blog Yazısı</option>
  {/* ... */}
</select>
```

**startTransition async pattern** — AddPageModal satır 70–87:
```tsx
startTransition(async () => {
  const result = await generatePagesFromClusters(projectId, confirmedRows)
  if (!result.success) {
    setError(result.error)
    return
  }
  setOpen(false)
})
```

**Inline hata pattern** — MoveKeywordDialog satır 109:
```tsx
{error && <p className="text-sm text-destructive">{error}</p>}
```

**`GeneratePagesDialog` için adaptation notları:**
- Preview table: cluster row başına `{ clusterId, pageName (editable), pageType (select), focusKeyword, include (checkbox), alreadyExists (boolean) }` state dizisi
- `alreadyExists=true` olan satırlar: amber "Zaten var" badge + checkbox pre-checked `false`
- "Oluştur" button: yalnızca `include=true` olan satırları `generatePagesFromClusters`'a gönderir
- `INTENT_TO_PAGE_TYPE` map burada tanımlanır (D-02 kuralları): `transactional|commercial → hizmet`, `informational|unknown → blog`, `navigational → ana-sayfa`
- `PAGE_TYPE_LABELS` sayfalar/page.tsx'ten kopyalanır (yeniden import edilmez, yerel tanım)

---

### `GenerateFromClustersButton.tsx` Client Component — Yeni

**Analog:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterButton.tsx` (tam dosya)

**useTransition + loading spinner pattern** (satır 7–57):
```tsx
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'

export function GenerateFromClustersButton({
  projectId,
  hasEnrichedClusters,
}: {
  projectId: string
  hasEnrichedClusters: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // NOT: Bu buton dialog açar, doğrudan action çağırmaz.
  // hasEnrichedClusters=false → disabled + tooltip
}
```

**Loading spinner pattern** — ClusterButton satır 36–46:
```tsx
{isPending ? (
  <span className="flex items-center gap-2">
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    Oluşturuluyor...
  </span>
) : (
  'Kümelerden Oluştur'
)}
```

**Disabled + tooltip pattern:**
```tsx
<Button
  onClick={() => setDialogOpen(true)}
  disabled={!hasEnrichedClusters || isPending}
  title={!hasEnrichedClusters ? 'Önce keyword kümeleme yapın' : undefined}
  className={`h-9 ${isPending ? 'opacity-50' : ''}`}
>
```

**`GenerateFromClustersButton` için adaptation notları:**
- Bu component `GeneratePagesDialog`'u render eder (dialog state burada)
- `hasEnrichedClusters` prop: `page.tsx`'te `clusters.length > 0` ile hesaplanır, SSR'da geçirilir
- Hata mesajı: `{error && <p className="text-sm text-destructive">{error}</p>}`

---

### Tab switcher — `site-blueprint/page.tsx` düzenlemesi

**Analog:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ViewToggle.tsx` (tam dosya) + `keyword-stratejisi/page.tsx` satır 54–63

**searchParams routing pattern** — keyword-stratejisi/page.tsx satır 54–63:
```tsx
export default async function SiteBlueprintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams
  const isMappingTab = tab === 'mapping'
  // tab==='tree' veya undefined → ağaç görünümü (default)
```

**Tab bar UI pattern** — ViewToggle.tsx satır 15–41:
```tsx
// Client component olarak ViewToggle benzeri TabSwitcher oluştur
// veya doğrudan page.tsx'te Link tabanlı statik tab bar:
<div className="flex rounded-md border border-border overflow-hidden">
  <Link
    href={`/projeler/${id}/site-blueprint?tab=tree`}
    className={`px-3 h-8 text-xs flex items-center rounded-none border-r border-border ${
      !isMappingTab ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
    }`}
  >
    Ağaç Görünümü
  </Link>
  <Link
    href={`/projeler/${id}/site-blueprint?tab=mapping`}
    className={`px-3 h-8 text-xs flex items-center rounded-none ${
      isMappingTab ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
    }`}
  >
    Keyword Eşleme
  </Link>
</div>
```

**NOT:** Tab switcher için `useRouter` + Client Component yerine SSR-friendly `Link` tabanlı statik tab bar tercih edilebilir. Eğer `useRouter` gerekiyorsa ViewToggle.tsx'ten kopyala.

---

### Keyword Eşleme tab — `site-blueprint/page.tsx` yeni section

**Analog:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` düz tablo bölümü (satır 78+) ve `sayfalar/page.tsx` PAGE_TYPE_LABELS

**SSR sorgu pattern** — keyword-stratejisi/page.tsx satır 78–90:
```tsx
// Eşleşen keywords sorgusu — pages + keywords JOIN
const { data: mappedPages } = await supabase
  .from('pages')
  .select(`
    id, title,
    focus_keyword:keywords!focus_keyword_id(keyword),
    cluster:keyword_clusters!cluster_id(
      id, cluster_name, intent,
      keywords(keyword)
    )
  `)
  .eq('project_id', id)
  .eq('user_id', user.id)
  .not('cluster_id', 'is', null)

// Eşleşmeyenler sorgusu — cluster_id=null keywords
const { data: unmappedKeywords } = await supabase
  .from('keywords')
  .select('id, keyword, search_intent')
  .eq('project_id', id)
  .eq('user_id', user.id)
  .is('cluster_id', null)
```

**Amber warning banner pattern** — keyword-stratejisi/page.tsx enrichment banner:
```tsx
{unmappedKeywords && unmappedKeywords.length > 0 && (
  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
    {unmappedKeywords.length} keyword henüz bir sayfaya bağlı değil.
  </div>
)}
```

**IntentBadge reuse** — `keyword-stratejisi/IntentBadge.tsx` import edilir:
```tsx
import { IntentBadge } from '../keyword-stratejisi/IntentBadge'
```

**Conflict detection SSR query:**
```tsx
// Aynı keyword text'i birden fazla sayfada bulan sorgu
// pages → cluster → keywords JOIN ile duplicate keyword text tespiti
// Client-side: pages render sırasında conflictPageIds Set ile işaretle
// Red badge: <span className="text-xs text-destructive font-medium">⚠ Çakışma</span>
```

---

### Tree table reorder arrows — `site-blueprint/page.tsx` düzenlemesi

**Analog:** `site-blueprint/page.tsx` mevcut delete form pattern (satır 204–219)

**Mevcut inline server action form pattern** (satır 204–219):
```tsx
<form
  action={async () => {
    'use server'
    await deletePage(id, page.id)
  }}
>
  <Button
    variant="ghost"
    size="sm"
    type="submit"
    className="h-7 px-2 text-muted-foreground hover:text-destructive"
  >
    Sil
  </Button>
</form>
```

**Reorder arrows için adaptation** — aynı inline form pattern, iki buton:
```tsx
{/* ↑ ↓ butonları — her biri ayrı form */}
<div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
  <form action={async () => { 'use server'; await reorderPage(page.id, 'up', id) }}>
    <Button variant="ghost" size="sm" type="submit"
      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
      disabled={/* first sibling */}
    >↑</Button>
  </form>
  <form action={async () => { 'use server'; await reorderPage(page.id, 'down', id) }}>
    <Button variant="ghost" size="sm" type="submit"
      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
      disabled={/* last sibling */}
    >↓</Button>
  </form>
</div>
```

**NOT:** `group` className mevcut `flattenTree` row `div`'ine eklenmeli: `className="... hover:bg-muted/30 group ..."`.
İlk/son sibling tespiti: `flattenTree` çıktısında `page.parent_id` aynı olan satırlar arasındaki index'e göre `disabled` prop'u hesaplanır.

---

## Shared Patterns

### ActionResult tip tanımı
**Kaynak:** `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts` satır 6
```typescript
export type ActionResult = { success: true } | { success: false; error: string }
```
**Uygula:** `generatePagesFromClusters` ve `reorderPage` bu tipi extend eder veya doğrudan kullanır.

### UUID validation guard
**Kaynak:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` satır 195–197
```typescript
if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) {
  return { success: false, error: 'Geçersiz proje ID.' }
}
```
**Uygula:** `generatePagesFromClusters`, `reorderPage` — tüm string parametreler için.

### verifyProjectOwnership helper
**Kaynak:** `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts` satır 25–39
**Uygula:** Her iki yeni action — dosyada zaten mevcut, yeniden tanımlanmaz.

### Badge className doğrudan renk ataması (variant prop yok)
**Kaynak:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/IntentBadge.tsx` satır 1–4
```typescript
// variant prop kullanılmaz — className ile doğrudan
const intentConfig = {
  commercial: { className: 'bg-blue-500/20 text-blue-400', label: 'Commercial' },
  // ...
}
```
**Uygula:** `GeneratePagesDialog` içindeki tüm badge'ler (amber "Zaten var", red "Çakışma", intent badge).

### Dialog open/close state + reset pattern
**Kaynak:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/MoveKeywordDialog.tsx` satır 43–49
```typescript
const handleOpenChange = (nextOpen: boolean) => {
  if (!nextOpen) {
    setSelectedClusterId(null)
    setError(null)
  }
  setOpen(nextOpen)
}
```
**Uygula:** `GeneratePagesDialog` — dialog kapandığında form state'i sıfırla.

### group-hover opacity reveal
**Kaynak:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/MoveKeywordDialog.tsx` satır 73–77
```typescript
className="... opacity-0 group-hover:opacity-100 transition-opacity ..."
// Parent div'e: className="... group ..."
```
**Uygula:** Tree table reorder arrows + tree table row `group` className.

### PAGE_TYPE_LABELS map
**Kaynak:** `src/app/(dashboard)/projeler/[id]/sayfalar/page.tsx` satır 17–28
```typescript
const PAGE_TYPE_LABELS: Record<string, string> = {
  'ana-sayfa': 'Ana Sayfa',
  kategori: 'Kategori Sayfası',
  hizmet: 'Hizmet Sayfası',
  urun: 'Ürün Sayfası',
  blog: 'Blog Yazısı',
  landing: 'Landing Page',
  hakkimizda: 'Hakkımızda',
  iletisim: 'İletişim',
  sss: 'SSS Sayfası',
  fiyatlandirma: 'Fiyatlandırma',
}
```
**Uygula:** `GeneratePagesDialog` select dropdown label'ları için yerel kopyası tanımlanır. `sayfalar/page.tsx` import edilmez (farklı route).

---

## No Analog Found

Tüm dosyalar için kuvvetli analog bulundu. Aşağıdaki mantık parçaları için CONTEXT.md D-06 kararları birincil referanstır:

| Parça | Açıklama |
|---|---|
| `slugify()` yardımcı fonksiyonu | Proje genelinde mevcut değil; `site-blueprint/actions.ts` içine yerel tanımlanır |
| Conflict detection cross-join sorgusu | Proje genelinde benzeri yok; SSR'da client-side `Map` ile duplike tespiti yapılır |

---

## Metadata

**Analog arama kapsamı:** `src/app/(dashboard)/projeler/[id]/` tüm alt dizinler
**Dosyalar okundu:** 11
**Pattern extraction tarihi:** 2026-04-24
