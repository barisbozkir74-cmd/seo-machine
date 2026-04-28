import 'server-only'
/**
 * AI enrichment — claude-haiku-4-5 ile toplu content_summary + primary_intent üretimi.
 * D-04: Import biter bitmez ayrı batch çağrısı — DB write sonrası.
 * D-05: claude-haiku-4-5, BATCH_SIZE=20 paralel.
 * D-06: content_summary max 200 char, primary_intent enum.
 * Hata handling: parse hatası → null, import başarılı sayılır.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is not set')
}
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const BATCH_SIZE = 20
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

/**
 * Tek sayfa için AI enrichment çağrısı.
 * qa-audit/route.ts messages.create pattern — EXACT ANALOG.
 */
async function enrichSinglePage(page: PageToEnrich): Promise<EnrichmentResult> {
  try {
    const prompt = `Aşağıdaki web sayfasını analiz et ve JSON formatında yanıt ver.
Sayfa başlığı: ${page.title}
URL: ${page.link ?? page.slug ?? 'bilinmiyor'}

Görev:
1. Sayfayı 200 karakteri KESINLIKLE geçmeyecek şekilde Türkçe özetle (summary)
2. Sayfanın arama intent'ini belirle (intent)

Yanıtı SADECE JSON formatında ver, başka hiçbir şey ekleme:
{"summary": "...", "intent": "informational|commercial|transactional|navigational"}`

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''

    // JSON extract — qa-audit/route.ts pattern EXACT COPY
    const jsonMatch =
      text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
    const jsonText = jsonMatch ? jsonMatch[1] : text

    let parsed: { summary?: string; intent?: string }
    try {
      parsed = JSON.parse(jsonText.trim())
    } catch {
      // D-04: parse hatası → null, import başarılı
      return { wp_id: page.wp_id, content_summary: null, primary_intent: null }
    }

    // D-06: max 200 char truncate
    const summary =
      typeof parsed.summary === 'string' ? parsed.summary.slice(0, 200) : null

    // D-06: valid enum kontrolü
    const intent = VALID_INTENTS.includes(parsed.intent as PrimaryIntent)
      ? (parsed.intent as PrimaryIntent)
      : null

    return { wp_id: page.wp_id, content_summary: summary, primary_intent: intent }
  } catch {
    // D-04: AI hatası → null, import başarılı
    return { wp_id: page.wp_id, content_summary: null, primary_intent: null }
  }
}

/**
 * Tüm sayfalar için toplu AI enrichment.
 * BATCH_SIZE=20 paralel, batch'ler arası sıralı.
 * DB güncelleme: serviceClient (service role) ile project_imported_pages.
 */
export async function enrichImportedPages(
  pages: PageToEnrich[],
  serviceClient: SupabaseClient,
  projectId: string
): Promise<void> {
  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batch = pages.slice(i, i + BATCH_SIZE)

    const results = await Promise.all(batch.map((page) => enrichSinglePage(page)))

    // Batch sonuçlarını DB'ye yaz
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
}
