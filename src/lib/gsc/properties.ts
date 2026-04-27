import 'server-only'

export type GscProperty = {
  siteUrl: string
  permissionLevel: string
}

export async function listGscProperties(
  accessToken: string
): Promise<GscProperty[]> {
  const res = await fetch(
    'https://www.googleapis.com/webmasters/v3/sites',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.siteEntry ?? []) as GscProperty[]
}
