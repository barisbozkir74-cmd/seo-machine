import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getSerpApiKey } from '@/lib/supabase/vault'

// ─── Service clients ──────────────────────────────────────────────────────────

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY env var eksik.')
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type SectionKey =
  | 'market_structures'
  | 'competitor_strengths'
  | 'competitor_weaknesses'
  | 'quick_wins'
  | 'high_value_opportunities'

export interface ResearchInput {
  projectId: string
  userId: string
  sector: string
  initial_competitors: string
  target_keywords: string
}

interface ClaudeReport {
  market_structures: Array<{ alan: string; aciklama: string; onem: string }>
  competitor_strengths: Array<{ alan: string; neden_guclu: string; seviye: string }>
  competitor_weaknesses: Array<{ alan: string; zayiflik: string; firsat_notu: string }>
  quick_wins: Array<{ keyword_alan: string; zorluk: string; tahmini_etki: string }>
  high_value_opportunities: Array<{ sayfa_alan: string; ticari_deger: string; oncelik: string }>
}

// ─── Query builder ────────────────────────────────────────────────────────────

/**
 * Proje verilerinden otomatik arama sorguları üretir.
 * SRCH-01: sektör + rakip + keyword kombinasyonları, max 7 sorgu.
 */
function buildSearchQueries(input: ResearchInput): string[] {
  const queries: string[] = []

  // Sektör genel sorgusu
  queries.push(`${input.sector} sektörü pazar analizi`)

  // Rakip bazlı sorgular (virgül veya yeni satır ile bölünmüş, max 3 rakip)
  const competitors = input.initial_competitors
    .split(/[,\n]/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 3)

  for (const competitor of competitors) {
    queries.push(`${competitor} SEO içerik stratejisi`)
  }

  // Keyword bazlı sorgular (virgül veya yeni satır ile bölünmüş, ilk 2 keyword)
  const keywords = input.target_keywords
    .split(/[,\n]/)
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 2)

  for (const keyword of keywords) {
    queries.push(`${keyword} rakip analiz`)
  }

  // Genel fırsat sorgusu
  queries.push(`${input.sector} içerik boşluğu fırsatları SEO`)

  // Max 7 sorgu
  return queries.slice(0, 7)
}

// ─── SerpAPI fetcher ──────────────────────────────────────────────────────────

/**
 * Tek sorgu için SerpAPI çağrısı.
 * T-18-04: Rate limit riski nedeniyle sorgular paralel değil sıralı çalışır.
 * 10 saniyelik timeout ile korunur.
 */
