import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ClusterTree } from '@/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterTree'
import { KeywordFlatList } from '@/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordFlatList'
import { MasterSeoMap } from '@/app/(dashboard)/projeler/[id]/keyword-stratejisi/MasterSeoMap'
import { AddKeywordDialog } from '@/app/(dashboard)/projeler/[id]/keyword-stratejisi/AddKeywordDialog'
import { AiAcquireButton } from '@/app/(dashboard)/projeler/[id]/keyword-stratejisi/AiAcquireButton'
import { EnrichButton } from '@/app/(dashboard)/projeler/[id]/keyword-stratejisi/EnrichButton'
import { AiExpandButton } from '@/app/(dashboard)/projeler/[id]/keyword-stratejisi/AiExpandButton'
import { KeywordStratejisiToolbar } from '@/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordStratejisiToolbar'
import { LockedModuleBanner } from '@/components/control-center/LockedModuleBanner'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'
import { intentToPageType } from '@/app/(dashboard)/projeler/[id]/site-blueprint/page-utils'
import type { DialogRow } from '@/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog'

function hasTurkishChars(text: string): boolean {
  return /[çğıöşüÇĞİÖŞÜ]/.test(text)
}

function mightBeNonTurkish(keyword: string, projectLang: string): boolean {
  if (projectLang !== 'tr') return false
  return !hasTurkishChars(keyword) && keyword.split(' ').length <= 2 && !/\d/.test(keyword)
}

function stripIntentSuffix(name: string): string {
  return name
    .replace(/\s*\((commercial|informational|navigational|transactional|unknown)\)\s*$/i, '')
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ')
}

type KeywordRow = {
  id: string
  keyword: string
  volume: number | null
  cpc: number | null
  difficulty: number | null
  search_intent: string | null
  enriched_at: string | null
  cluster_id: string | null
  opportunity_score: number | null
  source: 'manual' | 'competitor' | 'expansion' | 'seed'
  parent_keyword_id: string | null
  is_starred: boolean
  is_ai_suggested: boolean
  long_tail_flag: boolean
  faq_flag: boolean
  comparison_flag: boolean
  keyword_role: string | null
}

type ClusterWithKeywords = {
  id: string
  cluster_name: string
  intent: string | null
  primary_keyword_id: string | null
  opportunity_score: number | null
  revenue_type: string | null
  status: string | null
  cannibalization_status: string | null
  link_tier: string | null
  keywords: KeywordRow[]
}

