# Phase 18: Project Launch Gate & Sector Research - Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 5 new/modified files
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/(dashboard)/projeler/[id]/ProjectInfoSection.tsx` | component | request-response | `src/app/(dashboard)/projeler/[id]/site-import-section.tsx` | exact |
| `src/app/api/research/trigger/route.ts` | route | request-response | `src/app/api/wp/import/route.ts` | exact |
| `src/lib/research/sector-research.ts` | service | request-response | `src/lib/wp/enrichment.ts` | role-match |
| `src/lib/supabase/vault.ts` | utility | - | `src/lib/supabase/vault.ts` | exact (modify) |
| `src/app/(dashboard)/projeler/[id]/arastirma/page.tsx` | component | CRUD | `src/app/(dashboard)/projeler/[id]/arastirma/page.tsx` | exact (modify) |

---

## Pattern Assignments

### `src/app/(dashboard)/projeler/[id]/ProjectInfoSection.tsx` (component, request-response)

**Analog:** `src/app/(dashboard)/projeler/[id]/site-import-section.tsx`

**Mevcut dosyaya ekleme yapılacak** — bileşen sıfırdan yazılmaz. Formun altına Launch Gate butonu eklenir.

**Imports pattern** (site-import-section.tsx satır 1-8):
```typescript
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { startSiteImport } from './actions'
```

**Gate logic pattern** (edit-project-modal.tsx satır 201):
```typescript
// Disabled button kontrolü — zorunlu alan eksikse disabled
<Button onClick={handleSave} disabled={isPending || !form.name.trim() || !form.domain.trim()}>
  {isPending ? 'Kaydediliyor...' : 'Kaydet'}
</Button>
```

Phase 18 gate logic için:
```typescript
// ProjectInfoSection içinde hesaplanan gate state
const canLaunch = Boolean(
  data['sector']?.trim() &&
  data['initial_competitors']?.trim() &&
  data['target_keywords']?.trim()
)

const missingFields = [
  !data['sector']?.trim() && 'sektör',
  !data['initial_competitors']?.trim() && 'rakipler',
  !data['target_keywords']?.trim() && 'anahtar kelimeler',
].filter(Boolean)
```

**Loading + error state pattern** (site-import-section.tsx satır 51-99):
```typescript
const [status, setStatus] = useState<ImportStatus>(parseStatus(initialImportStatus))
const [error, setError] = useState<string | null>(null)
const [starting, setStarting] = useState(false)

const handleStartImport = async () => {
  setError(null)
  setStarting(true)
  try {
    const result = await startSiteImport(projectId)
    if (!result.jobStarted) {
      setError(result.error ?? 'İçe aktarma başlatılamadı.')
      return
    }
    setStatus('running')
  } catch {
    setError('İçe aktarma başarısız. WordPress bağlantısını kontrol edin ve tekrar deneyin.')
  } finally {
    setStarting(false)
  }
}
```

**Spinner pattern** (ClusterButton.tsx satır 35-48):
```typescript
{isPending ? (
  <span className="flex items-center gap-2">
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    Kümeleniyor...
  </span>
) : hasExistingClusters ? (
  'Yeniden Kümeleme'
) : (
  'Kümelere Böl'
)}
```

**Tamamlandı banner pattern** (site-import-section.tsx satır 157-176):
```typescript
{status === 'complete' && (
  <div
    aria-live="polite"
    role="status"
    className="flex items-center justify-between rounded-md bg-emerald-500/20 border border-emerald-500/30 px-4 py-3"
  >
    <span className="text-sm text-emerald-400">
      İçe aktarma tamamlandı
      {importCompletedAt && (
        <span className="ml-2 text-emerald-400/60">{formatImportDate(importCompletedAt)}</span>
      )}
    </span>
    <Link
      href={`/projeler/${projectId}/site-analizi`}
      className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
    >
      Site Analizine Git →
    </Link>
  </div>
)}
```

**Inline validation hint pattern** (site-import-section.tsx satır 219-226):
```typescript
{(error || status === 'error') && (
  <p
    role="alert"
    className="text-xs text-destructive"
  >
    {error ?? 'İçe aktarma başarısız...'}
  </p>
)}
```

---

### `src/app/api/research/trigger/route.ts` (route, request-response)

**Analog:** `src/app/api/wp/import/route.ts`

**Imports + service client pattern** (satır 1-18):
```typescript
import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getWordPressCredentials } from '@/lib/supabase/vault'

