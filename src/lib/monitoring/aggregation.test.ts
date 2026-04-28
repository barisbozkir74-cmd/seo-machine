import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// aggregation.ts henüz mevcut değil — bu testler RED fazında başarısız olmalı
import { getClusterMetrics, getPageMetrics } from './aggregation'

// Supabase client mock factory
function makeSupabaseMock(responses: Record<string, unknown>) {
  const client = {
    from: vi.fn((table: string) => {
      const result = responses[table] ?? { data: [], error: null }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
      }
    }),
  }
  return client as unknown as SupabaseClient
}

// ------------------------------------------------------------------
// Test 1: Weighted CTR = sum(clicks)/sum(impressions), NOT avg of per-row CTRs
// Cluster A: [{clicks:10, impressions:100}, {clicks:30, impressions:200}]
//   Weighted CTR = 40/300 ≈ 0.1333
//   Per-row avg   = (0.10 + 0.15) / 2 = 0.125  <-- WRONG approach
// ------------------------------------------------------------------
describe('getClusterMetrics — weighted CTR', () => {
  it('CTR hesaplaması sum(clicks)/sum(impressions) yöntemiyle yapılmalı', async () => {
    const pageId1 = 'page-1'
    const pageId2 = 'page-2'
    const clusterId = 'cluster-a'

    // gsc_metrics satırları — aynı cluster'daki iki sayfa
    const gscRows = [
      { page_id: pageId1, clicks: 10, impressions: 100, avg_position: 3.0 },
      { page_id: pageId2, clicks: 30, impressions: 200, avg_position: 5.0 },
    ]
    // pages tablosu
    const pagesRows = [
      { id: pageId1, cluster_id: clusterId },
      { id: pageId2, cluster_id: clusterId },
    ]
    // keyword_clusters tablosu
    const clusterRows = [
      { id: clusterId, cluster_name: 'Cluster A', intent: 'informational' },
    ]

    const supabase = {
      from: vi.fn((table: string) => {
        let data: unknown[] = []
        if (table === 'gsc_metrics') data = gscRows
        if (table === 'pages') data = pagesRows
        if (table === 'keyword_clusters') data = clusterRows

        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data, error: null }).then(resolve),
        }
        return chain
      }),
    } as unknown as SupabaseClient

    const result = await getClusterMetrics(supabase, 'project-1', 28)

    expect(result).toHaveLength(1)
    const row = result[0]
    expect(row.clusterId).toBe(clusterId)
    expect(row.clicks).toBe(40)
    expect(row.impressions).toBe(300)
    // Weighted CTR: 40/300 ≈ 0.1333..., NOT 0.125
    expect(row.ctr).toBeCloseTo(40 / 300, 4)
    expect(row.ctr).not.toBeCloseTo(0.125, 3)
  })
})

// ------------------------------------------------------------------
// Test 2: Decay flag
//   prior avg_position=5, current avg_position=12 → delta=+7 → decay=true when impressions>10
//   Same scenario with impressions=5 → decay=false (noise filter)
// ------------------------------------------------------------------
describe('getPageMetrics — decay flag', () => {
  it('delta >= +5 ve impressions > 10 ise isDecayed=true, impressions <= 10 ise false', async () => {
    const pageId = 'page-decay'
    const currentRows = [
      { page_id: pageId, clicks: 5, impressions: 50, avg_position: 12.0 },
    ]
    const priorRows = [
      { page_id: pageId, clicks: 8, impressions: 60, avg_position: 5.0 },
    ]
    const pagesRows = [
      { id: pageId, title: 'Decay Page', slug: 'decay-page' },
    ]
    const packagesRows: unknown[] = []

    let callIndex = 0
    const supabase = {
      from: vi.fn((table: string) => {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) => {
            let data: unknown[] = []
            if (table === 'gsc_metrics') {
              // İlk çağrı current, ikinci çağrı prior
              data = callIndex === 0 ? currentRows : priorRows
              callIndex++
            } else if (table === 'pages') {
              data = pagesRows
            } else if (table === 'page_packages') {
              data = packagesRows
            }
            return Promise.resolve({ data, error: null }).then(resolve)
          },
        }
        return chain
      }),
    } as unknown as SupabaseClient

    const result = await getPageMetrics(supabase, 'project-1', 28)

    expect(result).toHaveLength(1)
    const row = result[0]
    expect(row.pageId).toBe(pageId)
    // delta = 12 - 5 = +7
    expect(row.deltaPosition).toBeCloseTo(7, 1)
    // impressions=50 > 10, delta >= 5 → isDecayed=true
    expect(row.isDecayed).toBe(true)
  })

  it('impressions <= 10 ise isDecayed=false (gürültü filtresi)', async () => {
    const pageId = 'page-low-imp'
    // Aynı delta (+7) ama impressions=5
    const currentRows = [
      { page_id: pageId, clicks: 1, impressions: 5, avg_position: 12.0 },
    ]
    const priorRows = [
      { page_id: pageId, clicks: 2, impressions: 8, avg_position: 5.0 },
    ]
    const pagesRows = [
      { id: pageId, title: 'Low Imp Page', slug: 'low-imp' },
    ]
    const packagesRows: unknown[] = []

    let callIndex = 0
    const supabase = {
      from: vi.fn((table: string) => {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) => {
            let data: unknown[] = []
            if (table === 'gsc_metrics') {
              data = callIndex === 0 ? currentRows : priorRows
              callIndex++
            } else if (table === 'pages') {
              data = pagesRows
            } else if (table === 'page_packages') {
              data = packagesRows
            }
            return Promise.resolve({ data, error: null }).then(resolve)
          },
        }
        return chain
      }),
    } as unknown as SupabaseClient

    const result = await getPageMetrics(supabase, 'project-1', 28)

    // impressions=5 <= 10 → isDecayed=false
    expect(result[0].isDecayed).toBe(false)
  })
})

// ------------------------------------------------------------------
// Test 3: getClusterMetrics excludes clusters whose pages have no gsc_metrics
// ------------------------------------------------------------------
describe('getClusterMetrics — cluster exclusion', () => {
  it('gsc_metrics satırı olmayan cluster sonuçlardan hariç tutulmalı', async () => {
    const pageWithData = 'page-has-data'
    const pageWithout = 'page-no-data'
    const clusterWith = 'cluster-with'
    const clusterWithout = 'cluster-without'

    const gscRows = [
      { page_id: pageWithData, clicks: 20, impressions: 200, avg_position: 4.0 },
    ]
    const pagesRows = [
      { id: pageWithData, cluster_id: clusterWith },
      { id: pageWithout, cluster_id: clusterWithout },
    ]
    const clusterRows = [
      { id: clusterWith, cluster_name: 'Cluster With Data', intent: null },
      { id: clusterWithout, cluster_name: 'Cluster Without Data', intent: null },
    ]

    const supabase = {
      from: vi.fn((table: string) => {
        let data: unknown[] = []
        if (table === 'gsc_metrics') data = gscRows
        if (table === 'pages') data = pagesRows
        if (table === 'keyword_clusters') data = clusterRows

        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data, error: null }).then(resolve),
        }
        return chain
      }),
    } as unknown as SupabaseClient

    const result = await getClusterMetrics(supabase, 'project-1', 28)

    // Sadece clusterWith dönmeli
    expect(result).toHaveLength(1)
    expect(result[0].clusterId).toBe(clusterWith)
    expect(result[0].clusterName).toBe('Cluster With Data')
  })
})
