# Phase 3: Rules Engine - Pattern Map

**Mapped:** 2026-04-23
**Files analyzed:** 7 (5 new + 2 modified)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/(dashboard)/ayarlar/kurallar/page.tsx` | page (Server Component) | request-response | `src/app/(dashboard)/projeler/page.tsx` | role-match |
| `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx` | page (Server Component) | request-response | `src/app/(dashboard)/projeler/[id]/page.tsx` | exact |
| `src/app/(dashboard)/ayarlar/kurallar/actions.ts` | server action | CRUD | `src/app/(dashboard)/projeler/[id]/actions.ts` | exact |
| `src/app/(dashboard)/projeler/[id]/kurallar/actions.ts` | server action | CRUD | `src/app/(dashboard)/projeler/[id]/actions.ts` | exact |
| `src/components/rules/RuleToggleRow.tsx` | component (Client) | event-driven | `src/app/(dashboard)/projeler/[id]/stage-transition.tsx` | role-match |
| `src/app/(dashboard)/layout.tsx` | layout (modify) | request-response | `src/app/(dashboard)/layout.tsx` | self |
| `src/app/(dashboard)/projeler/[id]/page.tsx` | page (modify) | request-response | `src/app/(dashboard)/projeler/[id]/page.tsx` | self |

---

## Pattern Assignments

### `src/app/(dashboard)/ayarlar/kurallar/page.tsx` (Server Component, request-response)

**Analog:** `src/app/(dashboard)/projeler/page.tsx`

**Imports pattern** (lines 1-14):
```typescript
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
```

**Auth + veri çekimi pattern** (projeler/page.tsx lines 29-37):
```typescript
export default async function KurallarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: rules, error } = await supabase
    .from('rules')
    .select('id, rule_key, rule_value, scope')
    .eq('user_id', user.id)
    .eq('scope', 'global')
    .is('project_id', null)
}
```

**Seed guard pattern** (ilk açılışta boş sayfa önlemi — projeler/page.tsx error branch'inden türetilir):
```typescript
// Kurallar yoksa seedGlobalRules action'ı çağrılır
// (sayfa render'ında, ayrı "Kaydet" butonu yok — D-05 kararı)
if (!rules || rules.length === 0) {
  await seedGlobalRules()
  // ardından redirect veya re-fetch
}
```

**Sayfa başlığı + açıklama pattern** (projeler/page.tsx lines 74-80):
```tsx
<main className="p-8">
  <div className="flex items-center justify-between mb-6">
    <h1 className="text-xl font-semibold">Global SEO Kuralları</h1>
  </div>
  <p className="text-sm text-muted-foreground mt-1">
    Tüm projeler için varsayılan kural seti. Proje bazlı override yapılmayan kurallar bu değerleri kullanır.
  </p>
```

**Tablo header pattern** (projeler/page.tsx lines 94-113):
```tsx
<TableHeader>
  <TableRow>
    <TableHead className="text-xs font-normal uppercase text-muted-foreground">
      Kural
    </TableHead>
    <TableHead className="text-xs font-normal uppercase text-muted-foreground">
      Önerilen
    </TableHead>
    <TableHead className="text-xs font-normal uppercase text-muted-foreground w-16">
      Durum
    </TableHead>
  </TableRow>
</TableHeader>
```

**Kategori bölüm başlığı pattern** (projeler/[id]/page.tsx line 100-102):
```tsx
<p className="text-xs font-normal uppercase text-muted-foreground mb-3">
  SEO Title
</p>
```

**Breadcrumb pattern** (projeler/[id]/page.tsx lines 87-91):
```tsx
<Link
  href="/projeler"
  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
>
  ← Dashboard
</Link>
```

---

### `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx` (Server Component, request-response)

**Analog:** `src/app/(dashboard)/projeler/[id]/page.tsx`

**Imports pattern** (projeler/[id]/page.tsx lines 1-10):
```typescript
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
```

**Auth + ownership guard pattern** (projeler/[id]/page.tsx lines 39-57):
```typescript
export default async function ProjeKurallarPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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
}
```

**Rules veri çekimi (global + proje override birleştirme):**
```typescript
// Global kurallar
const { data: globalRules } = await supabase
  .from('rules')
  .select('rule_key, rule_value')
  .eq('user_id', user.id)
  .eq('scope', 'global')
  .is('project_id', null)

// Proje bazlı override'lar
const { data: projectRules } = await supabase
  .from('rules')
  .select('id, rule_key, rule_value')
  .eq('user_id', user.id)
  .eq('project_id', id)
  .eq('scope', 'project')

