import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getDataForSeoCredentials } from '@/lib/supabase/vault'
import {
  fetchRankedKeywords,
  fetchRelatedKeywords,
  fetchKeywordData,
  type RankedKeywordItem,
  type RelatedKeywordItem,
} from '@/lib/dataforseo/client'
import { resolveLocation } from '@/lib/dataforseo/location-map'

// ─── Service client ───────────────────────────────────────────────────────────
// Pattern: src/lib/research/sector-research.ts satır 9-14 — service role bypass RLS

function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Public types ─────────────────────────────────────────────────────────────

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

// ─── Constants (RESEARCH.md tuzak önlemleri) ──────────────────────────────────

const MAX_COMPETITORS = 5            // Tuzak 2: rakip cap
const KEYWORDS_PER_COMPETITOR = 50   // RESEARCH.md Standart Yığın
const SEED_LIMIT = 10                // Genişletme için max seed sayısı (Tuzak 3)
const RELATED_DEPTH = 1              // Tuzak 3: depth patlamasını önle
const RELATED_LIMIT = 20             // Tuzak 3: per-seed limit

// ─── Internal pipeline pieces ─────────────────────────────────────────────────

type KeywordRow = {
  user_id: string
  project_id: string
  keyword: string
  volume: number | null
  cpc: number | null
  source: 'competitor' | 'expansion'
}

/**
 * Rakip domain listesi için sıralı (paralel değil — Tuzak 2) ranked_keywords çağrısı.
 * Her rakip için top 50 keyword (rank<=20 filtresi mevcut, client.ts satır 140).
 */
async function fetchCompetitorKeywords(
  domains: string[],
  userId: string,
  projectId: string,
  credentials: { login: string; password: string },
  location: { locationCode: number; languageCode: string }
): Promise<KeywordRow[]> {
  const rows: KeywordRow[] = []
  const seen = new Set<string>()

  for (const domain of domains.slice(0, MAX_COMPETITORS)) {
    let items: RankedKeywordItem[]
    try {
      items = await fetchRankedKeywords(domain, credentials, KEYWORDS_PER_COMPETITOR, location)
    } catch (err) {
      console.error('[ai-acquisition] fetchRankedKeywords failed for domain:', domain, err)
      continue  // Tek rakip bozulursa diğerleri devam etsin
    }

    for (const item of items) {
      const kw = item.keyword?.trim()
      if (!kw || seen.has(kw)) continue
      seen.add(kw)
      rows.push({
        user_id: userId,
        project_id: projectId,
        keyword: kw,
        volume: item.keyword_data?.keyword_info?.search_volume ?? null,
        cpc: item.keyword_data?.keyword_info?.cpc ?? null,
        source: 'competitor',
      })
    }
  }
  return rows
}

/**
 * Mevcut keyword listesinden seed alıp related_keywords ile genişletir.
 * Tuzak 3: depth: 1, limit: 20, max 10 seed.
 * Hata olursa silently fail — competitor akışı bozulmaz.
 */
async function fetchSeedExpansion(
  seeds: string[],
  userId: string,
  projectId: string,
  credentials: { login: string; password: string },
  location: { locationCode: number; languageCode: string },
  excludedKeywords: Set<string>
): Promise<KeywordRow[]> {
  if (seeds.length === 0) return []

  const seedSlice = seeds.slice(0, SEED_LIMIT)
  let items: RelatedKeywordItem[] = []
  try {
    items = await fetchRelatedKeywords(seedSlice, credentials, location, {
      depth: RELATED_DEPTH,
      limit: RELATED_LIMIT,
    })
  } catch (err) {
    console.error('[ai-acquisition] fetchRelatedKeywords failed (silent):', err)
    return []
  }

  const rows: KeywordRow[] = []
  const seen = new Set<string>(excludedKeywords)
  for (const item of items) {
    const kw = item.keyword_data?.keyword?.trim()
    if (!kw || seen.has(kw)) continue
    seen.add(kw)
    rows.push({
      user_id: userId,
      project_id: projectId,
      keyword: kw,
      volume: item.keyword_data?.keyword_info?.search_volume ?? null,
      cpc: item.keyword_data?.keyword_info?.cpc ?? null,
      source: 'expansion',
    })
  }
  return rows
}

