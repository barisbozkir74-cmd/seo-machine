import 'server-only'

import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const BATCH_SIZE = 5
const CALL_TIMEOUT_MS = 15_000
const VALID_INTENTS = ['informational', 'commercial', 'transactional', 'navigational'] as const
type PrimaryIntent = (typeof VALID_INTENTS)[number]

export interface EnrichmentResult {
  wp_id: number
  content_summary: string | null
  primary_intent: PrimaryIntent | null
}

interface PageToEnrich {
  wp_id: number
  title: string
  link: string | null
  slug: string | null
}

async function enrichSinglePage(page: PageToEnrich): Promise<EnrichmentResult> {
  const fallback = { wp_id: page.wp_id, content_summary: null, primary_intent: null }
  try {
    const prompt = `Aşağıdaki web sayfasını analiz et ve JSON formatında yanıt ver.
Sayfa başlığı: ${page.title}
URL: ${page.link ?? page.slug ?? 'bilinmiyor'}

Görev:
1. Sayfayı 200 karakteri KESINLIKLE geçmeyecek şekilde Türkçe özetle (summary)
2. Sayfanın arama intent'ini belirle (intent)

Yanıtı SADECE JSON formatında ver, başka hiçbir şey ekleme:
{"summary": "...", "intent": "informational|commercial|transactional|navigational"}`

    const apiCall = getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    })

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Enrichment timeout')), CALL_TIMEOUT_MS)
    )
    const response = await Promise.race([apiCall, timeout])

    const text = response.choices[0]?.message?.content ?? ''
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
    const jsonText = jsonMatch ? jsonMatch[1] : text

    let parsed: { summary?: string; intent?: string }
    try {
      parsed = JSON.parse(jsonText.trim())
    } catch {
      return fallback
    }

    const summary = typeof parsed.summary === 'string' ? parsed.summary.slice(0, 200) : null
    const intent = VALID_INTENTS.includes(parsed.intent as PrimaryIntent)
      ? (parsed.intent as PrimaryIntent)
      : null

    return { wp_id: page.wp_id, content_summary: summary, primary_intent: intent }
  } catch {
    return fallback
  }
}

export async function enrichImportedPages(
  pages: PageToEnrich[],
  serviceClient: SupabaseClient,
  projectId: string
): Promise<void> {
  console.log(`[enrichment] Başlıyor: ${pages.length} sayfa, batch=${BATCH_SIZE}`)

  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batch = pages.slice(i, i + BATCH_SIZE)
    console.log(`[enrichment] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pages.length / BATCH_SIZE)} (${batch.length} sayfa)`)

    const results = await Promise.all(batch.map(enrichSinglePage))

    for (const result of results) {
      if (result.content_summary !== null || result.primary_intent !== null) {
        await serviceClient
          .from('project_imported_pages')
          .update({
            content_summary: result.content_summary,
            primary_intent: result.primary_intent,
            updated_at: new Date().toISOString(),
          })
          .eq('project_id', projectId)
          .eq('wp_id', result.wp_id)
      }
    }
  }

  console.log(`[enrichment] Tamamlandı: ${pages.length} sayfa işlendi`)
}