// Service role client — RLS bypass, uzun-süreli pipeline için
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

**Request body parse + validation pattern** (satır 20-32):
```typescript
export async function POST(request: NextRequest) {
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

**IDOR ownership check pattern** (satır 37-45):
```typescript
  const { data: project } = await serviceClient
    .from('projects')
    .select('id, name, gsc_property_url')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
```

**Error handling + status update pattern** (satır 269-278):
```typescript
  } catch (err) {
    console.error('[wp/import] Pipeline error:', err)
    await serviceClient
      .from('projects')
      .update({ import_status: 'error' })
      .eq('id', projectId)
    return NextResponse.json({ error: 'Import pipeline failed' }, { status: 500 })
  }
```

**Başarı response pattern** (satır 268):
```typescript
return NextResponse.json({ success: true, total: totalFetched })
```

---

### `src/lib/research/sector-research.ts` (service, request-response)

**Analog:** `src/lib/wp/enrichment.ts`

**Server-only + AI client pattern** (satır 1-15):
```typescript
import 'server-only'

import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}
```

**Prompt + JSON parse + fallback pattern** (satır 31-76):
```typescript
async function enrichSinglePage(page: PageToEnrich): Promise<EnrichmentResult> {
  const fallback = { wp_id: page.wp_id, content_summary: null, primary_intent: null }
  try {
    const prompt = `...JSON formatında yanıt ver...
Yanıtı SADECE JSON formatında ver, başka hiçbir şey ekleme:
{"summary": "...", "intent": "..."}`

    const apiCall = getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    })

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Enrichment timeout')), CALL_TIMEOUT_MS)
    )
    const response = await Promise.race([apiCall, timeout])

    const text = response.choices[0]?.message?.content ?? ''
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
    const jsonText = jsonMatch ? jsonMatch[1] : text

    let parsed: { summary?: string; intent?: string }
    try {
      parsed = JSON.parse(jsonText.trim())
    } catch {
      return fallback
    }
    // ...validate fields, return result
  } catch {
    return fallback
  }
}
```

**Phase 18 için model:** `claude-sonnet-4-6` (CONTEXT.md D-03). `@anthropic-ai/sdk` kullanılacak — `openai` değil. Aynı `Promise.race` timeout + JSON parse + fallback pattern geçerlidir.

**SerpAPI çağrısı:** `enrichment.ts`'teki OpenAI pattern yerine `fetch()` kullanılacak:
```typescript
// SerpAPI pattern — vault'tan gelen api_key ile
const serpRes = await fetch(
  `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${serpApiKey}&hl=tr&gl=tr`
)
if (!serpRes.ok) throw new Error(`SerpAPI error: ${serpRes.status}`)
const serpData = await serpRes.json()
```

---

### `src/lib/supabase/vault.ts` (utility, modify)

**Analog:** `src/lib/supabase/vault.ts` (aynı dosyaya ekleme)

**Mevcut pattern kopyalanacak** — `getDataForSeoCredentials()` ile aynı env var öncelikli pattern:

```typescript
// Satır 10-35 — env var önce, vault fallback
export async function getDataForSeoCredentials(): Promise<{ login: string; password: string }> {
  if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
    return {
      login: process.env.DATAFORSEO_LOGIN,
      password: process.env.DATAFORSEO_PASSWORD,
    }
  }

  const { data, error } = await serviceClient
    .rpc('vault_get_secrets', { p_names: ['dataforseo_login', 'dataforseo_password'] })

  if (error || !data?.length) {
    throw new Error('DataForSEO credentials okunamadı...')
  }
  // find + return
}
```

**Phase 18 için eklenecek fonksiyon:**
```typescript
export async function getSerpApiKey(): Promise<string> {
  if (process.env.SERPAPI_KEY) return process.env.SERPAPI_KEY

  const { data, error } = await serviceClient
    .rpc('vault_get_secrets', { p_names: ['serpapi_key'] })

  if (error || !data?.length) {
    throw new Error('SERPAPI_KEY env var olarak .env.local dosyasına ekleyin.')
  }

  const row = data.find((s: { name: string; decrypted_secret: string }) => s.name === 'serpapi_key')
  if (!row) throw new Error('SerpAPI key bulunamadı.')
  return row.decrypted_secret
}
```

---

### `src/app/(dashboard)/projeler/[id]/arastirma/page.tsx` (component, CRUD — modify)

**Analog:** Aynı dosya (`arastirma/page.tsx`) — "Yeniden Araştır" butonu eklenecek.

**Mevcut SSR + supabase auth pattern** (satır 66-100):
```typescript
export default async function ArastirmaPage({
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
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!project) notFound()

  // Tüm bölümleri tek sorguda çek
  const { data: reports } = await supabase
    .from('research_reports')
    .select('section, rows')
    .eq('project_id', id)
    .eq('user_id', user.id)
```

**"Yeniden Araştır" butonu için:** `ClusterButton.tsx` pattern'i kullanılacak — bağımsız Client Component olarak sayfaya eklenir.

**upsertSection — AI çıktısı yazma pattern** (arastirma/actions.ts satır 15-49):
```typescript
export async function upsertSection(
  projectId: string,
  section: SectionKey,
  rows: Record<string, string>[]
): Promise<ActionResult> {
  // ...auth + ownership check...
  const { error } = await supabase.from('research_reports').upsert(
    {
      user_id: user.id,
      project_id: projectId,
      section,
      rows,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'project_id,section' }
  )
  // ...
  revalidatePath(`/projeler/${projectId}/arastirma`)
  return { success: true }
}
```

AI çıktısı bu `upsertSection` ile yazılacak (replace semantiği `onConflict` ile sağlanıyor).

---

## Shared Patterns

### Authentication / IDOR Koruması
**Source:** `src/app/api/wp/import/route.ts` satır 37-45
**Apply to:** `src/app/api/research/trigger/route.ts`
```typescript
const { data: project } = await serviceClient
  .from('projects')
  .select('id, name, sector, initial_competitors, target_keywords')
  .eq('id', projectId)
  .eq('user_id', userId)
  .single()

if (!project) {
  return NextResponse.json({ error: 'Project not found' }, { status: 404 })
}
```

### Error Handling — API Route
**Source:** `src/app/api/wp/import/route.ts` satır 269-278
**Apply to:** `src/app/api/research/trigger/route.ts`
```typescript
} catch (err) {
  console.error('[research/trigger] Pipeline error:', err)
  return NextResponse.json({ error: 'Research pipeline failed' }, { status: 500 })
}
```

### Error Handling — Client Component
**Source:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterButton.tsx` satır 15-22
**Apply to:** `ProjectInfoSection.tsx` (launch gate butonu), `arastirma/page.tsx` (yeniden araştır butonu)
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
  })
}
```

### Vault — API Key Okuma
**Source:** `src/lib/supabase/vault.ts` satır 10-35
**Apply to:** `src/lib/research/sector-research.ts` (getSerpApiKey çağrısı)
Pattern: env var önce kontrol edilir, yoksa `vault_get_secrets` RPC çağrılır. Hata halinde açıklayıcı mesajla `throw`.

### Server Action Result Type
**Source:** `src/app/(dashboard)/projeler/[id]/arastirma/actions.ts` satır 6
**Apply to:** `src/app/api/research/trigger/route.ts` için server action sarmalayıcı varsa
```typescript
export type ActionResult = { success: true } | { success: false; error: string }
```

### Service Role Client
**Source:** `src/app/api/wp/import/route.ts` satır 13-17
**Apply to:** `src/app/api/research/trigger/route.ts`
```typescript
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| - | - | - | Tüm dosyalar için yakın analog bulundu |

---

## Metadata

**Analog search scope:** `src/app/(dashboard)/projeler/[id]/`, `src/app/api/wp/`, `src/lib/wp/`, `src/lib/supabase/`
**Files scanned:** 9
**Pattern extraction date:** 2026-05-08
