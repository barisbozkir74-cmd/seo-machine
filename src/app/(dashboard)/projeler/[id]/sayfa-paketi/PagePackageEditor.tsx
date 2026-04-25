'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { updatePagePackage, createPagePackage, updatePackageStatus } from './actions'
import { QaBadge } from './QaBadge'
import { PackageStatusBadge } from './PackageStatusBadge'
import { LockedBanner } from './LockedBanner'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'

export type PageData = {
  id: string
  title: string
  slug: string | null
  page_type: string | null
  focus_keyword_id: string | null
  focus_keyword_text?: string | null
  pkg?: {
    id: string
    status: string
    generated_by: string
    seo_title: string | null
    meta_description: string | null
    h1: string | null
    slug: string | null
    search_intent: string | null
    strategic_purpose: string | null
    secondary_keywords: unknown
    heading_hierarchy: unknown
    content_blocks: unknown
    cta_blocks: unknown
    image_plan: unknown
    alt_texts: unknown
    schema_type: string | null
    canonical_url: string | null
    faq: unknown
    schema_jsonld: unknown
  } | null
}

function jsonString(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  return JSON.stringify(val, null, 2)
}

function parseJsonField(val: string): unknown {
  const trimmed = val.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

type FieldProps = {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  rows?: number
  placeholder?: string
  mono?: boolean
  maxLen?: number
  maxLenWarning?: number
  disabled?: boolean
}

function Field({
  label,
  id,
  value,
  onChange,
  multiline,
  rows = 4,
  placeholder,
  mono,
  maxLen,
  maxLenWarning,
  disabled,
}: FieldProps) {
  const isOverHard = maxLen ? value.length > maxLen : false
  const isOverSoft = maxLenWarning ? value.length > maxLenWarning : false

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label
          htmlFor={id}
          className="text-xs font-normal text-muted-foreground uppercase tracking-wide"
        >
          {label}
        </Label>
        {maxLen && value.length > 0 && (
          <span
            className={cn(
              'text-xs',
              isOverHard ? 'text-red-400' : isOverSoft ? 'text-amber-400' : 'text-muted-foreground'
            )}
          >
            {value.length}/{maxLen}
          </span>
        )}
      </div>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
          className={cn('text-sm resize-y', mono && 'font-mono text-xs')}
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="text-sm"
        />
      )}
    </div>
  )
}

