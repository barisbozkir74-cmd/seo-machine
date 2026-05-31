// DataForSEO Orchestrator — Shared Types
// server-only değil: client kodu import etmez ama bu dosya taşınabilir.

// ─── Endpoint katalog ─────────────────────────────────────────────────────────

export type EndpointId =
  | 'serp/organic'
  | 'labs/ranked_keywords'
  | 'labs/relevant_pages'
  | 'labs/related_keywords'
  | 'labs/competitors_domain'
  | 'labs/domain_intersection'
  | 'keyword_data/search_volume'
  | 'backlinks/summary'
  | 'backlinks/referring_domains'
  | 'onpage/crawl'

// ─── Task tanımı ──────────────────────────────────────────────────────────────

export type FetchTarget =
  | { type: 'domain';   value: string }
  | { type: 'keyword';  value: string }
  | { type: 'keywords'; value: string[] }

export type TaskSpec = {
  module:       string
  endpoint:     EndpointId
  target:       FetchTarget
  locationCode: number
  languageCode: string
  params?:      Record<string, unknown>
}

// ─── TTL tablosu (saniye) ─────────────────────────────────────────────────────

export const ENDPOINT_TTL: Record<EndpointId, number> = {
  'serp/organic':                7  * 24 * 3600,   // 7 gün
  'labs/ranked_keywords':        14 * 24 * 3600,   // 14 gün
  'labs/relevant_pages':         14 * 24 * 3600,   // 14 gün
  'labs/related_keywords':       30 * 24 * 3600,   // 30 gün
  'labs/competitors_domain':     14 * 24 * 3600,   // 14 gün
  'labs/domain_intersection':    14 * 24 * 3600,   // 14 gün
  'keyword_data/search_volume':  30 * 24 * 3600,   // 30 gün
  'backlinks/summary':           30 * 24 * 3600,   // 30 gün
  'backlinks/referring_domains': 30 * 24 * 3600,   // 30 gün
  'onpage/crawl':                0,                // WR-03: TTL=0 means "always re-fetch" — expires_at is null,
                                                  // isStale(null) returns true, so cache is bypassed every call.
                                                  // This is intentional for user-triggered crawls; call sites
                                                  // must use forceRefresh:true or accept repeated fetches.
}

// ─── Bütçe ────────────────────────────────────────────────────────────────────

export const DAILY_BUDGET_UNITS = 5000   // günlük maksimum cost_units toplamı

// ─── Cache sonuç tipi ─────────────────────────────────────────────────────────

export type SkipReason =
  | 'BUDGET_EXCEEDED'
  | 'BACKOFF'
  | 'ALREADY_RUNNING'

export type CacheResult<T> =
  | { data: T;    fromCache: boolean; skipped: false }
  | { data: null; fromCache: false;   skipped: true; reason: SkipReason }