/**
 * KRİTİK: ignoreDuplicates: true — mevcut 'manual' kayıtların source'u korunur.
 * RESEARCH.md Tuzak 1: importKeywords'deki false'tan farklı, kasıtlı.
 * onConflict project_id,keyword unique constraint ile uyumlu (migration 20260423000005).
 */
async function upsertKeywordPool(
  supabase: SupabaseClient,
  rows: KeywordRow[]
): Promise<number> {
  if (rows.length === 0) return 0

  const { data, error } = await supabase
    .from('keywords')
    .upsert(rows, {
      onConflict: 'project_id,keyword',
      ignoreDuplicates: true,
    })
    .select('id')

  if (error) {
    throw new Error(`upsertKeywordPool failed: ${error.message}`)
  }
  return data?.length ?? 0
}

/**
 * Sessiz enrichment — pattern: actions.ts satır 76-104 (importKeywords).
 * Sadece source IN ('competitor','expansion') AND enriched_at IS NULL satırları zenginleştirir.
 * Hata throw etmez — acquisition başarılı sayılır.
 */
async function enrichNewKeywords(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  credentials: { login: string; password: string },
  location: { locationCode: number; languageCode: string }
): Promise<void> {
  try {
    const { data: pending } = await supabase
      .from('keywords')
      .select('keyword')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .is('enriched_at', null)
      .in('source', ['competitor', 'expansion'])
      .limit(200)  // Patlamayı önle

    const kwTexts = (pending ?? []).map((r) => r.keyword as string)
    if (kwTexts.length === 0) return

    const enriched = await fetchKeywordData(kwTexts, credentials, location)

    for (const item of enriched) {
      if (!item.keyword) continue
      const updatePayload: Record<string, unknown> = {
        enriched_at: new Date().toISOString(),
      }
      if (item.search_volume !== null) updatePayload.volume = item.search_volume
      if (item.cpc !== null) updatePayload.cpc = item.cpc
      if (item.keyword_difficulty !== null) updatePayload.difficulty = item.keyword_difficulty
      if (item.search_intent !== null) updatePayload.search_intent = item.search_intent

      await supabase
        .from('keywords')
        .update(updatePayload)
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('keyword', item.keyword)
    }
  } catch (err) {
    // Sessiz fail — D-07 pattern (Phase 5)
    console.error('[ai-acquisition] enrichment failed (silent):', err)
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runKeywordAcquisition(input: AcquisitionInput): Promise<AcquisitionResult> {
  const { projectId, userId } = input

  // Credentials (vault fallback inside) — credential hatası throw eder
  const credentials = await getDataForSeoCredentials()
  const supabase = getServiceClient()

  // Project info: target_country / target_language for location resolution
  const { data: project, error: projectErr } = await supabase
    .from('projects')
    .select('target_country, target_language')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (projectErr || !project) {
    throw new Error(`Project not found or access denied: ${projectId}`)
  }

  const location = resolveLocation(project.target_country, project.target_language)

  // 1. Competitors → ranked_keywords
  const { data: competitorsData } = await supabase
    .from('competitors')
    .select('domain')
    .eq('project_id', projectId)
    .eq('user_id', userId)
  const competitorDomains = (competitorsData ?? []).map((c) => c.domain as string).filter(Boolean)

  const competitorRows = await fetchCompetitorKeywords(
    competitorDomains, userId, projectId, credentials, location
  )

  // 2. Seeds for expansion: mevcut 'manual' kayıtların ilki + competitor'dan top
  const { data: existingManual } = await supabase
    .from('keywords')
    .select('keyword, volume')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('source', 'manual')
    .order('volume', { ascending: false, nullsFirst: false })
    .limit(SEED_LIMIT)

  const seeds = (existingManual ?? []).map((r) => r.keyword as string).filter(Boolean)
  const competitorKeywordSet = new Set(competitorRows.map((r) => r.keyword))

  const expansionRows = await fetchSeedExpansion(
    seeds, userId, projectId, credentials, location, competitorKeywordSet
  )

  // 3. Upsert (ignoreDuplicates: true — manual korunur)
  const competitorAdded = await upsertKeywordPool(supabase, competitorRows)
  const expansionAdded = await upsertKeywordPool(supabase, expansionRows)

  // 4. Enrich silently
  await enrichNewKeywords(supabase, userId, projectId, credentials, location)

  return {
    competitorCount: competitorAdded,
    expansionCount: expansionAdded,
    totalAdded: competitorAdded + expansionAdded,
  }
}
