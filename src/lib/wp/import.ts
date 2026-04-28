/**
 * WP REST API'den tüm içeriği çeken pagination loop.
 * RESEARCH.md Pattern 1 — gsc/sync/route.ts pagination analog.
 * Pitfall 2: _fields parametresi zorunlu — content HTML asla çekilmez.
 * Rate limit: her batch sonrası 50ms bekle (Claude's Discretion — RESEARCH.md).
 * T-15.5-03-01: authHeader asla console.log'a yazılmaz.
 * T-15.5-03-02: AbortSignal.timeout(30_000) her request için; 50ms batch delay.
 */

// WP REST API raw item — normalize.ts'teki WpItem ile aynı shape
export interface WpRawItem {
  id: number
  title: { rendered: string }
  link: string
  slug: string
  parent: number
  date: string
  modified: string
  status: string
  menu_order: number
  yoast_head_json?: { title?: string; description?: string } | null
  excerpt?: { rendered?: string } | null
}

const WP_FIELDS = 'id,title,link,slug,parent,date,modified,status,menu_order,yoast_head_json,excerpt'

/**
 * Exponential backoff retry — RESEARCH.md "Rate Limiting Strategy".
 * 429 Too Many Requests → Retry-After header'a göre bekler.
 */
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, options)
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10)
      await new Promise(r => setTimeout(r, retryAfter * 1000))
      continue
    }
    return res
  }
  throw new Error('WP API: Max retries exceeded')
}

/**
 * Belirtilen endpoint için tüm sayfaları çeker (pagination loop).
 * @param wpUrl WordPress site URL (https://example.com)
 * @param authHeader "Basic base64(username:appPassword)" string — asla loglanmaz (T-15.5-03-01)
 * @param endpoint 'pages' | 'posts' | 'categories' | 'tags'
 * @returns Tüm WP item'ları
 */
export async function fetchAllWpContent(
  wpUrl: string,
  authHeader: string,
  endpoint: 'pages' | 'posts' | 'categories' | 'tags'
): Promise<WpRawItem[]> {
  const results: WpRawItem[] = []
  let page = 1
  let totalPages = 1

  do {
    const url = `${wpUrl.replace(/\/$/, '')}/wp-json/wp/v2/${endpoint}?per_page=100&page=${page}&_fields=${WP_FIELDS}`
    const res = await fetchWithRetry(url, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30_000),  // T-15.5-03-02: DoS mitigation
    })

    if (!res.ok) {
      throw new Error(`WP API error: ${res.status} on ${endpoint} page ${page}`)
    }

    if (page === 1) {
      totalPages = parseInt(res.headers.get('X-WP-TotalPages') ?? '1', 10)
    }

    const items: WpRawItem[] = await res.json()
    results.push(...items)

    // Rate limit önlemi: 50ms bekle (Claude's Discretion — RESEARCH.md)
    if (page < totalPages) {
      await new Promise(r => setTimeout(r, 50))
    }

    page++
  } while (page <= totalPages)

  return results
}
