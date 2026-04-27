import 'server-only'

export type IndexStatus = 'indexed' | 'not_indexed' | 'crawled_not_indexed' | 'unknown'

export async function checkUrlIndexStatus(
  accessToken: string,
  inspectionUrl: string,
  siteUrl: string
): Promise<IndexStatus> {
  const res = await fetch(
    'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inspectionUrl, siteUrl }),
    }
  )
  if (!res.ok) return 'unknown'
  const data = await res.json()
  const verdict: string | undefined = data?.inspectionResult?.indexStatusResult?.verdict

  // PASS=indexed, FAIL=not_indexed, NEUTRAL=crawled_not_indexed
  if (verdict === 'PASS') return 'indexed'
  if (verdict === 'FAIL') return 'not_indexed'
  if (verdict === 'NEUTRAL') return 'crawled_not_indexed'
  return 'unknown'
}