type AiGeneratedFields = {
  strategic_purpose?: string
  search_intent?: string
  seo_title?: string
  meta_description?: string
  h1?: string
  heading_hierarchy?: unknown
  schema_type?: string
  content_blocks?: unknown
  secondary_keywords?: unknown
  faq?: unknown
}

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

  let faqItems: Array<{ soru?: string; cevap?: string }> = []
  try {
    const parsed = typeof pkg?.faq === 'string' ? JSON.parse(pkg.faq as string) : pkg?.faq
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

export function PagePackageEditor({
  projectId,
  page,
}: {
  projectId: string
  page: PageData
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const pkg = page.pkg ?? null
  const isLocked = pkg?.status === 'locked'

  // Temel Bilgiler
  const [pageType, setPageType] = useState(page.page_type ?? '')
  const [strategicPurpose, setStrategicPurpose] = useState(pkg?.strategic_purpose ?? '')
  const [searchIntent, setSearchIntent] = useState(pkg?.search_intent ?? '')

  // Meta & URL
  const [slug, setSlug] = useState(pkg?.slug ?? page.slug ?? '')
  const [seoTitle, setSeoTitle] = useState(pkg?.seo_title ?? '')
  const [metaDescription, setMetaDescription] = useState(pkg?.meta_description ?? '')
  const [h1, setH1] = useState(pkg?.h1 ?? '')
  const [canonicalUrl, setCanonicalUrl] = useState(pkg?.canonical_url ?? '')

  // Heading
  const [headingHierarchy, setHeadingHierarchy] = useState(jsonString(pkg?.heading_hierarchy))

  // Schema
  const [schemaType, setSchemaType] = useState(pkg?.schema_type ?? '')

  // İçerik
  const [contentBlocks, setContentBlocks] = useState(jsonString(pkg?.content_blocks))
  const [ctaBlocks, setCtaBlocks] = useState(jsonString(pkg?.cta_blocks))

  // Görsel
  const [imagePlan, setImagePlan] = useState(jsonString(pkg?.image_plan))
  const [altTexts, setAltTexts] = useState(jsonString(pkg?.alt_texts))

  // Keywords
  const [secondaryKeywords, setSecondaryKeywords] = useState(jsonString(pkg?.secondary_keywords))

  // FAQ
  const [faq, setFaq] = useState(jsonString(pkg?.faq))

  // Schema (Phase 10)
  const [schemaJsonLd, setSchemaJsonLd] = useState(jsonString(pkg?.schema_jsonld))
  const [activeTab, setActiveTab] = useState<'paket' | 'schema'>('paket')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  // Feedback
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // AI state
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [aiError, setAiError] = useState('')

  function applyAiFields(fields: AiGeneratedFields) {
    if (fields.strategic_purpose) setStrategicPurpose(fields.strategic_purpose)
    if (fields.search_intent) setSearchIntent(fields.search_intent)
    if (fields.seo_title) setSeoTitle(fields.seo_title)
    if (fields.meta_description) setMetaDescription(fields.meta_description)
    if (fields.h1) setH1(fields.h1)
    if (fields.heading_hierarchy) setHeadingHierarchy(jsonString(fields.heading_hierarchy))
    if (fields.schema_type) setSchemaType(fields.schema_type)
    if (fields.content_blocks) setContentBlocks(jsonString(fields.content_blocks))
    if (fields.secondary_keywords) setSecondaryKeywords(jsonString(fields.secondary_keywords))
    if (fields.faq) setFaq(jsonString(fields.faq))
  }

  async function handleAiGenerate() {
    setAiStatus('loading')
    setAiError('')
    try {
      const res = await fetch('/api/ai/generate-page-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, pageId: page.id }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }

      // Stream okuma
      const reader = res.body?.getReader()
      if (!reader) throw new Error('Stream alınamadı')

      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
      }

      // JSON extract: ```json ... ``` veya düz JSON
      const jsonMatch =
        accumulated.match(/```json\s*([\s\S]*?)```/) ?? accumulated.match(/(\{[\s\S]*\})/)
      const jsonText = jsonMatch ? jsonMatch[1] : accumulated

      const parsed = JSON.parse(jsonText.trim()) as AiGeneratedFields
      applyAiFields(parsed)
      setAiStatus('done')
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Bilinmeyen hata')
      setAiStatus('error')
    }
  }

  async function handleManualStart() {
    startTransition(async () => {
      const result = await createPagePackage(projectId, page.id, 'manual')
      if (result.success) {
        router.refresh()
      } else {
        setSaveStatus('error')
        setErrorMsg(result.error)
      }
    })
  }

  async function handleStatusChange(newStatus: 'draft' | 'approved' | 'locked') {
    if (!pkg?.id) return
    startTransition(async () => {
      const result = await updatePackageStatus(projectId, pkg.id, newStatus)
      if (result.success) {
        router.refresh()
      } else {
        setSaveStatus('error')
        setErrorMsg(result.error)
      }
    })
  }

  function handleGenerateSchema() {
    const result = generateSchemaJsonLd(page)
    setSchemaJsonLd(JSON.stringify(result, null, 2))
  }

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

  function handleSave() {
    setSaveStatus('idle')
    startTransition(async () => {
      // package yoksa önce oluştur
      if (!pkg) {
        const createResult = await createPagePackage(
          projectId,
          page.id,
          aiStatus === 'done' ? 'ai' : 'manual'
        )
        if (!createResult.success) {
          setSaveStatus('error')
          setErrorMsg(createResult.error)
          return
        }
      }

      const result = await updatePagePackage(projectId, page.id, {
        page_type: pageType || undefined,
        strategic_purpose: strategicPurpose || undefined,
        search_intent: searchIntent || undefined,
        slug: slug || undefined,
        seo_title: seoTitle || undefined,
        meta_description: metaDescription || undefined,
        h1: h1 || undefined,
        canonical_url: canonicalUrl || undefined,
        heading_hierarchy: parseJsonField(headingHierarchy),
        schema_type: schemaType || undefined,
        content_blocks: parseJsonField(contentBlocks),
        cta_blocks: parseJsonField(ctaBlocks),
        image_plan: parseJsonField(imagePlan),
        alt_texts: parseJsonField(altTexts),
        secondary_keywords: parseJsonField(secondaryKeywords),
        faq: parseJsonField(faq),
        schema_jsonld: parseJsonField(schemaJsonLd),
      })

      if (result.success) {
        setSaveStatus('success')
        router.refresh()
      } else {
        setSaveStatus('error')
        setErrorMsg(result.error)
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Header: sayfa adı + badge'ler + aksiyon butonları */}
      <div className="space-y-2 mb-6">
        <div>
          <h2 className="text-base font-semibold">{page.title}</h2>
          {page.focus_keyword_text && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Focus keyword:{' '}
              <span className="text-foreground">{page.focus_keyword_text}</span>
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            {pkg !== null && (
              <QaBadge
                seoTitle={seoTitle}
                metaDescription={metaDescription}
                h1={h1}
                focusKeyword={page.focus_keyword_text ?? null}
              />
            )}
            <PackageStatusBadge status={pkg?.status ?? null} />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* No package state */}
            {!pkg && (
              <>
                <Button
                  size="sm"
                  onClick={handleAiGenerate}
                  disabled={aiStatus === 'loading' || isPending}
                >
                  {aiStatus === 'loading' ? 'Üretiliyor...' : 'AI ile Üret'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualStart}
                  disabled={isPending}
                >
                  Manuel Başlat
                </Button>
              </>
            )}

            {/* draft */}
            {pkg?.status === 'draft' && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleStatusChange('approved')}
                  disabled={isPending}
                >
                  Onayla
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAiGenerate}
                  disabled={aiStatus === 'loading' || isPending}
                >
                  {aiStatus === 'loading' ? 'Üretiliyor...' : 'AI ile Üret'}
                </Button>
              </>
            )}

            {/* approved */}
            {pkg?.status === 'approved' && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleStatusChange('locked')}
                  disabled={isPending}
                >
                  Kilitle
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAiGenerate}
                  disabled={aiStatus === 'loading' || isPending}
                >
                  {aiStatus === 'loading' ? 'Üretiliyor...' : 'AI ile Üret'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStatusChange('draft')}
                  disabled={isPending}
                >
                  Taslağa Al
                </Button>
              </>
            )}

            {/* locked — Dialog confirmation */}
            {pkg?.status === 'locked' && (
              <Dialog>
                <DialogTrigger render={<Button variant="outline" size="sm">Kilidini Aç</Button>} />
                <DialogContent showCloseButton={false} className="max-w-sm">
                  <DialogTitle>Paketi kilidden çıkar</DialogTitle>
                  <DialogDescription>
                    Bu sayfa paketi kilitli. Kilidini açarsan düzenlenebilir hale gelir ve onay
                    durumuna döner.
                  </DialogDescription>
                  <div className="flex gap-2 justify-end mt-2">
                    <DialogClose render={<Button variant="ghost" size="sm">İptal</Button>} />
                    <DialogClose
                      render={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange('approved')}
                          disabled={isPending}
                        >
                          Kilidini Aç
                        </Button>
                      }
                    />
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* AI feedback */}
        {aiStatus === 'done' && (
          <p className="text-xs text-emerald-500">Alanlar dolduruldu — kaydetmeyi unutma.</p>
        )}
        {aiStatus === 'error' && (
          <p className="text-xs text-red-400">
            {aiError || 'AI üretimi başarısız oldu. Lütfen tekrar dene.'}
          </p>
        )}
      </div>

      {/* Locked banner */}
      {isLocked && (
        <LockedBanner
          onUnlockClick={() => handleStatusChange('approved')}
          isPending={isPending}
        />
      )}

      {/* Tab navigasyonu — sadece pkg mevcut iken göster */}
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

      {/* Paket sekmesi içeriği */}
      {(pkg === null || activeTab === 'paket') && (
        <>

      {/* 1. Temel Bilgiler */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold border-b border-border pb-2">Temel Bilgiler</h3>
        <Field
          label="Sayfa Tipi"
          id="page_type"
          value={pageType}
          onChange={setPageType}
          placeholder="ör. landing, blog, category"
          disabled={isLocked}
        />
        <Field
          label="Focus Keyword"
          id="focus_keyword"
          value={page.focus_keyword_text ?? '—'}
          onChange={() => {}}
          placeholder="—"
          disabled
        />
        <Field
          label="Sayfa Amacı"
          id="strategic_purpose"
          value={strategicPurpose}
          onChange={setStrategicPurpose}
          multiline
          rows={3}
          placeholder="Bu sayfanın stratejik amacı..."
          disabled={isLocked}
        />
        <Field
          label="Search Intent"
          id="search_intent"
          value={searchIntent}
          onChange={setSearchIntent}
          placeholder="ör. informational, transactional, navigational"
          disabled={isLocked}
        />
      </section>

      {/* 2. Meta & URL */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold border-b border-border pb-2">Meta & URL</h3>
        <Field
          label="Slug"
          id="slug"
          value={slug}
          onChange={setSlug}
          placeholder="/sayfa-url"
          disabled={isLocked}
        />
        <Field
          label="SEO Title"
          id="seo_title"
          value={seoTitle}
          onChange={setSeoTitle}
          placeholder="Arama sonuçlarında görünecek başlık"
          maxLen={60}
          maxLenWarning={55}
          disabled={isLocked}
        />
        <Field
          label="Meta Description"
          id="meta_description"
          value={metaDescription}
          onChange={setMetaDescription}
          multiline
          rows={3}
          placeholder="Arama sonuçlarında görünecek açıklama (155 karakter)"
          maxLen={155}
          maxLenWarning={140}
          disabled={isLocked}
        />
        <Field
          label="H1"
          id="h1"
          value={h1}
          onChange={setH1}
          placeholder="Sayfanın H1 başlığı"
          disabled={isLocked}
        />
        <Field
          label="Canonical URL"
          id="canonical_url"
          value={canonicalUrl}
          onChange={setCanonicalUrl}
          placeholder="https://example.com/sayfa"
          disabled={isLocked}
        />
      </section>

      {/* 3. Heading Yapısı */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold border-b border-border pb-2">Heading Yapısı</h3>
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
      </section>

      {/* 4. Schema */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold border-b border-border pb-2">Schema</h3>
        <Field
          label="Schema Tipi"
          id="schema_type"
          value={schemaType}
          onChange={setSchemaType}
          placeholder="ör. Article, Product, FAQPage, LocalBusiness"
          disabled={isLocked}
        />
      </section>

      {/* 5. İçerik Blokları */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold border-b border-border pb-2">İçerik Blokları</h3>
        <Field
          label="Content Blocks (JSON)"
          id="content_blocks"
          value={contentBlocks}
          onChange={setContentBlocks}
          multiline
          rows={8}
          mono
          placeholder={'[\n  { "type": "hero", "content": "..." }\n]'}
          disabled={isLocked}
        />
      </section>

      {/* 6. CTA Blokları */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold border-b border-border pb-2">CTA Blokları</h3>
        <Field
          label="CTA Blocks (JSON)"
          id="cta_blocks"
          value={ctaBlocks}
          onChange={setCtaBlocks}
          multiline
          rows={6}
          mono
          placeholder={'[\n  { "label": "Hemen Başla", "url": "/kayit" }\n]'}
          disabled={isLocked}
        />
      </section>

      {/* 7. Görsel Planı */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold border-b border-border pb-2">Görsel Planı</h3>
        <Field
          label="Image Plan (JSON)"
          id="image_plan"
          value={imagePlan}
          onChange={setImagePlan}
          multiline
          rows={6}
          mono
          placeholder={'[\n  { "section": "hero", "description": "..." }\n]'}
          disabled={isLocked}
        />
        <Field
          label="Alt Textler (JSON)"
          id="alt_texts"
          value={altTexts}
          onChange={setAltTexts}
          multiline
          rows={4}
          mono
          placeholder={'[\n  { "image": "hero.jpg", "alt": "..." }\n]'}
          disabled={isLocked}
        />
      </section>

      {/* 8. Secondary Keywords */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold border-b border-border pb-2">Secondary Keywords</h3>
        <Field
          label="Secondary Keywords (JSON array)"
          id="secondary_keywords"
          value={secondaryKeywords}
          onChange={setSecondaryKeywords}
          multiline
          rows={4}
          mono
          placeholder={'[\n  "keyword bir",\n  "keyword iki"\n]'}
          disabled={isLocked}
        />
      </section>

      {/* 9. FAQ */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold border-b border-border pb-2">FAQ</h3>
        <Field
          label="FAQ (JSON array)"
          id="faq"
          value={faq}
          onChange={setFaq}
          multiline
          rows={8}
          mono
          placeholder={'[\n  { "soru": "...", "cevap": "..." }\n]'}
          disabled={isLocked}
        />
      </section>

        </>
      )}

      {/* Schema sekmesi içeriği */}
      {pkg !== null && activeTab === 'schema' && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold border-b border-border pb-2">JSON-LD Schema</h3>

          {!schemaJsonLd ? (
            /* Boş durum */
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
            /* Dolu durum */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-normal text-muted-foreground uppercase tracking-wide">
                  JSON-LD
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopySchema}
                  className={cn(
                    copyStatus === 'copied' && 'text-emerald-500',
                    copyStatus === 'error' && 'text-red-400'
                  )}
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

      {/* Kaydet */}
      {!isLocked && (
        <div className="flex items-center gap-4 pt-2 pb-8">
          <Button onClick={handleSave} disabled={isPending} className="min-w-24">
            {isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>

          {saveStatus === 'success' && (
            <span className="text-sm text-emerald-600">Kaydedildi.</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm text-red-500">{errorMsg || 'Kayıt sırasında hata oluştu. Lütfen tekrar dene.'}</span>
          )}
        </div>
      )}
    </div>
  )
}
