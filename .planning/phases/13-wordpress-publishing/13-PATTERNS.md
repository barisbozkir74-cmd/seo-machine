---
phase: 13-wordpress-publishing
type: patterns
created: "2026-04-26T00:00:00Z"
---

# Phase 13: WordPress Publishing — Pattern Map

**Mapped:** 2026-04-26
**Files analyzed:** 7 yeni/değiştirilen dosya
**Analogs found:** 7 / 7

---

## File Classification

| Yeni / Değiştirilen Dosya | Rol | Data Flow | En Yakın Analog | Eşleşme Kalitesi |
|---------------------------|-----|-----------|-----------------|-----------------|
| `supabase/migrations/20260426000002_add_wp_columns.sql` | migration | transform | `supabase/migrations/20260426000001_add_content_studio_columns.sql` | exact |
| `src/lib/supabase/vault.ts` (genişlet) | utility | request-response | `src/lib/supabase/vault.ts` (mevcut) | exact |
| `src/app/(dashboard)/projeler/[id]/wordpress-section.tsx` | component | request-response | `src/app/(dashboard)/projeler/[id]/ProjectInfoSection.tsx` | role-match |
| `src/app/(dashboard)/projeler/[id]/actions.ts` (genişlet) | action | request-response | `src/app/(dashboard)/projeler/[id]/actions.ts` (mevcut) | exact |
| `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/PublishDialog.tsx` | component | request-response | `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/AddLinkDialog.tsx` | exact |
| `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx` (genişlet) | component | event-driven | `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx` (mevcut) | exact |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` (genişlet) | action | request-response | `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` (mevcut) | exact |

---

## Pattern Assignments

### `supabase/migrations/20260426000002_add_wp_columns.sql` (migration, transform)

**Analog:** `supabase/migrations/20260426000001_add_content_studio_columns.sql`

**Core migration pattern** (satır 1-7):
```sql
-- Phase 12: Content Studio — section-by-section AI content generation
-- Adds two columns to page_packages:
--   content_sections JSONB: ...
--   html_content TEXT: ...
ALTER TABLE public.page_packages
  ADD COLUMN IF NOT EXISTS content_sections JSONB,
  ADD COLUMN IF NOT EXISTS html_content     TEXT;
```

**Yeni migration'da kopyalanacak yorum + ALTER pattern:**
```sql
-- Phase 13: WordPress Publishing — publish result tracking
-- Adds four columns to page_packages:
--   wp_post_id INTEGER: WordPress post ID after successful publish
--   wp_post_url TEXT: Public URL of the WordPress post
--   wp_published_at TIMESTAMPTZ: Timestamp of publish/draft save
--   wp_status TEXT: 'publish' | 'draft'
ALTER TABLE public.page_packages
  ADD COLUMN IF NOT EXISTS wp_post_id       INTEGER,
  ADD COLUMN IF NOT EXISTS wp_post_url      TEXT,
  ADD COLUMN IF NOT EXISTS wp_published_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wp_status        TEXT;
```

---

### `src/lib/supabase/vault.ts` (utility, request-response) — genişlet

**Analog:** `src/lib/supabase/vault.ts` (mevcut, satır 1-39)

**Import + server-only pattern** (satır 1-8):
```typescript
import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Service role client — Vault okuma için anon key değil service role key gerekir
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

**Vault read pattern** (satır 19-38):
```typescript
const { data, error } = await serviceClient
  .from('vault.decrypted_secrets')
  .select('name, decrypted_secret')
  .in('name', ['dataforseo_login', 'dataforseo_password'])

if (error || !data?.length) {
  throw new Error('DataForSEO credentials okunamadı. ...')
}

const loginRow = data.find((s: { name: string; decrypted_secret: string }) => s.name === 'dataforseo_login')
```

**Yeni fonksiyonlar için kopyalanacak pattern — per-project Vault key okuma:**
```typescript
// wp_url_{projectId} ve wp_app_password_{projectId} anahtarlarını oku
export async function getWordPressCredentials(
  projectId: string
): Promise<{ wpUrl: string; appPassword: string } | null> {
  const urlKey = `wp_url_${projectId}`
  const passKey = `wp_app_password_${projectId}`

  const { data, error } = await serviceClient
    .from('vault.decrypted_secrets')
    .select('name, decrypted_secret')
    .in('name', [urlKey, passKey])

  if (error || !data?.length) return null

  const urlRow = data.find((s) => s.name === urlKey)
  const passRow = data.find((s) => s.name === passKey)
  if (!urlRow || !passRow) return null

  return { wpUrl: urlRow.decrypted_secret, appPassword: passRow.decrypted_secret }
}
```

