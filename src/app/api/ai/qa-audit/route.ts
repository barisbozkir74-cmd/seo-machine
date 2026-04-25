import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Body parse
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

  // Proje ownership doğrula (T-11-01: unauthenticated bypass önlenir)
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain, sector, target_language, brand_tone')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return new Response('Project not found', { status: 404 })

  // Package ownership doğrula (T-11-02: başkasının package'ı QA edilemez)
  const { data: pkg } = await supabase
    .from('page_packages')
    .select('id, status, seo_title, meta_description, h1, search_intent, strategic_purpose, content_blocks, schema_jsonld')
    .eq('id', packageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!pkg) return new Response('Package not found', { status: 404 })

  // Focus keyword — package'ın ait olduğu sayfa üzerinden join edilir
  const { data: pkgPageRow } = await supabase
    .from('page_packages')
    .select('page_id')
    .eq('id', packageId)
    .single()

  let focusKeyword = ''
  if (pkgPageRow?.page_id) {
    const { data: pageRow } = await supabase
      .from('pages')
      .select('focus_keyword_id')
      .eq('id', pkgPageRow.page_id)
      .eq('user_id', user.id)
      .single()

    if (pageRow?.focus_keyword_id) {
      const { data: kw } = await supabase
        .from('keywords')
        .select('keyword')
        .eq('id', pageRow.focus_keyword_id)
        .single()
      if (kw) focusKeyword = kw.keyword
    }
  }

  // Prompt oluştur — user-controlled içerik template'e gömülür (T-11-03: prompt injection azaltma)
  const prompt = buildQaPrompt(pkg, project, focusKeyword)

  // Non-streaming Anthropic call (D-06: streaming değil, tek JSON yanıt)
  let message
  try {
    message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })
  } catch {
    return new Response('Claude API error', { status: 502 })
  }

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')

  // JSON extract — kod bloğu veya ham JSON
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
}

function buildQaPrompt(
  pkg: Record<string, unknown>,
  project: Record<string, unknown>,
  focusKeyword: string
): string {
  // T-11-03: user-controlled alanlar açık label'larla sınırlandırılır
  // "---BAŞLIK---" ve "---BİTİŞ---" marker'ları injection riskini azaltır
  const contentBlocksSafe = (() => {
    try {
      return JSON.stringify(pkg.content_blocks ?? [], null, 2)
    } catch {
      return '[]'
    }
  })()

  return `Sen bir SEO içerik denetçisisin. Aşağıdaki sayfa paketini 4 boyutta denetle ve structured JSON döndür.

## Sayfa Paketi
---BAŞLIK---
SEO Title: ${String(pkg.seo_title ?? '(boş)').slice(0, 200)}
Meta Description: ${String(pkg.meta_description ?? '(boş)').slice(0, 400)}
H1: ${String(pkg.h1 ?? '(boş)').slice(0, 200)}
Search Intent: ${String(pkg.search_intent ?? '(belirtilmemiş)').slice(0, 100)}
Stratejik Amaç: ${String(pkg.strategic_purpose ?? '(boş)').slice(0, 500)}
Focus Keyword: ${String(focusKeyword || '(belirtilmemiş)').slice(0, 200)}
---BİTİŞ---

## İçerik Blokları
---IÇERIK-BAŞLANGIÇ---
${contentBlocksSafe.slice(0, 3000)}
---IÇERIK-BİTİŞ---

## Proje Bağlamı
Domain: ${String(project.domain ?? '').slice(0, 200)}
Sektör: ${String(project.sector ?? 'belirtilmemiş').slice(0, 200)}
Dil: ${String(project.target_language ?? 'Türkçe').slice(0, 50)}
Marka Tonu: ${String(project.brand_tone ?? 'profesyonel').slice(0, 100)}

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
  "content_score": 0,
  "human_score": 0
}
\`\`\``
}
