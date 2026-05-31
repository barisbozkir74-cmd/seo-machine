import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LockedModuleBanner } from '@/components/control-center/LockedModuleBanner'
import { computeGraph, type RawPage, type RawLink, type GscPageMetric } from '@/app/(dashboard)/projeler/[id]/ic-link-haritasi/computeGraph'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'
import { SplitPane } from '@/components/control-center/SplitPane'
import { LinkGraphCCShell } from './LinkGraphCCShell'
import type { LastCrawlJob } from '@/app/(dashboard)/projeler/[id]/ic-link-haritasi/page'

export default async function LinkGraphPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string; selected?: string }>
}) {
  const { id } = await params
  const { view: viewParam, selected: selectedParam } = await searchParams

  const initialView: 'list' | 'network' =
    viewParam === 'network' ? 'network' : 'list'
  const initialSelected: string | null = selectedParam ?? null

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain, blueprint_approved')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const blueprintApproved = (project as unknown as { blueprint_approved: boolean | null }).blueprint_approved ?? false

  if (!blueprintApproved) {
    return (
      <div className="p-6">
        <LockedModuleBanner
          reason="İç Link Haritası için önce Site Blueprint onaylanmalıdır."
          unlockCondition="Site Blueprint adımını tamamlayıp onaylayın."
          ctaLabel="Site Blueprint'e Git"
          ctaHref={`/control-center/projects/${id}/architecture/blueprint`}
        />
      </div>
    )
  }

  const { data: pagesRaw } = await supabase
    .from('pages')
    .select('id, title, slug, page_type')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const pages: RawPage[] = (pagesRaw ?? []) as RawPage[]

  const { data: linksRaw } = await supabase
    .from('internal_links')
    .select('id, source_page_id, target_page_id, anchor_text, link_type, status, response_code, final_url, is_noindex, canonical_url, crawled_at')
    .eq('project_id', id)
    .eq('user_id', user.id)

  const links: RawLink[] = (linksRaw ?? []) as RawLink[]

  // GSC metrics — last 28 days
  const gscMap = new Map<string, GscPageMetric>()
  {
    const now = new Date()
    const startDate = new Date(now)
    startDate.setDate(now.getDate() - 28)
    const fmt = (d: Date) => d.toISOString().split('T')[0]

    const { data: gscRaw } = await supabase
      .from('gsc_metrics')
      .select('page_id, clicks, impressions, avg_position')
      .eq('project_id', id)
      .gte('date', fmt(startDate))
      .lte('date', fmt(now))

    type GscRow = { page_id: string; clicks: number; impressions: number; avg_position: number | null }
    type GscAgg = { clicks: number; impressions: number; posSum: number; posCount: number }
    const agg = new Map<string, GscAgg>()
    for (const row of (gscRaw ?? []) as GscRow[]) {
      const existing = agg.get(row.page_id)
      if (existing) {
        existing.clicks += row.clicks
        existing.impressions += row.impressions
        if (row.avg_position !== null) { existing.posSum += row.avg_position; existing.posCount++ }
      } else {
        agg.set(row.page_id, {
          clicks:     row.clicks,
          impressions: row.impressions,
          posSum:     row.avg_position ?? 0,
          posCount:   row.avg_position !== null ? 1 : 0,
        })
      }
    }
    for (const [pageId, a] of agg.entries()) {
      gscMap.set(pageId, {
        clicks:      a.clicks,
        impressions: a.impressions,
        avgPosition: a.posCount > 0 ? a.posSum / a.posCount : null,
      })
    }
  }

  const graphData = computeGraph(pages, links, gscMap)

  const { data: lastJobRaw } = await supabase
    .from('crawl_jobs')
    .select('id, status, total_links, processed_links, started_at, completed_at, is_new_site')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastJob: LastCrawlJob | null = lastJobRaw ?? null

  // Compute stats for İç Link Uzmanı panel
  const linkCount = links.length
  const pageCount = pages.length

  // Orphan pages: pages with 0 incoming links
  const targetPageIds = new Set(links.map((l) => l.target_page_id).filter((id): id is string => id != null))
  const orphanCount = pages.filter((p) => !targetPageIds.has(p.id)).length

  // Hub pages: top 20% by incoming link count (pages with at least 1 incoming link)
  const incomingCounts = new Map<string, number>()
  for (const l of links) {
    if (!l.target_page_id) continue
    incomingCounts.set(l.target_page_id, (incomingCounts.get(l.target_page_id) ?? 0) + 1)
  }
  const sortedCounts = Array.from(incomingCounts.values()).sort((a, b) => b - a)
  const hubThresholdIndex = Math.max(0, Math.ceil(sortedCounts.length * 0.2) - 1)
  const hubThreshold = sortedCounts.length > 0 ? sortedCounts[hubThresholdIndex] : 1
  const hubCount = sortedCounts.filter((c) => c >= hubThreshold).length

  const panelContextItems = [
    {
      label: 'İç Link',
      value: `${linkCount} link`,
      status: (linkCount > 0 ? 'ok' : 'missing') as 'ok' | 'missing',
    },
    {
      label: 'Yetim Sayfa',
      value: `${orphanCount} sayfa`,
      status: (orphanCount === 0 ? 'ok' : 'warning') as 'ok' | 'warning',
    },
    {
      label: 'Hub Sayfa',
      value: `${hubCount} sayfa`,
      status: (hubCount > 0 ? 'ok' : 'warning') as 'ok' | 'warning',
    },
    {
      label: 'Toplam Sayfa',
      value: `${pageCount} sayfa`,
      status: 'ok' as const,
    },
  ]

  const panelNextStep =
    linkCount === 0
      ? 'Henüz iç link tanımlanmamış'
      : orphanCount > 0
        ? `${orphanCount} yetim sayfa var — iç link eklenebilir`
        : 'Link haritası oluşturulmuş'

  const base = `/control-center/projects/${id}`
  const panelActions = [
    { label: 'Ağ Görünümü', href: '?view=network', variant: 'primary' as const },
    { label: 'Liste Görünümü', href: '?view=list' },
    { label: 'Blueprint', href: `${base}/architecture/blueprint` },
  ]

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex flex-shrink-0 items-center border-b border-border px-6 py-3">
        <span className="text-sm font-medium text-foreground">İç Link Haritası</span>
        {pages.length > 0 && (
          <span className="ml-3 text-xs text-muted-foreground">
            {pages.length} sayfa · {links.length} link
          </span>
        )}
      </div>
      <SplitPane
        storageKey="ic-link-haritasi"
        defaultRightWidth={288}
        minRightWidth={180}
        maxRightWidth={520}
        right={
          <ModuleAIPanel
            variant="sidebar"
            title="İç Link Analizi"
            managerName="İç Link Uzmanı"
            hint="Orphan sayfaları tespit eder, link dağılımını analiz eder, pillar-support ilişkilerini doğrular ve anchor text önerir."
            section="ic-link-haritasi"
            contextItems={panelContextItems}
            nextStep={panelNextStep}
            actions={panelActions}
          />
        }
      >
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
          <LinkGraphCCShell
            projectId={id}
            graphData={graphData}
            lastJob={lastJob}
            initialView={initialView}
            initialSelected={initialSelected}
          />
        </div>
      </SplitPane>
    </div>
  )
}
