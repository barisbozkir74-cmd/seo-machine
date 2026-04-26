'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { saveContentSections } from '@/app/(dashboard)/projeler/[id]/sayfa-paketi/actions'
import type { ContentSection } from '@/app/(dashboard)/projeler/[id]/sayfa-paketi/actions'
import { ContentStudioHeader } from './ContentStudioHeader'
import { SectionCard } from './SectionCard'
import { HtmlReadyBanner } from './HtmlReadyBanner'

// heading_hierarchy JSONB → ContentSection[] parse
function parseHeadingHierarchy(raw: unknown): ContentSection[] {
  if (!Array.isArray(raw)) return []
  const result: ContentSection[] = []
  let currentSection: ContentSection | null = null

  for (const item of raw as Array<{ level: string; text: string }>) {
    if (item.level === 'H2') {
      if (currentSection) result.push(currentSection)
      currentSection = {
        heading: item.text,
        level: 2,
        sub_headings: [],
        content: '',
        status: 'pending',
      }
    } else if (item.level === 'H3' && currentSection) {
      currentSection.sub_headings.push(item.text)
    }
  }
  if (currentSection) result.push(currentSection)
  return result
}

type PackageData = {
  id: string
  status: string
  seo_title: string | null
  meta_description: string | null
  h1: string | null
  focus_keyword_id: string | null
  search_intent: string | null
  page_type: string | null
  strategic_purpose: string | null
  heading_hierarchy: unknown
  content_sections: unknown
  html_content: string | null
}

export type ContentStudioShellProps = {
  projectId: string
  pageId: string
  pageTitle: string
  pkg: PackageData
  resolvedRules: Record<string, boolean>
}

export function ContentStudioShell({
  projectId,
  pageId,
  pageTitle,
  pkg,
}: ContentStudioShellProps) {
  const router = useRouter()

  // Başlangıç bölümleri: DB'de kaydedilmiş content_sections varsa onu kullan, yoksa heading_hierarchy'den parse et
  const initialSections: ContentSection[] =
    Array.isArray(pkg.content_sections) && (pkg.content_sections as ContentSection[]).length > 0
      ? (pkg.content_sections as ContentSection[])
      : parseHeadingHierarchy(pkg.heading_hierarchy)

  const [sections, setSections] = useState<ContentSection[]>(initialSections)
  // Her bölüm için canlı streaming metni: index → string
  const [liveTexts, setLiveTexts] = useState<Record<number, string>>({})
  // Aktif stream sayısı
  const [generatingCount, setGeneratingCount] = useState(0)

  const approvedCount = sections.filter((s) => s.status === 'approved').length
  const allApproved = sections.length > 0 && approvedCount === sections.length
  const isGenerating = generatingCount > 0

  // Tek bölüm stream başlat
  const generateSection = useCallback(
    async (index: number, isRegenerate = false) => {
      // Durumu generating yap
      setSections((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], status: 'generating' }
        return next
      })
      setLiveTexts((prev) => ({ ...prev, [index]: '' }))
      setGeneratingCount((c) => c + 1)

      // Yeniden üretme için approved sections context'i hazırla
      const approvedSections = isRegenerate
        ? sections
            .filter((s, i) => i !== index && s.status === 'approved')
            .map((s) => ({ heading: s.heading, content: s.content }))
        : undefined

      // heading_hierarchy array'ini oluştur (generate-section route için)
      const headingHierarchy = sections.map((s) => ({ level: 'H2', text: s.heading }))

      try {
        const res = await fetch('/api/ai/generate-section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            pageId,
            sectionIndex: index,
            headingHierarchy,
            approvedSections,
            isRegenerate,
          }),
        })

        if (!res.ok) {
          throw new Error((await res.text()) || `HTTP ${res.status}`)
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error('Stream alınamadı')
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })
          setLiveTexts((prev) => ({ ...prev, [index]: accumulated }))
        }

        // Stream tamamlandı — sections'a yeni içeriği kaydet
        const updatedSections = sections.map((s, i) =>
          i === index ? { ...s, content: accumulated, status: 'draft' as const } : s
        )

        setSections(updatedSections)

        // Tüm bölümleri DB'ye kaydet (fire and forget)
        saveContentSections(projectId, pageId, updatedSections).then((result) => {
          if (result.success) router.refresh()
        })
      } catch (err) {
        console.error(`Bölüm ${index} üretilemedi:`, err)
        setSections((prev) => {
          const next = [...prev]
          next[index] = { ...next[index], status: 'draft', content: '' }
          return next
        })
      } finally {
        setGeneratingCount((c) => Math.max(0, c - 1))
        setLiveTexts((prev) => {
          const next = { ...prev }
          delete next[index]
          return next
        })
      }
    },
    [projectId, pageId, sections, router]
  )

  // Tümünü üret — paralel başlatır
  function handleGenerateAll() {
    sections.forEach((_, index) => {
      generateSection(index, false)
    })
  }

  // Yeniden üret (tekil)
  function handleRegenerate(index: number) {
    generateSection(index, true)
  }

  return (
    <div className="flex flex-col h-full">
      <ContentStudioHeader
        projectId={projectId}
        pageTitle={pageTitle}
        totalSections={sections.length}
        approvedCount={approvedCount}
        isGenerating={isGenerating}
        generatingCount={generatingCount}
        onGenerateAll={handleGenerateAll}
      />

      <div className="flex flex-1 min-h-0">
        {/* İçerik alanı (scrollable) */}
        <div className="flex-1 min-w-0 overflow-y-auto px-6 py-6 space-y-4">
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Bu sayfa paketi için heading yapısı bulunamadı. Sayfa paketinde heading_hierarchy
              ekleyin.
            </p>
          ) : (
            sections.map((section, index) => (
              <SectionCard
                key={index}
                projectId={projectId}
                pageId={pageId}
                sectionIndex={index}
                section={section}
                streamingContent={liveTexts[index]}
                onRegenerate={handleRegenerate}
              />
            ))
          )}
        </div>
      </div>

      {allApproved && <HtmlReadyBanner />}
    </div>
  )
}
