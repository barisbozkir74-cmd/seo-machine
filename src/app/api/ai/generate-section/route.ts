import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { RULE_META } from '@/lib/rules/rule-meta'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type GenerateSectionBody = {
  projectId: string
  pageId: string
  sectionIndex: number
  headingHierarchy: Array<{ level: string; text: string }>
  approvedSections?: Array<{ heading: string; content: string }>
  isRegenerate?: boolean
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const {
    projectId,
    pageId,
    sectionIndex,
    headingHierarchy,
    approvedSections,
    isRegenerate,
  } = body as Partial<GenerateSectionBody>

  if (
    !projectId ||
    !pageId ||
    sectionIndex === undefined ||
    sectionIndex === null ||
    typeof sectionIndex !== 'number' ||
    !Array.isArray(headingHierarchy)
  ) {
    return new Response(
      'projectId, pageId, sectionIndex (number) and headingHierarchy (array) are required',
      { status: 400 }
    )
  }

  // 4. Proje sahipliği + proje bilgileri
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain, sector, target_language, brand_tone')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return new Response('Project not found', { status: 404 })

  // 5. Sayfa bilgileri
  const { data: page } = await supabase
    .from('pages')
    .select('id, title, slug, page_type, focus_keyword_id')
    .eq('id', pageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!page) return new Response('Page not found', { status: 404 })

  // 6. Paket kilidi kontrolü — yalnızca locked paket için içerik üretilir
  const { data: pkg } = await supabase
    .from('page_packages')
    .select('id, status, seo_title, meta_description, h1, search_intent, strategic_purpose, page_type')
    .eq('page_id', pageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!pkg || pkg.status !== 'locked') {
    return new Response('Package must be locked to generate content.', { status: 403 })
  }

  // 7. Focus keyword
  let focusKeyword = ''
  if (page.focus_keyword_id) {
    const { data: kw } = await supabase
      .from('keywords')
      .select('keyword')
      .eq('id', page.focus_keyword_id)
      .single()
    if (kw) focusKeyword = kw.keyword
  }

  // 8. Kural sorgulama — global + proje override pattern
  const { data: globalRulesData } = await supabase
    .from('rules')
    .select('rule_key, rule_value')
    .eq('user_id', user.id)
    .eq('scope', 'global')
    .is('project_id', null)

  const { data: projectRulesData } = await supabase
    .from('rules')
    .select('rule_key, rule_value')
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .eq('scope', 'project')

  const projectOverrides = Object.fromEntries(
    (projectRulesData ?? []).map((r) => [r.rule_key, r.rule_value])
  )
  const globalValues = Object.fromEntries(
    (globalRulesData ?? []).map((r) => [r.rule_key, r.rule_value])
  )
  const resolvedRules: Record<string, boolean> = Object.fromEntries(
    Object.keys(RULE_META).map((ruleKey) => {
      const hasOverride = ruleKey in projectOverrides
      const value = hasOverride
        ? projectOverrides[ruleKey] === 'true'
        : (globalValues[ruleKey] ?? 'true') === 'true'
      return [ruleKey, value]
    })
  )

  // 9. Prompt oluştur
  const prompt = buildSectionPrompt({
    project,
    pkg,
    page,
    focusKeyword,
    headingHierarchy,
    sectionIndex,
    approvedSections: isRegenerate ? approvedSections : undefined,
    resolvedRules,
  })

  // 10. Streaming AI çağrısı
  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  // 11. Streaming response döndür
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  })
}

function buildSectionPrompt({
  project,
  pkg,
  page,
  focusKeyword,
  headingHierarchy,
  sectionIndex,
  approvedSections,
  resolvedRules,
}: {
  project: {
    name: string
    domain: string
    sector: string | null
    brand_tone: string | null
    target_language: string | null
  }
  pkg: {
    seo_title: string | null
    meta_description: string | null
    h1: string | null
    search_intent: string | null
    strategic_purpose: string | null
    page_type: string | null
  }
  page: { title: string; page_type: string | null }
  focusKeyword: string
  headingHierarchy: Array<{ level: string; text: string }>
  sectionIndex: number
  approvedSections?: Array<{ heading: string; content: string }>
  resolvedRules: Record<string, boolean>
}): string {
  const targetSection = headingHierarchy[sectionIndex]
  const targetHeading = targetSection?.text ?? `Bölüm ${sectionIndex + 1}`

  const activeRules = Object.entries(resolvedRules)
    .filter(([, active]) => active)
    .map(([key]) => `- ${RULE_META[key]?.label ?? key}`)
    .join('\n')

  const headingList = headingHierarchy
    .map((h, i) => `  ${i === sectionIndex ? '→ ' : '  '}${h.level}: ${h.text}`)
    .join('\n')

  const approvedSectionsBlock =
    approvedSections && approvedSections.length > 0
      ? `\n## Önceden Onaylanan Bölümler (akış tutarlılığı için)\n${approvedSections
          .map((s) => `### ${s.heading}\n${s.content}`)
          .join('\n\n')}\n`
      : ''

  return `Sen bir SEO içerik uzmanısın. Aşağıdaki sayfa bölümü için akıcı, SEO odaklı, marka tonuna uygun içerik üret.

## Görev
"${targetHeading}" başlıklı bölümün paragraf içeriğini yaz. Sadece paragraf metni üret — başlığı tekrar etme, JSON veya markdown başlığı kullanma. Düz metin döndür.

## Proje Bilgileri
---
Domain: ${project.domain}
Site Adı: ${project.name}
---

---
Sektör: ${project.sector ?? 'belirtilmemiş'}
Marka Tonu: ${project.brand_tone ?? 'profesyonel'}
---

Hedef Dil: ${project.target_language ?? 'Türkçe'}

## Sayfa Paketi
---
SEO Title: ${pkg.seo_title ?? 'belirtilmemiş'}
H1: ${pkg.h1 ?? 'belirtilmemiş'}
Meta Description: ${pkg.meta_description ?? 'belirtilmemiş'}
Arama Amacı: ${pkg.search_intent ?? 'belirtilmemiş'}
Sayfa Tipi: ${pkg.page_type ?? page.page_type ?? 'belirtilmemiş'}
---

---
Stratejik Amaç: ${pkg.strategic_purpose ?? 'belirtilmemiş'}
---

Focus Keyword: ${focusKeyword || 'belirtilmemiş'}

## Sayfa Yapısı (Heading Hierarchy)
${headingList}

## Hedef Bölüm
Şu anda üretilecek bölüm: **${targetHeading}**
${approvedSectionsBlock}
## Aktif SEO Kuralları
${activeRules || '- Kural tanımlı değil'}

## Üretim Kuralları
- Sadece bu bölümün paragraf içeriğini yaz
- Başlığı tekrar etme
- JSON, markdown başlığı (#, ##) veya liste kullanma
- Focus keyword'ü doğal biçimde içer
- Marka tonuna uy
- Yaklaşık 150–300 kelime, akıcı ve SEO odaklı
- ${project.target_language ?? 'Türkçe'} dilinde yaz`
}
