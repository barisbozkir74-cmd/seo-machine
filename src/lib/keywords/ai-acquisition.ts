import 'server-only'

/**
 * Phase 19: AI Keyword Data Acquisition
 *
 * Bu servis Plan 03'te tamamlanacak. İskelet dosya, Plan 02 (fetchRelatedKeywords)
 * ve Plan 03 (route + UI) için tip kontratlarını sabitler.
 *
 * Implementation pattern'i: src/lib/research/sector-research.ts (Phase 18)
 * Upsert pattern'i: src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts
 *   ile aynı şema, ANCAK ignoreDuplicates: true (manual kayıtların source'u korunur).
 */

export interface AcquisitionInput {
  projectId: string
  userId: string
}

export interface AcquisitionResult {
  /** DataForSEO ranked_keywords'ten eklenen yeni satır sayısı (source: 'competitor') */
  competitorCount: number
  /** DataForSEO related_keywords'ten eklenen yeni satır sayısı (source: 'expansion') */
  expansionCount: number
  /** competitorCount + expansionCount; mevcut manual kayıtlar dahil değil */
  totalAdded: number
}

/**
 * Pipeline:
 *  1. competitors tablosundan domain listesi çek (max 5 — RESEARCH.md Tuzak 2)
 *  2. Her rakip için sıralı fetchRankedKeywords(domain, credentials, 50, location)
 *  3. Seed keyword'lerden fetchRelatedKeywords(seeds, credentials, location, depth:1, limit:20)
 *  4. upsertKeywordPool — onConflict: 'project_id,keyword', ignoreDuplicates: true
 *  5. Yeni satırlar için fetchKeywordData ile sessiz enrichment (try/catch)
 */
export async function runKeywordAcquisition(_input: AcquisitionInput): Promise<AcquisitionResult> {
  throw new Error('Not implemented — Plan 03')
}
