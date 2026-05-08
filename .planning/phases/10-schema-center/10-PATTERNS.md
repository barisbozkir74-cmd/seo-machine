# Phase 10: Schema Center - Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 4 (3 modified + 1 new migration)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` | component | request-response + client-side transform | Self (evolve existing file) | exact — evolve in place |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` | service (server action) | CRUD | Self (evolve existing file) | exact — add field to existing type/action |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx` | page (server component) | request-response | Self (evolve existing file) | exact — add column to SELECT |
| `supabase/migrations/20260425000001_add_schema_jsonld.sql` | migration | CRUD | `supabase/migrations/20260424000003_competitors_seo_columns.sql` | exact — additive ALTER TABLE |

---

## Pattern Assignments

### `PagePackageEditor.tsx` — Tab Navigation Addition

**Analog:** Self (lines 1–710 already read)

**Existing state pattern to extend** (lines 163–205):
```typescript
// Mevcut state blokları — schema_jsonld state bu bloğun sonuna eklenir
const [faq, setFaq] = useState(jsonString(pkg?.faq))
const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

// YENİ: Tab state
const [activeTab, setActiveTab] = useState<'paket' | 'schema'>('paket')

// YENİ: Schema JSON-LD state
const [schemaJsonLd, setSchemaJsonLd] = useState(jsonString(pkg?.schema_jsonld))

// YENİ: Copy button feedback state
const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
```

**Tab bar markup pattern** (insert between LockedBanner block line ~481 and first `<section>` line ~484, conditional on `pkg !== null`):
```tsx
{pkg !== null && (
  <div className="flex gap-1 border-b border-border">
    <button
      onClick={() => setActiveTab('paket')}
      className={cn(
        'px-3 py-2 text-sm',
        activeTab === 'paket'
          ? 'border-b-2 border-foreground font-semibold'
          : 'text-muted-foreground'
      )}
    >
      Paket
    </button>
    <button
      onClick={() => setActiveTab('schema')}
      className={cn(
        'px-3 py-2 text-sm',
        activeTab === 'schema'
          ? 'border-b-2 border-foreground font-semibold'
          : 'text-muted-foreground'
      )}
    >
      Schema
    </button>
  </div>
)}
```

**Paket tab conditional render** — wrap all `<section>` blocks (lines 483–691) inside:
```tsx
{activeTab === 'paket' && (
  <>
    {/* existing sections 1–9 unchanged */}
  </>
)}
```

**Schema tab content pattern** (insert after the Paket conditional block):
```tsx
{activeTab === 'schema' && (
  <section className="space-y-4">
    <h3 className="text-sm font-semibold border-b border-border pb-2">JSON-LD Schema</h3>

    {!schemaJsonLd ? (
      /* Empty state */
      <div className="space-y-3 py-4">
        <p className="text-sm text-muted-foreground">
          Bu sayfa için henüz schema üretilmedi.
        </p>
        <p className="text-xs text-muted-foreground">
          Sayfa tipine göre otomatik JSON-LD oluşturmak için Schema Üret butonuna tıkla.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateSchema}
          disabled={isLocked}
        >
          Schema Üret
        </Button>
      </div>
    ) : (
      /* Filled state */
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-normal text-muted-foreground uppercase tracking-wide">
            JSON-LD
          </Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopySchema}
            className={cn(copyStatus === 'copied' && 'text-emerald-500')}
          >
            {copyStatus === 'copied'
              ? 'Kopyalandı ✓'
              : copyStatus === 'error'
              ? 'Kopyalanamadı'
              : 'Kopyala'}
          </Button>
        </div>
        <Field
          label=""
          id="schema_jsonld"
          value={schemaJsonLd}
          onChange={setSchemaJsonLd}
          multiline
          rows={12}
          mono
          placeholder="Schema Üret butonuna tıklayarak JSON-LD oluştur."
          disabled={isLocked}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateSchema}
          disabled={isLocked}
        >
          Schema Üret
        </Button>
      </div>
    )}
  </section>
)}
```