// Birleştirme: her rule_key için proje varsa 'project' scope, yoksa 'global' scope
```

**2 sütunlu layout pattern** (projeler/[id]/page.tsx lines 83-97):
```tsx
<div className="flex flex-col h-screen">
  {/* Breadcrumb + başlık */}
  <div className="p-8 pb-4">
    <Link href={`/projeler/${id}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
      ← {project.name}
    </Link>
    <h1 className="text-xl font-semibold">Proje Kuralları</h1>
    <p className="text-sm text-muted-foreground mt-1">
      Bu projeye özel kural override'ları. Override yapılmayan kurallar global ayarları kullanır.
    </p>
  </div>

  {/* 2 sütunlu içerik */}
  <div className="flex flex-1 min-h-0">
    {/* Sol sütun — w-64 shrink-0 border-r */}
    <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
      {/* stage listesi buraya kopyalanır */}
      <Separator className="my-4" />
      <Link href={`/projeler/${id}/kurallar`} className="...">
        Proje Kuralları
      </Link>
    </div>

    {/* Sağ sütun — kural tablosu */}
    <div className="flex-1 min-w-0 overflow-y-auto p-8">
      {/* RuleToggleRow bileşenleri */}
    </div>
  </div>
</div>
```

---

### `src/app/(dashboard)/ayarlar/kurallar/actions.ts` (Server Action, CRUD)

**Analog:** `src/app/(dashboard)/projeler/[id]/actions.ts`

**Dosya başlığı + imports pattern** (actions.ts lines 1-4):
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
```

**Return type pattern** (actions.ts lines 6-8):
```typescript
export type ToggleRuleResult =
  | { success: true }
  | { success: false; error: string }
```

**toggleRule action — auth + ownership guard + UPDATE pattern** (actions.ts lines 10-75 baz alınarak):
```typescript
export async function toggleRule(
  ruleKey: string,
  newValue: boolean
): Promise<ToggleRuleResult> {
  const supabase = await createClient()

  // 1. Authenticate
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' }
  }

  // 2. UPDATE — RLS user_id eşleşmesini zorunlu kılar
  const { error } = await supabase
    .from('rules')
    .update({ rule_value: String(newValue) })
    .eq('rule_key', ruleKey)
    .eq('user_id', user.id)
    .eq('scope', 'global')
    .is('project_id', null)

  if (error) {
    return { success: false, error: 'Kural güncellenemedi. Lütfen tekrar deneyin.' }
  }

  revalidatePath('/ayarlar/kurallar')
  return { success: true }
}
```

**seedGlobalRules action — INSERT pattern** (actions.ts addNote insert'i baz alınarak, lines 117-128):
```typescript
export async function seedGlobalRules(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Mevcut kayıt yoksa INSERT (upsert ile idempotent)
  await supabase.from('rules').upsert(
    GLOBAL_RULES_SEED.map((rule) => ({
      user_id: user.id,
      project_id: null,
      scope: 'global',
      rule_key: rule.rule_key,
      rule_value: rule.defaultValue,
    })),
    { onConflict: 'user_id,rule_key,scope' }
  )

  revalidatePath('/ayarlar/kurallar')
}
```

**Türkçe hata mesajları** (actions.ts pattern — tüm error string'ler Türkçe):
```typescript
// Örnekler:
'Oturum bulunamadı.'
'Kural güncellenemedi. Lütfen tekrar deneyin.'
'Kural bulunamadı.'
```

---

### `src/app/(dashboard)/projeler/[id]/kurallar/actions.ts` (Server Action, CRUD)

**Analog:** `src/app/(dashboard)/projeler/[id]/actions.ts`

**toggleProjectRule — ownership double-check pattern** (actions.ts lines 81-131 baz alınarak):
```typescript
export async function toggleProjectRule(
  projectId: string,
  ruleKey: string,
  newValue: boolean
): Promise<ToggleRuleResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' }
  }

  // Proje ownership kontrolü (advanceStage pattern — stage ownership yerine project)
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) {
    return { success: false, error: 'Proje bulunamadı.' }
  }

  // UPSERT — override varsa güncelle, yoksa ekle
  const { error } = await supabase.from('rules').upsert(
    {
      user_id: user.id,
      project_id: projectId,
      scope: 'project',
      rule_key: ruleKey,
      rule_value: String(newValue),
    },
    { onConflict: 'user_id,project_id,rule_key,scope' }
  )

  if (error) {
    return { success: false, error: 'Kural güncellenemedi. Lütfen tekrar deneyin.' }
  }

  revalidatePath(`/projeler/${projectId}/kurallar`)
  return { success: true }
}
```

**resetProjectRule — DELETE pattern** (actions.ts addNote insert pattern'dan ters olarak):
```typescript
export async function resetProjectRule(
  projectId: string,
  ruleKey: string
): Promise<ToggleRuleResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' }
  }

  const { error } = await supabase
    .from('rules')
    .delete()
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .eq('rule_key', ruleKey)
    .eq('scope', 'project')

  if (error) {
    return { success: false, error: 'Kural sıfırlanamadı. Lütfen tekrar deneyin.' }
  }

  revalidatePath(`/projeler/${projectId}/kurallar`)
  return { success: true }
}
```

---

### `src/components/rules/RuleToggleRow.tsx` (Client Component, event-driven)

**Analog:** `src/app/(dashboard)/projeler/[id]/stage-transition.tsx` (isPending pattern) + `src/app/(dashboard)/projeler/[id]/notes-section.tsx` (hata gösterimi pattern)

**Client Component başlığı + state pattern** (stage-transition.tsx lines 1-29 + notes-section.tsx lines 1-24):
```typescript
'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
```

**isPending ile loading state** (stage-transition.tsx lines 27-45):
```typescript
// RuleToggleRow'da useTransition kullanılır (UI-SPEC D-06):
// toggle disabled + opacity-50 loading durumu
const [isPending, setIsPending] = useState(false)
const [localValue, setLocalValue] = useState(currentValue)

