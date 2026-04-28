/**
 * GSC URL eşleştirme — imported_pages için GSC trafik verisi.
 * RESEARCH.md Open Question 1 kararı: gsc_metrics tablosunu bypass et;
 * Search Analytics API'ye doğrudan istek at (import zamanı snapshot).
 * Pitfall 5: sc-domain: property → URL bazlı join yapılamaz → null döner.
 * D-14: URL normalization zinciri — trailing slash, www, http normalize edilir.
 * D-15: projects.gsc_property_url domain ile imported_page.link domain eşleşmeli.
 */

import { getValidGscToken } from '../gsc/auth'
import { normalizeUrl } from './url-normalize'

export interface GscPageMetric {
  url: string            // normalize edilmiş URL
  clicks: number
  impressions: number
  avgPosition: number | null
}

/**
 * Proje için GSC'den son 28 günlük sayfa bazlı trafik verisi çeker.
 * @param projectId Supabase project UUID
 * @param gscPropertyUrl GSC property URL (projects.gsc_property_url)
 * @param userId Supabase user UUID (token ownership için — Route Handler'dan gelir)
 * @returns URL → GscPageMetric map (normalize edilmiş URL key)
 * @returns null — GSC bağlı değil, sc-domain: property, veya token hatası
 */
export async function matchGscData(
  projectId: string,
  gscPropertyUrl: string | null,
  userId?: string
): Promise<Map<string, GscPageMetric> | null> {
  // GSC bağlı değil — early return, userId gerekmez
  if (!gscPropertyUrl) return null

  // Pitfall 5: sc-domain: property — URL bazlı join yapılamaz
  if (gscPropertyUrl.startsWith('sc-domain:')) {
    console.warn(`[gsc-match] sc-domain: property detected (${gscPropertyUrl}) — URL join atlandı`)
    return null
  }

  // userId zorunlu — Route Handler'dan sağlanmalı
  if (!userId) {
    console.warn('[gsc-match] userId sağlanmadı — GSC token alınamaz')
    return null
  }

  // Token al
  const token = await getValidGscToken(projectId, userId)
  if (!token) return null

  try {
    // Son 28 gün — D-10 weak_page threshold ile uyumlu
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 28)
    const formatDate = (d: Date) => d.toISOString().split('T')[0]

    // Search Analytics API'ye direkt istek — page bazlı
    const response = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscPropertyUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ['page'],
          rowLimit: 25000,
        }),
        signal: AbortSignal.timeout(30_000),
      }
    )

    if (!response.ok) {
      console.error(`[gsc-match] GSC API error: ${response.status}`)
      return null
    }

    const data = await response.json()
    const rows: Array<{ keys: string[]; clicks: number; impressions: number; position: number }> =
      data.rows ?? []

    // URL → GscPageMetric map (normalize edilmiş URL key)
    const metricsMap = new Map<string, GscPageMetric>()
    for (const row of rows) {
      const rawUrl = row.keys[0]
      const normalizedUrl = normalizeUrl(rawUrl)
      metricsMap.set(normalizedUrl, {
        url: normalizedUrl,
        clicks: row.clicks,
        impressions: row.impressions,
        avgPosition: row.position ?? null,
      })
    }

    return metricsMap
  } catch (err) {
    console.error('[gsc-match] GSC data fetch failed:', err)
    return null
  }
}

/**
 * Imported pages için GSC metriklerini URL eşleştirmesi ile atar.
 * D-14: Eşleşme bulunamazsa GSC alanları null kalır.
 */
export function enrichWithGscMetrics(
  importedPages: Array<{ link: string | null }>,
  gscMap: Map<string, GscPageMetric> | null
): Array<{ gsc_clicks: number | null; gsc_impressions: number | null; gsc_avg_position: number | null }> {
  if (!gscMap) {
    return importedPages.map(() => ({ gsc_clicks: null, gsc_impressions: null, gsc_avg_position: null }))
  }

  return importedPages.map(page => {
    if (!page.link) {
      return { gsc_clicks: null, gsc_impressions: null, gsc_avg_position: null }
    }
    const normalizedLink = normalizeUrl(page.link)
    const metric = gscMap.get(normalizedLink)
    if (!metric) {
      return { gsc_clicks: null, gsc_impressions: null, gsc_avg_position: null }
    }
    return {
      gsc_clicks: metric.clicks,
      gsc_impressions: metric.impressions,
      gsc_avg_position: metric.avgPosition,
    }
  })
}