**generateSchemaJsonLd function** (new pure function, add above the component export):
```typescript
function generateSchemaJsonLd(page: PageData): object | object[] {
  const pkg = page.pkg
  const pageType = page.page_type ?? null
  const name = pkg?.seo_title || page.title || ''
  const description = pkg?.meta_description || ''
  const url = pkg?.canonical_url || ''

  const baseSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': (() => {
      switch (pageType) {
        case 'homepage': return ['Organization', 'WebSite']
        case 'service':  return 'Service'
        case 'product':  return 'Product'
        case 'blog':     return 'Article'
        case 'category':
        case 'landing':
        default:         return 'WebPage'
      }
    })(),
    ...(name        && { name }),
    ...(description && { description }),
    ...(url         && { url }),
  }

  // FAQPage augmentation
  let faqItems: Array<{ soru?: string; cevap?: string }> = []
  try {
    const parsed = typeof pkg?.faq === 'string' ? JSON.parse(pkg.faq) : pkg?.faq
    if (Array.isArray(parsed) && parsed.length > 0) faqItems = parsed
  } catch { /* ignore */ }

  if (faqItems.length > 0) {
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.soru ?? '',
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.cevap ?? '',
        },
      })),
    }
    return [baseSchema, faqSchema]
  }

  return baseSchema
}
```

**handleGenerateSchema handler** (add inside the component, alongside handleSave):
```typescript
function handleGenerateSchema() {
  const result = generateSchemaJsonLd(page)
  setSchemaJsonLd(JSON.stringify(result, null, 2))
}
```

**handleCopySchema handler** (add inside the component):
```typescript
async function handleCopySchema() {
  try {
    await navigator.clipboard.writeText(schemaJsonLd)
    setCopyStatus('copied')
    setTimeout(() => setCopyStatus('idle'), 2000)
  } catch {
    setCopyStatus('error')
    setTimeout(() => setCopyStatus('idle'), 2000)
  }
}
```

**handleSave extension** — add `schema_jsonld` to the updatePagePackage call (lines 305–322):
```typescript
const result = await updatePagePackage(projectId, page.id, {
  // ...existing fields unchanged...
  faq: parseJsonField(faq),
  schema_jsonld: parseJsonField(schemaJsonLd),  // NEW
})
```

**Kaydet button conditional** — currently `{!isLocked && ...}` at line 694. This block stays unchanged; it already covers both tabs because `activeTab` does not gate the save button.

**PageData type extension** (lines 30–49) — add `schema_jsonld` field to `pkg`:
```typescript
pkg?: {
  // ...existing fields...
  schema_type: string | null
  canonical_url: string | null
  faq: unknown
  schema_jsonld: unknown  // NEW
} | null
```

---

### `actions.ts` — PagePackageData Type + updatePagePackage Extension

**Analog:** Self (lines 1–210 already read)

**PagePackageData type extension** (lines 13–39) — add one field after `faq`:
```typescript
export type PagePackageData = {
  // ...existing fields unchanged...
  // FAQ
  faq?: unknown
  // Schema JSON-LD (Phase 10)
  schema_jsonld?: unknown
  // QA
  qa_scores?: unknown
}
```

No other changes to `actions.ts`. The upsert at lines 73–83 uses spread `...data` so the new field flows through automatically once it is on the type.

---

### `page.tsx` — SELECT Query Extension

**Analog:** Self (lines 99–109 already read)

**SELECT string extension** (line 104 — add `schema_jsonld` to the column list):
```typescript
const { data: pkgData } = await supabase
  .from('page_packages')
  .select(
    'id, status, generated_by, seo_title, meta_description, h1, slug, search_intent, strategic_purpose, secondary_keywords, heading_hierarchy, content_blocks, cta_blocks, image_plan, alt_texts, schema_type, canonical_url, faq, schema_jsonld'
  )
  .eq('page_id', selectedPage.id)
  .single()
```

No other changes needed. `pkg` is cast as `PageData['pkg']` which will include the new field once the type is updated in `PagePackageEditor.tsx`.

---

### `supabase/migrations/20260425000001_add_schema_jsonld.sql` — New Migration File

**Analog:** `supabase/migrations/20260424000003_competitors_seo_columns.sql` (additive ALTER TABLE, 3 lines)

**Full migration content to write:**
```sql
-- Phase 10: Schema Center — schema_jsonld column
-- Adds JSONB column to page_packages for storing generated JSON-LD objects.
ALTER TABLE public.page_packages
  ADD COLUMN IF NOT EXISTS schema_jsonld JSONB;
```

Pattern notes:
- `IF NOT EXISTS` is the project convention (seen in all additive migrations)
- No DEFAULT needed — null means "not yet generated" (used as empty state signal in Phase 10)
- No index needed — column is read by page_id lookup, not filtered or sorted on its own
- No RLS change needed — table-level policies already cover all columns