const handleToggle = async (checked: boolean) => {
  setIsPending(true)
  const prev = localValue
  setLocalValue(checked) // optimistic update
  try {
    const result = await toggleAction(checked)
    if (!result.success) {
      setLocalValue(prev) // rollback
      // toast error göster
    }
  } catch {
    setLocalValue(prev)
  } finally {
    setIsPending(false)
  }
}
```

**Props interface pattern** (stage-transition.tsx lines 15-19):
```typescript
interface RuleToggleRowProps {
  ruleKey: string
  label: string
  currentValue: boolean
  recommendedValue: boolean
  scope: 'global' | 'project'
  // Proje sayfasında gerekli:
  projectId?: string
  onReset?: () => void
}
```

**Hata gösterimi pattern** (notes-section.tsx lines 57-58):
```tsx
{error && <p className="text-sm text-destructive">{error}</p>}
```

**Disabled + opacity loading state pattern** (notes-section.tsx line 56):
```tsx
<Switch
  checked={localValue}
  onCheckedChange={handleToggle}
  disabled={isPending}
  className={isPending ? 'opacity-50 cursor-wait' : ''}
/>
```

**Scope badge pattern** (projeler/page.tsx lines 137-143 — className ile direkt, variant prop kullanılmaz):
```tsx
{scope === 'global' ? (
  <Badge className="bg-slate-500/20 text-slate-400 border border-slate-500/30">
    Global
  </Badge>
) : (
  <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30">
    Proje
    <Button
      variant="ghost"
      size="sm"
      title="Global'e döndür"
      onClick={handleReset}
      className="text-blue-400 hover:text-red-400 ml-1 h-auto p-0"
    >
      ✕
    </Button>
  </Badge>
)}
```

**Önerilen değer gösterimi — amber uyarısı pattern** (UI-SPEC color section):
```tsx
<span className={
  currentValue === recommendedValue
    ? 'text-xs text-muted-foreground'
    : 'text-xs text-amber-400'
}>
  Önerilen: {recommendedValue ? 'Açık' : 'Kapalı'}
</span>
```

---

### `src/app/(dashboard)/layout.tsx` (modify — üst nav ekleme)

**Analog:** `src/app/(dashboard)/layout.tsx` (self)

**Mevcut layout** (layout.tsx lines 1-21 — tüm dosya):
```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
```

**Eklenecek üst nav pattern** (projeler/page.tsx header yapısı + projeler/[id]/page.tsx breadcrumb pattern baz alınarak):
```tsx
return (
  <div className="min-h-screen bg-background">
    {/* Üst nav — Dashboard + Projeler + Ayarlar */}
    <nav className="border-b border-border px-8 py-3 flex items-center gap-6">
      <Link
        href="/projeler"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Projeler
      </Link>
      <Link
        href="/ayarlar/kurallar"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Ayarlar
      </Link>
    </nav>
    {children}
  </div>
)
```

**NOT:** Layout'a nav eklenmesi mevcut sayfa başlıklarıyla (p-8) çakışmayacak şekilde yapılmalı. Planner bu konuyu açık bırakabilir veya nav'ı minimal tutabilir.

---

### `src/app/(dashboard)/projeler/[id]/page.tsx` (modify — sol sütun alt kısmı)

**Analog:** `src/app/(dashboard)/projeler/[id]/page.tsx` (self)

**Mevcut sol sütun sonu** (page.tsx lines 99-167):
```tsx
<div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
  <p className="text-xs font-normal uppercase text-muted-foreground mb-3">
    Aşamalar
  </p>
  <ul className="space-y-1">
    {stageList.map((stage) => ( ... ))}
  </ul>
  {/* BURAYA EKLENECEK: */}
