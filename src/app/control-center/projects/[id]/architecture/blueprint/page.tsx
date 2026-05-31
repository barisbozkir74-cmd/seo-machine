import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LockedModuleBanner } from '@/components/control-center/LockedModuleBanner'
import { AddPageModal } from '@/app/(dashboard)/projeler/[id]/site-blueprint/AddPageModal'
import { MenuEditor } from '@/app/(dashboard)/projeler/[id]/site-blueprint/MenuEditor'
import { deletePage } from '@/app/(dashboard)/projeler/[id]/site-blueprint/actions'
import { intentToPageType } from '@/app/(dashboard)/projeler/[id]/site-blueprint/page-utils'
import type { MenuType, MenuItem } from '@/app/(dashboard)/projeler/[id]/site-blueprint/actions'
import { GenerateFromClustersButton } from '@/app/(dashboard)/projeler/[id]/site-blueprint/GenerateFromClustersButton'
import { ReorderButton } from '@/app/(dashboard)/projeler/[id]/site-blueprint/ReorderButton'
import { KeywordMappingTab, type MappedPage, type UnmappedKeyword } from '@/app/(dashboard)/projeler/[id]/site-blueprint/KeywordMappingTab'
import type { DialogRow } from '@/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog'
import { ArchHealthPanel } from '@/app/(dashboard)/projeler/[id]/site-blueprint/ArchHealthPanel'
import { ApproveBlueprintButton } from '@/app/(dashboard)/projeler/[id]/site-blueprint/ApproveBlueprintButton'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'

type Page = {
  id: string
  title: string
  slug: string
  page_type: string
  priority: string
  parent_id: string | null
  sort_order: number
  cluster_id: string | null
  focus_keyword_id: string | null
}

type Menu = {
  id: string
  menu_type: MenuType
  items: MenuItem[]
}

type PageWithDepth = Page & { depth: number }

type ClusterRow = {
  id: string
  cluster_name: string
  intent: string | null
  primary_keyword_id: string | null
  keywords: Array<{ id: string; keyword: string }>
}

const MENU_CONFIGS: { type: MenuType; title: string }[] = [
  { type: 'top',    title: 'Üst Menü' },
  { type: 'main',   title: 'Ana Menü' },
  { type: 'footer', title: 'Footer' },
]

function flattenTree(pages: Page[]): PageWithDepth[] {
  const childrenMap: Record<string, Page[]> = {}
  for (const page of pages) {
    const key = page.parent_id ?? '__root__'
    if (!childrenMap[key]) childrenMap[key] = []
    childrenMap[key].push(page)
  }
  function sortPages(list: Page[]): Page[] {
    return [...list].sort((a, b) => a.sort_order - b.sort_order)
  }
  function walk(parentKey: string, depth: number): PageWithDepth[] {
    const children = sortPages(childrenMap[parentKey] ?? [])
    const result: PageWithDepth[] = []
    for (const child of children) {
      result.push({ ...child, depth })
      result.push(...walk(child.id, depth + 1))
    }
    return result
  }
  return walk('__root__', 0)
}

function stripIntentSuffix(name: string): string {
  return name
    .replace(/\s*\((commercial|informational|navigational|transactional|unknown)\)\s*$/i, '')
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ')
}

function priorityClass(priority: string): string {
  if (priority === 'yüksek') return 'text-red-500'
  if (priority === 'orta')   return 'text-yellow-500'
  return 'text-muted-foreground'
}

const PAGE_TYPE_LABELS: Record<string, string> = {
  homepage:       'Ana Sayfa',
  category:       'Kategori',
  product:        'Ürün',
  service:        'Hizmet',
  blog_post:      'Blog',
  landing:        'Landing',
  about:          'Hakkında',
  contact:        'İletişim',
  faq:            'SSS',
  location:       'Lokasyon',
  comparison:     'Karşılaştırma',
  guide:          'Rehber',
}

