import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { readHub, hubToPromptContext } from '@/lib/ai-context/hub'
import { buildFullSystemPrompt } from '@/core/context/prompt-builder'
import { checkPhasePrerequisites } from '@/core/phase/engine'
import { checkOutputAgainstLockedDecisions } from '@/core/decision/decision-guard'
import { logGuardFailure } from '@/core/decision/guard-policy'
import { saveModuleState, buildMemorySnapshot } from '@/core/context/memory-writer'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type StrategyCluster = {
  id: string | null
  cluster_name: string
  page_type: 'traffic' | 'lead' | 'authority'
  target_url: string
  intent: string
  priority_rank: number
  content_month: number
  ai_reasoning: string
  keyword_ids: string[]
  new_keywords: string[]
}

type StrategyResponse = {
  clusters: StrategyCluster[]
  architecture_summary: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = await req.json() as { projectId: string }
  if (!projectId) return NextResponse.json({ error: 'projectId gerekli' }, { status: 400 })

  // Proje verisi — IDOR korumalı
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain, sector, business_model, target_customer, main_goal, target_country, target_language, initial_competitors, target_keywords, notes')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return NextResponse.json({ error: 'Proje bulunamadı' }, { status: 404 })

  // Keywordler + kümeler + işletme kataloğu (paralel)
  const [{ data: keywords }, { data: clusters }, { data: businessEntities }] = await Promise.all([
    supabase
      .from('keywords')
      .select('id, keyword, volume, difficulty, search_intent, cluster_id, source')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('volume', { ascending: false, nullsFirst: false })
      .limit(300),
    supabase
      .from('keyword_clusters')
      .select('id, cluster_name, intent, total_volume, opportunity_score, revenue_type')
      .eq('project_id', projectId)
      .eq('user_id', user.id),
    supabase
      .from('business_entities')
      .select('type, name, is_primary, primary_keyword, seo_intent')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false })
      .order('type', { ascending: true }),
  ])

  const kwList = (keywords ?? [])
  const clList = (clusters ?? [])

  // İşletme kataloğu — ★ öncelikli varlıklar + hedef keyword + intent sinyali
  const catalogEntities = (businessEntities ?? []) as Array<{
    type: string; name: string; is_primary: boolean; primary_keyword: string | null; seo_intent: string | null
  }>
  const CATALOG_LABELS: Record<string, string> = {
    product: 'Ürünler', service: 'Hizmetler', category: 'Kategoriler',
    service_area: 'Servis Alanları', persona: 'Personalar', usp: 'USP',
  }
  const catalogLines = Object.entries(CATALOG_LABELS).map(([type, label]) => {
    const group = catalogEntities.filter(e => e.type === type)
    if (!group.length) return ''
    const names = group.map(e => {
      const star = e.is_primary ? ' ★' : ''
      const kw = e.primary_keyword ? ` [hedef kw: ${e.primary_keyword}]` : ''
      const intent = e.seo_intent ? ` (${e.seo_intent})` : ''
      return `${e.name}${star}${kw}${intent}`
    }).join(', ')
    return `${label} (${group.length}): ${names}`
  }).filter(Boolean)
  const businessCatalogBlock = catalogLines.length > 0
    ? `\n\nİŞLETME KATALOĞU (★ = ana varlık — bu varlıklara lead page_type ve yüksek öncelik ver, hedef keyword'leri cluster içinde kullan):\n${catalogLines.join('\n')}`
    : ''

  // Küme başına keyword listesi
  const clusterKeywords: Record<string, { id: string; keyword: string; volume: number | null }[]> = {}
  for (const kw of kwList) {
    if (kw.cluster_id) {
      if (!clusterKeywords[kw.cluster_id]) clusterKeywords[kw.cluster_id] = []
      clusterKeywords[kw.cluster_id].push({ id: kw.id, keyword: kw.keyword, volume: kw.volume })
    }
  }
  const unclusteredKws = kwList.filter((kw) => !kw.cluster_id)

  const clusterSummary = clList.map((c) => ({
    id: c.id,
    name: c.cluster_name,
    intent: c.intent,
    total_volume: c.total_volume,
    revenue_type: c.revenue_type,
    keywords: (clusterKeywords[c.id] ?? []).slice(0, 10).map((k) => `${k.keyword}(${k.volume ?? 0})`),
  }))

  // Phase check — keyword_strategy tipi: warn-only, hiçbir zaman bloklanmaz
  const phaseResult = await checkPhasePrerequisites(supabase, projectId, user.id, 'keyword_strategy')

  // Merkezi karar havuzu
  const hub = await readHub(projectId, user.id, supabase).catch(() => null)
  const hubContext = hub ? hubToPromptContext(hub) : ''

  const baseSystemPrompt = `${hubContext ? hubContext + '\n\n' : ''}Sen enterprise seviyesinde çalışan bir SEO mimarısın. Distilled, Merkle, Wpromote gibi ajansların üst düzey stratejistleri gibi düşünüyorsun.

Görevin: Proje verilerini analiz edip tam kapsamlı bir Master SEO Mimarisi oluşturmak.

PROJE:
İsim: ${project.name}
Domain: ${project.domain}
Sektör: ${project.sector ?? '—'}
İş Modeli: ${project.business_model ?? '—'}
Hedef Müşteri: ${project.target_customer ?? '—'}
Ana Hedef: ${project.main_goal ?? '—'}
Hedef Ülke: ${project.target_country ?? '—'}
Dil: ${project.target_language ?? '—'}
Rakipler: ${project.initial_competitors ?? '—'}
Başlangıç Keywordleri: ${project.target_keywords ?? '—'}
Notlar: ${project.notes ?? '—'}${businessCatalogBlock}

MEVCUT KÜMELER (${clList.length} küme):
${JSON.stringify(clusterSummary, null, 2)}

KÜMESİZ KEYWORDLER (${unclusteredKws.length} adet):
${unclusteredKws.slice(0, 50).map((k) => `${k.keyword}(vol:${k.volume ?? 0})`).join(', ')}

GÖREV:
1. Her mevcut kümeye page_type ata (aşağıdaki kurallara göre)
2. Her küme için hedef URL slug öner
3. Öncelik sırası belirle (priority_rank) ve içerik ayını ata (content_month 1-12)
4. Gerekirse kümedeki eksik keywordleri öner (new_keywords)
5. Kümelenmemiş keywordler varsa yeni kümeler oluştur (id: null)

PAGE TYPE KURALLARI:
- traffic: Yüksek hacimli bilgilendirici sorgular (nasıl, ne, fikir, ipuçları, fiyat nedir). Hedef: trafik + farkındalık.
- lead: Ticari/dönüşüm amaçlı sorgular (satın al, hizmet, fiyat teklifi, kurulum, şirket). Hedef: lead + satış.
- authority: Pillar içerik, konu otoritesi, kapsamlı rehberler. Hedef: topikal otorite + backlink mıknatısı.

ÖNCELİK KURALLARI:
- Rank 1-5: Ana lead sayfaları + düşük rekabetli yüksek hacimli traffic sayfaları
- Rank 6-15: İkincil lead + traffic
- Rank 16+: Genişleme içeriği, uzun kuyruk
- İçerik ayı: lead sayfaları ay 1-3, traffic ay 2-8, authority ay 4-12

DİL ZORUNLU: new_keywords dizisindeki tüm keyword'ler mutlaka ${project.target_language ?? 'hedef dil'} dilinde olmalı.

YANIT FORMATI: Sadece JSON döndür. Markdown veya açıklama ekleme.

{
  "clusters": [
    {
      "id": "mevcut-uuid-veya-null-yeni-için",
      "cluster_name": "string",
      "page_type": "traffic|lead|authority",
      "target_url": "/slug-buraya",
      "intent": "informational|commercial|transactional|navigational",
      "priority_rank": 1,
      "content_month": 1,
      "ai_reasoning": "tek cümle gerekçe",
      "keyword_ids": ["uuid", ...],
      "new_keywords": ["yeni keyword 1", "yeni keyword 2"]
    }
  ],
  "architecture_summary": "3-4 cümle stratejik genel bakış"
}`

  // 4-katman sistem promptu
  const { systemPrompt } = await buildFullSystemPrompt(supabase, {
    projectId,
    userId: user.id,
    section: 'keyword-stratejisi',
    baseSystemPrompt,
    phaseWarning: phaseResult.warning_text,
    includeGlobalBrain: true,
  })

  let raw = ''
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Master SEO mimarisini oluştur.' },
      ],
    })
    raw = completion.choices[0]?.message?.content ?? ''
  } catch {
    return NextResponse.json({ error: 'AI yanıt vermedi. Lütfen tekrar deneyin.' }, { status: 502 })
  }

  // Guard: kilitli kararlarla karşılaştır — fail-close (Wave G).
  // Guard crash → 503; violation → 409. Write asla guard bypass edemez.
  let guardResult: Awaited<ReturnType<typeof checkOutputAgainstLockedDecisions>> | null = null
  try {
    guardResult = await checkOutputAgainstLockedDecisions(supabase, projectId, user.id, raw, 'keyword-stratejisi')
  } catch (guardError) {
    logGuardFailure('keywords/strategy', guardError)
    return NextResponse.json(
      { error: 'Guard kontrolü başarısız — strateji kaydedilmedi', code: 'GUARD_ERROR' },
      { status: 503 }
    )
  }
  if (guardResult && !guardResult.passed) {
    return NextResponse.json(
      {
        error: 'AI çıktısı kilitli kararlarla çakışıyor — strateji kaydedilmedi',
        code: 'DECISION_CONFLICT',
        violations: guardResult.violations,
      },
      { status: 409 }
    )
  }

  // JSON parse — markdown code block varsa temizle
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  let strategy: StrategyResponse
  try {
    strategy = JSON.parse(jsonStr) as StrategyResponse
  } catch {
    return NextResponse.json({ error: 'AI yanıtı parse edilemedi.', raw }, { status: 422 })
  }

  // DB'ye yaz — mevcut kümeleri güncelle, yeni kümeleri ekle
  const now = new Date().toISOString()

  for (const sc of strategy.clusters) {
    if (sc.id) {
      // Mevcut küme: arch kolonlarını güncelle
      await supabase
        .from('keyword_clusters')
        .update({
          page_type: sc.page_type,
          target_url: sc.target_url,
          arch_status: 'pending',
          ai_reasoning: sc.ai_reasoning,
          priority_rank: sc.priority_rank,
          content_month: sc.content_month,
          intent: sc.intent ?? undefined,
          updated_at: now,
        })
        .eq('id', sc.id)
        .eq('user_id', user.id)
    } else {
      // Yeni küme oluştur
      const { data: newCluster } = await supabase
        .from('keyword_clusters')
        .insert({
          user_id: user.id,
          project_id: projectId,
          cluster_name: sc.cluster_name,
          intent: sc.intent,
          page_type: sc.page_type,
          target_url: sc.target_url,
          arch_status: 'pending',
          ai_reasoning: sc.ai_reasoning,
          priority_rank: sc.priority_rank,
          content_month: sc.content_month,
        })
        .select('id')
        .single()

      if (newCluster) {
        sc.id = newCluster.id
      }
    }

    // Yeni keyword önerileri ekle
    if (sc.new_keywords?.length && sc.id) {
      const newKwRows = sc.new_keywords.map((kw) => ({
        user_id: user.id,
        project_id: projectId,
        keyword: kw,
        source: 'expansion' as const,
        cluster_id: sc.id,
      }))
      await supabase
        .from('keywords')
        .upsert(newKwRows, { onConflict: 'project_id,keyword', ignoreDuplicates: true })
    }

    // Mevcut küme keyword_ids bağlaması
    if (sc.keyword_ids?.length && sc.id) {
      await supabase
        .from('keywords')
        .update({ cluster_id: sc.id })
        .in('id', sc.keyword_ids)
        .eq('user_id', user.id)
    }
  }

  // Mimari özeti projeye kaydet
  await supabase
    .from('projects')
    .update({ seo_arch_summary: strategy.architecture_summary, seo_arch_built_at: now })
    .eq('id', projectId)
    .eq('user_id', user.id)

  // Hafıza kaydı — fire-and-forget
  void saveModuleState(
    supabase, projectId, user.id, 'keyword-stratejisi',
    buildMemorySnapshot('keyword-stratejisi', {
      clusterCount: strategy.clusters.length,
      keywordCount: kwList.length,
    })
  ).catch(() => {})

  return NextResponse.json({
    ok: true,
    cluster_count: strategy.clusters.length,
    architecture_summary: strategy.architecture_summary,
  })
}
