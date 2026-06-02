import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { buildFullSystemPrompt } from '@/core/context/prompt-builder'
import { checkOutputAgainstLockedDecisions } from '@/core/decision/decision-guard'
import { logGuardFailure } from '@/core/decision/guard-policy'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export type ExpandCategory =
  | 'ticari'
  | 'bilgi'
  | 'yerel'
  | 'karsilastirma'
  | 'sss'
  | 'uzun_kuyruk'
  | 'acil'

export type ExpandResult = {
  categories: Record<ExpandCategory, string[]>
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = await req.json() as { projectId: string }
  if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) {
    return NextResponse.json({ error: 'projectId gerekli' }, { status: 400 })
  }

  const { data: project } = await supabase
    .from('projects')
    .select('name, domain, sector, business_model, target_customer, main_goal, target_country, target_language, initial_competitors')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return NextResponse.json({ error: 'Proje bulunamadı' }, { status: 404 })

  // Existing keywords — avoid suggesting duplicates
  const { data: existingKws } = await supabase
    .from('keywords')
    .select('keyword')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .limit(500)

  const existingSet = new Set((existingKws ?? []).map(k => k.keyword.toLowerCase()))
  const existingList = (existingKws ?? []).map(k => k.keyword).slice(0, 100).join(', ')

  // Araştırma section decisions for strategic context
  const { data: researchDecisions } = await supabase
    .from('project_decisions')
    .select('decision_type, decision')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .eq('section', 'arastirma')
    .eq('scope_type', 'section')
    .eq('is_active', true)
    .limit(10)

  const researchContext = (researchDecisions ?? [])
    .map(d => `[${d.decision_type}] ${d.decision}`)
    .join('\n')

  // Competitors from competitors table + project field
  const { data: competitors } = await supabase
    .from('competitors')
    .select('domain, name')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .limit(10)

  const competitorList = [
    ...(competitors ?? []).map(c => c.domain ?? c.name),
    ...(project.initial_competitors ?? '').split(/[\n,]/).map((s: string) => s.trim()).filter(Boolean),
  ].filter((v, i, arr) => v && arr.indexOf(v) === i).slice(0, 15).join(', ')

  const prompt = `Sen bu projenin SEO stratejisti olarak yeni keyword fırsatları üretiyorsun.

PROJE:
Domain: ${project.domain}
Sektör: ${project.sector ?? '—'}
İş Modeli: ${project.business_model ?? '—'}
Hedef Müşteri: ${project.target_customer ?? '—'}
Ana Hedef: ${project.main_goal ?? '—'}
Hedef Ülke: ${project.target_country ?? '—'}
Hedef Dil: ${project.target_language ?? '—'}
Rakipler: ${competitorList || '—'}

${researchContext ? `ARAŞTIRMA ANALİZİ:\n${researchContext}\n` : ''}
MEVCUT KEYWORDLER (tekrar önerme):
${existingList || '(henüz keyword yok)'}

GÖREV: Bu projeye özgü, mevcut listenin DIŞINDA yeni keyword fırsatları üret. Her kategori için 4-8 adet spesifik keyword ver.

KATEGORİLER VE ANLAMI:
- ticari: Satın alma niyeti taşıyan, dönüşüm odaklı ("fiyat", "satın al", "hizmet", "paket")
- bilgi: Eğitici, araştırma niyetli ("nasıl", "nedir", "neden", "rehber")
- yerel: Coğrafi hedefli ("istanbul", "ankara", şehir/bölge bazlı) — hedef ülke dışındaysa boş bırak
- karsilastirma: Rakip veya alternatif karşılaştırması ("vs", "alternatif", "karşılaştırma", "fark")
- sss: Sık sorulan sorular formatında ("hangi", "ne zaman", "kim için", "nasıl seçilir")
- uzun_kuyruk: Çok spesifik, niş, 4+ kelimeli long-tail fırsatlar
- acil: Aciliyet/karar aşaması keyword'leri ("hızlı", "acil", "bugün", "şimdi", "ücretsiz deneme")

KURALLAR:
- Tüm keyword önerileri kesinlikle ${project.target_language ?? 'Türkçe'} dilinde olmalı — başka dil kullanma
- Mevcut listedeki keyword'leri ASLA tekrarlama
- Proje sektörüne özgü, gerçekçi keyword'ler ver
- Jenerik veya alakasız terimler verme

Yanıtı SADECE aşağıdaki JSON formatında döndür:
{
  "categories": {
    "ticari": ["keyword1", "keyword2", ...],
    "bilgi": ["keyword1", ...],
    "yerel": ["keyword1", ...],
    "karsilastirma": ["keyword1", ...],
    "sss": ["keyword1", ...],
    "uzun_kuyruk": ["keyword1", ...],
    "acil": ["keyword1", ...]
  }
}`

  // 4-layer governed system prompt
  const { systemPrompt: governedPrompt } = await buildFullSystemPrompt(supabase, {
    projectId, userId: user.id, section: 'strategy',
    baseSystemPrompt: prompt, phaseWarning: null,
  })

  let raw = ''
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: governedPrompt },
        { role: 'user', content: 'Keyword önerilerini üret.' },
      ],
    })
    raw = completion.choices[0]?.message?.content ?? ''
  } catch {
    return NextResponse.json({ error: 'AI yanıt vermedi.' }, { status: 502 })
  }

  // Fail-close output guard (Wave H) — violation → 409; crash → 503.
  let guardResult: Awaited<ReturnType<typeof checkOutputAgainstLockedDecisions>> | null = null
  try {
    guardResult = await checkOutputAgainstLockedDecisions(supabase, projectId, user.id, raw, 'keyword-stratejisi')
  } catch (guardError) {
    logGuardFailure('keywords/expand', guardError)
    return NextResponse.json(
      { error: 'Guard kontrolü başarısız — keyword önerileri kaydedilmedi', code: 'GUARD_ERROR' },
      { status: 503 }
    )
  }
  if (guardResult && !guardResult.passed) {
    return NextResponse.json(
      { error: 'Keyword önerileri kilitli kararlarla çakışıyor', code: 'DECISION_CONFLICT', violations: guardResult.violations },
      { status: 409 }
    )
  }

  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  let result: ExpandResult
  try {
    result = JSON.parse(jsonStr)
  } catch {
    return NextResponse.json({ error: 'AI yanıtı parse edilemedi.' }, { status: 422 })
  }

  // Filter out any suggestions that already exist
  const filteredCategories: Record<string, string[]> = {}
  for (const [cat, keywords] of Object.entries(result.categories ?? {})) {
    filteredCategories[cat] = (keywords as string[]).filter(
      k => typeof k === 'string' && k.trim() && !existingSet.has(k.trim().toLowerCase())
    )
  }

  return NextResponse.json({ categories: filteredCategories })
}
