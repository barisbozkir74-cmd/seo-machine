import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { LockedModuleBanner } from '@/components/control-center/LockedModuleBanner'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'
import { SplitPane } from '@/components/control-center/SplitPane'
import { AuditScoreDialog } from '@/app/(dashboard)/projeler/[id]/seo-denetimi/AuditScoreDialog'
import { ApproveTechnicalAuditButton } from '@/app/(dashboard)/projeler/[id]/seo-denetimi/ApproveTechnicalAuditButton'
import type { AuditScores } from '@/app/(dashboard)/projeler/[id]/seo-denetimi/actions'

type PageRow = {
  id: string
  title: string
  slug: string | null
  page_type: string | null
  status: string | null
  audit_scores: AuditScores | null
  seo_title: string | null
  meta_description: string | null
  h1: string | null
  schema_type: string | null
  canonical_url: string | null
  faq: unknown[] | null
}

function ScoreCell({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>
  }
  const colorClass = value <= 40 ? 'bg-red-500' : value <= 70 ? 'bg-yellow-400' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', colorClass)} style={{ width: `${value}%` }} />
      </div>
      <span className={cn('text-xs font-medium tabular-nums w-7 text-right', value <= 40 ? 'text-red-500' : value <= 70 ? 'text-yellow-500' : 'text-green-600')}>
        {value}
      </span>
    </div>
  )
}

function IssuesBadges({ page }: { page: PageRow }) {
  const issues: string[] = []
  if (!page.seo_title) issues.push('SEO Title eksik')
  if (!page.h1) issues.push('H1 eksik')
  if (!page.schema_type) issues.push('Schema eksik')
  if (!page.faq || (Array.isArray(page.faq) && page.faq.length === 0)) issues.push('FAQ eksik')

  if (issues.length === 0) {
    return (
      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 text-xs font-normal">
        Tamam
      </Badge>
    )
  }
  return <span className="text-xs text-muted-foreground">{issues.join(', ')}</span>
}

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, blueprint_approved, site_type, technical_audit_approved')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const siteType         = (project as unknown as { site_type: string | null }).site_type
  const blueprintApproved = (project as unknown as { blueprint_approved: boolean | null }).blueprint_approved ?? false
  const technicalAudit   = (project as unknown as { technical_audit_approved: boolean | null }).technical_audit_approved ?? false

  // New site: blueprint must be approved first
  if (siteType !== 'existing_site' && !blueprintApproved) {
    return (
      <div className="p-6">
        <LockedModuleBanner
          reason="SEO Denetimi için önce Site Blueprint onaylanmalıdır."
          unlockCondition="Site Blueprint adımını tamamlayıp onaylayın."
          ctaLabel="Site Blueprint'e Git"
          ctaHref={`/control-center/projects/${id}/architecture/blueprint`}
        />
      </div>
    )
  }

  const { data: rawPages } = await supabase
    .from('pages')
    .select('id, title, slug, page_type, status, audit_scores, seo_title, meta_description, h1, schema_type, canonical_url, faq')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('title', { ascending: true })

  const pages: PageRow[] = (rawPages ?? []).map((p) => ({
    ...p,
    audit_scores: (p.audit_scores as AuditScores | null) ?? null,
    faq: Array.isArray(p.faq) ? (p.faq as unknown[]) : p.faq ? [p.faq] : null,
  }))

  const seoReadinessValues = pages
    .map((p) => p.audit_scores?.seo_readiness_score)
    .filter((v): v is number => typeof v === 'number')
  const avgSeoReadiness = seoReadinessValues.length > 0
    ? Math.round(seoReadinessValues.reduce((s, v) => s + v, 0) / seoReadinessValues.length)
    : null

  const missingMetaCount = pages.filter((p) => !p.seo_title || !p.meta_description).length
  const missingH1Count   = pages.filter((p) => !p.h1).length

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">SEO Denetimi</span>
          {pages.length > 0 && (
            <span className="text-xs text-muted-foreground">{pages.length} sayfa</span>
          )}
        </div>
        <ApproveTechnicalAuditButton projectId={id} isApproved={technicalAudit} />
      </div>

      <SplitPane
        storageKey="seo-denetimi"
        defaultRightWidth={288}
        minRightWidth={180}
        maxRightWidth={520}
        right={
          <ModuleAIPanel
            variant="sidebar"
            title="SEO Denetimi"
            managerName="Denetim Uzmanı"
            hint="Teknik SEO sorunlarını tespit eder, öncelikli iyileştirmeleri önerir ve denetim geçmişini takip eder."
            section="seo-denetimi"
            actions={[
              { label: 'Teknik Sorunlar', href: '?filter=technical' },
              { label: 'İçerik Sorunları', href: '?filter=content' },
              { label: 'Monitoring Genel', href: `/control-center/projects/${id}/monitoring/overview` },
            ]}
          />
        }
      >
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Toplam Sayfa',      value: pages.length },
              { label: 'Ort. SEO Hazırlık', value: avgSeoReadiness !== null ? avgSeoReadiness : '—' },
              { label: 'Eksik Meta',         value: missingMetaCount },
              { label: 'Eksik H1',           value: missingH1Count },
            ].map((card) => (
              <div key={card.label} className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-semibold mt-1">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Pages table */}
          {pages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <p className="text-sm text-muted-foreground">
                Henüz sayfa eklenmemiş. Sayfa Listesi bölümünden sayfa ekleyin.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {['Sayfa', 'Sayfa Tipi', 'SEO Hazırlık', 'Fırsat Skoru', 'Ticari Değer', 'Öncelik Skoru', 'Sorunlar', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pages.map((page) => (
                      <tr key={page.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground leading-tight">{page.title}</p>
                          {page.slug && (
                            <p className="text-xs text-muted-foreground mt-0.5">/{page.slug}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{page.page_type ?? '—'}</td>
                        <td className="px-4 py-3"><ScoreCell value={page.audit_scores?.seo_readiness_score} /></td>
                        <td className="px-4 py-3"><ScoreCell value={page.audit_scores?.opportunity_score} /></td>
                        <td className="px-4 py-3"><ScoreCell value={page.audit_scores?.commercial_value_score} /></td>
                        <td className="px-4 py-3"><ScoreCell value={page.audit_scores?.build_priority_score} /></td>
                        <td className="px-4 py-3"><IssuesBadges page={page} /></td>
                        <td className="px-4 py-3 text-right">
                          <AuditScoreDialog
                            projectId={id}
                            pageId={page.id}
                            pageName={page.title}
                            initialScores={page.audit_scores}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </SplitPane>
    </div>
  )
}