async function fetchSerpResults(query: string, serpApiKey: string): Promise<string> {
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${serpApiKey}&hl=tr&gl=tr&num=10`

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`SerpAPI sorgu zaman aşımı: ${query}`)), 10000)
  )

  const fetchPromise = fetch(url).then(async (res) => {
    if (!res.ok) throw new Error(`SerpAPI hatası: ${res.status}`)
    return res.json()
  })

  const data = await Promise.race([fetchPromise, timeoutPromise])

  // organic_results'tan title + snippet + link al
  const results = ((data as { organic_results?: Array<{ title?: string; snippet?: string; link?: string }> }).organic_results ?? [])
    .slice(0, 5)
    .map((r) =>
      `Başlık: ${r.title ?? ''}\nÖzet: ${r.snippet ?? ''}\nLink: ${r.link ?? ''}`
    )
    .join('\n\n')

  return results || 'Sonuç yok.'
}

// ─── Claude analyzer ──────────────────────────────────────────────────────────

/**
 * SerpAPI sonuçlarını Claude claude-sonnet-4-6 ile analiz eder.
 * T-18-03: JSON parse try/catch — bozuk veri DB'ye yazılmaz.
 */
async function analyzeWithClaude(serpResults: string, input: ResearchInput): Promise<ClaudeReport> {
  const anthropic = getAnthropicClient()

  const prompt = `Sen bir SEO stratejisti uzmanısın. Aşağıdaki Google arama sonuçlarını analiz ederek ${input.sector} sektöründeki pazar durumunu ve fırsatları değerlendir.

Proje bilgileri:
- Sektör: ${input.sector}
- Rakipler: ${input.initial_competitors}
- Hedef Kelimeler: ${input.target_keywords}

Google Arama Sonuçları:
${serpResults}

SADECE aşağıdaki JSON formatında yanıt ver, başka hiçbir şey ekleme:
{
  "market_structures": [{"alan": "...", "aciklama": "...", "onem": "yüksek/orta/düşük"}],
  "competitor_strengths": [{"alan": "...", "neden_guclu": "...", "seviye": "yüksek/orta/düşük"}],
  "competitor_weaknesses": [{"alan": "...", "zayiflik": "...", "firsat_notu": "..."}],
  "quick_wins": [{"keyword_alan": "...", "zorluk": "Düşük/Orta/Yüksek", "tahmini_etki": "..."}],
  "high_value_opportunities": [{"sayfa_alan": "...", "ticari_deger": "Yüksek/Orta/Düşük", "oncelik": "1/2/3"}]
}
Her bölümde en az 3, en fazla 8 satır üret.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('')

  // T-18-03: JSON parse — bozuk veri geçmez
  const jsonMatch =
    text.match(/```json\s*([\s\S]*?)```/) ??
    text.match(/```\s*([\s\S]*?)```/) ??
    text.match(/(\{[\s\S]*\})/)

  if (!jsonMatch) throw new Error('Claude JSON çıktısı parse edilemedi.')

  try {
    const parsed = JSON.parse(jsonMatch[1]) as ClaudeReport
    return parsed
  } catch {
    throw new Error('Claude JSON çıktısı parse edilemedi.')
  }
}

// ─── DB writer ────────────────────────────────────────────────────────────────

/**
 * 5 araştırma bölümünü research_reports tablosuna upsert eder.
 * replace semantiği: onConflict 'project_id,section' ile mevcut satırların üzerine yazar.
 */
async function saveReport(report: ClaudeReport, input: ResearchInput): Promise<void> {
  const serviceClient = getServiceClient()

  const sections: SectionKey[] = [
    'market_structures',
    'competitor_strengths',
    'competitor_weaknesses',
    'quick_wins',
    'high_value_opportunities',
  ]

  for (const sectionKey of sections) {
    const { error } = await serviceClient.from('research_reports').upsert(
      {
        user_id: input.userId,
        project_id: input.projectId,
        section: sectionKey,
        rows: report[sectionKey],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,section' }
    )

    if (error) {
      throw new Error(`research_reports yazma hatası (${sectionKey}): ${error.message}`)
    }
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Ana araştırma pipeline'ı.
 * SRCH-01: SerpAPI ile Google aramaları
 * SRCH-02: Claude analizi + research_reports'a yazma
 *
 * Hata durumunda throw — çağıran route katmanı hatayı yönetir.
 */
export async function runSectorResearch(input: ResearchInput): Promise<void> {
  // 1. SerpAPI anahtarını al (env var önce, vault fallback — T-18-01)
  const serpApiKey = await getSerpApiKey()

  // 2. Arama sorgularını üret
  const queries = buildSearchQueries(input)

  // 3. Her sorgu için sırayla SerpAPI çağrısı (T-18-04: paralel değil, rate limit riski)
  const results: string[] = []
  for (const query of queries) {
    const result = await fetchSerpResults(query, serpApiKey)
    results.push(`Sorgu: ${query}\n\n${result}`)
  }

  // 4. Tüm sonuçları birleştir
  const allResults = results.join('\n\n---\n\n')

  // 5. Claude ile analiz et
  const report = await analyzeWithClaude(allResults, input)

  // 6. research_reports'a kaydet
  await saveReport(report, input)
}
