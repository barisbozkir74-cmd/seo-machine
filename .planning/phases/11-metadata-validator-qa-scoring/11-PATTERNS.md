# Phase 11: Metadata Validator & QA Scoring - Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 5 (4 modified + 1 new)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/QaBadge.tsx` | component | transform | self (extend in-place) | exact |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` | component | request-response + event-driven | self (extend in-place) | exact |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` | server-action | CRUD | self (extend in-place) | exact |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx` | page (server component) | CRUD + request-response | `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx` | role-match |
| `src/app/api/ai/qa-audit/route.ts` | api-route | request-response | `src/app/api/ai/generate-page-package/route.ts` | exact |

---

## Pattern Assignments

### `src/app/(dashboard)/projeler/[id]/sayfa-paketi/QaBadge.tsx` (component, transform)

**Analog:** Self — mevcut dosya genişletilir, yeniden yazılmaz.

**Mevcut imports pattern** (satır 1-3):
```typescript
'use client'

import { cn } from '@/lib/utils'
```

**Mevcut tip tanımları** (satır 5-16):
```typescript
type QaRule = {
  id: string
  severity: 'warning' | 'error'
}

export type QaBadgeProps = {
  seoTitle: string
  metaDescription: string
  h1: string
  focusKeyword: string | null
}
```

**Genişletme hedefi — yeni prop eklenecek:**
```typescript
// ProjectRules: rule_key → aktif mi (true/false)
// kurallar/page.tsx satır 63-71'deki resolvedRules'tan türetilir
// PagePackageEditor üzerinden geçirilir
type ProjectRules = Record<string, boolean>  // rule_key → active

export type QaBadgeProps = {
  seoTitle: string
  metaDescription: string
  h1: string
  focusKeyword: string | null
  projectRules: ProjectRules  // YENİ
}
```

**computeQaRules mevcut core pattern** (satır 17-48):
```typescript
function computeQaRules(props: QaBadgeProps): QaRule[] {
  const rules: QaRule[] = []

  // QA-01: SEO Title uzunluğu
  if (props.seoTitle.length > 70) {
    rules.push({ id: 'QA-01', severity: 'error' })
  } else if (props.seoTitle.length > 60) {
    rules.push({ id: 'QA-01', severity: 'warning' })
  }
  // ... (diğer hardcoded kurallar aynı kalır)

  return rules
}
```

**Eklenecek rules-engine bloku (computeQaRules sonuna):**
```typescript
// Rules engine entegrasyonu — projectRules prop'undan gelir
// Her kural yalnızca aktifse (projectRules[key] === true) değerlendirilir

if (props.projectRules['title_starts_with_keyword'] && props.focusKeyword) {
  if (!props.seoTitle.toLowerCase().startsWith(props.focusKeyword.toLowerCase())) {
    rules.push({ id: 'title_starts_with_keyword', severity: 'warning' })
  }
}

if (props.projectRules['title_max_length_enforced']) {
  if (props.seoTitle.length > 60) {
    rules.push({ id: 'title_max_length_enforced', severity: 'error' })
  }
}

if (props.projectRules['slug_lowercase_hyphen'] && props.slug) {
  if (!/^[a-z0-9-]+$/.test(props.slug)) {
    rules.push({ id: 'slug_lowercase_hyphen', severity: 'error' })
  }
}

if (props.projectRules['meta_desc_includes_keyword'] && props.focusKeyword) {
  if (!props.metaDescription.toLowerCase().includes(props.focusKeyword.toLowerCase())) {
    rules.push({ id: 'meta_desc_includes_keyword', severity: 'warning' })
  }
}

if (props.projectRules['meta_desc_required']) {
  if (!props.metaDescription.trim()) {
    rules.push({ id: 'meta_desc_required', severity: 'error' })
  }
}

if (props.projectRules['meta_desc_length_enforced']) {
  const len = props.metaDescription.length
  if (len > 160 || (len > 0 && len < 120)) {
    rules.push({ id: 'meta_desc_length_enforced', severity: 'warning' })
  }
}

if (props.projectRules['h1_includes_keyword'] && props.focusKeyword) {
  if (!props.h1.toLowerCase().includes(props.focusKeyword.toLowerCase())) {
    rules.push({ id: 'h1_includes_keyword', severity: 'warning' })
  }
}
```

