import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'

// Service role client — recovery_tasks INSERT bypasses RLS for trusted n8n caller.
// Auth at this route is enforced via X-N8n-Webhook-Secret + ownership re-check.
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Phase 16 D-05/D-06: decay threshold (delta >= 5 AND impressions > 10),
// computed from last 7d vs prior 7d gsc_metrics rows. Mirrors the heuristic in
// src/lib/monitoring/aggregation.ts so the n8n-detected and the dashboard-displayed
// "decay" mean the same thing.
const DECAY_DELTA_THRESHOLD = 5
const DECAY_MIN_IMPRESSIONS = 10
const PERIOD_DAYS = 7

// Phase 16 D-14: imported_page weak-page recovery threshold.
// Matches Phase 15.5 D-10 (flag_weak_page = clicks < 10 AND position > 20).
// We re-check gsc_avg_position > WEAK_POSITION_THRESHOLD as defence-in-depth.
const WEAK_POSITION_THRESHOLD = 20

export async function POST(request: NextRequest) {
  // ─── Auth: webhook secret ────────────────────────────────────────────────
  const secret = request.headers.get('X-N8n-Webhook-Secret')
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ─── Body parse ──────────────────────────────────────────────────────────
  let body: { projectId?: string; userId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { projectId, userId } = body
  if (!projectId || !userId) {
    return NextResponse.json(
      { error: 'projectId and userId required' },
      { status: 400 },
    )
  }

  const serviceClient = getServiceClient()

  // ─── Ownership check ─────────────────────────────────────────────────────
  const { data: project } = await serviceClient
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  let inserted = 0
  let skipped = 0

  // ─── Pass 1: page_packages decay (REC-01) ────────────────────────────────
  const decayCount = await scanPagePackagesDecay(serviceClient, projectId, {
    onInserted: () => {
      inserted += 1
    },
    onSkipped: () => {
      skipped += 1
    },
  })

  // ─── Pass 2: imported_pages weak-page (REC-03) ───────────────────────────
  const weakCount = await scanImportedPagesWeak(serviceClient, projectId, {
    onInserted: () => {
      inserted += 1
    },
    onSkipped: () => {
      skipped += 1
    },
  })

  return NextResponse.json({
    inserted,
    skipped,
    scanned: {
      page_packages: decayCount,
      imported_pages: weakCount,
    },
  })
}

// ---------------------------------------------------------------------------
// Pass 1 — page_packages decay scan (REC-01, D-05, D-06)
// ---------------------------------------------------------------------------
//
// Logic: compare last PERIOD_DAYS gsc_metrics avg_position to the prior PERIOD_DAYS.
// If delta_position >= DECAY_DELTA_THRESHOLD AND current impressions > DECAY_MIN_IMPRESSIONS,
// the page is in decay. Insert a recovery_task with source='page_package' and source_id=
// page_packages.id (NOT pages.id — D-02 tied source to the package).
//
// Returns: number of pages scanned (whether they decayed or not — for reporting).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = SupabaseClient<any, any, any>

async function scanPagePackagesDecay(
  serviceClient: ServiceClient,
  projectId: string,
  callbacks: { onInserted: () => void; onSkipped: () => void },
): Promise<number> {
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const today = new Date()

  const currentStart = new Date(today)
  currentStart.setDate(today.getDate() - PERIOD_DAYS)
  const priorEnd = new Date(currentStart)
  priorEnd.setDate(currentStart.getDate() - 1)
  const priorStart = new Date(priorEnd)
  priorStart.setDate(priorEnd.getDate() - PERIOD_DAYS + 1)

  // 1. Fetch gsc_metrics for current and prior periods in parallel
  const [currentResult, priorResult] = await Promise.all([
    serviceClient
      .from('gsc_metrics')
      .select('page_id, clicks, impressions, avg_position')
      .eq('project_id', projectId)
      .gte('date', fmt(currentStart)),
    serviceClient
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

  if (currentMetrics.length === 0) return 0

  // 2. Reduce per page_id (mirrors aggregation.ts reduceMetrics)
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

  // 3. Build candidate page_ids (decayed)
  const decayedPageIds: { pageId: string; positionBefore: number; positionAfter: number }[] = []
  for (const [pageId, curr] of currentAgg.entries()) {
    if (curr.impressions <= DECAY_MIN_IMPRESSIONS) continue
    const prior = priorAgg.get(pageId)
    if (!prior || prior.posCount === 0) continue
    const currentAvgPos = curr.posCount === 0 ? 0 : curr.posSum / curr.posCount
    const priorAvgPos = prior.posSum / prior.posCount
    const delta = currentAvgPos - priorAvgPos
    if (delta >= DECAY_DELTA_THRESHOLD) {
      decayedPageIds.push({
        pageId,
        positionBefore: priorAvgPos,
        positionAfter: currentAvgPos,
      })
    }
  }

  if (decayedPageIds.length === 0) return 0

  // 4. Resolve pageId → page_package + title + URL.
  //    Only pages with a page_package can be a recovery target (source='page_package').
  const pageIds = decayedPageIds.map((d) => d.pageId)
  const { data: packagesData } = await serviceClient
    .from('page_packages')
    .select('id, page_id, seo_title, wp_post_url')
    .eq('project_id', projectId)
    .in('page_id', pageIds)

  type PkgRaw = {
    id: string
    page_id: string
    seo_title: string | null
    wp_post_url: string | null
  }
  const packagesMap = new Map<string, PkgRaw>()
  for (const pkg of (packagesData ?? []) as PkgRaw[]) {
    packagesMap.set(pkg.page_id, pkg)
  }

  // Also fetch pages for fallback title/slug if package lacks them
  const { data: pagesData } = await serviceClient
    .from('pages')
    .select('id, title, slug')
    .in('id', pageIds)
  type PageRaw = { id: string; title: string; slug: string }
  const pagesMap = new Map<string, PageRaw>()
  for (const p of (pagesData ?? []) as PageRaw[]) {
    pagesMap.set(p.id, p)
  }

  // 5. Per-decayed-page: duplicate-prevention check + INSERT
  for (const decay of decayedPageIds) {
    const pkg = packagesMap.get(decay.pageId)
    const page = pagesMap.get(decay.pageId)
    if (!pkg) {
      // No page_package — cannot make a page_package recovery task. Skip.
      // (imported_pages have their own pass below.)
      callbacks.onSkipped()
      continue
    }

    // D-07 Duplicate prevention: skip if an open or in_progress task already exists
    // for this source_id. Same source_id is allowed if the prior task is resolved
    // or dismissed (a fresh decay event after a fix or a deliberate dismiss is valid).
    const { data: existing } = await serviceClient
      .from('recovery_tasks')
      .select('id')
      .eq('source', 'page_package')
      .eq('source_id', pkg.id)
      .in('status', ['open', 'in_progress'])
      .limit(1)
      .maybeSingle()

    if (existing) {
      callbacks.onSkipped()
      continue
    }

    const title = pkg.seo_title ?? page?.title ?? 'Untitled'
    const pageUrl = pkg.wp_post_url ?? (page?.slug ? `/${page.slug}` : '/')

    const { error } = await serviceClient.from('recovery_tasks').insert({
      project_id: projectId,
      source: 'page_package',
      source_id: pkg.id,
      title,
      page_url: pageUrl,
      position_before: Number(decay.positionBefore.toFixed(2)),
      position_after: Number(decay.positionAfter.toFixed(2)),
      status: 'open',
    })

    if (error) {
      console.warn(
        '[recovery/detect] page_package insert failed:',
        error.message,
      )
      callbacks.onSkipped()
    } else {
      callbacks.onInserted()
    }
  }

  return decayedPageIds.length
}

// ---------------------------------------------------------------------------
// Pass 2 — project_imported_pages weak-page scan (REC-03, D-14, D-15)
// ---------------------------------------------------------------------------
//
// Logic: SELECT project_imported_pages WHERE flag_weak_page = true AND
// gsc_avg_position > WEAK_POSITION_THRESHOLD. Insert recovery_tasks with
// source='imported_page' and source_id=project_imported_pages.id.
//
// Returns: number of weak pages scanned.

async function scanImportedPagesWeak(
  serviceClient: ServiceClient,
  projectId: string,
  callbacks: { onInserted: () => void; onSkipped: () => void },
): Promise<number> {
  const { data: weakPages } = await serviceClient
    .from('project_imported_pages')
    .select('id, title, link, gsc_avg_position, flag_weak_page')
    .eq('project_id', projectId)
    .eq('flag_weak_page', true)
    .gt('gsc_avg_position', WEAK_POSITION_THRESHOLD)

  type WeakRaw = {
    id: string
    title: string
    link: string | null
    gsc_avg_position: number | null
    flag_weak_page: boolean
  }
  const rows: WeakRaw[] = weakPages ?? []
  if (rows.length === 0) return 0

  for (const row of rows) {
    // Duplicate prevention (D-07 generalized to imported_page source)
    const { data: existing } = await serviceClient
      .from('recovery_tasks')
      .select('id')
      .eq('source', 'imported_page')
      .eq('source_id', row.id)
      .in('status', ['open', 'in_progress'])
      .limit(1)
      .maybeSingle()

    if (existing) {
      callbacks.onSkipped()
      continue
    }

    const { error } = await serviceClient.from('recovery_tasks').insert({
      project_id: projectId,
      source: 'imported_page',
      source_id: row.id,
      title: row.title,
      page_url: row.link ?? '',
      // For imported_page source we have only the current avg_position, not a delta.
      // Store it in position_after; leave position_before NULL.
      position_before: null,
      position_after:
        row.gsc_avg_position !== null
          ? Number(row.gsc_avg_position.toFixed(2))
          : null,
      status: 'open',
    })

    if (error) {
      console.warn(
        '[recovery/detect] imported_page insert failed:',
        error.message,
      )
      callbacks.onSkipped()
    } else {
      callbacks.onInserted()
    }
  }

  return rows.length
}
