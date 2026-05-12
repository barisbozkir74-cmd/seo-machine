import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
  const { projectId } = body as { projectId?: string }
  if (!projectId) {
    return new Response('projectId is required', { status: 400 })
  }

  // IDOR: projenin bu user'a ait olduğunu doğrula
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return new Response('Not Found', { status: 404 })

  // Keyword + cluster + blueprint sayfaları (D-05) paralel olarak çek
  const [{ data: keywords }, { data: clusters }, { data: pages }] = await Promise.all([
    supabase
      .from('keywords')
      .select('keyword, volume, cpc, difficulty, search_intent, opportunity_score, source, cluster_id, parent_keyword_id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .is('parent_keyword_id', null)
      .order('volume', { ascending: false, nullsFirst: false })
      .limit(200),
    supabase
      .from('keyword_clusters')
      .select('id, cluster_name, intent, opportunity_score, revenue_type, total_volume')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('total_volume', { ascending: false, nullsFirst: false }),
    supabase
      .from('pages')
      .select('id, title, slug, page_type, priority, parent_id, cluster_id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
  ])

  // ai_memory okuma (D-06) — önceki kararlar prompt'a dahil edilir
  const { data: memoryRows } = await supabase
    .from('ai_memory')
    .select('module, key, value')
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  // Context metinleri oluştur
  const clusterSummary = (clusters ?? [])
    .map((c) => {
      const kws = (keywords ?? [])
        .filter((k) => k.cluster_id === c.id)
        .slice(0, 5)
        .map((k) => `${k.keyword} (${k.volume ?? 0} vol)`)
        .join(', ')
      return `• [${c.cluster_name}] intent:${c.intent ?? '?'} revenue:${c.revenue_type ?? '?'} vol:${c.total_volume ?? 0} niche_score:${c.opportunity_score?.toFixed(0) ?? '?'} — ${kws}`
    })
    .join('\n')

  const blueprintSummary = (pages ?? [])
    .slice(0, 30)
    .map((p) => `• [${p.page_type ?? '?'}] ${p.title} (${p.slug})`)
    .join('\n')

  const memorySummary = (memoryRows ?? [])
    .map((r) => `[${r.module}/${r.key}]: ${JSON.stringify(r.value).slice(0, 200)}`)
    .join('\n')

  // Primary AI system prompt — SEO Strateji Uzmanı
  const primarySystemPrompt = `Sen bir SEO Strateji Uzmanısın (Traffic Architect rolü). Aşağıdaki proje verisini analiz et ve proaktif stratejik bulgularını Türkçe olarak sun.

Proje: ${project.name} (${project.domain})
Toplam keyword: ${(keywords ?? []).length} | Toplam küme: ${(clusters ?? []).length}

KÜMELER:
${clusterSummary || '(küme yok)'}

SITE BLUEPRINT (mevcut sayfalar):
${blueprintSummary || '(blueprint yok)'}

AI HAFIZA (önceki kararlar):
${memorySummary || '(hafıza yok)'}

Görevin:
1. Intent dağılımı analizi (informational vs commercial vs transactional)
2. Commercial gap tespiti (yüksek gelir potansiyeli olan eksik kümeler)
3. Cannibalization riski (aynı intent'e hizmet eden birden fazla küme)
4. Pillar/support cluster map (hangi kümeler ana sayfa, hangileri destek içerik)
5. Blueprint uyum analizi (blueprint sayfaları ile cluster'lar arasındaki boşluklar)

Kısa ve aksiyon odaklı yaz. Her bulgu için somut öneri ver.`

  // Review AI system prompt — SEO Denetçi
  const reviewSystemPrompt = `Sen bir SEO Denetçisisin. Aşağıdaki Primary AI analizini incele ve şu 3 konuda kısa denetim raporu yaz:
1. Intent çakışması: Birden fazla küme aynı intent'e mi hizmet ediyor?
2. Cannibalization riski: Hangi keyword grupları birbiriyle rekabet ediyor?
3. Eksik commercial page'ler: Blueprint'te olması gereken ama olmayan sayfalar

Bulgularını madde madde, Türkçe ve kısa yaz. Onaylanan noktalarda "✓" kullan.`

  // İki aşamalı Anthropic streaming pipeline
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let primaryOutput = ''

      // Aşama 1: Primary AI — stratejik analiz
      const primaryStream = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        temperature: 0.4 as never,
        stream: true,
        system: primarySystemPrompt,
        messages: [{ role: 'user', content: 'Keyword stratejimi analiz et.' }],
      })

      for await (const event of primaryStream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const text = event.delta.text
          primaryOutput += text
          controller.enqueue(encoder.encode(text))
        }
      }

      // Separator token — client bu token'ı görünce Review mesajını state'e ekler
      controller.enqueue(encoder.encode('\n\n__REVIEW_START__\n\n'))

      // Aşama 2: Review AI — Primary çıktısı context olarak verilir
      const reviewStream = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        temperature: 0.3 as never,
        stream: true,
        system: reviewSystemPrompt,
        messages: [{ role: 'user', content: primaryOutput }],
      })

      for await (const event of reviewStream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(event.delta.text))
        }
      }

      // Analiz tamamlandı — ai_memory'ye yaz (D-07, D-08)
      await supabase
        .from('ai_memory')
        .upsert(
          {
            user_id: user.id,
            project_id: projectId,
            module: 'analysis',
            key: 'last_primary',
            value: { summary: primaryOutput.slice(0, 500), analyzed_at: new Date().toISOString() },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'project_id,module,key' }
        )

      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
