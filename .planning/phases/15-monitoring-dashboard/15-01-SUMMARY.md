---
phase: 15-monitoring-dashboard
plan: "01"
subsystem: monitoring-data-layer
tags: [monitoring, gsc, aggregation, api, tdd]
dependency_graph:
  requires: [gsc_metrics table (Phase 14), pages table, keyword_clusters table, page_packages table]
  provides: [getClusterMetrics, getPageMetrics, /api/monitoring/clusters, /api/monitoring/pages]
  affects: [15-02-PLAN (SSR page imports aggregation lib directly)]
tech_stack:
  added: []
  patterns: [parallel Promise.all for dual-period queries, in-memory JS reduce over Supabase rows, user-scoped RLS client only]
key_files:
  created:
    - src/lib/monitoring/aggregation.ts
    - src/lib/monitoring/aggregation.test.ts
    - src/app/api/monitoring/clusters/route.ts
    - src/app/api/monitoring/pages/route.ts
  modified: []
decisions:
  - "In-memory JS aggregation (not SQL GROUP BY) for cluster metrics — avoids complex Supabase relational aggregation syntax, data volume is bounded by 90-day window"
  - "Promise.all for parallel current+prior period queries in getPageMetrics — no sequential waterfall"
  - "pageUrl = wp_post_url ?? /${slug} fallback — never undefined"
  - "gscConnected: false response shape when gsc_property_url is null — UI consumer branches on this flag"
metrics:
  duration_minutes: 5
  completed_date: "2026-04-28"
  tasks_completed: 2
  files_created: 4
---

# Phase 15 Plan 01: Monitoring Data Layer Summary

GSC cluster + page aggregation library with two thin API routes behind auth and ownership guards. Implements MON-01 (cluster summary) and MON-02 (page metrics + decay) data side.

## Aggregation Library API

**File:** `src/lib/monitoring/aggregation.ts`

### Types

```typescript
export type MonitoringPeriod = 7 | 28 | 90

export type ClusterMetricRow = {
  clusterId: string
  clusterName: string
  intent: string | null
  clicks: number
  impressions: number
  ctr: number          // weighted = sum(clicks)/sum(impressions)
  avgPosition: number
}

export type PageMetricRow = {
  pageId: string
  pageUrl: string             // wp_post_url || `/${slug}` fallback
  title: string
  clicks: number
  impressions: number
  avgPosition: number
  deltaPosition: number | null // current - prior; null when no prior data
  isDecayed: boolean           // deltaPosition >= 5 AND impressions > 10
}
```

### Functions

```typescript
getClusterMetrics(supabase: SupabaseClient, projectId: string, period: MonitoringPeriod): Promise<ClusterMetricRow[]>
getPageMetrics(supabase: SupabaseClient, projectId: string, period: MonitoringPeriod): Promise<PageMetricRow[]>
```

**getClusterMetrics implementation:**
1. SELECT gsc_metrics WHERE project_id = projectId AND date >= currentStart
2. SELECT pages WHERE project_id = projectId → pageId→clusterId Map
3. SELECT keyword_clusters WHERE project_id = projectId → clusterId→{name,intent} Map
4. In-memory reduce: group rows by clusterId; SUM clicks/impressions, mean avg_position
5. ctr = sum(clicks) / sum(impressions) (weighted, not row-average)
6. Drop clusters with clicks=0 AND impressions=0; sort by clicks DESC

**getPageMetrics implementation:**
1. Promise.all([current period SELECT, prior period SELECT]) on gsc_metrics
2. SELECT pages, SELECT page_packages for URL resolution
3. In-memory reduce: group by page_id for both periods
4. deltaPosition = currentAvgPos - priorAvgPos (null when no prior data)
5. isDecayed = deltaPosition !== null AND deltaPosition >= 5 AND impressions > 10
6. pageUrl = packagesMap.get(pageId) ?? `/${slug}`

## Date-Range Arithmetic

```
today = new Date()
currentStart = today - period days
priorEnd = currentStart - 1 day
priorStart = priorEnd - period + 1 days
```

Current period: [currentStart, today]
Prior period: [priorStart, priorEnd]

## API Route Response Shapes

### GET /api/monitoring/clusters?projectId=...&period=7|28|90

**Success (GSC connected):**
```json
{ "clusters": [...ClusterMetricRow], "gscConnected": true, "period": 28 }
```

**GSC not connected:**
```json
{ "clusters": [], "gscConnected": false }
```

**Errors:**
- 400: `{ "error": "projectId required" }`
- 401: `{ "error": "Unauthorized" }`
- 404: `{ "error": "Project not found" }`
- 500: `{ "error": "Failed to fetch cluster metrics" }`

### GET /api/monitoring/pages?projectId=...&period=7|28|90

**Success (GSC connected):**
```json
{ "pages": [...PageMetricRow], "gscConnected": true, "period": 28 }
```

**GSC not connected:**
```json
{ "pages": [], "gscConnected": false }
```

**Errors:**
- 400: `{ "error": "projectId required" }`
- 401: `{ "error": "Unauthorized" }`
- 404: `{ "error": "Project not found" }`
- 500: `{ "error": "Failed to fetch page metrics" }`

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test) | 3f177ae | PASS — 4 failing tests (module not found) |
| GREEN (feat) | 5219ca9 | PASS — 4 tests passing |
| REFACTOR | — | Not needed |

**Tests cover:**
1. Weighted CTR: 40/300 ≈ 0.1333, NOT per-row average 0.125
2. Decay flag true: delta=+7, impressions=50 → isDecayed=true
3. Decay flag false: delta=+7, impressions=5 → isDecayed=false (noise filter)
4. Cluster exclusion: cluster without gsc_metrics rows excluded from result

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is wired from real DB queries; no hardcoded placeholders.

## Threat Flags

All threats in plan's threat model addressed:

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-15-01-01 | 401 auth + 404 ownership on clusters route | DONE |
| T-15-01-02 | Same auth + ownership on pages route, user-scoped client | DONE |
| T-15-01-03 | period whitelist — any other value coerces to 28 | DONE |
| T-15-01-04 | date filter uses period bound (max 90 days) | DONE |
| T-15-01-05 | No createServiceClient or SERVICE_ROLE in monitoring/ | DONE |

## Self-Check: PASSED

Files exist:
- src/lib/monitoring/aggregation.ts: FOUND
- src/lib/monitoring/aggregation.test.ts: FOUND
- src/app/api/monitoring/clusters/route.ts: FOUND
- src/app/api/monitoring/pages/route.ts: FOUND

Commits exist:
- 3f177ae (test RED): FOUND
- 5219ca9 (feat GREEN): FOUND
- 6efd097 (feat API routes): FOUND
