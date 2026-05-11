import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MonitoringPeriod = 7 | 28 | 90

export type ClusterMetricRow = {
  clusterId: string
  clusterName: string
  intent: string | null
  clicks: number
  impressions: number
  ctr: number          // 0..1, weighted = sum(clicks)/sum(impressions); 0 when impressions=0
  avgPosition: number  // simple AVG of avg_position values; null-coerce to 0 when no rows
}

export type PageMetricRow = {
  pageId: string
  pageUrl: string             // wp_post_url || `/${slug}` fallback
  title: string
  clicks: number
  impressions: number
  avgPosition: number
  deltaPosition: number | null // current - prior; null when prior period has no data
  isDecayed: boolean           // deltaPosition !== null && deltaPosition >= 5 && impressions > 10
}

export type ImportedPageRow = {
  pageId: string        // project_imported_pages.id
  pageUrl: string       // link || `/${slug}` fallback
  title: string
  clicks: null
  impressions: null
  avgPosition: null
  deltaPosition: null
  isDecayed: false
  rowType: 'imported'   // discriminant for PageMetricsTable rendering
}

// ---------------------------------------------------------------------------
// Date helpers (replicated from src/app/api/gsc/sync/route.ts pattern)
// ---------------------------------------------------------------------------

function buildDateRanges(period: MonitoringPeriod) {
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const today = new Date()
  const currentStart = new Date(today)
  currentStart.setDate(today.getDate() - period)
  const priorEnd = new Date(currentStart)
  priorEnd.setDate(currentStart.getDate() - 1)
  const priorStart = new Date(priorEnd)
  priorStart.setDate(priorEnd.getDate() - period + 1)

  return {
    fmt,
    today,
    currentStart,
    priorStart,
    priorEnd,
  }
}

// ---------------------------------------------------------------------------
// getClusterMetrics
// ---------------------------------------------------------------------------

export async function getClusterMetrics(
  supabase: SupabaseClient,
  projectId: string,
  period: MonitoringPeriod
): Promise<ClusterMetricRow[]> {
  const { fmt, today, currentStart } = buildDateRanges(period)

  // 1. Fetch gsc_metrics for current period
  const { data: metricsData } = await supabase
    .from('gsc_metrics')
    .select('page_id, clicks, impressions, avg_position')
    .eq('project_id', projectId)
    .gte('date', fmt(currentStart))
    .lte('date', fmt(today))  // upper bound prevents including same-day sync rows beyond window

  const metrics: Array<{
    page_id: string
    clicks: number
    impressions: number
    avg_position: number | null
  }> = metricsData ?? []

  // 2. Fetch pages to build pageId → clusterId map
  const { data: pagesData } = await supabase
    .from('pages')
    .select('id, cluster_id')
    .eq('project_id', projectId)

  const pageToCluster = new Map<string, string>()
  for (const p of (pagesData ?? []) as Array<{ id: string; cluster_id: string | null }>) {
    if (p.cluster_id) {
      pageToCluster.set(p.id, p.cluster_id)
    }
  }

  // 3. Fetch keyword_clusters to build clusterId → {name, intent} map
  const { data: clustersData } = await supabase
    .from('keyword_clusters')
    .select('id, cluster_name, intent')
    .eq('project_id', projectId)

  const clusterMeta = new Map<string, { name: string; intent: string | null }>()
  for (const c of (clustersData ?? []) as Array<{
    id: string
    cluster_name: string
    intent: string | null
  }>) {
    clusterMeta.set(c.id, { name: c.cluster_name, intent: c.intent })
  }

  // 4. Reduce gsc_metrics rows by clusterId
  const clusterAgg = new Map<
    string,
    { clicks: number; impressions: number; posSum: number; posCount: number }
  >()

  for (const row of metrics) {
    const clusterId = pageToCluster.get(row.page_id)
    if (!clusterId) continue // page with no cluster_id — skip

    const existing = clusterAgg.get(clusterId)
    const posValue = row.avg_position ?? 0
    if (existing) {
      existing.clicks += row.clicks
      existing.impressions += row.impressions
      existing.posSum += posValue
      existing.posCount += 1
    } else {
      clusterAgg.set(clusterId, {
        clicks: row.clicks,
        impressions: row.impressions,
        posSum: posValue,
        posCount: 1,
      })
    }
  }

  // 5. Build output rows
  const result: ClusterMetricRow[] = []
  for (const [clusterId, agg] of clusterAgg.entries()) {
    // Drop clusters with zero clicks AND zero impressions
    if (agg.clicks === 0 && agg.impressions === 0) continue

    const meta = clusterMeta.get(clusterId)
    const ctr = agg.impressions === 0 ? 0 : agg.clicks / agg.impressions
    const avgPosition = agg.posCount === 0 ? 0 : agg.posSum / agg.posCount

    result.push({
      clusterId,
      clusterName: meta?.name ?? 'Unknown',
      intent: meta?.intent ?? null,
      clicks: agg.clicks,
      impressions: agg.impressions,
      ctr,
      avgPosition,
    })
  }

  // Sort by clicks DESC
  result.sort((a, b) => b.clicks - a.clicks)

  return result
}

