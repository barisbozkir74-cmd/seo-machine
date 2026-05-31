import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RakiplerTable, type FullCompetitor, type SummaryStats } from '@/app/(dashboard)/projeler/[id]/rakipler/RakiplerTable'
import { RakiplerDeepAnalysis } from '@/app/(dashboard)/projeler/[id]/rakipler/RakiplerDeepAnalysis'
import { CompetitorDiscoveryDialog } from '@/app/(dashboard)/projeler/[id]/rakipler/CompetitorDiscoveryDialog'
import { OwnDomainAnalyzeButton } from '@/app/(dashboard)/projeler/[id]/rakipler/OwnDomainAnalyzeButton'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'
import { SplitPane } from '@/components/control-center/SplitPane'
import { FetchAllButton } from '@/app/(dashboard)/projeler/[id]/rakipler/FetchAllButton'
import { addCompetitor } from '@/app/(dashboard)/projeler/[id]/rakipler/actions'

type CategoryEntry = { pageCount: number; sampleUrls: string[]; totalEtv: number }
type CategoryStructure = Record<string, CategoryEntry> | null

type RawCompetitor = {
  id: string
  domain: string
  source: string
  top_pages: unknown
  category_structure: CategoryStructure
  content_areas: Record<string, CategoryEntry> | null
  ranked_keywords: unknown
  backlinks_summary: unknown
  analysis: unknown
  updated_at: string
}

function normalizeTopPages(raw: unknown): FullCompetitor['top_pages'] {
  if (!raw) return null
  if (Array.isArray(raw)) return { total_count: raw.length, pages: raw }
  const obj = raw as FullCompetitor['top_pages']
  if (obj?.pages) return obj
  return null
}

function computeEtv(topPages: FullCompetitor['top_pages']): number {
  if (!topPages) return 0
  return topPages.pages.reduce((s, p) => s + (p.etv ?? 0), 0)
}

function computeGapCategories(
  catStructure: CategoryStructure,
  ownCatData: Record<string, number> | null
): string[] {
  if (!catStructure) return []
  return Object.keys(catStructure).filter(
    (cat) => cat !== 'Diğer' && !(ownCatData?.[cat])
  )
}

function computeDominantPageType(comps: FullCompetitor[]): string | null {
  const counts: Record<string, number> = {}
  for (const c of comps) {
    if (!c.category_structure) continue
    for (const cat of Object.keys(c.category_structure)) {
      if (cat === 'Diğer') continue
      counts[cat] = (counts[cat] ?? 0) + 1
    }
  }
  const entries = Object.entries(counts)
  if (!entries.length) return null
  return entries.sort((a, b) => b[1] - a[1])[0][0]
}

function computeFastestOpportunity(comps: FullCompetitor[]): string | null {
  const etv: Record<string, number> = {}
  for (const c of comps) {
    for (const cat of c.gapCategories) {
      const catEtv = c.category_structure?.[cat]?.totalEtv ?? 0
      etv[cat] = (etv[cat] ?? 0) + catEtv
    }
  }
  const entries = Object.entries(etv)
  if (!entries.length) return null
  return entries.sort((a, b) => b[1] - a[1])[0][0]
}

