/**
 * URL normalizasyonu — GSC ve WP imported page URL'lerini karşılaştırmak için.
 * D-14: trailing slash, https/http, www/non-www normalize edilir.
 * Query string ve fragment kaldırılır.
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim())
    // https/http normalize
    parsed.protocol = 'https:'
    // www kaldır
    if (parsed.hostname.startsWith('www.')) {
      parsed.hostname = parsed.hostname.slice(4)
    }
    // query string ve fragment kaldır
    parsed.search = ''
    parsed.hash = ''
    // trailing slash kaldır (root dahil)
    let normalized = parsed.toString()
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1)
    }
    return normalized
  } catch {
    // Parse edilemeyen URL → olduğu gibi döndür
    return url
  }
}
