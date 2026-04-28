import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getClusterMetrics, getPageMetrics, type MonitoringPeriod } from '@/lib/monitoring/aggregation'
import { ProjectNav } from '../ProjectNav'
import { PeriodTabBar } from './period-tab-bar'
import { ClusterSummaryTable } from './cluster-summary-table'
import { PageMetricsTable } from './page-metrics-table'

export default async function IzlemePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ period?: string }>
}) {
  const { id } = await params
  const { period: periodRaw } = await searchParams
  const period: MonitoringPeriod = periodRaw === '7' ? 7 : periodRaw === '90' ? 90 : 28

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

  const gscConnected = project.gsc_property_url !== null && project.gsc_property_url !== ''

  // Fetch metrics in parallel only when GSC connected
  const [clusters, pages] = gscConnected
    ? await Promise.all([
        getClusterMetrics(supabase, id, period),
        getPageMetrics(supabase, id, period),
      ])
    : [[], []]

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
          {!gscConnected ? (
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

              <section>
                <h2 className="text-base font-semibold mb-4">Cluster Performansı</h2>
                <ClusterSummaryTable clusters={clusters} />
              </section>

              <section>
                <h2 className="text-base font-semibold mb-4">Sayfa Performansı</h2>
                <PageMetricsTable pages={pages} />
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