export default async function BlueprintPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; view?: string }>
}) {
  const { id }   = await params
  const { tab, view } = await searchParams
  const isMappingTab = tab === 'mapping'
  const isHealthTab  = tab === 'health'
  const isTreeView   = view === 'tree'

  const base = `/control-center/projects/${id}/architecture/blueprint`

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, research_approved, keyword_strategy_approved, blueprint_approved, site_type, technical_audit_approved')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const strategyApproved = (project as unknown as { keyword_strategy_approved: boolean | null }).keyword_strategy_approved ?? false

  if (!strategyApproved) {
    return (
      <div className="p-6">
        <LockedModuleBanner
          reason="Site Blueprint için önce Keyword Stratejisi onaylanmalıdır."
          unlockCondition="Keyword Stratejisi adımını tamamlayıp onaylayın."
          ctaLabel="Keyword Stratejisine Git"
          ctaHref={`/control-center/projects/${id}/intelligence/keywords`}
        />
      </div>
    )
  }

  const [
    { data: pagesData },
    { data: menusData },
    { data: clustersRaw },
    { data: entities },
    { data: linkedPageIds },
  ] = await Promise.all([
    supabase
      .from('pages')
      .select('id, title, slug, page_type, priority, parent_id, sort_order, cluster_id, focus_keyword_id')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('menus')
      .select('id, menu_type, items')
      .eq('project_id', id)
      .eq('user_id', user.id),
    supabase
      .from('keyword_clusters')
      .select('id, cluster_name, intent, primary_keyword_id, keywords!inner ( id, keyword )')
      .eq('project_id', id)
      .eq('user_id', user.id),
    supabase
      .from('business_entities')
      .select('id, type, name, is_primary, primary_keyword')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true, nullsFirst: false }),
    supabase
      .from('internal_links')
      .select('target_page_id')
      .eq('project_id', id),
  ])

  const pages: Page[] = (pagesData ?? []) as Page[]
  const flatPages = flattenTree(pages)

  const blueprintApproved = (project as unknown as { blueprint_approved: boolean | null }).blueprint_approved ?? false

  // Orphan count: root-level pages with no incoming internal link
  const linkedSet = new Set((linkedPageIds ?? []).map((l: { target_page_id: string }) => l.target_page_id))
  const pageCount = pages.length
  const orphanCount = pages.filter((p) => !linkedSet.has(p.id) && p.parent_id === null).length

  // Page type breakdown
  const countByType = (type: string) => pages.filter((p) => p.page_type === type).length

  // ModuleAIPanel data
  const panelContextItems = [
    {
      label: 'Toplam Sayfa',
      value: pageCount + ' sayfa',
      status: (pageCount > 0 ? 'ok' : 'missing') as 'ok' | 'missing' | 'warning',
    },
    {
      label: 'Yetim Sayfa',
      value: orphanCount + ' sayfa',
      status: (orphanCount === 0 ? 'ok' : 'warning') as 'ok' | 'missing' | 'warning',
    },
    {
      label: 'Blueprint',
      value: blueprintApproved ? 'Onaylandı' : 'Taslak',
      status: (blueprintApproved ? 'ok' : 'warning') as 'ok' | 'missing' | 'warning',
    },
    ...(pageCount > 0
      ? [
          {
            label: 'Ana Sayfa',
            value: countByType('homepage') + ' adet',
            status: 'ok' as const,
          },
          {
            label: 'Kategori',
            value: countByType('category') + ' adet',
            status: 'ok' as const,
          },
          {
            label: 'Ürün / Hizmet',
            value: (countByType('product') + countByType('service')) + ' adet',
            status: 'ok' as const,
          },
          {
            label: 'Blog',
            value: countByType('blog_post') + ' adet',
            status: 'ok' as const,
          },
        ]
      : []),
  ]

  const panelNextStep =
    pageCount === 0
      ? 'Sayfa oluşturun veya kümelerden transfer edin'
      : orphanCount > 0
        ? `${orphanCount} yetim sayfa var — iç link haritasını kontrol edin`
        : !blueprintApproved
          ? 'Blueprint onaylanmadı — gözden geçirin'
          : 'Blueprint onaylandı. İçerik üretimi başlayabilir.'

  const ccBase = `/control-center/projects/${id}`
  const panelActions = [
    { label: 'Ağaç Görünümü', href: `${base}?view=tree`, variant: 'primary' as const },
    { label: 'Liste Görünümü', href: `${base}?view=list` },
    { label: 'İç Link Haritası', href: `${ccBase}/architecture/link-graph` },
    { label: 'Sayfa Listesi', href: `${ccBase}/architecture/pages` },
  ]

  const menus: Menu[] = (menusData ?? []) as Menu[]
  const menuMap: Partial<Record<MenuType, MenuItem[]>> = {}
  for (const menu of menus) {
    menuMap[menu.menu_type] = (menu.items as MenuItem[]) ?? []
  }

  const clusters: ClusterRow[] = (clustersRaw ?? []) as ClusterRow[]
  const hasEnrichedClusters = clusters.some((c) => c.primary_keyword_id !== null)

  type EntityRow = { id: string; type: string; name: string; is_primary: boolean; primary_keyword: string | null }
  const ENTITY_TYPE_LABELS: Record<string, string> = {
    product: 'Ürünler', service: 'Hizmetler', category: 'Kategoriler',
    service_area: 'Servis Alanları', persona: 'Personalar', usp: 'USP',
  }
  const allEntities = (entities ?? []) as EntityRow[]
  const entityGroups = Object.entries(ENTITY_TYPE_LABELS)
    .map(([type, label]) => ({ type, label, items: allEntities.filter(e => e.type === type) }))
    .filter(g => g.items.length > 0)

  const primaryKeywordTextById = new Map<string, string>()
  for (const c of clusters) {
    if (c.primary_keyword_id) {
      const pk = c.keywords.find((k) => k.id === c.primary_keyword_id)
      if (pk) primaryKeywordTextById.set(c.primary_keyword_id, pk.keyword)
    }
  }

  const clusterIdsWithPages = new Set(
    pages.filter((p) => p.cluster_id !== null).map((p) => p.cluster_id as string)
  )

  const dialogRows: DialogRow[] = clusters
    .filter((c) => c.primary_keyword_id !== null)
    .map((c) => ({
      clusterId:      c.id,
      clusterName:    c.cluster_name,
      proposedName:   stripIntentSuffix(c.cluster_name),
      proposedType:   intentToPageType(c.intent),
      focusKeyword:   c.primary_keyword_id ? (primaryKeywordTextById.get(c.primary_keyword_id) ?? null) : null,
      focusKeywordId: c.primary_keyword_id,
      alreadyExists:  clusterIdsWithPages.has(c.id),
    }))

  // Conflict detection
  const conflictPageIds = new Set<string>()
  const clusterIdToPageId = new Map<string, string>()
  for (const p of pages) {
    if (p.cluster_id) clusterIdToPageId.set(p.cluster_id, p.id)
  }
  const keywordTextToClusters = new Map<string, Set<string>>()
  for (const c of clusters) {
    if (!clusterIdToPageId.has(c.id)) continue
    for (const kw of c.keywords) {
      const key = kw.keyword.toLowerCase().trim()
      if (!keywordTextToClusters.has(key)) keywordTextToClusters.set(key, new Set())
      keywordTextToClusters.get(key)!.add(c.id)
    }
  }
  for (const [, clusterSet] of keywordTextToClusters) {
    if (clusterSet.size > 1) {
      for (const cid of clusterSet) {
        const pid = clusterIdToPageId.get(cid)
        if (pid) conflictPageIds.add(pid)
      }
    }
  }

  // Keyword mapping tab data
  const clusterById = new Map<string, ClusterRow>(clusters.map((c) => [c.id, c]))
  const focusKeywordIds = pages.map((p) => p.focus_keyword_id).filter((v): v is string => v !== null)
  const { data: focusKeywordRows } = focusKeywordIds.length > 0
    ? await supabase.from('keywords').select('id, keyword').in('id', focusKeywordIds).eq('user_id', user.id)
    : { data: [] as Array<{ id: string; keyword: string }> }

  const focusKeywordTextById = new Map<string, string>()
  for (const row of focusKeywordRows ?? []) {
    focusKeywordTextById.set(row.id, row.keyword)
  }

  const mappedPages: MappedPage[] = pages
    .filter((p) => p.cluster_id !== null)
    .map((p) => {
      const cluster = p.cluster_id ? clusterById.get(p.cluster_id) : null
      return {
        id:               p.id,
        title:            p.title,
        focusKeyword:     p.focus_keyword_id ? (focusKeywordTextById.get(p.focus_keyword_id) ?? null) : null,
        clusterKeywords:  cluster ? cluster.keywords.map((k) => k.keyword) : [],
        intent:           cluster?.intent ?? null,
        hasConflict:      conflictPageIds.has(p.id),
      }
    })

  const { data: unmappedRaw } = await supabase
    .from('keywords')
    .select('id, keyword')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .is('cluster_id', null)

  const unmappedKeywords: UnmappedKeyword[] = (unmappedRaw ?? []).map((k) => ({ id: k.id, keyword: k.keyword }))

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">Site Blueprint</span>
          {pages.length > 0 && (
            <span className="text-xs text-muted-foreground">{pages.length} sayfa</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isMappingTab && !isHealthTab && (
            <>
              <GenerateFromClustersButton
                projectId={id}
                rows={dialogRows}
                hasEnrichedClusters={hasEnrichedClusters}
              />
              <AddPageModal
                projectId={id}
                existingPages={pages.map((p) => ({ id: p.id, title: p.title }))}
              />
              <span className="h-4 w-px shrink-0 bg-border/50" />
            </>
          )}
          <ApproveBlueprintButton projectId={id} isApproved={blueprintApproved} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex shrink-0 items-center gap-0.5 border-b border-border px-6 py-2">
        <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
          <Link
            href={base}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${!isMappingTab && !isHealthTab ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Ağaç Görünümü
          </Link>
          <Link
            href={`${base}?tab=mapping`}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${isMappingTab ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Keyword Eşleme
          </Link>
          <Link
            href={`${base}?tab=health`}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${isHealthTab ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Mimari Sağlığı
          </Link>
        </div>
      </div>

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
        title="Blueprint Yönetimi"
        managerName="Blueprint Mimarı"
        hint="Site ağacını yönetir, sayfa önceliklerini belirler, iç link mantığını denetler ve içerik üretimine geçiş kararı verir."
        contextItems={panelContextItems}
        nextStep={panelNextStep}
        actions={panelActions}
      />

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-10">
        {isHealthTab ? (
          <ArchHealthPanel projectId={id} />
        ) : isMappingTab ? (
          <KeywordMappingTab mappedPages={mappedPages} unmappedKeywords={unmappedKeywords} />
        ) : (
          <>
            {/* Site Ağacı */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Site Ağacı</h2>
                {/* View toggle */}
                <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
                  <Link
                    href={`${base}${isTreeView ? '' : '?view=list'}`}
                    className={cn(
                      'flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors',
                      !isTreeView ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span>&#9776;</span> Liste
                  </Link>
                  <Link
                    href={`${base}?view=tree`}
                    className={cn(
                      'flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors',
                      isTreeView ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span>&#127794;</span> Agac
                  </Link>
                </div>
              </div>

              {isTreeView ? (
                /* ---- TREE VIEW ---- */
                <div className="rounded-md border border-border overflow-hidden">
                  {flatPages.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Henüz sayfa yok. &ldquo;Sayfa Ekle&rdquo; ile başlayın.
                    </div>
                  ) : (
                    flatPages
                      .filter((page) => page.depth < 3)
                      .map((page) => {
                        const hasConflict = conflictPageIds.has(page.id)
                        const focusKw = page.focus_keyword_id
                          ? focusKeywordTextById.get(page.focus_keyword_id) ?? null
                          : null
                        const typeLabel = PAGE_TYPE_LABELS[page.page_type] ?? page.page_type
                        return (
                          <Link
                            key={page.id}
                            href={`/control-center/projects/${id}/architecture/pages?page=${page.id}`}
                            className="flex items-center gap-2 border-b border-border last:border-0 px-4 py-2.5 hover:bg-muted/30 transition-colors group"
                            style={{ paddingLeft: `${16 + page.depth * 16}px` }}
                          >
                            {page.depth > 0 && (
                              <span className="text-muted-foreground/50 text-xs shrink-0">&#8627;</span>
                            )}
                            <span className="text-sm font-normal text-foreground truncate flex-1">
                              {page.title}
                            </span>
                            {hasConflict && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 shrink-0">
                                Cakisma
                              </span>
                            )}
                            <span className="text-[11px] rounded-full border border-border bg-muted/60 px-2 py-0.5 text-muted-foreground shrink-0">
                              {typeLabel}
                            </span>
                            {focusKw && (
                              <span className="hidden sm:inline text-[11px] text-muted-foreground/60 truncate max-w-[160px] shrink-0">
                                {focusKw}
                              </span>
                            )}
                            <span className={cn('text-xs shrink-0', priorityClass(page.priority))}>
                              {page.priority}
                            </span>
                          </Link>
                        )
                      })
                  )}
                </div>
              ) : (
                /* ---- LIST VIEW (unchanged) ---- */
                <div className="rounded-md border border-border overflow-hidden">
                  <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] bg-muted/50 border-b border-border text-xs text-muted-foreground">
                    <div className="px-4 py-2">Sayfa Adı</div>
                    <div className="px-4 py-2">Slug</div>
                    <div className="px-4 py-2 w-32">Tip</div>
                    <div className="px-4 py-2 w-20">Öncelik</div>
                    <div className="px-4 py-2 w-16 text-center">Sıra</div>
                    <div className="px-4 py-2 w-16" />
                  </div>

                  {flatPages.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Henüz sayfa yok. &ldquo;Sayfa Ekle&rdquo; ile başlayın.
                    </div>
                  ) : (
                    flatPages.map((page) => {
                      const siblingList    = flatPages.filter((p) => p.parent_id === page.parent_id)
                      const siblingIndex   = siblingList.findIndex((p) => p.id === page.id)
                      const isFirstSibling = siblingIndex === 0
                      const isLastSibling  = siblingIndex === siblingList.length - 1
                      const hasConflict    = conflictPageIds.has(page.id)

                      return (
                        <div
                          key={page.id}
                          className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] border-b border-border last:border-0 items-center text-sm hover:bg-muted/30 transition-colors"
                        >
                          <div
                            className="px-4 py-2 font-normal truncate flex items-center"
                            style={{ paddingLeft: `${16 + page.depth * 20}px` }}
                          >
                            {page.depth > 0 && (
                              <span className="text-muted-foreground mr-1.5">↳</span>
                            )}
                            <span className="truncate">{page.title}</span>
                            {hasConflict && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 shrink-0">
                                ⚠ Çakışma
                              </span>
                            )}
                          </div>
                          <div className="px-4 py-2 text-muted-foreground truncate font-mono text-xs">
                            {page.slug}
                          </div>
                          <div className="px-4 py-2 w-32 text-muted-foreground truncate text-xs">
                            {page.page_type}
                          </div>
                          <div className={cn('px-4 py-2 w-20 text-xs', priorityClass(page.priority))}>
                            {page.priority}
                          </div>
                          <div className="px-2 py-2 w-16 flex items-center justify-center gap-0.5">
                            <ReorderButton pageId={page.id} projectId={id} direction="up"   disabled={isFirstSibling} />
                            <ReorderButton pageId={page.id} projectId={id} direction="down" disabled={isLastSibling} />
                          </div>
                          <div className="px-4 py-2 w-16 text-right">
                            <form
                              action={async () => {
                                'use server'
                                await deletePage(id, page.id)
                              }}
                            >
                              <Button variant="ghost" size="sm" type="submit" className="h-7 px-2 text-muted-foreground hover:text-destructive">
                                Sil
                              </Button>
                            </form>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </section>

            {/* Menüler */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Menüler</h2>
              <div className="space-y-8">
                {MENU_CONFIGS.map(({ type, title }) => (
                  <MenuEditor
                    key={type}
                    projectId={id}
                    menuType={type}
                    menuTitle={title}
                    initialItems={menuMap[type] ?? []}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
