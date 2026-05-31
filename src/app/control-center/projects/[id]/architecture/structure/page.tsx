import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LockedModuleBanner } from '@/components/control-center/LockedModuleBanner'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'
import { SiteMimarisiShell } from '@/app/(dashboard)/projeler/[id]/site-mimarisi/SiteMimarisiShell'
import { getProjectLocale } from '@/lib/serp-engine/fingerprint'

export default async function StructurePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain, site_type, target_country, target_language, section_rules, research_approved, technical_audit_approved, strategy_approved')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const researchApproved = (project as unknown as { research_approved: boolean | null }).research_approved ?? false
  const technicalAudit   = (project as unknown as { technical_audit_approved: boolean | null }).technical_audit_approved ?? false
  const strategyApproved = (project as unknown as { strategy_approved: boolean | null }).strategy_approved ?? false

  if (!researchApproved) {
    return (
      <div className="p-6">
        <LockedModuleBanner
          reason="Site Mimarisi için önce araştırmanın onaylanması gerekir."
          unlockCondition="Araştırma adımını tamamlayıp onaylayın."
          ctaLabel="Araştırmaya Git"
          ctaHref={`/control-center/projects/${projectId}/intelligence/research`}
        />
      </div>
    )
  }

  if (project.site_type === 'existing_site' && !technicalAudit) {
    return (
      <div className="p-6">
        <LockedModuleBanner
          reason="Mevcut site için teknik denetim tamamlanmalıdır."
          unlockCondition="SEO Denetimi adımını tamamlayıp onaylayın."
          ctaLabel="SEO Denetimine Git"
          ctaHref={`/control-center/projects/${projectId}/monitoring/audit`}
        />
      </div>
    )
  }

  const locale = getProjectLocale(project)

  const [
    { data: fingerprints },
    { data: suggestions },
    { data: keywords },
    { data: topicMaps },
    { data: clusters },
    { data: pages },
    { data: cases },
    { data: entities },
  ] = await Promise.all([
    supabase
      .from('serp_fingerprints')
      .select('keyword_id, is_stale, fetched_at')
      .eq('project_id', projectId)
      .eq('gl', locale.gl)
      .eq('hl', locale.hl),
    supabase
      .from('serp_cluster_map')
      .select('id, keyword_ids, overlap_score, proposed_cluster_name, target_cluster_id, action_type, status')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('overlap_score', { ascending: false }),
    supabase
      .from('keywords')
      .select('id, keyword, cluster_id')
      .eq('project_id', projectId)
      .eq('user_id', user.id),
    supabase
      .from('topic_maps')
      .select('id, topic_name, cluster_ids, coverage_score, gap_areas, authority_tier, total_volume')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('total_volume', { ascending: false }),
    supabase
      .from('keyword_clusters')
      .select('id, cluster_name, status')
      .eq('project_id', projectId)
      .eq('user_id', user.id),
    supabase
      .from('pages')
      .select('id, title, slug, page_type, search_intent, status, architecture_source, cluster_id, priority_score_v2')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('priority_score_v2', { ascending: false, nullsFirst: false }),
    supabase
      .from('cannibalization_cases')
      .select('id, conflict_type, page_ids, keyword_ids, severity, recommendation, status, resolution_notes')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('severity'),
    supabase
      .from('business_entities')
      .select('id, type, name, is_primary, primary_keyword')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true, nullsFirst: false }),
  ])

  const freshFps         = (fingerprints ?? []).filter((fp) => !fp.is_stale && fp.fetched_at)
  const staleFps         = (fingerprints ?? []).filter((fp) => fp.is_stale)
  const pendingSuggestions = (suggestions ?? []).filter((s) => s.status === 'pending').length

  const approvedClusters = (clusters ?? []).filter((c) => (c as unknown as { status: string | null }).status === 'approved').length
  const pageCount        = (pages ?? []).length

  const base = `/control-center/projects/${projectId}`

  const panelContextItems = [
    { label: 'Onaylı Küme',   value: `${approvedClusters} küme`, status: (approvedClusters > 0 ? 'ok' : 'warning') as 'ok' | 'warning' | 'missing' },
    { label: 'Sayfa Taslağı', value: `${pageCount} sayfa`,       status: (pageCount > 0 ? 'ok' : 'missing')         as 'ok' | 'warning' | 'missing' },
    { label: 'Strateji',      value: strategyApproved ? 'Onaylandı' : 'Bekliyor', status: (strategyApproved ? 'ok' : 'warning') as 'ok' | 'warning' | 'missing' },
  ]

  const panelNextStep = !strategyApproved
    ? 'Önce keyword stratejisini onaylayın'
    : approvedClusters === 0
    ? 'Onaylı küme yok — keyword stratejisine dönün'
    : 'Onaylı kümelerden mimari üretilebilir'

  const panelActions = [
    { label: 'Keyword Stratejisi', href: `${base}/intelligence/keywords`, variant: (!strategyApproved ? 'primary' : 'default') as 'primary' | 'default' },
    { label: 'Site Blueprint',     href: `${base}/architecture/blueprint` },
    { label: 'Küme Haritası',      href: `${base}/intelligence/keywords?view=map` },
  ]

  const keywordMap: Record<string, string> = {}
  for (const kw of keywords ?? []) keywordMap[kw.id] = kw.keyword

  const clusterMap: Record<string, string> = {}
  for (const c of clusters ?? []) clusterMap[c.id] = c.cluster_name

  const pageMap: Record<string, string> = {}
  for (const p of pages ?? []) pageMap[p.id] = p.title

  type EntityRow = { id: string; type: string; name: string; is_primary: boolean; primary_keyword: string | null }
  const allEntities = (entities ?? []) as EntityRow[]
  const ENTITY_TYPE_LABELS: Record<string, string> = {
    product: 'Ürünler', service: 'Hizmetler', category: 'Kategoriler',
    service_area: 'Servis Alanları', persona: 'Personalar', usp: 'USP',
  }
  const entityGroups = Object.entries(ENTITY_TYPE_LABELS)
    .map(([type, label]) => ({ type, label, items: allEntities.filter(e => e.type === type) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Business context strip — entity öncelikleri yapı kararlarını bildirir */}
      {entityGroups.length > 0 && (
        <div className="flex-shrink-0 border-b border-border/30 bg-secondary/10 px-6 py-2.5 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/35 select-none">
            İşletme Bağlamı
          </p>
          <div className="space-y-1.5">
            {entityGroups.map(group => (
              <div key={group.type} className="flex items-start gap-3">
                <span className="text-[10px] font-medium text-muted-foreground/40 w-24 shrink-0 pt-0.5">
                  {group.label}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map(entity => (
                    <span
                      key={entity.id}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                        entity.is_primary
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                          : 'border-border bg-secondary text-foreground/70'
                      }`}
                    >
                      {entity.name}
                      {entity.is_primary && <span className="text-amber-400/50 text-[9px]">★</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <ModuleAIPanel
        title="Mimari Analiz"
        managerName="Site Mimarı"
        hint="Keyword kümelerinden site yapısını tasarlar, SERP analizinden mimari kararlar üretir ve blueprint ile sorumluluk ayrımını korur."
        contextItems={panelContextItems}
        nextStep={panelNextStep}
        actions={panelActions}
      />

      {/* Module purpose + responsibility boundary */}
      <div className="flex-shrink-0 mx-6 mt-4 mb-1 rounded-lg border border-border/40 bg-muted/30 px-4 py-3 space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-muted-foreground/50 select-none">
          Modül Amacı
        </p>
        <p className="text-sm text-foreground/80 leading-relaxed">
          Site Mimarisi modülü, keyword stratejisinden çıkan temaları bir site yapısına dönüştürür.
          Blueprint (sayfa listesi) bu mimariye dayanır.
        </p>
        <div className="flex flex-wrap gap-4 pt-0.5">
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/70">Mimari</span>
            {' '}→ yapı ve hiyerarşi
          </span>
          <span className="text-xs text-muted-foreground/40 select-none">|</span>
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/70">Blueprint</span>
            {' '}→ sayfa öznitelikleri ve içerik kararları
          </span>
        </div>
      </div>

      {/* Section legend: maps the shell's tabs to their logical role */}
      <div className="flex-shrink-0 flex gap-4 px-6 pt-3 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400/70" />
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/50">
            Analiz
          </span>
          <span className="text-[10px] text-muted-foreground/35">(SERP, Cluster, Konu Haritası)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/50">
            Mimari Öneri
          </span>
          <span className="text-[10px] text-muted-foreground/35">(Önerilen yapı)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/50">
            Kararlar
          </span>
          <span className="text-[10px] text-muted-foreground/35">(Çakışmalar, kilitli kararlar)</span>
        </div>
      </div>

      <SiteMimarisiShell
        projectId={projectId}
        fingerprintCount={freshFps.length}
        staleCount={staleFps.length}
        pendingSuggestions={pendingSuggestions}
        suggestions={suggestions ?? []}
        keywordMap={keywordMap}
        topicMaps={topicMaps ?? []}
        clusterMap={clusterMap}
        pages={pages ?? []}
        cases={cases ?? []}
        pageMap={pageMap}
        totalKeywords={keywords?.length ?? 0}
      />
    </div>
  )
}
