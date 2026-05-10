import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getClusterMetrics, getPageMetrics, type MonitoringPeriod, type ImportedPageRow } from '@/lib/monitoring/aggregation'
import { getRecoveryTasks } from '@/lib/monitoring/recovery-tasks'
import { ProjectNav } from '../ProjectNav'
import { PeriodTabBar } from './period-tab-bar'
import { ContentTabBar, type ContentTab } from './content-tab-bar'
import { ClusterSummaryTable } from './cluster-summary-table'
import { PageMetricsTable } from './page-metrics-table'
import { RecoveryTaskTable } from './recovery-task-table'

export default async function IzlemePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ period?: string; tab?: string }>
}) {
  const { id } = await params
  const { period: periodRaw, tab: tabRaw } = await searchParams

  const period: MonitoringPeriod =
    periodRaw === '7' ? 7 : periodRaw === '90' ? 90 : 28

  // UI-SPEC §URL State Machine: default tab=clusters when missing/invalid (was the original
  // single-section default). Wave 16-04 introduces the tab param — backward compat preserved.
  const activeTab: ContentTab =
    tabRaw === 'pages'
      ? 'pages'
      : tabRaw === 'recovery'
      ? 'recovery'
      : 'clusters'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain, gsc_property_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const gscConnected =
    project.gsc_property_url !== null && project.gsc_property_url !== ''

  // Always fetch imported pages — independent of GSC connection (D-02)
  const { data: importedPagesRaw } = await supabase
    .from('project_imported_pages')
    .select('id, title, link, slug')
    .eq('project_id', id)
    .order('title')

  const importedPages: ImportedPageRow[] = (importedPagesRaw ?? []).map(
    (p: { id: string; title: string; link: string | null; slug: string | null }) => ({
      pageId: p.id,
      pageUrl: p.link ?? (p.slug ? `/${p.slug}` : ''),
      title: p.title,
      clicks: null,
      impressions: null,
      avgPosition: null,
      deltaPosition: null,
      isDecayed: false as const,
      rowType: 'imported' as const,
    })
  )

  // Parallel fetch: only when GSC connected (recovery tasks may exist independently —
  // imported_page source does not require GSC, but page_package source does — we still
  // gate on gscConnected because the izleme page itself is GSC-centered. Recovery tab
  // shows empty state if list is [].)
  // includesDismissed=true: loads open + in_progress + dismissed in one query so the
  // "Dismissed görevleri göster" toggle in RecoveryTaskTable has data to reveal (D-13).
  const [clusters, pages, recoveryTasks] = gscConnected
    ? await Promise.all([
        getClusterMetrics(supabase, id, period),
        getPageMetrics(supabase, id, period),
        getRecoveryTasks(supabase, id, true),
      ])
    : [[], [], []]

  return (
    <div className="flex flex-col h-screen">
      <div className="p-8 pb-4">
        <Link
          href={`/projeler/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
        >
          ← {project.name}
        </Link>
        <h1 className="text-xl font-semibold">İzleme</h1>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
          <ProjectNav projectId={id} activePath={`/projeler/${id}/izleme`} />
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto p-8">
          {/* Pages tab: always accessible regardless of GSC connection (D-02) */}
          {activeTab === 'pages' ? (
            <div className="space-y-8">
              <PeriodTabBar projectId={id} active={period} />
              <ContentTabBar projectId={id} active={activeTab} period={period} />
              <section>
                <h2 className="text-base font-semibold mb-4">Sayfa Performansı</h2>
                <PageMetricsTable pages={pages} importedPages={importedPages} gscConnected={gscConnected} />
              </section>
            </div>
          ) : !gscConnected ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-base font-semibold">GSC verisi bulunamadı</p>
              <p className="text-sm text-muted-foreground mt-2">
                Bu proje için henüz GSC metriği senkronize edilmedi. Proje Bilgileri sayfasından GSC bağlantısını kontrol edin.
              </p>
              <Link
                href={`/projeler/${id}`}
                className="inline-flex items-center mt-4 text-sm text-foreground hover:underline"
              >
                Proje Bilgileri →
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              <PeriodTabBar projectId={id} active={period} />
              <ContentTabBar projectId={id} active={activeTab} period={period} />

              {activeTab === 'clusters' && (
                <section>
                  <h2 className="text-base font-semibold mb-4">Cluster Performansı</h2>
                  <ClusterSummaryTable clusters={clusters} />
                </section>
              )}

              {activeTab === 'recovery' && (
                <section>
                  <h2 className="text-base font-semibold mb-4">Recovery</h2>
                  <RecoveryTaskTable tasks={recoveryTasks} projectId={id} />
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