**Vault write pattern (yeni — createSecret / updateSecret):**
Not: Mevcut vault.ts'te write fonksiyonu yok. Supabase JS `rpc` veya REST ile Vault secret oluşturma/güncelleme yapılacak. Analog yok — planner RESEARCH.md'yi referans alacak.

---

### `src/app/(dashboard)/projeler/[id]/wordpress-section.tsx` (component, request-response)

**Analog:** `src/app/(dashboard)/projeler/[id]/ProjectInfoSection.tsx` (satır 1-274)

**Import + 'use client' pattern** (satır 1-18):
```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateProjectField } from '../actions'
```

**Form state pattern** (satır 170-205):
```typescript
export function ProjectInfoSection({ projectId, initialData }: Props) {
  const [data, setData] = useState<ProjectData>(initialData)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (field: string, value: string) => {
    setSaving(true)
    setError(null)
    const result = await updateProjectField(projectId, field as any, value)
    setSaving(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setData((prev) => ({ ...prev, [field]: value || null }))
  }
  // ...
}
```

**Password input pattern (wordpress-section'a özgü — Input type="password"):**
```typescript
// ProjectInfoSection'daki Input pattern'ini kopyala; type="password" ekle:
<Input
  type="password"
  value={editValue}
  onChange={(e) => onEditChange(e.target.value)}
  placeholder="xxxx xxxx xxxx xxxx"
  className="text-sm h-8"
/>
```

**Badge/durum göstergesi pattern** (Badge component mevcut — `src/components/ui/badge.tsx`):
```typescript
// Vault'ta key varsa "Bağlı" badge, yoksa "Yapılandırılmamış" badge
import { Badge } from '@/components/ui/badge'

{isConfigured ? (
  <Badge variant="default" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
    Bağlı
  </Badge>
) : (
  <Badge variant="outline" className="text-muted-foreground">
    Yapılandırılmamış
  </Badge>
)}
```

**Kaydet butonu pattern** (satır 146-155 — critical olmayan alan):
```typescript
<Button size="sm" className="h-7 text-xs" disabled={saving} onClick={onSaveClick}>
  {saving ? 'Kaydediliyor...' : 'Kaydet'}
</Button>
<Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel} disabled={saving}>
  İptal
</Button>
```

---

### `src/app/(dashboard)/projeler/[id]/actions.ts` (action, request-response) — genişlet

**Analog:** `src/app/(dashboard)/projeler/[id]/actions.ts` (mevcut, satır 1-132)

**'use server' + import pattern** (satır 1-4):
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
```

**Auth + ownership check pattern** (satır 17-19, 95-96):
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { success: false, error: 'Oturum bulunamadı.' }
```

**Result type pattern** (satır 77-79):
```typescript
export type AddNoteResult =
  | { success: true }
  | { success: false; error: string }
```

**Yeni saveWordPressCredentials action imzası:**
```typescript
// src/lib/supabase/vault.ts'i import eder (server-only güvencesi)
import { saveWpCredentials } from '@/lib/supabase/vault'

export type SaveWpCredentialsResult =
  | { success: true }
  | { success: false; error: string }

export async function saveWordPressCredentials(
  projectId: string,
  wpUrl: string,
  appPassword: string
): Promise<SaveWpCredentialsResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Proje sahipliği doğrula
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  // Vault'a yaz — appPassword asla loglanmaz
  await saveWpCredentials(projectId, wpUrl, appPassword)

  revalidatePath(`/projeler/${projectId}`)
  return { success: true }
}
```

---

### `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/PublishDialog.tsx` (component, request-response)

**Analog:** `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/AddLinkDialog.tsx` (satır 1-186)

**Import + Dialog pattern** (satır 1-15):
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { addLink, type LinkType } from './actions'
```

**State + open/reset pattern** (satır 34-50):
```typescript
export function AddLinkDialog({ projectId, pages }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setError(null)
    setIsPending(false)
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) resetForm()
  }
  // ...
}
```

**Async action call + error pattern** (satır 57-93):
```typescript
const handleSubmit = async () => {
  // client-side validation...
  setIsPending(true)
  setError(null)

  const result = await addLink(projectId, { ... })

  if (!result.success) {
    setError(result.error)
    setIsPending(false)
    return
  }

  setOpen(false)
  resetForm()
}
```

**PublishDialog'a özgü RadioGroup pattern (Shadcn/ui henüz eklenmemişse native radio kullanılır):**
```typescript
// D-04: Hemen Yayınla / Taslak Kaydet
const [publishStatus, setPublishStatus] = useState<'publish' | 'draft'>('publish')

