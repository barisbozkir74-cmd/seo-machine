import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { readHub, hubToPromptContext } from '@/lib/ai-context/hub'
import { buildFullSystemPrompt } from '@/core/context/prompt-builder'
import { checkPhasePrerequisites } from '@/core/phase/engine'
import { checkOutputAgainstLockedDecisions } from '@/core/decision/decision-guard'
import { logGuardFailure } from '@/core/decision/guard-policy'

function getClient() { return new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) }

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
  const { projectId, pageId, keywordBrief } = body as {
    projectId?: string
    pageId?: string
    keywordBrief?: { supporting?: string[]; long_tail?: string[]; question?: string[]; commercial?: string[]; synonym?: string[] } | null
  }
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
    .select('id, title, slug, page_type, focus_keyword_id, source_wp_id')
    .eq('id', pageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!page) return new Response('Page not found', { status: 404 })

  // Improvement context — fetch WP source if this is an improvement brief
  let wpSourceContext: Record<string, unknown> | null = null
  if (page.source_wp_id) {
    const { data: wpPage } = await supabase
      .from('project_imported_pages')
      .select('title, slug, link, gsc_clicks, gsc_impressions, gsc_avg_position, content_summary, primary_intent, flag_orphan, flag_weak_page, flag_outdated, flag_missing_metadata, flag_missing_keyword, flag_duplicate_intent')
      .eq('project_id', projectId)
      .eq('wp_id', page.source_wp_id)
      .single()
    if (wpPage) wpSourceContext = wpPage as Record<string, unknown>
  }

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

  // Phase check — content_generation: keywords=0 ise blokla
  const phaseResult = await checkPhasePrerequisites(supabase, projectId, user.id, 'content_generation')
  if (phaseResult.blocked) {
    return new Response(
      JSON.stringify({ error: 'Önce keyword stratejisi oluşturun.', missing: phaseResult.missing_prerequisites }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
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

  // Merkezi karar havuzu
  const hub = await readHub(projectId, user.id, supabase).catch(() => null)
  const hubContext = hub ? hubToPromptContext(hub) : ''

  const baseSystemPrompt = buildPrompt({
    project,
    page,
    focusKeyword,
    relatedKws: relatedKws ?? [],
    keywordBrief: keywordBrief ?? null,
    researchSummary,
    hubContext,
    wpSourceContext,
  })

  // 4-katman sistem promptu
  const { systemPrompt } = await buildFullSystemPrompt(supabase, {
    projectId,
    userId: user.id,
    section: 'icerik-studio',
    baseSystemPrompt,
    phaseWarning: phaseResult.warning_text,
  })

  // Pre-stream fail-close guard (Wave H) — sayfa metadatası üzerinden kilitli kararlarla karşılaştır.
  // Stream başlamadan önce bloklanır: violation → 409; crash → 503.
  const preflightText = [project.name, project.domain, page.title, page.slug, page.page_type, focusKeyword]
    .filter(Boolean).join(' ')
  try {
    const preflightGuard = await checkOutputAgainstLockedDecisions(supabase, projectId, user.id, preflightText, 'icerik-studio')
    if (!preflightGuard.passed) {
      return new Response(
        JSON.stringify({ error: 'Sayfa metadatası kilitli kararlarla çakışıyor — paket oluşturulamadı', code: 'DECISION_CONFLICT', violations: preflightGuard.violations }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    }
  } catch (guardError) {
    logGuardFailure('ai/generate-page-package', guardError)
    return new Response(
      JSON.stringify({ error: 'Guard kontrolü başarısız — paket oluşturulamadı', code: 'GUARD_ERROR' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const stream = await getClient().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4000,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Sayfa paketini JSON formatında oluştur.' },
    ],
  })

  const encoder = new TextEncoder()
  let streamOutput = ''
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? ''
        if (text) {
          streamOutput += text
          controller.enqueue(encoder.encode(text))
        }
      }
      controller.close()
      // Guard: stream tamamlandıktan sonra çalışır, bloklamaz
      checkOutputAgainstLockedDecisions(supabase, projectId, user.id, streamOutput, 'icerik-studio')
        .catch(() => {})
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
  keywordBrief,
  researchSummary,
  hubContext,
  wpSourceContext,
}: {
  project: Record<string, string | null>
  page: Record<string, unknown>
  focusKeyword: string
  relatedKws: Array<{ keyword: string; volume: number | null }>
  keywordBrief: { supporting?: string[]; long_tail?: string[]; question?: string[]; commercial?: string[]; synonym?: string[] } | null
  researchSummary: string
  hubContext: string
  wpSourceContext: Record<string, unknown> | null
}) {
  let kwSection: string
  if (keywordBrief) {
    const parts: string[] = []
    if (keywordBrief.supporting?.length)  parts.push(`Supporting: ${keywordBrief.supporting.join(', ')}`)
    if (keywordBrief.long_tail?.length)   parts.push(`Long Tail: ${keywordBrief.long_tail.join(', ')}`)
    if (keywordBrief.question?.length)    parts.push(`Question/FAQ: ${keywordBrief.question.join(', ')}`)
    if (keywordBrief.commercial?.length)  parts.push(`Commercial: ${keywordBrief.commercial.join(', ')}`)
    if (keywordBrief.synonym?.length)     parts.push(`Synonym/Varyasyon: ${keywordBrief.synonym.join(', ')}`)
    kwSection = parts.join('\n')
  } else {
    kwSection = relatedKws.map((k) => k.keyword).join(', ')
  }

  const isImprovement = wpSourceContext !== null
  const improvementSection = isImprovement ? `
## Mevcut WP Sayfası (İyileştirme Briefingi)
Bu sayfa sıfırdan oluşturulmayacak — mevcut bir WordPress sayfasının SEO iyileştirmesidir.
- Mevcut URL: ${wpSourceContext!.link ?? wpSourceContext!.slug ?? 'bilinmiyor'}
- Mevcut GSC Tıklama: ${wpSourceContext!.gsc_clicks ?? 'veri yok'}
- Mevcut GSC Gösterim: ${wpSourceContext!.gsc_impressions ?? 'veri yok'}
- Ort. Pozisyon: ${wpSourceContext!.gsc_avg_position ?? 'veri yok'}
- Mevcut İçerik Özeti: ${wpSourceContext!.content_summary ?? 'özet yok'}
- Tespit Edilen Sorunlar: ${[
    wpSourceContext!.flag_orphan ? 'Orphan' : null,
    wpSourceContext!.flag_weak_page ? 'Zayıf İçerik' : null,
    wpSourceContext!.flag_outdated ? 'Eskimiş' : null,
    wpSourceContext!.flag_missing_metadata ? 'Meta Eksik' : null,
    wpSourceContext!.flag_missing_keyword ? 'KW Eksik' : null,
    wpSourceContext!.flag_duplicate_intent ? 'Intent Çakışması' : null,
  ].filter(Boolean).join(', ') || 'yok'}

Görevin: Bu sayfayı iyileştiren bir SEO briefingi oluştur. Mevcut sorunları gider, GSC performansını artır.` : ''

  return `${hubContext ? hubContext + '\n\n' : ''}Sen bir SEO strateji uzmanısın. Aşağıdaki proje ve sayfa bilgilerini kullanarak sayfa paketini JSON formatında doldur.

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
${improvementSection}
## Keyword Seti (rol bazlı — secondary_keywords ve FAQ sorularını buradan türet)
${kwSection || 'Henüz keyword eklenmemiş'}

${researchSummary ? `## Araştırma Verileri\n${researchSummary}` : ''}

## Görev
Aşağıdaki JSON formatında sayfa paketini doldur. Her alan için gerçekçi, SEO odaklı içerik üret.${isImprovement ? ' Mevcut sayfanın sorunlarını ve GSC verisini göz önünde bulundurarak iyileştirme odaklı bir brifing hazırla.' : ''}

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
