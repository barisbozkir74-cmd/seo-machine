import 'server-only'

export type SearchAnalyticsRow = {
  pageUrl: string
  keyword: string
  clicks: number
  impressions: number
  avgPosition: number
}

export async function fetchSearchAnalytics(
  accessToken: string,
  siteUrl: string,
  startDate: string, // YYYY-MM-DD
  endDate: string
): Promise<SearchAnalyticsRow[]> {
  const encodedSite = encodeURIComponent(siteUrl)
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ['page', 'query'],
        rowLimit: 25000,
        dataState: 'final',
      }),
    }
  )
  if (!res.ok) return []
  const data = await res.json()
  if (!data.rows) return []

  return data.rows.map((row: {
    keys: string[]
    clicks: number
    impressions: number
    position: number
  }) => ({
    pageUrl: row.keys[0],
    keyword: row.keys[1],
    clicks: row.clicks,
    impressions: row.impressions,
    avgPosition: Math.round(row.position * 100) / 100,
  }))
}