// ---------------------------------------------------------------------------
// getPageMetrics
// ---------------------------------------------------------------------------

export async function getPageMetrics(
  supabase: SupabaseClient,
  projectId: string,
  period: MonitoringPeriod
): Promise<PageMetricRow[]> {
  const { fmt, today, currentStart, priorStart, priorEnd } = buildDateRanges(period)

  // 1. Two parallel SELECTs on gsc_metrics (current + prior periods)
  const [currentResult, priorResult] = await Promise.all([
    supabase
      .from('gsc_metrics')
      .select('page_id, clicks, impressions, avg_position')
      .eq('project_id', projectId)
      .gte('date', fmt(currentStart))
      .lte('date', fmt(today)),  // upper bound prevents including same-day sync rows beyond window
    supabase
      .from('gsc_metrics')
      .select('page_id, clicks, impressions, avg_position')
      .eq('project_id', projectId)
      .gte('date', fmt(priorStart))
      .lte('date', fmt(priorEnd)),
  ])

  type MetricRaw = {
    page_id: string
    clicks: number
    impressions: number
    avg_position: number | null
  }

  const currentMetrics: MetricRaw[] = currentResult.data ?? []
  const priorMetrics: MetricRaw[] = priorResult.data ?? []

  // 2. Fetch pages
  const { data: pagesData } = await supabase
    .from('pages')
    .select('id, title, slug')
    .eq('project_id', projectId)

  type PageRaw = { id: string; title: string; slug: string }
  const pages: PageRaw[] = pagesData ?? []

  // 3. Fetch page_packages for wp_post_url resolution
  const { data: packagesData } = await supabase
    .from('page_packages')
    .select('page_id, wp_post_url')
    .eq('project_id', projectId)

  const packagesMap = new Map<string, string>()
  for (const pkg of (packagesData ?? []) as Array<{
    page_id: string
    wp_post_url: string | null
  }>) {
    if (pkg.wp_post_url) {
      packagesMap.set(pkg.page_id, pkg.wp_post_url)
    }
  }

  // 4. Reduce gsc_metrics rows in JS

  type Agg = { clicks: number; impressions: number; posSum: number; posCount: number }

  function reduceMetrics(rows: MetricRaw[]): Map<string, Agg> {
    const map = new Map<string, Agg>()
    for (const row of rows) {
      const existing = map.get(row.page_id)
      const posValue = row.avg_position ?? 0
      if (existing) {
        existing.clicks += row.clicks
        existing.impressions += row.impressions
        existing.posSum += posValue
        existing.posCount += 1
      } else {
        map.set(row.page_id, {
          clicks: row.clicks,
          impressions: row.impressions,
          posSum: posValue,
          posCount: 1,
        })
      }
    }
    return map
  }

  const currentAgg = reduceMetrics(currentMetrics)
  const priorAgg = reduceMetrics(priorMetrics)

  // 5. Build output rows
  const result: PageMetricRow[] = []

  for (const page of pages) {
    const curr = currentAgg.get(page.id)

    // Drop pages with no current data
    if (!curr || (curr.clicks === 0 && curr.impressions === 0)) continue

    const prior = priorAgg.get(page.id)

    const currentAvgPos = curr.posCount === 0 ? 0 : curr.posSum / curr.posCount
    const priorAvgPos = prior && prior.posCount > 0 ? prior.posSum / prior.posCount : null

    const deltaPosition = priorAvgPos !== null ? currentAvgPos - priorAvgPos : null
    const isDecayed =
      deltaPosition !== null && deltaPosition >= 5 && curr.impressions > 10

    const pageUrl = packagesMap.get(page.id) ?? `/${page.slug}`

    result.push({
      pageId: page.id,
      pageUrl,
      title: page.title,
      clicks: curr.clicks,
      impressions: curr.impressions,
      avgPosition: currentAvgPos,
      deltaPosition,
      isDecayed,
    })
  }

  // Sort by clicks DESC
  result.sort((a, b) => b.clicks - a.clicks)

  return result
}

// ---------------------------------------------------------------------------
// getImportedPageMetrics
// ---------------------------------------------------------------------------

export async function getImportedPageMetrics(
  supabase: SupabaseClient,
  projectId: string
): Promise<ImportedPageRow[]> {
  const { data } = await supabase
    .from('project_imported_pages')
    .select('id, title, link, slug')
    .eq('project_id', projectId)
    .order('title')

  return (data ?? []).map((p: { id: string; title: string; link: string | null; slug: string | null }) => ({
    pageId: p.id,
    pageUrl: p.link ?? (p.slug ? `/${p.slug}` : ''),
    title: p.title,
    clicks: null,
    impressions: null,
    avgPosition: null,
    deltaPosition: null,
    isDecayed: false as const,
    rowType: 'imported' as const,
  }))
}