export default async function KeywordsPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ view?: string; sort?: string; dir?: string }>
}) {
  const { id }            = await params
  const { view, sort, dir } = await searchParams

  const isMapView     = view === 'map'
  const isFlatView    = view === 'flat'
  const isClusterView = !isFlatView && !isMapView

  const base = `/control-center/projects/${id}/intelligence/keywords`

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain, seo_arch_summary, seo_arch_built_at, keyword_strategy_approved, target_keywords, research_approved, blueprint_approved, site_type, technical_audit_approved, target_language')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const researchApproved = (project as unknown as { research_approved: boolean | null }).research_approved ?? false
  const siteType         = (project as unknown as { site_type: string | null }).site_type ?? null
  const technicalAudit   = (project as unknown as { technical_audit_approved: boolean | null }).technical_audit_approved ?? false
  const targetLanguage   = (project as unknown as { target_language: string | null }).target_language ?? 'tr'

  // Gate: research must be approved
  if (!researchApproved) {
    return (
      <div className="p-6">
        <LockedModuleBanner
          reason="Keyword stratejisi için önce araştırmanın onaylanması gerekir."
          unlockCondition="Araştırma adımını tamamlayıp onaylayın."
          ctaLabel="Araştırmaya Git"
          ctaHref={`/control-center/projects/${id}/intelligence/research`}
        />
      </div>
    )
  }

  // Gate: existing site needs technical audit
  if (siteType === 'existing_site' && !technicalAudit) {
    redirect(`/control-center/projects/${id}/monitoring/audit`)
  }

  // Seed sync
  const targetKeywordsStr = (project as unknown as { target_keywords: string | null }).target_keywords ?? ''
  if (targetKeywordsStr.trim()) {
    const seeds = targetKeywordsStr.split(/[,\n]+/).map((k: string) => k.trim()).filter(Boolean)
    if (seeds.length > 0) {
      await supabase.from('keywords').upsert(
        seeds.map((keyword: string) => ({ user_id: user.id, project_id: id, keyword, source: 'manual' })),
        { onConflict: 'project_id,keyword', ignoreDuplicates: true }
      )
    }
  }

  const sortColumn = sort === 'niche_score' ? 'opportunity_score' : 'total_volume'
  const ascending  = dir === 'asc'

  const [{ data: keywordsRaw }, { data: clustersRaw }, { data: pagesWithClusters }, { data: entities }] = await Promise.all([
    supabase
      .from('keywords')
      .select('id, keyword, volume, cpc, difficulty, search_intent, enriched_at, cluster_id, opportunity_score, source, parent_keyword_id, is_starred, is_ai_suggested, long_tail_flag, faq_flag, comparison_flag, keyword_role')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .order('volume', { ascending: false, nullsFirst: false }),
    supabase
      .from('keyword_clusters')
      .select('id, cluster_name, intent, primary_keyword_id, opportunity_score, revenue_type, total_volume, page_type, target_url, arch_status, ai_reasoning, priority_rank, content_month, status, cannibalization_status, link_tier')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .order(sortColumn, { ascending, nullsFirst: false }),
    supabase
      .from('pages')
      .select('cluster_id')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .not('cluster_id', 'is', null),
    supabase
      .from('business_entities')
      .select('id, type, name, is_primary, primary_keyword')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true, nullsFirst: false }),
  ])

  const keywords: KeywordRow[] = (keywordsRaw ?? []) as KeywordRow[]
  const clusters               = clustersRaw ?? []

  const clusterIdsWithPages = new Set(
    (pagesWithClusters ?? []).map((p: { cluster_id: string }) => p.cluster_id)
  )

  const clusterMap: Record<string, string> = {}
  for (const c of clusters) clusterMap[c.id] = c.cluster_name

  const clusterKeywordMap: Record<string, KeywordRow[]> = {}
  for (const kw of keywords) {
    if (kw.cluster_id) {
      if (!clusterKeywordMap[kw.cluster_id]) clusterKeywordMap[kw.cluster_id] = []
      clusterKeywordMap[kw.cluster_id].push(kw)
    }
  }

  const clustersWithKeywords: ClusterWithKeywords[] = clusters.map((c) => ({
    ...c,
    status:                   (c as unknown as { status: string | null }).status ?? null,
    cannibalization_status:   (c as unknown as { cannibalization_status: string | null }).cannibalization_status ?? null,
    link_tier:                (c as unknown as { link_tier: string | null }).link_tier ?? null,
    keywords:                 clusterKeywordMap[c.id] ?? [],
  }))

  const keywordIdToText = new Map<string, string>()
  for (const kw of keywords) keywordIdToText.set(kw.id, kw.keyword)

  const approvedDialogRows: DialogRow[] = clustersWithKeywords
    .filter((c) => c.status === 'approved' && c.primary_keyword_id !== null)
    .map((c) => ({
      clusterId:     c.id,
      clusterName:   c.cluster_name,
      proposedName:  stripIntentSuffix(c.cluster_name),
      proposedType:  intentToPageType(c.intent),
      focusKeyword:  c.primary_keyword_id ? (keywordIdToText.get(c.primary_keyword_id) ?? null) : null,
      focusKeywordId: c.primary_keyword_id,
      alreadyExists: clusterIdsWithPages.has(c.id),
    }))

  const allClusters    = clusters.map((c) => ({ id: c.id, cluster_name: c.cluster_name, intent: c.intent, keyword_count: (clusterKeywordMap[c.id] ?? []).length }))
  const expandClusters = clusters.map((c) => {
    const primaryId = (c as unknown as { primary_keyword_id: string | null }).primary_keyword_id
    return { id: c.id, cluster_name: c.cluster_name, focus_keyword: primaryId ? (keywordIdToText.get(primaryId) ?? null) : null }
  })

  const totalKeywords       = keywords.length
  const totalClusters       = clusters.length
  const pendingEnrichment   = keywords.filter((kw) => !kw.enriched_at).length
  const localeFlaggedIds    = new Set(keywords.filter((kw) => mightBeNonTurkish(kw.keyword, targetLanguage)).map((kw) => kw.id))
  const localeFlaggedCount  = localeFlaggedIds.size

  const approvedClusters = clustersWithKeywords.filter((c) => c.status === 'approved')
  const readinessChecks  = {
    hasApprovedCluster:          approvedClusters.length > 0,
    allHavePrimary:              approvedClusters.length > 0 && approvedClusters.every((c) => c.primary_keyword_id !== null),
    hasCommercial:               approvedClusters.some((c) => c.revenue_type === 'ticari'),
    noUnresolvedCannibalization: approvedClusters.every((c) => c.cannibalization_status !== 'warning'),
    enrichmentDone:              keywords.length > 0 && pendingEnrichment === 0,
  }
  const readinessScore = Object.values(readinessChecks).filter(Boolean).length
  const readinessTotal = Object.keys(readinessChecks).length

  const isStrategyApproved = (project as unknown as { keyword_strategy_approved: boolean | null }).keyword_strategy_approved ?? false
  const blueprintBase      = `/control-center/projects/${id}/architecture/blueprint`

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
      {/* Toolbar */}
      <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-foreground">Keyword Stratejisi</span>
          {totalKeywords > 0 && (
            <span className="text-xs text-muted-foreground">
              {totalKeywords} keyword · {totalClusters} küme
              {pendingEnrichment > 0 && (
                <span className="ml-1 text-amber-400">· {pendingEnrichment} zenginleştirilecek</span>
              )}
              {localeFlaggedCount > 0 && (
                <span className="ml-1 text-blue-400/70" title="Dil Uyarısı: Türkçe karakter içermeyen keyword'ler">
                  · 🌍 {localeFlaggedCount} dil uyarısı
                </span>
              )}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Data actions */}
          <AddKeywordDialog
            projectId={id}
            clusters={clusters.map((c) => ({ id: c.id, cluster_name: c.cluster_name }))}
          />
          <AiAcquireButton projectId={id} userId={user.id} />
          {totalKeywords > 0 && pendingEnrichment > 0 && (
            <EnrichButton projectId={id} pendingCount={pendingEnrichment} />
          )}

          {totalKeywords > 0 && (
            <>
              <span className="h-4 w-px shrink-0 bg-border/50" aria-hidden="true" />
              <AiExpandButton projectId={id} clusters={expandClusters} />
              <KeywordStratejisiToolbar
                projectId={id}
                hasExistingClusters={totalClusters > 0}
                hasApprovedCluster={approvedClusters.length > 0}
                isStrategyApproved={isStrategyApproved}
                approvedDialogRows={approvedDialogRows}
                readinessScore={readinessScore}
                readinessTotal={readinessTotal}
                readinessChecks={readinessChecks}
              />
            </>
          )}

          <span className="h-4 w-px shrink-0 bg-border/50" aria-hidden="true" />

          {/* View toggle */}
          <div
            role="group"
            aria-label="Görünüm"
            className="flex items-center gap-0.5 rounded-md border border-border p-0.5"
          >
            <Link
              href={base}
              aria-current={isClusterView ? 'page' : undefined}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${isClusterView ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Kümeler
            </Link>
            <Link
              href={`${base}?view=flat`}
              aria-current={isFlatView ? 'page' : undefined}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${isFlatView ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Liste
            </Link>
            <Link
              href={`${base}?view=map`}
              aria-current={isMapView ? 'page' : undefined}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${isMapView ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              SEO Haritası
            </Link>
          </div>
        </div>
      </div>

      {/* Approved — next step strip */}
      {isStrategyApproved && (
        <div className="flex flex-shrink-0 items-center justify-between border-b border-emerald-500/20 bg-emerald-500/5 px-6 py-2">
          <p className="text-[11px] font-medium text-emerald-400">
            Strateji onaylandı
          </p>
          <Link
            href={blueprintBase}
            className="text-[11px] text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            Site Blueprint'e Git →
          </Link>
        </div>
      )}

      {/* Business context strip */}
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
        title="Keyword Stratejisi"
        managerName="Keyword Stratejisti"
        hint="Keyword kümeleri analiz eder, dil uyumunu kontrol eder, cluster önerileri üretir ve strateji boşluklarını tespit eder."
        contextItems={[
          { label: 'Keywords',     value: `${totalKeywords} adet`,           status: totalKeywords > 0 ? 'ok' : 'missing' },
          { label: 'Kümeler',      value: `${totalClusters} küme`,           status: totalClusters > 0 ? 'ok' : 'missing' },
          { label: 'Onaylı Küme', value: `${approvedClusters.length} onaylı`, status: approvedClusters.length > 0 ? 'ok' : 'warning' },
          { label: 'Strateji',     value: isStrategyApproved ? 'Kilitli' : 'Taslak', status: isStrategyApproved ? 'ok' : 'warning' },
        ]}
        nextStep={
          totalKeywords === 0
            ? 'Keyword ekleyin veya CSV ile içe aktarın'
            : totalClusters === 0
            ? 'Kümeleme başlatın'
            : approvedClusters.length === 0
            ? 'Kümeleri gözden geçirin ve onaylayın'
            : !isStrategyApproved
            ? 'Stratejiyi kilitleyin'
            : 'Strateji onaylandı. Blueprint oluşturabilirsiniz.'
        }
        actions={[
          { label: 'Keyword Ekle',   href: `${base}?view=flat`,            variant: totalKeywords === 0 ? 'primary' : 'default' },
          { label: 'Küme Görünümü',  href: `${base}?view=cluster` },
          { label: 'Harita Görünümü', href: `${base}?view=map` },
          { label: 'Site Blueprint', href: blueprintBase, disabled: !isStrategyApproved, disabledReason: 'Stratejiyi kilitleyin' },
        ]}
      />

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {keywords.length === 0 ? (
          <div className="flex h-full items-center justify-center py-20">
            <div className="text-center max-w-xs space-y-3">
              <p className="text-sm font-medium text-foreground/80">Henüz keyword eklenmemiş</p>
              <p className="text-xs text-muted-foreground">
                Araştırmadan aktarılan taslaklar veya AI ile keyword çekerek başlayın. Kümeler oluşturulduktan sonra strateji onaylanabilir.
              </p>
            </div>
          </div>
        ) : isMapView ? (
          <MasterSeoMap
            projectId={id}
            clusters={clusters.map((c) => ({
              id:           c.id,
              cluster_name: c.cluster_name,
              page_type:    (c as unknown as Record<string, string | null>).page_type ?? null,
              target_url:   (c as unknown as Record<string, string | null>).target_url ?? null,
              arch_status:  (c as unknown as Record<string, string | null>).arch_status ?? null,
              ai_reasoning: (c as unknown as Record<string, string | null>).ai_reasoning ?? null,
              priority_rank:(c as unknown as Record<string, number | null>).priority_rank ?? null,
              content_month:(c as unknown as Record<string, number | null>).content_month ?? null,
              intent:        c.intent ?? null,
              total_volume:  (c as unknown as Record<string, number | null>).total_volume ?? null,
              keyword_count: (clusterKeywordMap[c.id] ?? []).length,
            }))}
            archSummary={(project as unknown as Record<string, string | null>).seo_arch_summary ?? null}
            archBuiltAt={(project as unknown as Record<string, string | null>).seo_arch_built_at ?? null}
          />
        ) : isFlatView ? (
          <KeywordFlatList
            keywords={keywords}
            projectId={id}
            clusterMap={clusterMap}
            localeFlaggedIds={localeFlaggedIds}
          />
        ) : (
          <div className="p-4">
            {clustersWithKeywords.length > 0 && (
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {clustersWithKeywords.length} küme
                </span>
                {(() => {
                  const isActive = sort === 'niche_score'
                  const nextDir  = isActive && dir === 'desc' ? 'asc' : isActive && dir === 'asc' ? undefined : 'desc'
                  const href     = nextDir ? `${base}?sort=niche_score&dir=${nextDir}` : base
                  return (
                    <Link href={href} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                      Niche Skoru{isActive && dir === 'desc' ? ' ↓' : isActive && dir === 'asc' ? ' ↑' : ''}
                    </Link>
                  )
                })()}
              </div>
            )}
            <ClusterTree
              clusters={clustersWithKeywords}
              allClusters={allClusters}
              projectId={id}
              localeFlaggedIds={localeFlaggedIds}
            />
          </div>
        )}
      </div>
    </div>
  )
}