---

## Shared Patterns

### JSON Field Serialization / Deserialization
**Source:** `PagePackageEditor.tsx` lines 52–66
**Apply to:** `schema_jsonld` state init, `handleSave()`, `generateSchemaJsonLd()` output
```typescript
function jsonString(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  return JSON.stringify(val, null, 2)
}

function parseJsonField(val: string): unknown {
  const trimmed = val.trim()
  if (!trimmed) return null
  try { return JSON.parse(trimmed) } catch { return trimmed }
}
```

### Mono Textarea via Field Component
**Source:** `PagePackageEditor.tsx` lines 573–587 (heading_hierarchy field)
**Apply to:** `schema_jsonld` textarea in Schema tab
```tsx
<Field
  label="Heading Hierarchy (JSON)"
  id="heading_hierarchy"
  value={headingHierarchy}
  onChange={setHeadingHierarchy}
  multiline
  rows={6}
  mono
  placeholder={'[\n  { "level": "H2", "text": "Bölüm Başlığı" }\n]'}
  disabled={isLocked}
/>
```
Schema tab uses `rows={12}` per UI-SPEC and placeholder `"Schema Üret butonuna tıklayarak JSON-LD oluştur."`.

### Ownership + Auth Check (Server Actions)
**Source:** `actions.ts` lines 42–50 + 63–71
**Apply to:** No new server actions in Phase 10 — pattern is inherited by `updatePagePackage` which already implements it
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
// Usage: const project = await verifyOwnership(supabase, projectId, user.id)
// if (!project) return { success: false, error: 'Proje bulunamadı.' }
```

### Feedback State Pattern (emerald-500 / red-400)
**Source:** `PagePackageEditor.tsx` lines 465–472
**Apply to:** `copyStatus` feedback in Schema tab — same color tokens
```tsx
{aiStatus === 'done' && (
  <p className="text-xs text-emerald-500">Alanlar dolduruldu — kaydetmeyi unutma.</p>
)}
{aiStatus === 'error' && (
  <p className="text-xs text-red-400">...</p>
)}
```
Copy feedback pattern: `copyStatus === 'copied'` → `text-emerald-500`, `copyStatus === 'error'` → `text-red-400`. Timeout: 2000ms via `setTimeout`.

### Section Header
**Source:** `PagePackageEditor.tsx` line 485
**Apply to:** Schema tab section header
```tsx
<h3 className="text-sm font-semibold border-b border-border pb-2">JSON-LD Schema</h3>
```

### Locked / Disabled Gate
**Source:** `PagePackageEditor.tsx` line 166 + all `disabled={isLocked}` props
**Apply to:** "Schema Üret" button and schema textarea in Schema tab
```typescript
const isLocked = pkg?.status === 'locked'
// ...
disabled={isLocked}
```

### Dialog Pattern (base-ui)
**Source:** `PagePackageEditor.tsx` lines 435–460
**Apply to:** Phase 10 has no new dialogs — pattern recorded for reference only
```tsx
<DialogTrigger render={<Button variant="outline" size="sm">...</Button>} />
// NOT asChild — base-ui uses render={} prop
```

---

## UI Constraint Reminders (from UI-SPEC)

| Constraint | Rule |
|------------|------|
| `font-medium` | PROHIBITED — use `font-semibold` or `font-normal` |
| Badge `variant` | PROHIBITED — use `className` with direct color classes |
| `DialogTrigger asChild` | PROHIBITED — use `render={}` prop |
| "Schema Üret" button | `variant="outline"` — NOT accent/primary |
| "Kopyala" button | `variant="ghost"` — NOT accent/primary |
| Active tab underline | `border-b-2 border-foreground` |
| Inactive tab | `text-muted-foreground` |
| Copy success color | `text-emerald-500` |
| Copy error color | `text-red-400` |

---

## No Analog Found

None. All four files have direct analogs — three are self-evolutions of existing files, one follows the established additive migration pattern.

---

## Metadata

**Analog search scope:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/`, `supabase/migrations/`
**Files read:** 7 (PagePackageEditor.tsx, actions.ts, page.tsx, 20260424000005_create_page_packages.sql, 20260424000003_competitors_seo_columns.sql, 20260424000004_competitors_analysis_column.sql, 10-CONTEXT.md, 10-UI-SPEC.md)
**Pattern extraction date:** 2026-04-25