**Mevcut render pattern** (satır 50-76) — değişmez, sadece combined count yansır:
```typescript
export function QaBadge(props: QaBadgeProps) {
  const rules = computeQaRules(props)
  const errors = rules.filter((r) => r.severity === 'error')
  const warnings = rules.filter((r) => r.severity === 'warning')

  if (errors.length > 0) {
    return (
      <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-red-400')}>
        ✕ Hata
      </span>
    )
  }

  if (warnings.length > 0) {
    return (
      <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-amber-400')}>
        ⚠ {warnings.length} Uyarı
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-emerald-400')}>
      ✓ QA Geçti
    </span>
  )
}
```

**Kural ihlali detaylarını dışa açma** — kilitleme diyaloğu için computeQaRules export edilmeli:
```typescript
// QaBadge.tsx'te export ekle — PagePackageEditor lock flow'u için
export { computeQaRules }
// veya ayrı bir getRuleViolations yardımcı fonksiyonu
```

---

### `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` (component, event-driven)

**Analog:** Self — mevcut bileşen üzerine ekleme yapılır.

**Mevcut imports pattern** (satır 1-21):
```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { updatePagePackage, createPagePackage, updatePackageStatus } from './actions'
import { QaBadge } from './QaBadge'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
```

**Yeni prop ekleme — PageData ve bileşen imzası:**
```typescript
// PageData tipine qa_scores ekle
type PageData = {
  // ... mevcut alanlar ...
  pkg?: {
    // ... mevcut pkg alanları ...
    qa_scores?: {
      seo?: number | null
      metadata?: number | null
      content?: number | null
      human?: number | null
      schema?: number | null
      readiness?: number | null
      last_qa_run?: string | null
    } | null
  } | null
}

// Bileşen imzasına projectRules prop ekle
export function PagePackageEditor({
  projectId,
  page,
  projectRules,  // YENİ
}: {
  projectId: string
  page: PageData
  projectRules: Record<string, boolean>  // YENİ
})
```

**Yeni state tanımları — QA flow için:**
```typescript
// QA Dialog state — tek dialog, içerik swap
const [qaDialogOpen, setQaDialogOpen] = useState(false)
const [qaDialogPhase, setQaDialogPhase] = useState<'rules' | 'loading' | 'result' | 'error'>('rules')
const [ruleViolations, setRuleViolations] = useState<QaRule[]>([])
const [qaResult, setQaResult] = useState<QaResult | null>(null)

// qa_scores state — header score row için
const [qaScores, setQaScores] = useState(pkg?.qa_scores ?? null)
```

**Mevcut Dialog pattern** (satır 508-533) — kilitle diyaloğu bu pattern'ı izler:
```typescript
{pkg?.status === 'locked' && (
  <Dialog>
    <DialogTrigger render={<Button variant="outline" size="sm">Kilidini Aç</Button>} />
    <DialogContent showCloseButton={false} className="max-w-sm">
      <DialogTitle>Paketi kilidden çıkar</DialogTitle>
      <DialogDescription>...</DialogDescription>
      <div className="flex gap-2 justify-end mt-2">
        <DialogClose render={<Button variant="ghost" size="sm">İptal</Button>} />
        <DialogClose
          render={
            <Button variant="outline" size="sm" onClick={() => handleStatusChange('approved')}>
              Kilidini Aç
            </Button>
          }
        />
      </div>
    </DialogContent>
  </Dialog>
)}
```

