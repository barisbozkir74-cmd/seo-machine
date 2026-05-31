import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { KPIGrid } from '@/components/control-center/KPIGrid'
import { StatePanel } from '@/components/control-center/StatePanel'
import Link from 'next/link'

type NextStep = { description: string; cta: string; href: string }

function computeNextStep(
  research:  boolean,
  strategy:  boolean,
  blueprint: boolean,
  pageCount: number,
  base:      string,
): NextStep | null {
  if (!research)  return {
    description: 'Araştırmayı tamamlayın ve keşif sürecini onaylayın.',
    cta:  'Araştırmaya Git',
    href: `${base}/intelligence/research`,
  }
  if (!strategy)  return {
    description: 'Keyword stratejisini oluşturun ve onaylayın.',
    cta:  'Stratejiye Git',
    href: `${base}/intelligence/keywords`,
  }
  if (!blueprint) return {
    description: "Site blueprint'ini hazırlayın ve yapıyı onaylayın.",
    cta:  "Blueprint'e Git",
    href: `${base}/architecture/blueprint`,
  }
  if (pageCount === 0) return {
    description: 'Blueprint onaylandı. İlk sayfaları oluşturmaya başlayın.',
    cta:  'Sayfaları Yönet',
    href: `${base}/architecture/pages`,
  }
  return null
}