</div>
```

**Eklenecek Separator + link pattern** (Separator bileşeni + projeler/[id]/page.tsx breadcrumb link stili):
```tsx
{/* Separator + Proje Kuralları linki — stage listesinin altına */}
<Separator className="my-4" />
<Link
  href={`/projeler/${id}/kurallar`}
  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 py-2 rounded-md hover:bg-secondary"
>
  Proje Kuralları
</Link>
```

---

## Shared Patterns

### Authentication Guard
**Kaynak:** `src/app/(dashboard)/projeler/[id]/actions.ts` (lines 17-20) + `src/app/(dashboard)/projeler/[id]/page.tsx` (lines 43-46)
**Uygulama yeri:** Tüm Server Action dosyaları + Server Component page'ler
```typescript
// Server Action'larda:
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  return { success: false, error: 'Oturum bulunamadı.' }
}

// Server Component page'lerde:
const { data: { user } } = await supabase.auth.getUser()
if (!user) notFound()
```

### Supabase Client Başlatma
**Kaynak:** `src/app/(dashboard)/projeler/[id]/actions.ts` (line 4) + `src/app/(dashboard)/projeler/page.tsx` (line 1)
**Uygulama yeri:** Tüm server-side dosyalar
```typescript
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
```

### revalidatePath Sonrası Return
**Kaynak:** `src/app/(dashboard)/projeler/[id]/actions.ts` (lines 73-74)
**Uygulama yeri:** Tüm Server Action'lar
```typescript
revalidatePath(`/projeler/${projectId}`)
return { success: true }
```

### isPending Loading State (Client Component)
**Kaynak:** `src/app/(dashboard)/projeler/[id]/stage-transition.tsx` (lines 27-44) + `src/app/(dashboard)/projeler/[id]/notes-section.tsx` (lines 21-23)
**Uygulama yeri:** `RuleToggleRow.tsx`
```typescript
const [isPending, setIsPending] = useState(false)
// setIsPending(true) → action → setIsPending(false) in finally
```

### Badge className Direkt Kullanımı (variant prop YOK)
**Kaynak:** `src/app/(dashboard)/projeler/page.tsx` (lines 137-143) + `src/app/(dashboard)/projeler/[id]/page.tsx` (lines 147-158)
**Uygulama yeri:** Tüm scope badge'leri
```tsx
// Doğru kullanım:
<Badge className="bg-slate-500/20 text-slate-400 border border-slate-500/30">Global</Badge>
<Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30">Proje</Badge>

// YANLIŞ — variant prop kullanılmaz:
<Badge variant="secondary">Global</Badge>
```

### Türkçe UI Metinleri
**Kaynak:** Tüm mevcut dosyalar
**Uygulama yeri:** Tüm yeni dosyalar
```typescript
// Tüm hata mesajları, etiketler, başlıklar Türkçe:
'Oturum bulunamadı.'
'Kural güncellenemedi. Lütfen tekrar deneyin.'
'Kural sıfırlanamadı. Lütfen tekrar deneyin.'
'Proje bulunamadı.'
```

### TableHead Kategori Başlık Stili
**Kaynak:** `src/app/(dashboard)/projeler/page.tsx` (lines 96-113) + `src/app/(dashboard)/projeler/[id]/page.tsx` (line 100-102)
**Uygulama yeri:** Kural tablosu kategori başlıkları
```tsx
<p className="text-xs font-normal uppercase text-muted-foreground mb-3">
  SEO Title
</p>
```

---

## No Analog Found

Bu fazda tüm dosyalar için güçlü analog bulundu. Aşağıdaki unsur kısmen yeni davranış gerektiriyor:

| Unsur | Rol | Veri Akışı | Durum |
|---|---|---|---|
| `seedGlobalRules` action içindeki upsert seed mantığı | server action | CRUD-insert | Proje içinde analog yok — CONTEXT.md D-01 seed verisi baz alınır |
| `Switch` bileşeni | UI component | — | `npx shadcn add switch` ile eklenmeli; projede henüz yok |
| Toast hata bildirimi | UI pattern | event-driven | Phase 2'de toast pattern yok — `sonner` veya shadcn `toast` eklenmesi gerekebilir; planner karar vermeli |

---

## Metadata

**Analog arama kapsamı:** `src/app/(dashboard)/`, `src/components/ui/`
**Taranan dosyalar:** 9
**Pattern çıkarım tarihi:** 2026-04-23
