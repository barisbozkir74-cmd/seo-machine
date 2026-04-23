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
  credentials: { login: string; password: string }
): Promise<string[]> {
  const authHeader = `Basic ${Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64')}`

  const tasks = keywords.map((kw) => ({
    keyword: kw,
    location_code: 2792, // Turkey — RESEARCH.md Pitfall 2
    language_code: 'tr',
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
  credentials: { login: string; password: string }
): Promise<TopPageItem[]> {
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
          location_code: 2792,
          language_code: 'tr',
          limit: 10,
          order_by: [['metrics.organic.etv', 'desc']],
        },
      ]),
    }
  )

  if (!response.ok) {
    throw new Error(`DataForSEO Relevant Pages API hatası: ${response.status}`)
  }

  const data = await response.json()
  return (data.tasks?.[0]?.result?.[0]?.items ?? []) as TopPageItem[]
}
