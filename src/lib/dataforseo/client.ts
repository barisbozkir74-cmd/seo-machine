import 'server-only'

export type TopPageItem = {
  page_address: string
  metrics?: {
    organic?: {
      etv?: number
      count?: number
    }
  }
}

export async function fetchSerpDomains(
  keywords: string[],
  credentials: { login: string; password: string },
  location: { locationCode: number; languageCode: string } = { locationCode: 2792, languageCode: 'tr' }
): Promise<string[]> {
  const authHeader = `Basic ${Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64')}`

  const tasks = keywords.map((kw) => ({
    keyword: kw,
    location_code: location.locationCode,
    language_code: location.languageCode,
    depth: 10,
  }))

  const response = await fetch(
    'https://api.dataforseo.com/v3/serp/google/organic/live/regular',
    {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tasks),
    }
  )

  if (!response.ok) {
    throw new Error(`DataForSEO SERP API hatası: ${response.status}`)
  }

  const data = await response.json()
  const domains = new Set<string>()

  for (const task of data.tasks ?? []) {
    for (const result of task.result ?? []) {
      for (const item of result.items ?? []) {
        if (item.type === 'organic' && item.domain) {
          // www. normalizasyonu — RESEARCH.md Pitfall 3
          domains.add((item.domain as string).replace(/^www\./, ''))
        }
      }
    }
  }

  return Array.from(domains)
}

export async function fetchTopPages(
  domain: string,
  credentials: { login: string; password: string },
  location: { locationCode: number; languageCode: string } = { locationCode: 2792, languageCode: 'tr' }
): Promise<{ items: TopPageItem[]; totalCount: number }> {
  const authHeader = `Basic ${Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64')}`

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '')

  const response = await fetch(
    'https://api.dataforseo.com/v3/dataforseo_labs/google/relevant_pages/live',
    {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          target: cleanDomain,
          location_code: location.locationCode,
          language_code: location.languageCode,
          limit: 10,
        },
      ]),
    }
  )

  if (!response.ok) {
    throw new Error(`DataForSEO Relevant Pages API hatası: ${response.status}`)
  }

  const data = await response.json()
  const result = data.tasks?.[0]?.result?.[0]
  return {
    items: (result?.items ?? []) as TopPageItem[],
    totalCount: result?.total_count ?? 0,
  }
}

export type RankedKeywordItem = {
  keyword: string
  location_code: number
  ranked_serp_element?: {
    serp_item?: {
      rank_absolute?: number
    }
  }
  keyword_data?: {
    keyword_info?: {
      search_volume?: number
      cpc?: number
    }
    impressions_info?: {
      etv?: number
    }
  }
}

export async function fetchRankedKeywords(
  domain: string,
  credentials: { login: string; password: string },
  limit = 20,
  location: { locationCode: number; languageCode: string } = { locationCode: 2792, languageCode: 'tr' }
): Promise<RankedKeywordItem[]> {
  const authHeader = `Basic ${Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64')}`
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '')

  const response = await fetch(
    'https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live',
    {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        {
          target: cleanDomain,
          location_code: location.locationCode,
          language_code: location.languageCode,
          limit,
          order_by: [['keyword_data.impressions_info.etv', 'desc']],
          filters: [['ranked_serp_element.serp_item.rank_absolute', '<=', 20]],
        },
      ]),
    }
  )

  if (!response.ok) throw new Error(`DataForSEO Ranked Keywords API hatası: ${response.status}`)

  const data = await response.json()
  return (data.tasks?.[0]?.result?.[0]?.items ?? []) as RankedKeywordItem[]
}

export type BacklinksSummary = {
  total_backlinks: number
  referring_domains: number
  referring_ips: number
  rank: number
}

export async function fetchBacklinksSummary(
  domain: string,
  credentials: { login: string; password: string }
): Promise<BacklinksSummary | null> {
  const authHeader = `Basic ${Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64')}`
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '')

  const response = await fetch(
    'https://api.dataforseo.com/v3/backlinks/summary/live',
    {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ target: cleanDomain }]),
    }
  )

  if (!response.ok) throw new Error(`DataForSEO Backlinks API hatası: ${response.status}`)

  const data = await response.json()
  const result = data.tasks?.[0]?.result?.[0]
  if (!result) return null

  return {
    total_backlinks: result.total_backlinks ?? 0,
    referring_domains: result.referring_domains ?? 0,
    referring_ips: result.referring_ips ?? 0,
    rank: result.rank ?? 0,
  }
}

export type RelatedKeywordItem = {
  keyword_data?: {
    keyword?: string
    keyword_info?: {
      search_volume?: number
      cpc?: number
      competition?: number
    }
    search_intent_info?: {
      main_intent?: string
    }
  }
  depth?: number
}

export async function fetchRelatedKeywords(
  keywords: string[],
  credentials: { login: string; password: string },
  location: { locationCode: number; languageCode: string } = { locationCode: 2792, languageCode: 'tr' },
  options: { depth?: number; limit?: number } = {}
): Promise<RelatedKeywordItem[]> {
  if (keywords.length === 0) return []

  const { depth = 1, limit = 20 } = options
  const authHeader = `Basic ${Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64')}`

  // RESEARCH.md Tuzak 3: depth: 1 + limit: 20 — patlama önlenir.
  // Birden fazla seed keyword için ayrı task gönderilir; DataForSEO her task için ayrı result döner.
  const tasks = keywords.map((kw) => ({
    keyword: kw,
    location_code: location.locationCode,
    language_code: location.languageCode,
    depth,
    limit,
    include_seed_keyword: false,
  }))

  const response = await fetch(
    'https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live',
    {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(tasks),
    }
  )

  if (!response.ok) {
    throw new Error(`DataForSEO Related Keywords API hatası: ${response.status}`)
  }

  const data = await response.json()

  // Tüm task sonuçlarını flatten — her task ayrı items[] taşır
  const allItems: RelatedKeywordItem[] = []
  for (const task of data.tasks ?? []) {
    for (const result of task.result ?? []) {
      for (const item of result.items ?? []) {
        allItems.push(item as RelatedKeywordItem)
      }
    }
  }

  return allItems
}

export type KeywordDataItem = {
  keyword: string
  search_volume: number | null
  cpc: number | null
  keyword_difficulty: number | null
  search_intent: string | null
}

export async function fetchKeywordData(
  keywords: string[],
  credentials: { login: string; password: string },
  location: { locationCode: number; languageCode: string } = { locationCode: 2792, languageCode: 'tr' }
): Promise<KeywordDataItem[]> {
  if (keywords.length === 0) return []

  const authHeader = `Basic ${Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64')}`

  const response = await fetch(
    'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
    {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        {
          keywords,
          location_code: location.locationCode,
          language_code: location.languageCode,
        },
      ]),
    }
  )

  if (!response.ok) throw new Error(`DataForSEO Keyword Data API hatası: ${response.status}`)

  const data = await response.json()
  const items: Record<string, unknown>[] = data.tasks?.[0]?.result ?? []

  return items.map((item) => ({
    keyword: item.keyword as string,
    search_volume: (item.search_volume as number) ?? null,
    cpc: (item.cpc as number) ?? null,
    keyword_difficulty: (item.keyword_difficulty as number) ?? null,
    search_intent: (item.search_intent as string) ?? null,
  }))
}
