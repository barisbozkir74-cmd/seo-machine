import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getClusterMetrics, getPageMetrics, type MonitoringPeriod, type ImportedPageRow } from '@/lib/monitoring/aggregation'
import { getRecoveryTasks } from '@/lib/monitoring/recovery-tasks'
import { ClusterSummaryTable } from '@/app/(dashboard)/projeler/[id]/izleme/cluster-summary-table'
import { PageMetricsTable } from '@/app/(dashboard)/projeler/[id]/izleme/page-metrics-table'
import { RecoveryTaskTable } from '@/app/(dashboard)/projeler/[id]/izleme/recovery-task-table'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'
import { SplitPane } from '@/components/control-center/SplitPane'

type ContentTab = 'clusters' | 'pages' | 'recovery'

const PERIODS = [
  { value: 7,  label: '7G' },
  { value: 28, label: '28G' },
  { value: 90, label: '90G' },
] as const

const TABS: { id: ContentTab; label: string }[] = [
  { id: 'clusters',  label: 'Cluster Performansı' },
  { id: 'pages',     label: 'Sayfa Performansı' },
  { id: 'recovery',  label: 'Recovery' },
]

export default async function MonitoringOverviewPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ period?: string; tab?: string }>
}) {
  const { id }             = await params
  const { period: pRaw, tab: tRaw } = await searchParams

  const period: MonitoringPeriod = pRaw === '7' ? 7 : pRaw === '90' ? 90 : 28
  const activeTab: ContentTab    = tRaw === 'pages' ? 'pages' : tRaw === 'recovery' ? 'recovery' : 'clusters'

  const base = `/control-center/projects/${id}/monitoring/overview`

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
    project.gsc_property_url !== null && (project.gsc_property_url as string) !== ''

  const { data: importedPagesRaw } = await supabase
    .from('project_imported_pages')
    .select('id, title, link, slug')
    .eq('project_id', id)
    .order('title')

  const importedPages: ImportedPageRow[] = (importedPagesRaw ?? []).map(
    (p: { id: string; title: string; link: string | null; slug: string | null }) => ({
      pageId:        p.id,
      pageUrl:       p.link ?? (p.slug ? `/${p.slug}` : ''),
      title:         p.title,
      clicks:        null,
      impressions:   null,
      avgPosition:   null,
      deltaPosition: null,
      isDecayed:     false as const,
      rowType:       'imported' as const,
    })
  )

  const [clusters, pages, recoveryTasks] = gscConnected
    ? await Promise.all([
        getClusterMetrics(supabase, id, period),
        getPageMetrics(supabase, id, period),
        getRecoveryTasks(supabase, id, true),
      ])
    : [[], [], []]

  const totalClicks      = pages.reduce((s, p) => s + p.clicks, 0)
  const totalImpressions = pages.reduce((s, p) => s + p.impressions, 0)
  const decayedCount     = pages.filter((p) => p.isDecayed).length
  const openTasks        = recoveryTasks.filter((t) => t.status === 'open').length

  function periodHref(p: number): string {
    return activeTab === 'clusters'
      ? `${base}?period=${p}`
      : `${base}?period=${p}&tab=${activeTab}`
  }

  function tabHref(t: ContentTab): string {
    return t === 'clusters'
      ? `${base}?period=${period}`
      : `${base}?period=${period}&tab=${t}`
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-3">
        <span className="text-sm font-medium text-foreground">İzleme</span>
        {gscConnected && (pages.length > 0 || clusters.length > 0) && (
          <span className="text-xs text-muted-foreground">GSC bağlı</span>
        )}
      </div>

      <SplitPane
        storageKey="izleme"
        defaultRightWidth={288}
        minRightWidth={180}
        maxRightWidth={520}
        right={
          <ModuleAIPanel
            variant="sidebar"
            title="İzleme Yöneticisi"
            hint="Performans analizi, decay tespiti ve recovery görevleri"
            section="izleme"
          />
        }
      >
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          {/* GSC summary KPIs */}
          {gscConnected && (pages.length > 0 || clusters.length > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Tıklama</p>
                <p className="text-2xl font-semibold mt-1">{totalClicks.toLocaleString('tr-TR')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{period} gün</p>
              </div>
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Gösterim</p>
                <p className="text-2xl font-semibold mt-1">{totalImpressions.toLocaleString('tr-TR')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{period} gün</p>
              </div>
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Düşen Sayfa</p>
                <p className={`text-2xl font-semibold mt-1 ${decayedCount > 0 ? 'text-red-400' : ''}`}>
                  {decayedCount}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">pozisyon kaybı</p>
              </div>
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Açık Görev</p>
                <p className={`text-2xl font-semibold mt-1 ${openTasks > 0 ? 'text-amber-400' : ''}`}>
                  {openTasks}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">recovery</p>
              </div>
            </div>
          )}

          {/* No GSC state */}
          {!gscConnected && activeTab !== 'pages' && (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-sm font-medium text-foreground/80">GSC bağlantısı gerekli</p>
              <p className="text-sm text-muted-foreground mt-2">
                İzleme verileri için Google Search Console entegrasyonunu etkinleştirin.
              </p>
              <Link
                href={`/control-center/projects/${id}/settings/integrations`}
                className="inline-flex items-center mt-4 text-sm text-foreground hover:underline"
              >
                Entegrasyonlara Git →
              </Link>
            </div>
          )}

          {/* Period + Tab navigation */}
          {(gscConnected || activeTab === 'pages') && (
            <div className="space-y-3">
              {/* Period bar */}
              <div role="group" aria-label="Zaman periyodu" className="flex items-center gap-0.5 rounded-md border border-border p-0.5 w-fit">
                {PERIODS.map((p) => (
                  <Link
                    key={p.value}
                    href={periodHref(p.value)}
                    aria-current={period === p.value ? 'page' : undefined}
                    className={`rounded px-3 py-1 text-xs transition-colors ${
                      period === p.value
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p.label}
                  </Link>
                ))}
              </div>

              {/* Tab bar */}
              <div role="tablist" aria-label="İzleme sekmeleri" className="flex items-center gap-0.5 rounded-md border border-border p-0.5 w-fit">
                {TABS.map((t) => (
                  <Link
                    key={t.id}
                    href={tabHref(t.id)}
                    role="tab"
                    aria-selected={activeTab === t.id}
                    className={`rounded px-3 py-1 text-xs transition-colors ${
                      activeTab === t.id
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tab content */}
          {activeTab === 'pages' && (
            <PageMetricsTable
              pages={pages}
              importedPages={importedPages}
              gscConnected={gscConnected}
              projectId={id}
            />
          )}

          {gscConnected && activeTab === 'clusters' && (
            <ClusterSummaryTable clusters={clusters} projectId={id} />
          )}

          {gscConnected && activeTab === 'recovery' && (
            <RecoveryTaskTable tasks={recoveryTasks} projectId={id} />
          )}
        </div>
      </SplitPane>
    </div>
  )
}
