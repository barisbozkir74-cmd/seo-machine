---
phase: 15-monitoring-dashboard
plan: "02"
subsystem: monitoring-ui
tags: [monitoring, ui, dashboard, gsc, ssr, period-tabs, decay-badge]
dependency_graph:
  requires: [src/lib/monitoring/aggregation.ts (Plan 15-01), gsc_metrics table, ProjectNav.tsx]
  provides: [/projeler/[id]/izleme SSR route, PeriodTabBar, ClusterSummaryTable, PageMetricsTable]
  affects: [ProjectNav (İzleme nav item added)]
tech_stack:
  added: []
  patterns:
    - SSR page with parallel Promise.all for dual-table fetch
    - Client-only PeriodTabBar with router.push ?period= query param
    - Server component tables receiving pre-aggregated props (no client state)
    - Decay badge via p.isDecayed flag delegated entirely to aggregation lib
    - className-direct Badge color (no variant prop)
key_files:
  created:
    - src/app/(dashboard)/projeler/[id]/izleme/page.tsx
    - src/app/(dashboard)/projeler/[id]/izleme/period-tab-bar.tsx
    - src/app/(dashboard)/projeler/[id]/izleme/cluster-summary-table.tsx
    - src/app/(dashboard)/projeler/[id]/izleme/page-metrics-table.tsx
  modified:
    - src/app/(dashboard)/projeler/[id]/ProjectNav.tsx
decisions:
  - "ProjectNav 'İzleme' entry added as LAST item (after 'Proje Kuralları') — preserves visual nav order"
  - "Decay badge renders via p.isDecayed (from aggregation lib) — threshold logic not duplicated in UI"
  - "PeriodTabBar is the only client component — tables are server components accepting pre-aggregated props"
  - "gscConnected checks both null AND empty string for defensive coverage"
  - "Build errors in worktree are pre-existing (missing files: AddLinkDialog, ProjectInfoSection, etc.) — out of scope for this plan"
metrics:
  duration_minutes: 3
  completed_date: "2026-04-28"
  tasks_completed: 2
  files_created: 5
---

# Phase 15 Plan 02: Monitoring Dashboard UI Summary

SSR monitoring dashboard route at `/projeler/[id]/izleme` with period tab bar (7G/28G/90G), cluster performance table, page metrics table with decay badges, and ProjectNav updated with "İzleme" as the last nav item.

## ProjectNav Item Placement

"İzleme" was appended as the **last item** in `getNavItems`, at line 22, immediately after "Proje Kuralları" (line 21). No existing items were modified.

```
10: Proje Bilgileri
11: Araştırma
12: Keyword Stratejisi
13: Site Blueprint
14: Sayfa Listesi
15: İç Link Haritası
16: Sayfa Paketi
17: SEO Denetimi
18: Rakipler
19: Proje Kuralları
20: İzleme  ← new
```

## File Map: izleme/ Directory

```
src/app/(dashboard)/projeler/[id]/izleme/
├── page.tsx               — SSR page (auth, ownership, GSC check, table fetch)
├── period-tab-bar.tsx     — Client component ('use client') for 7G/28G/90G tabs
├── cluster-summary-table.tsx  — Server component, ClusterMetricRow[] → table
└── page-metrics-table.tsx     — Server component, PageMetricRow[] → table + decay badge
```

## Period Tab Interaction Model

- `PeriodTabBar` receives `projectId` and `active: Period` from the SSR page
- On click: `router.push('/projeler/${projectId}/izleme?period=${p}')`
- SSR page reads `searchParams.period` with whitelist coercion:
  - `'7'` → `7`, `'90'` → `90`, anything else (including missing) → `28` (default)
- URL is the source of truth — no client state required

## Empty / Not-Connected / Decay States

| State | Trigger | Copy |
|-------|---------|------|
| GSC not connected | `gsc_property_url` is null or empty string | "GSC verisi bulunamadı" + "Bu proje için henüz GSC metriği senkronize edilmedi. Proje Bilgileri sayfasından GSC bağlantısını kontrol edin." |
| No cluster data | `clusters.length === 0` | "Bu projede henüz keyword cluster oluşturulmamış. Keyword Stratejisi sayfasından clustering başlatın." |
| No page data | `pages.length === 0` | "GSC verisi bulunamadı" |
| Decay badge | `p.isDecayed === true` (from aggregation lib) | Red "Düşüş" badge |

Decay threshold (`deltaPosition >= 5 AND impressions > 10`) is computed entirely in `aggregation.ts` — not duplicated in the UI.

## Deviations from Plan

None — plan executed exactly as written. All five files match the exact code specified in the plan actions.

## Known Stubs

None — all data flows from real DB queries via `getClusterMetrics` / `getPageMetrics` (Plan 15-01 output). No hardcoded placeholders.

## Threat Flags

All threats from plan's threat model addressed inline:

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-15-02-01 | searchParams.period whitelist — coerces to 28 for any invalid value | DONE |
| T-15-02-02 | `supabase.auth.getUser()` + `.eq('user_id', user.id)` + `notFound()` ownership guard | DONE |
| T-15-02-03 | pageUrl rendered as public URL — accepted (not sensitive) | ACCEPTED |
| T-15-02-04 | React auto-escapes all string children + title attr | DONE |
| T-15-02-05 | Read-only page, no mutations | ACCEPTED |

## Self-Check: PASSED

Files exist:
- src/app/(dashboard)/projeler/[id]/ProjectNav.tsx: FOUND
- src/app/(dashboard)/projeler/[id]/izleme/page.tsx: FOUND
- src/app/(dashboard)/projeler/[id]/izleme/period-tab-bar.tsx: FOUND
- src/app/(dashboard)/projeler/[id]/izleme/cluster-summary-table.tsx: FOUND
- src/app/(dashboard)/projeler/[id]/izleme/page-metrics-table.tsx: FOUND

Commits exist:
- 9189a7e (feat 15-02): FOUND

TypeScript: `npx tsc --noEmit` — no errors in new izleme/ files (pre-existing errors in other worktree files are out of scope).