export default async function ProjectHubPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: project },
    { count: pageCount },
    { count: keywordCount },
    { count: publishedCount },
    { count: pendingApprovalCount },
    { count: clusterCount },
  ] = await Promise.all([
    supabase
      .from('projects')
      .select(`
        id, name, domain, site_type,
        research_approved,
        keyword_strategy_approved,
        blueprint_approved,
        technical_audit_approved
      `)
      .eq('id', id)
      .single(),
    supabase.from('pages').select('*', { count: 'exact', head: true }).eq('project_id', id),
    supabase.from('keywords').select('*', { count: 'exact', head: true }).eq('project_id', id),
    supabase.from('publishes').select('*', { count: 'exact', head: true }).eq('project_id', id).eq('status', 'published'),
    supabase.from('approval_requests').select('*', { count: 'exact', head: true }).eq('project_id', id).eq('status', 'pending'),
    supabase.from('keyword_clusters').select('*', { count: 'exact', head: true }).eq('project_id', id),
  ])

  if (!project) notFound()

  const base = `/control-center/projects/${id}`

  const research  = project.research_approved         as boolean
  const strategy  = project.keyword_strategy_approved as boolean
  const blueprint = project.blueprint_approved        as boolean
  const pages     = pageCount ?? 0
  const keywords  = keywordCount ?? 0
  const clusters  = clusterCount ?? 0
  const published = (publishedCount ?? 0) > 0
  const hasPending = (pendingApprovalCount ?? 0) > 0

  const nextStep = computeNextStep(research, strategy, blueprint, pages, base)

  const kpiCards = [
    {
      id:    'pages',
      label: 'Sayfa',
      value: pages,
      href:  blueprint ? `${base}/architecture/pages` : undefined,
    },
    {
      id:    'keywords',
      label: 'Keyword',
      value: keywordCount ?? 0,
      href:  research ? `${base}/intelligence/keywords` : undefined,
    },
    {
      id:    'published',
      label: 'Yayınlandı',
      value: publishedCount ?? 0,
    },
    {
      id:    'approvals',
      label: 'Onay Bekleyen',
      value: pendingApprovalCount ?? 0,
      alert: hasPending ? ('warning' as const) : ('none' as const),
      href:  hasPending ? `${base}/publish/queue` : undefined,
    },
  ]

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">{project.name}</h1>
          {project.domain && (
            <p className="mt-0.5 text-xs text-muted-foreground">{project.domain}</p>
          )}
        </div>
        <Link
          href={`${base}/settings/business`}
          className="text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          Ayarlar →
        </Link>
      </div>

      {/* KPIs */}
      <section aria-label="Proje metrikleri">
        <KPIGrid status="live" cards={kpiCards} />
      </section>

      {/* Next step — only when actionable */}
      {nextStep && (
        <section aria-label="Sonraki adım">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-secondary/20 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-0.5">
                Sonraki Adım
              </p>
              <p className="text-sm text-foreground/80">{nextStep.description}</p>
            </div>
            <Link
              href={nextStep.href}
              className="flex-shrink-0 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
            >
              {nextStep.cta} →
            </Link>
          </div>
        </section>
      )}

      {/* Website Kurulumu — step-by-step progress */}
      <section aria-label="Website kurulumu ilerleme durumu">
        <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/35 select-none">
          Website Kurulumu
        </p>
        <div className="rounded-lg border border-border/40 bg-secondary/10 divide-y divide-border/30">
          {[
            {
              label:  'Keywordler',
              done:   keywords > 0,
              detail: keywords > 0 ? `${keywords} keyword tanımlandı` : 'Keyword stratejisi bekleniyor',
              href:   `${base}/intelligence/keywords`,
            },
            {
              label:  'Kümeler',
              done:   clusters > 0,
              detail: clusters > 0 ? `${clusters} küme oluşturuldu` : 'Keyword kümeleme bekleniyor',
              href:   strategy ? `${base}/intelligence/keywords` : undefined,
            },
            {
              label:  'Blueprint',
              done:   blueprint,
              detail: blueprint ? 'Site yapısı onaylandı' : 'Site blueprint hazırlanmadı',
              href:   strategy ? `${base}/architecture/blueprint` : undefined,
            },
            {
              label:  'Sayfalar',
              done:   pages > 0,
              detail: pages > 0 ? `${pages} sayfa oluşturuldu` : 'Henüz sayfa oluşturulmadı',
              href:   blueprint ? `${base}/architecture/pages` : undefined,
            },
            {
              label:  'İçerik',
              done:   false,
              pending: pages > 0,
              detail: pages > 0 ? 'İçerik oluşturma devam ediyor' : 'Sayfa oluşturulduktan sonra başlar',
              href:   pages > 0 ? `${base}/content/lifecycle` : undefined,
            },
          ].map(({ label, done, pending, detail, href }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-2.5">
              <span className={`h-4 w-4 shrink-0 rounded-full border flex items-center justify-center text-[9px] font-bold ${
                done
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                  : pending
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                    : 'border-border/40 bg-secondary text-muted-foreground/30'
              }`}>
                {done ? '✓' : '·'}
              </span>
              <span className={`text-xs font-medium ${done ? 'text-foreground/80' : 'text-muted-foreground/60'}`}>
                {label}
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground/50 truncate max-w-[180px]">
                {detail}
              </span>
              {href && (
                <Link href={href} className="shrink-0 text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors">
                  →
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Module status */}
      <section aria-label="Modül durumu">
        {/* Pipeline */}
        <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/35 select-none">
          İş Akışı
        </p>
        <div className="grid gap-2 sm:grid-cols-3 mb-3">
          <StatePanel
            title="Araştırma"
            status={research ? 'active' : 'empty'}
            description={research ? 'Araştırma onaylandı.' : 'Keşif süreci tamamlanmadı.'}
          >
            {!research && (
              <Link href={`${base}/intelligence/research`} className="mt-1 block text-[11px] text-muted-foreground hover:text-foreground">
                Araştırmaya git →
              </Link>
            )}
          </StatePanel>

          <StatePanel
            title="Keyword Stratejisi"
            status={strategy ? 'active' : research ? 'empty' : 'locked'}
            description={
              strategy  ? 'Strateji onaylandı.' :
              research  ? 'Strateji henüz onaylanmadı.' :
              'Araştırma onayı gerekli.'
            }
          >
            {research && !strategy && (
              <Link href={`${base}/intelligence/keywords`} className="mt-1 block text-[11px] text-muted-foreground hover:text-foreground">
                Stratejiye git →
              </Link>
            )}
          </StatePanel>

          <StatePanel
            title="Site Blueprint"
            status={blueprint ? 'active' : strategy ? 'empty' : 'locked'}
            description={
              blueprint ? 'Blueprint onaylandı.' :
              strategy  ? 'Blueprint henüz hazırlanmadı.' :
              'Keyword stratejisi onayı gerekli.'
            }
          >
            {strategy && !blueprint && (
              <Link href={`${base}/architecture/blueprint`} className="mt-1 block text-[11px] text-muted-foreground hover:text-foreground">
                Blueprint'e git →
              </Link>
            )}
          </StatePanel>
        </div>

        {/* Operational */}
        <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/35 select-none">
          Operasyon
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <StatePanel
            title="İçerik"
            status={blueprint ? pages > 0 ? 'active' : 'empty' : 'locked'}
            description={
              !blueprint ? 'Blueprint onayı gerekli.' :
              pages > 0  ? `${pages} sayfa oluşturuldu.` :
              'Henüz sayfa oluşturulmadı.'
            }
          >
            {blueprint && (
              <Link href={`${base}/architecture/pages`} className="mt-1 block text-[11px] text-muted-foreground hover:text-foreground">
                Sayfaları yönet →
              </Link>
            )}
          </StatePanel>

          <StatePanel
            title="Yayın"
            status={published ? 'active' : 'empty'}
            description={
              published
                ? `${publishedCount} sayfa yayınlandı.`
                : 'Henüz yayın yok.'
            }
          >
            {blueprint && (
              <Link href={`${base}/publish/queue`} className="mt-1 block text-[11px] text-muted-foreground hover:text-foreground">
                Yayın kuyruğu →
              </Link>
            )}
          </StatePanel>

          <StatePanel
            title="İzleme"
            status="empty"
            description="GSC verisi bekleniyor."
          >
            <Link href={`${base}/settings/integrations`} className="mt-1 block text-[11px] text-muted-foreground hover:text-foreground">
              GSC bağla →
            </Link>
          </StatePanel>
        </div>
      </section>
    </div>
  )
}