// JSX:
<div className="space-y-2">
  <Label>Yayın Durumu</Label>
  <div className="flex flex-col gap-2">
    {[
      { value: 'publish', label: 'Hemen Yayınla' },
      { value: 'draft',   label: 'Taslak Kaydet' },
    ].map((opt) => (
      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="publish-status"
          value={opt.value}
          checked={publishStatus === opt.value}
          onChange={() => setPublishStatus(opt.value as 'publish' | 'draft')}
          disabled={isPending}
        />
        <span className="text-sm">{opt.label}</span>
      </label>
    ))}
  </div>
</div>
```

**DialogFooter + pending state pattern** (satır 174-183):
```typescript
<DialogFooter>
  <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
    Vazgeç
  </Button>
  <Button onClick={handleSubmit} disabled={isPending}>
    {isPending ? 'Gönderiliyor...' : 'Gönder'}
  </Button>
</DialogFooter>
```

---

### `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx` (component, event-driven) — genişlet

**Analog:** Mevcut `HtmlReadyBanner.tsx` (satır 1-18)

**Mevcut banner pattern** (satır 1-18):
```typescript
'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { Tick02Icon } from '@hugeicons/core-free-icons'

export function HtmlReadyBanner() {
  return (
    <div className="sticky bottom-0 z-10 mx-6 mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
      <HugeiconsIcon icon={Tick02Icon} className="text-emerald-400 shrink-0" size={20} />
      <div>
        <p className="text-sm font-semibold text-emerald-400">HTML Çıktısı Hazır</p>
        <p className="text-sm text-muted-foreground">
          Tüm bölümler onaylandı. İçerik WordPress&apos;e yayınlanmaya hazır.
        </p>
      </div>
    </div>
  )
}
```

**Genişletilmiş banner — Props eklenecek:**
```typescript
type Props = {
  projectId: string
  pageId: string
  wpPostUrl?: string | null       // sayfa zaten yayınlandıysa
  wpStatus?: string | null        // 'publish' | 'draft' | null
}

export function HtmlReadyBanner({ projectId, pageId, wpPostUrl, wpStatus }: Props) {
  // Yayınlanmış durum: link göster
  if (wpPostUrl && wpStatus === 'publish') {
    return (
      <div className="sticky bottom-0 ...">
        {/* Yeşil banner + "WordPress'te yayında" + post URL linki */}
      </div>
    )
  }

  // Taslak durum
  if (wpPostUrl && wpStatus === 'draft') {
    return (/* Turuncu/gri banner + "WordPress taslağı kaydedildi" */  )
  }

  // Yayınlanmamış — mevcut banner + "WordPress'e Gönder" butonu + PublishDialog
  return (
    <div className="sticky bottom-0 z-10 mx-6 mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
      {/* Mevcut içerik */}
      <PublishDialog projectId={projectId} pageId={pageId} />
    </div>
  )
}
```

**ContentStudioShell'de prop geçiş pattern** (satır 83-84, 235):
```typescript
// ContentStudioShell.tsx — pkg'den wp alanları alınacak:
const allApproved = sections.length > 0 && approvedCount === sections.length

// Render:
{allApproved && (
  <HtmlReadyBanner
    projectId={projectId}
    pageId={pageId}
    wpPostUrl={pkg.wp_post_url}
    wpStatus={pkg.wp_status}
  />
)}
```

---

### `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` (action, request-response) — genişlet

**Analog:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` (mevcut)

**'use server' + verifyOwnership pattern** (satır 1-82):
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { success: true } | { success: false; error: string }

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

**page_packages UPDATE pattern** (satır 139-149):
```typescript
const { error } = await supabase
  .from('page_packages')
  .update({ content_sections: sections, updated_at: new Date().toISOString() })
  .eq('id', pkg.id)
  .eq('user_id', user.id)

if (error) return { success: false, error: 'Bölümler kaydedilemedi: ' + error.message }

revalidatePath(`/projeler/${projectId}/icerik-studio/${pageId}`)
revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
return { success: true }
```

