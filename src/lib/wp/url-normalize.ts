/**
 * URL normalizasyon — imported_pages.link ↔ GSC URL eşleştirme için.
 * RESEARCH.md Pattern 3: URL Normalization
 * D-14: trailing slash, https/http, www/non-www normalize edilir.
 */

/**
 * Bir URL'i canonical forma çevirir:
 * - http → https
 * - www. prefix kaldırır
 * - trailing slash kaldırır (root domain hariç işlev aynı)
 * - query string ve fragment kaldırır
 */
export function normalizeUrl(url: string): string {
  let normalized = url.trim().toLowerCase()

  // https/http normalize
  normalized = normalized.replace(/^http:\/\//, 'https://')

  // www/non-www normalize
  normalized = normalized.replace(/^https:\/\/www\./, 'https://')

  // query string ve fragment kaldır
  normalized = normalized.split('?')[0].split('#')[0]

  // trailing slash kaldır
  if (normalized.endsWith('/') && normalized.length > 'https://x'.length) {
    normalized = normalized.slice(0, -1)
  }

  return normalized
}
