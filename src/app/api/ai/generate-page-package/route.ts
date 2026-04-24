import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
  const { projectId, pageId } = body as { projectId?: string; pageId?: string }
  if (!projectId || !pageId) {
    return new Response('projectId and pageId are required', { status: 400 })
  }

  // Proje bilgileri
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain, sector, target_country, target_language, business_model, site_type, brand_tone, target_customer, main_goal')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return new Response('Project not found', { status: 404 })

  // Sayfa bilgileri
  const { data: page } = await supabase
    .from('pages')
    .select('id, title, slug, page_type, focus_keyword_id')
    .eq('id', pageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!page) return new Response('Page not found', { status: 404 })

  // D-03: Locked package'ı AI ile regenerate edemezsin — önce kilidi aç
  const { data: existingPkg } = await supabase
    .from('page_packages')
    .select('id, status')
    .eq('page_id', pageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (existingPkg?.status === 'locked') {
    return new Response('Package is locked. Unlock before regenerating.', { status: 403 })
  }

  // Focus keyword
  let focusKeyword = ''
  if (page.focus_keyword_id) {
    const { data: kw } = await supabase
      .from('keywords')
      .select('keyword, volume, difficulty')
      .eq('id', page.focus_keyword_id)
      .single()
    if (kw) focusKeyword = `${kw.keyword} (vol: ${kw.volume ?? '?'}, KD: ${kw.difficulty ?? '?'})`
  }

  // Kümedeki diğer keywordler (ilgili secondary keywords için)
  const { data: relatedKws } = await supabase
    .from('keywords')
    .select('keyword, volume')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .order('volume', { ascending: false, nullsFirst: false })
    .limit(30)

  // Araştırma verisi
  const { data: research } = await supabase
    .from('research_reports')
    .select('section_key, rows')
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  const researchSummary = (research ?? []).map((r) => {
    const rows = Array.isArray(r.rows) ? r.rows as Record<string, string>[] : []
    const lines = rows.map((row) => Object.values(row).join(' | ')).join('\n')
    return `### ${r.section_key}\n${lines}`
  }).join('\n\n')

  const prompt = buildPrompt({
    project,
    page,
    focusKeyword,
    relatedKws: relatedKws ?? [],
    researchSummary,
  })

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
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

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  })
}

function buildPrompt({
  project,
  page,
  focusKeyword,
  relatedKws,
  researchSummary,
}: {
  project: Record<string, string | null>
  page: Record<string, unknown>
  focusKeyword: string
  relatedKws: Array<{ keyword: string; volume: number | null }>
  researchSummary: string
}) {
  const kwList = relatedKws.map((k) => k.keyword).join(', ')

  return `Sen bir SEO strateji uzmanısın. Aşağıdaki proje ve sayfa bilgilerini kullanarak sayfa paketini JSON formatında doldur.

## Proje Bilgileri
- Domain: ${project.domain}
- Sektör: ${project.sector ?? 'belirtilmemiş'}
- Hedef Ülke: ${project.target_country ?? 'belirtilmemiş'}
- Hedef Dil: ${project.target_language ?? 'Türkçe'}
- İş Modeli: ${project.business_model ?? 'belirtilmemiş'}
- Site Tipi: ${project.site_type ?? 'belirtilmemiş'}
- Marka Tonu: ${project.brand_tone ?? 'profesyonel'}
- Hedef Müşteri: ${project.target_customer ?? 'belirtilmemiş'}
- Ana Hedef: ${project.main_goal ?? 'belirtilmemiş'}

## Sayfa Bilgileri
- Sayfa Adı: ${page.title}
- Mevcut Slug: ${page.slug ?? 'belirsiz'}
- Sayfa Tipi: ${page.page_type ?? 'belirtilmemiş'}
- Focus Keyword: ${focusKeyword || 'belirtilmemiş'}

## Proje Keywordleri (ilgili olanları secondary keyword olarak kullan)
${kwList || 'Henüz keyword eklenmemiş'}

${researchSummary ? `## Araştırma Verileri\n${researchSummary}` : ''}

## Görev
Aşağıdaki JSON formatında sayfa paketini doldur. Her alan için gerçekçi, SEO odaklı içerik üret.

\`\`\`json
{
  "strategic_purpose": "Bu sayfanın SEO ve iş hedefleri açısından stratejik amacı (2-3 cümle)",
  "search_intent": "informational | transactional | navigational | commercial",
  "seo_title": "SEO başlığı (max 60 karakter, focus keyword içermeli)",
  "meta_description": "Meta açıklama (max 155 karakter, CTA içermeli)",
  "h1": "Sayfanın H1 başlığı",
  "heading_hierarchy": [
    { "level": "H2", "text": "Bölüm başlığı" },
    { "level": "H3", "text": "Alt bölüm" }
  ],
  "schema_type": "Article | Product | FAQPage | LocalBusiness | Service | WebPage",
  "content_blocks": [
    { "type": "intro", "description": "Giriş paragrafı ne anlatmalı" },
    { "type": "section", "heading": "H2 başlığı", "description": "Bu bölümde ne olmalı" }
  ],
  "secondary_keywords": ["keyword 1", "keyword 2", "keyword 3"],
  "faq": [
    { "soru": "Sık sorulan soru?", "cevap": "Cevap metni" }
  ]
}
\`\`\`

Sadece JSON döndür, başka açıklama yazma.`
}