**External fetch pattern** (mevcut rakipler/actions.ts'ten — `getDataForSeoCredentials` vault.ts referansı):
```typescript
// Yeni publishToWordPress action — vault.ts'ten credentials alır, WP REST API'ye fetch yapar:
import { getWordPressCredentials } from '@/lib/supabase/vault'

export type PublishResult =
  | { success: true; wpPostId: number; wpPostUrl: string }
  | { success: false; error: string }

export async function publishToWordPress(
  projectId: string,
  pageId: string,
  status: 'publish' | 'draft'
): Promise<PublishResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const project = await verifyOwnership(supabase, projectId, user.id)
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  // Paket sahipliği + veri
  const { data: pkg } = await supabase
    .from('page_packages')
    .select('id, status, html_content, meta_description, schema_jsonld, focus_keyword_id')
    .eq('page_id', pageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!pkg) return { success: false, error: 'Paket bulunamadı.' }
  if (pkg.status !== 'locked') return { success: false, error: 'Paket kilitli değil.' }

  // Vault'tan WP credentials al
  const creds = await getWordPressCredentials(projectId)
  if (!creds) return { success: false, error: 'WordPress kimlik bilgileri bulunamadı. Proje ayarlarından ekleyin.' }

  // Basic Auth header — WP REST API standardı
  const authHeader = 'Basic ' + Buffer.from(`admin:${creds.appPassword}`).toString('base64')

  // Plugin algıla → meta key'leri belirle
  // POST /wp-json/wp/v2/posts
  // page_packages UPDATE: wp_post_id, wp_post_url, wp_status, wp_published_at

  revalidatePath(`/projeler/${projectId}/icerik-studio/${pageId}`)
  return { success: true, wpPostId: ..., wpPostUrl: ... }
}
```

---

## Shared Patterns

### Authentication (Server Action)
**Kaynak:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` (satır 119-136)
**Uygulanacak:** Tüm yeni server action'lar
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { success: false, error: 'Oturum bulunamadı.' }

const project = await verifyOwnership(supabase, projectId, user.id)
if (!project) return { success: false, error: 'Proje bulunamadı.' }
```

### Error Handling (Action Return Type)
**Kaynak:** `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/actions.ts` (satır 6)
**Uygulanacak:** Tüm yeni server action'lar
```typescript
export type ActionResult = { success: true } | { success: false; error: string }
```

### Vault Server-Only Guard
**Kaynak:** `src/lib/supabase/vault.ts` (satır 1)
**Uygulanacak:** vault.ts'teki tüm yeni fonksiyonlar
```typescript
import 'server-only'
// SUPABASE_SERVICE_ROLE_KEY asla NEXT_PUBLIC_ ile başlamaz
// wp_app_password loglanmaz, response'ta gösterilmez
```

### Client Component Loading State
**Kaynak:** `src/app/(dashboard)/projeler/[id]/rakipler/CompetitorFetchButton.tsx` (satır 13-53)
**Uygulanacak:** `PublishDialog.tsx`, `WordPressSection.tsx`
```typescript
const [isPending, setIsPending] = useState(false)
const [error, setError] = useState<string | null>(null)

const handleAction = async () => {
  setIsPending(true)
  setError(null)
  try {
    const result = await someAction(...)
    if (!result.success) setError(result.error)
  } catch {
    setError('İşlem başarısız. Lütfen tekrar deneyin.')
  } finally {
    setIsPending(false)
  }
}
```

### revalidatePath Pattern
**Kaynak:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` (satır 147-148)
**Uygulanacak:** `publishToWordPress`, `saveWordPressCredentials`
```typescript
revalidatePath(`/projeler/${projectId}/icerik-studio/${pageId}`)
revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
```

---

## No Analog Found

| Dosya / İşlev | Rol | Data Flow | Neden |
|---------------|-----|-----------|-------|
| Vault write (createSecret/updateSecret) | utility | request-response | Mevcut vault.ts yalnızca okuma yapar; Supabase Vault write API projede hiç kullanılmamış |
| WordPress REST API istemcisi (plugin detection + POST) | service | request-response | Harici WP API entegrasyonu projede ilk kez ekleniyor |

Bu dosyalar için planner **CONTEXT.md D-01 / D-03** bölümünü ve Supabase Vault RPC dokümantasyonunu referans alacak.

---

## Metadata

**Analog arama kapsamı:** `src/`, `supabase/migrations/`
**Taranan dosya sayısı:** 14
**Pattern extraction tarihi:** 2026-04-26
