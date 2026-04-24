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