export default async function CompetitorsPage({
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
    .select('id, name, domain, own_category_structure, research_approved, keyword_strategy_approved, blueprint_approved, site_type, technical_audit_approved')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const ownCategoryData = (project.own_category_structure as Record<string, number> | null) ?? null

  const [{ data: rawCompetitors }, { data: deepAnalysisRow }, { data: entities }] = await Promise.all([
    supabase
      .from('competitors')
      .select('id, domain, source, top_pages, category_structure, content_areas, ranked_keywords, backlinks_summary, analysis, updated_at')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('ai_memory')
      .select('value')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .eq('module', 'competitor_deep_analysis')
      .eq('key', 'latest')
      .maybeSingle(),
    supabase
      .from('business_entities')
      .select('id, type, name, is_primary, primary_keyword')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true, nullsFirst: false }),
  ])

  const competitors: FullCompetitor[] = ((rawCompetitors ?? []) as RawCompetitor[]).map((raw) => {
    const topPages      = normalizeTopPages(raw.top_pages)
    const totalEtv      = computeEtv(topPages)
    const gapCategories = computeGapCategories(raw.category_structure, ownCategoryData)
    return {
      id:                raw.id,
      domain:            raw.domain,
      source:            raw.source,
      top_pages:         topPages,
      category_structure: raw.category_structure,
      content_areas:     raw.content_areas,
      ranked_keywords:   (raw.ranked_keywords as FullCompetitor['ranked_keywords']) ?? null,
      backlinks_summary: (raw.backlinks_summary as FullCompetitor['backlinks_summary']) ?? null,
      analysis:          (raw.analysis as FullCompetitor['analysis']) ?? null,
      updated_at:        raw.updated_at,
      totalEtv,
      gapCount:          gapCategories.length,
      gapCategories,
    }
  })

  const strongest = competitors.length
    ? [...competitors].sort((a, b) => b.totalEtv - a.totalEtv)[0]
    : null

  const summaryStats: SummaryStats = {
    total:               competitors.length,
    withData:            competitors.filter((c) => c.category_structure !== null).length,
    highThreat:          competitors.filter((c) => c.totalEtv >= 10000).length,
    mediumThreat:        competitors.filter((c) => c.totalEtv >= 2000 && c.totalEtv < 10000).length,
    dominantPageType:    computeDominantPageType(competitors),
    totalGaps:           competitors.reduce((s, c) => s + c.gapCount, 0),
    strongestCompetitor: strongest?.totalEtv ? strongest.domain : null,
    fastestOpportunity:  computeFastestOpportunity(competitors),
  }

  const deepAnalysis = deepAnalysisRow?.value
    ? (deepAnalysisRow.value as Record<string, unknown>)
    : null

  const addCompetitorAction = addCompetitor.bind(null, id)

  type EntityRow = { id: string; type: string; name: string; is_primary: boolean; primary_keyword: string | null }
  const allEntities = (entities ?? []) as EntityRow[]
  const ENTITY_TYPE_LABELS: Record<string, string> = {
    product: 'Ürünler', service: 'Hizmetler', category: 'Kategoriler',
    service_area: 'Servis Alanları', persona: 'Personalar', usp: 'USP',
  }
  const entityGroups = Object.entries(ENTITY_TYPE_LABELS)
    .map(([type, label]) => ({ type, label, items: allEntities.filter(e => e.type === type) }))
    .filter(g => g.items.length > 0)
  const primaryKeywords = allEntities
    .filter(e => e.is_primary && e.primary_keyword)
    .slice(0, 3)
    .map(e => e.primary_keyword!)

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header — includes add-competitor form inline */}
      <div className="flex flex-shrink-0 items-start justify-between gap-4 flex-wrap border-b border-border px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">Rakipler</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {competitors.length > 0
              ? `${competitors.length} rakip · gap analizi`
              : 'Alan rakiplerini ekleyin ve analiz edin'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Add competitor — inline compact form */}
          <form
            action={async (formData: FormData) => {
              'use server'
              const domain = formData.get('domain') as string
              if (domain?.trim()) await addCompetitorAction(domain.trim())
            }}
            className="flex items-center gap-1.5"
          >
            <Input
              name="domain"
              placeholder="domain.com"
              required
              className="h-8 w-36 text-xs"
            />
            <Button type="submit" variant="outline" size="sm" className="h-8 text-xs">
              Ekle
            </Button>
          </form>

          {competitors.length > 0 && (
            <FetchAllButton
              projectId={id}
              competitors={competitors.map((c) => ({ id: c.id, domain: c.domain }))}
            />
          )}
          <CompetitorDiscoveryDialog projectId={id} primaryKeywords={primaryKeywords} />
        </div>
      </div>

      {/* Two-column body with draggable splitter */}
      <SplitPane
        storageKey="rakipler"
        defaultRightWidth={288}
        minRightWidth={180}
        maxRightWidth={520}
        right={
          <ModuleAIPanel
            variant="sidebar"
            title="Rakip Analizi"
            managerName="Rekabet Analisti"
            hint="Rakip zayıflıklarını tespit eder, fırsat boşluklarını analiz eder ve rakip keyword'lerinden strateji önerir."
            section="rakipler"
          />
        }
      >
        {/* Left: main content */}
        <div className="overflow-y-auto h-full">
          <div className="flex flex-col gap-5 p-6">
            {/* Business context strip */}
            {entityGroups.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/35 select-none">
                  İşletme Bağlamı
                </p>
                <div className="rounded-lg border border-border/40 bg-secondary/20 px-3 py-2.5 space-y-2">
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

            {/* Own-domain analysis prompt — shown when there are competitors but no own data */}
            {!ownCategoryData && competitors.length > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground/80">Gap analizi için kendi sitenizi de analiz edin</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Kendi siteyi analiz etmeden rakip boşlukları karşılaştırılamaz.
                  </p>
                </div>
                <OwnDomainAnalyzeButton projectId={id} domain={project.domain} />
              </div>
            )}

            {/* Empty state */}
            {competitors.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/50 py-16">
                <div className="mx-auto max-w-xs space-y-3 px-4 text-center">
                  <p className="text-sm font-medium text-foreground/80">Henüz rakip eklenmemiş</p>
                  <p className="text-xs text-muted-foreground">
                    Domain ekleyip veri çekin, ardından kendi sitenizi analiz ederek boşluk karşılaştırması yapın.
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    AI keşfi için "Rakip Keşfi" butonunu kullanın.
                  </p>
                </div>
              </div>
            ) : (
              /* Competitor table */
              <RakiplerTable
                competitors={competitors}
                projectId={id}
                summaryStats={summaryStats}
                hasOwnData={ownCategoryData !== null}
              />
            )}

            {/* Deep analysis — separate section */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/40 select-none whitespace-nowrap">
                  Derin Analiz
                </p>
                <span className="h-px flex-1 bg-border/30" aria-hidden="true" />
              </div>
              <RakiplerDeepAnalysis
                projectId={id}
                initialAnalysis={deepAnalysis as Parameters<typeof RakiplerDeepAnalysis>[0]['initialAnalysis']}
              />
            </div>
          </div>
        </div>
      </SplitPane>
    </div>
  )
}