**Yeni Kilitle butonu pattern — dialog kontrollü (approved state'te):**
```typescript
// Mevcut doğrudan handleStatusChange('locked') çağrısı YERİNE:
{pkg?.status === 'approved' && (
  <>
    <Button
      size="sm"
      onClick={handleLockClick}   // YENİ — dialog flow başlatır
      disabled={isPending}
    >
      Kilitle
    </Button>
    {/* ... diğer butonlar aynı ... */}
  </>
)}

// Tek controlled Dialog — phase'a göre içerik değişir
<Dialog open={qaDialogOpen} onOpenChange={setQaDialogOpen}>
  <DialogContent showCloseButton={false} className="max-w-sm">
    {qaDialogPhase === 'rules' && <RulesViolationContent violations={ruleViolations} onProceed={handleProceedToQA} />}
    {qaDialogPhase === 'loading' && <QaLoadingContent />}
    {qaDialogPhase === 'result' && <QaResultContent result={qaResult} onLock={handleConfirmLock} />}
    {qaDialogPhase === 'error' && <QaErrorContent onLock={handleConfirmLock} />}
  </DialogContent>
</Dialog>
```

**handleLockClick flow:**
```typescript
async function handleLockClick() {
  // 1. Client-side rules check
  const violations = computeQaRules({ seoTitle, metaDescription, h1, focusKeyword, projectRules, slug })
  if (violations.length > 0) {
    setRuleViolations(violations)
    setQaDialogPhase('rules')
    setQaDialogOpen(true)
    return
  }
  // 2. Doğrudan QA'ye geç
  await proceedToQA()
}

async function proceedToQA() {
  setQaDialogPhase('loading')
  setQaDialogOpen(true)
  try {
    const res = await fetch('/api/ai/qa-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId: pkg!.id, projectId }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as QaResult
    setQaResult(data)
    setQaScores(/* compute + merge scores */)
    setQaDialogPhase('result')
  } catch {
    setQaDialogPhase('error')
  }
}
```

**handleConfirmLock — mevcut useTransition + router.refresh() pattern** (satır 331-342):
```typescript
// Mevcut pattern — aynen korunur
async function handleStatusChange(newStatus: 'draft' | 'approved' | 'locked') {
  if (!pkg?.id) return
  startTransition(async () => {
    const result = await updatePackageStatus(projectId, pkg.id, newStatus)
    if (result.success) {
      router.refresh()
    }
  })
}

// handleConfirmLock: aynı pattern + qa_scores kaydet
async function handleConfirmLock() {
  if (!pkg?.id) return
  startTransition(async () => {
    // Önce qa_scores kaydet
    if (qaResult) {
      await updatePagePackage(projectId, page.id, { qa_scores: computeFinalScores(qaResult) })
    }
    // Sonra status geçişi
    const result = await updatePackageStatus(projectId, pkg.id, 'locked')
    if (result.success) {
      setQaDialogOpen(false)
      router.refresh()
    }
  })
}
```

**Score Row render pattern — UI-SPEC'ten:**
```typescript
// Header'da QaBadge + PackageStatusBadge satırının ALTINA eklenir
function scoreColor(n: number | null | undefined): string {
  if (n == null) return 'text-muted-foreground'
  if (n >= 80) return 'text-emerald-400'
  if (n >= 60) return 'text-amber-400'
  return 'text-red-400'
}

// Render (satır 421 civarı — mevcut badge div'inin hemen altında):
{pkg !== null && (
  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
    <span>SEO <span className={scoreColor(qaScores?.seo)}>{qaScores?.seo ?? '—'}</span></span>
    <span className="text-muted-foreground/40">|</span>
    <span>İçerik <span className={scoreColor(qaScores?.content)}>{qaScores?.content ?? '—'}</span></span>
    <span className="text-muted-foreground/40">|</span>
    <span>İnsan <span className={scoreColor(qaScores?.human)}>{qaScores?.human ?? '—'}</span></span>
    <span className="text-muted-foreground/40">|</span>
    <span>Schema <span className={scoreColor(qaScores?.schema)}>{qaScores?.schema ?? '—'}</span></span>
    <span className="text-muted-foreground/40">|</span>
    <span>Hazırlık <span className={scoreColor(qaScores?.readiness)}>{qaScores?.readiness ?? '—'}</span></span>
  </div>
)}
```

**QaResult tipi — API response için:**
```typescript
type QaCheck = {
  id: 'intent_drift' | 'robotic_language' | 'entity_gap' | 'duplicate_risk'
  severity: 'ok' | 'warning' | 'critical'
  note: string
}

type QaResult = {
  checks: QaCheck[]
  content_score: number
  human_score: number
}
```

---

### `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` (server-action, CRUD)

**Analog:** Self — mevcut `updatePackageStatus` fonksiyonuna `qa_scores` parametresi eklenir.

**Mevcut PagePackageData tipi** (satır 13-41) — `qa_scores` zaten var:
```typescript
export type PagePackageData = {
  // ... diğer alanlar ...
  // QA
  qa_scores?: unknown  // ← zaten mevcut, Phase 9'dan
}
```

**Mevcut updatePagePackage upsert pattern** (satır 59-91) — `qa_scores` bu yolla zaten yazılabilir:
```typescript
export async function updatePagePackage(
  projectId: string,
  pageId: string,
  data: PagePackageData
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const project = await verifyOwnership(supabase, projectId, user.id)
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  const { error } = await supabase
    .from('page_packages')
    .upsert(
      {
        page_id: pageId,
        project_id: projectId,
        user_id: user.id,
        ...data,  // qa_scores burada spread ile işlenir
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'page_id' }
    )

  if (error) return { success: false, error: 'Paket kaydedilemedi: ' + error.message }
  revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
  return { success: true }
}
```

**Not:** `updatePagePackage` zaten `qa_scores` alanını destekliyor. `PagePackageData` tipine `qa_scores` için daha güçlü bir tip tanımı eklenebilir:
```typescript
type QaScores = {
  seo?: number | null
  metadata?: number | null
  content?: number | null
  human?: number | null
  schema?: number | null
  readiness?: number | null
  last_qa_run?: string | null
}

export type PagePackageData = {
  // ... diğer alanlar ...
  qa_scores?: QaScores | null
}
```

---

### `src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx` (page/server-component, CRUD)

**Analog:** `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx` — aynı global+project rules sorgulama pattern'ı.

**Rules sorgu pattern** (kurallar/page.tsx satır 37-71):
```typescript
// Global kurallar
const { data: globalRules } = await supabase
  .from('rules')
  .select('rule_key, rule_value')
  .eq('user_id', user.id)
  .eq('scope', 'global')
  .is('project_id', null)

// Proje override'ları
const { data: projectRules } = await supabase
  .from('rules')
  .select('rule_key, rule_value')
  .eq('user_id', user.id)
  .eq('project_id', id)
  .eq('scope', 'project')

// Çözümleme: proje override varsa onu kullan, yoksa global
const projectOverrides = Object.fromEntries(
  (projectRules ?? []).map((r) => [r.rule_key, r.rule_value])
)
const globalValues = Object.fromEntries(
  (globalRules ?? []).map((r) => [r.rule_key, r.rule_value])
)

const resolvedRules = Object.fromEntries(
  Object.keys(RULE_META).map((ruleKey) => {
    const hasOverride = ruleKey in projectOverrides
    const value = hasOverride
      ? projectOverrides[ruleKey] === 'true'
      : (globalValues[ruleKey] ?? 'true') === 'true'
    return [ruleKey, value]  // sayfa-paketi için: sadece boolean yeterli
  })
)
```

**Mevcut page_packages sorgusu** (sayfa-paketi/page.tsx satır 101-108) — `qa_scores` JOIN eklenecek:
```typescript
// MEVCUT select (satır 104):
'id, status, generated_by, seo_title, meta_description, h1, slug, search_intent, strategic_purpose, secondary_keywords, heading_hierarchy, content_blocks, cta_blocks, image_plan, alt_texts, schema_type, canonical_url, faq, schema_jsonld'

// GÜNCELLENMİŞ select — qa_scores eklenir:
'id, status, generated_by, seo_title, meta_description, h1, slug, search_intent, strategic_purpose, secondary_keywords, heading_hierarchy, content_blocks, cta_blocks, image_plan, alt_texts, schema_type, canonical_url, faq, schema_jsonld, qa_scores'
```

**PagePackageEditor çağrısına prop geçme** (satır 195):
```typescript
// MEVCUT:
<PagePackageEditor projectId={id} page={selectedPageData} />

// GÜNCELLENMİŞ — resolvedRules prop eklenir:
<PagePackageEditor projectId={id} page={selectedPageData} projectRules={resolvedRules} />
```

---

### `src/app/api/ai/qa-audit/route.ts` (api-route, request-response) — YENİ DOSYA

**Analog:** `src/app/api/ai/generate-page-package/route.ts` — aynı auth + ownership + Anthropic SDK pattern'ı. Tek fark: streaming değil, tek JSON yanıt.

**Imports pattern** (generate-page-package satır 1-5):
```typescript
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
```

**Auth + ownership pattern** (satır 7-30):
```typescript
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }
  const { packageId, projectId } = body as { packageId?: string; projectId?: string }
  if (!packageId || !projectId) {
    return new Response('packageId and projectId are required', { status: 400 })
  }

  // Proje ownership doğrula
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain, sector, target_language, brand_tone')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return new Response('Project not found', { status: 404 })
```

**Page package sorgusu — QA için gerekli alanlar:**
```typescript
  // QA için page_packages'tan core alanlar
  const { data: pkg } = await supabase
    .from('page_packages')
    .select('id, status, seo_title, meta_description, h1, search_intent, strategic_purpose, content_blocks, schema_jsonld')
    .eq('id', packageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!pkg) return new Response('Package not found', { status: 404 })

  // Sayfa tipi + focus keyword için pages tablosu
  const { data: page } = await supabase
    .from('pages')
    .select('page_type, focus_keyword_id, title')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
```

**Non-streaming Anthropic call pattern** (generate-page-package satır 96-123'ten türetilir, streaming KALDIRILIR):
```typescript
  // Streaming yerine tek message call
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')

  // JSON extract — generate-page-package'taki aynı pattern
  const jsonMatch =
    text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
  const jsonText = jsonMatch ? jsonMatch[1] : text

  let result: unknown
  try {
    result = JSON.parse(jsonText.trim())
  } catch {
    return new Response('Invalid JSON from Claude', { status: 502 })
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
```

**Prompt builder — buildQaPrompt:**
```typescript
function buildQaPrompt(pkg: Record<string, unknown>, project: Record<string, unknown>, focusKeyword: string) {
  return `Sen bir SEO içerik denetçisisin. Aşağıdaki sayfa paketini 4 boyutta denetle ve structured JSON döndür.

## Sayfa Paketi
- SEO Title: ${pkg.seo_title ?? '(boş)'}
- Meta Description: ${pkg.meta_description ?? '(boş)'}
- H1: ${pkg.h1 ?? '(boş)'}
- Search Intent: ${pkg.search_intent ?? '(belirtilmemiş)'}
- Stratejik Amaç: ${pkg.strategic_purpose ?? '(boş)'}
- Focus Keyword: ${focusKeyword || '(belirtilmemiş)'}
- İçerik Blokları: ${JSON.stringify(pkg.content_blocks ?? [], null, 2)}

## Proje Bağlamı
- Domain: ${project.domain}
- Sektör: ${project.sector ?? 'belirtilmemiş'}
- Dil: ${project.target_language ?? 'Türkçe'}
- Marka Tonu: ${project.brand_tone ?? 'profesyonel'}

## Denetim Boyutları
1. intent_drift — İçerik hedef search intent ile uyuşuyor mu?
2. robotic_language — AI şablonculuğu, tekrarlayan yapılar, doğal olmayan dil var mı?
3. entity_gap — Bağlam için beklenen entity'ler (markalar, lokasyonlar, terimler) yazıda var mı?
4. duplicate_risk — İçerik yapısı site genelinde benzer sayfalarla çakışma riski taşıyor mu?

## Yanıt Formatı
Sadece JSON döndür, başka açıklama yazma:
\`\`\`json
{
  "checks": [
    { "id": "intent_drift", "severity": "ok|warning|critical", "note": "Kısa Türkçe açıklama" },
    { "id": "robotic_language", "severity": "ok|warning|critical", "note": "..." },
    { "id": "entity_gap", "severity": "ok|warning|critical", "note": "..." },
    { "id": "duplicate_risk", "severity": "ok|warning|critical", "note": "..." }
  ],
  "content_score": 0-100,
  "human_score": 0-100
}
\`\`\``
}
```

---

## Shared Patterns

### Auth + Ownership Doğrulama
**Kaynak:** `src/app/api/ai/generate-page-package/route.ts` satır 7-30
**Uygula:** `src/app/api/ai/qa-audit/route.ts`
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return new Response('Unauthorized', { status: 401 })

const { data: project } = await supabase
  .from('projects')
  .select('id, ...')
  .eq('id', projectId)
  .eq('user_id', user.id)
  .single()
if (!project) return new Response('Project not found', { status: 404 })
```

### Server Action Auth Pattern
**Kaynak:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` satır 62-72
**Uygula:** Tüm server action'larda — zaten yerleşik
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { success: false, error: 'Oturum bulunamadı.' }

const project = await verifyOwnership(supabase, projectId, user.id)
if (!project) return { success: false, error: 'Proje bulunamadı.' }
```

### useTransition + router.refresh() Mutation Pattern
**Kaynak:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` satır 214, 331-342
**Uygula:** Tüm client-side mutation'larda — kilitleme, skor kaydetme dahil
```typescript
const [isPending, startTransition] = useTransition()
const router = useRouter()

startTransition(async () => {
  const result = await someServerAction(...)
  if (result.success) {
    router.refresh()
  }
})
```

### Dialog Pattern (render prop, asChild değil)
**Kaynak:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` satır 508-533
**Uygula:** Rules Violation Dialog + QA Dialog (her ikisi de)
```typescript
// DialogTrigger — render prop zorunlu
<DialogTrigger render={<Button variant="outline" size="sm">...</Button>} />

// DialogClose — render prop zorunlu
<DialogClose render={<Button variant="ghost" size="sm">İptal</Button>} />

// DialogContent — showCloseButton={false} + max-w-sm
<DialogContent showCloseButton={false} className="max-w-sm">
```

### Rules Resolve Pattern
**Kaynak:** `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx` satır 37-71
**Uygula:** `sayfa-paketi/page.tsx` — aynı iki sorgu + merge mantığı
```typescript
// İki sorgu: global (scope='global', project_id IS NULL) + project (scope='project', eq project_id)
// Merge: project override varsa onu kullan, yoksa global; her şeyi boolean'a çevir
const resolvedRules: Record<string, boolean> = Object.fromEntries(
  Object.keys(RULE_META).map((ruleKey) => {
    const hasOverride = ruleKey in projectOverrides
    const value = hasOverride
      ? projectOverrides[ruleKey] === 'true'
      : (globalValues[ruleKey] ?? 'true') === 'true'
    return [ruleKey, value]
  })
)
```

### Renk Kodlaması (cn + sabit Tailwind değerleri)
**Kaynak:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` satır 110-116
**Uygula:** Score Row + QA Dialog severity renkleri + QaBadge (zaten uygulanmış)
```typescript
// Score rengi — threshold bazlı
function scoreColor(n: number | null | undefined): string {
  if (n == null) return 'text-muted-foreground'
  if (n >= 80) return 'text-emerald-400'
  if (n >= 60) return 'text-amber-400'
  return 'text-red-400'
}

// QA severity rengi
function severityClass(severity: 'ok' | 'warning' | 'critical'): string {
  if (severity === 'ok') return 'text-emerald-400'
  if (severity === 'warning') return 'text-amber-400'
  return 'text-red-400'
}
```

### Typography Constraints (font-medium YASAK)
**Kaynak:** `PagePackageEditor.tsx` satır 104-106 (Field label'ları)
**Uygula:** Tüm yeni UI elementleri — diyalog başlıkları, violation listesi, score row
```typescript
// Label pattern — font-medium ASLA kullanılmaz
<Label className="text-xs font-normal text-muted-foreground uppercase tracking-wide">
  {label}
</Label>

// Score row text
<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">

// Diyalog description
<DialogDescription>  // text-sm font-normal (shadcn default)
```

---

## No Analog Found

Tüm dosyalar için yeterli analog bulundu. Hiçbir dosya "analog yok" kategorisinde değil.

| Durum | Detay |
|---|---|
| `qa-audit/route.ts` non-streaming pattern | `generate-page-package/route.ts` streaming içeriyor; non-streaming kısım `client.messages.create()` ile türetilir — SDK aynı |
| Dialog phase state makinesi | Projeye yeni bir pattern; mevcut Dialog kullanımından (satır 508-533) türetilir, tek fark `open` + `qaDialogPhase` state kombinasyonu |

---

## Metadata

**Analog arama kapsamı:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/`, `src/app/api/ai/`, `src/lib/rules/`, `src/app/(dashboard)/projeler/[id]/kurallar/`
**Okunan dosyalar:** 6 (QaBadge.tsx, PagePackageEditor.tsx, actions.ts, page.tsx, generate-page-package/route.ts, rule-meta.ts, kurallar/page.tsx)
**Pattern extraction tarihi:** 2026-04-25
